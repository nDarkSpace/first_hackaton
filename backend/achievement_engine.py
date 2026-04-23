# filepath: backend/achievement_engine.py
"""Новая система ачивок с промокодами (Reward).

Триггеры:
  - hex_unlocked        — при открытии территории (после consume)
  - transaction_consumed — при подтверждении транзакции (есть сумма, партнёр)
"""
import secrets
import string
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from models import Achievement, PlayerProgress, Partner, PendingTransaction, Reward

HEX_TTL = timedelta(days=7)
REWARD_TTL = timedelta(days=30)


def _gen_promo_code(prefix: str) -> str:
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(6))
    return f"{prefix}-{suffix}"


def _grant(session: Session, player_id: str, ach_code: str, ach_name: str,
           ach_desc: str, reward_spec: dict) -> dict | None:
    """Выдаёт ачивку (если ещё не выдана) + промокод. Возвращает dict или None."""
    existing = session.query(Achievement).filter_by(
        player_id=player_id, code=ach_code
    ).first()
    if existing:
        return None

    ach = Achievement(
        player_id=player_id,
        code=ach_code,
        name=ach_name,
        description=ach_desc,
        unlocked_at=datetime.utcnow(),
    )
    session.add(ach)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        return None

    reward = Reward(
        player_id=player_id,
        source_code=ach_code,
        code=_gen_promo_code(reward_spec.get("prefix", "MT")),
        title=reward_spec["title"],
        description=reward_spec["description"],
        reward_type=reward_spec["reward_type"],
        value=float(reward_spec.get("value", 0.0)),
        scope=reward_spec.get("scope"),
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + REWARD_TTL,
    )
    session.add(reward)
    try:
        session.commit()
        session.refresh(ach)
        session.refresh(reward)
    except IntegrityError:
        session.rollback()
        return None

    return {
        "code": ach.code,
        "name": ach.name,
        "description": ach.description,
        "reward_label": reward.title,
        "unlocked_at": ach.unlocked_at.isoformat(),
        "reward": {
            "id": reward.id,
            "code": reward.code,
            "title": reward.title,
            "description": reward.description,
            "reward_type": reward.reward_type,
            "value": reward.value,
            "scope": reward.scope,
            "expires_at": reward.expires_at.isoformat(),
        },
    }


# -------- вспомогательные выборки --------

def _active_progress(session: Session, player_id: str) -> list[PlayerProgress]:
    cutoff = datetime.utcnow() - HEX_TTL
    return (
        session.query(PlayerProgress)
        .filter(PlayerProgress.player_id == player_id)
        .filter(PlayerProgress.unlocked_at >= cutoff)
        .all()
    )


def _active_hex_ids(session: Session, player_id: str) -> set[str]:
    return {pp.hex_id for pp in _active_progress(session, player_id)}


# -------- геометрия по axial --------

# 6 соседей в axial-координатах (pointy-top, odd-r — но мы храним axial q,r)
AXIAL_DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1)]


def _axial_map(grid):
    """qr -> hex_id, hex_id -> qr."""
    qr_to_id = {(h["q"], h["r"]): h["hex_id"] for h in grid if h.get("q") is not None}
    id_to_qr = {v: k for k, v in qr_to_id.items()}
    return qr_to_id, id_to_qr


def _check_neighbour_ring(active: set[str], qr_to_id, id_to_qr) -> list[str]:
    """Возвращает список уникальных hex_id-центров, у которых все 6 соседей + сам центр активны."""
    hits = []
    for hid in active:
        if hid not in id_to_qr:
            continue
        q, r = id_to_qr[hid]
        all_neighbours_present = True
        for dq, dr in AXIAL_DIRS:
            n_id = qr_to_id.get((q + dq, r + dr))
            if not n_id or n_id not in active:
                all_neighbours_present = False
                break
        if all_neighbours_present:
            hits.append(hid)
    return hits


def _check_line(active: set[str], qr_to_id, id_to_qr, length: int = 4) -> list[tuple]:
    """Ищет непрерывные отрезки длиной >= length по трём осям.
    Возвращает список кортежей (axis, start_qr) — уникальные стартовые точки отрезков."""
    hits = []
    active_qr = {id_to_qr[h] for h in active if h in id_to_qr}
    seen_segments = set()
    for (q, r) in active_qr:
        for dq, dr in [(1, 0), (0, 1), (1, -1)]:  # три не-противоположных направления
            # старт: предыдущая точка вне active
            prev_qr = (q - dq, r - dr)
            if prev_qr in active_qr:
                continue
            # собираем цепочку
            length_here = 0
            cq, cr = q, r
            while (cq, cr) in active_qr:
                length_here += 1
                cq += dq
                cr += dr
            if length_here >= length:
                key = (q, r, dq, dr, length_here)
                if key not in seen_segments:
                    seen_segments.add(key)
                    hits.append(key)
    return hits


def _check_district(active: set[str], qr_to_id, id_to_qr, radius: int = 2) -> list[str]:
    """Центры, у которых ВСЕ гексы в радиусе <= radius по axial активны.
    Считает только центры, у которых соответствующий диск полностью лежит в сетке
    (иначе граница даст ложные срабатывания)."""
    hits = []
    for hid, (q, r) in id_to_qr.items():
        if hid not in active:
            continue
        full = True
        for dq in range(-radius, radius + 1):
            for dr in range(max(-radius, -dq - radius), min(radius, -dq + radius) + 1):
                cq, cr = q + dq, r + dr
                if (cq, cr) not in qr_to_id:
                    full = False
                    break
                if qr_to_id[(cq, cr)] not in active:
                    full = False
                    break
            if not full:
                break
        if full:
            hits.append(hid)
    return hits


# -------- основной движок --------

class AchievementEngine:

    # конфиг тиров "Активная зона"
    ACTIVE_TIERS = [
        (5,  "active_zone_5",  "Активная зона I",   "Держи 5 территорий одновременно",
         {"title": "+1% кэшбэк на след. покупку", "description": "Бонус за активность. Код действителен 30 дней.",
          "reward_type": "cashback_boost", "value": 1.0, "prefix": "ACT5"}),
        (10, "active_zone_10", "Активная зона II",  "Держи 10 территорий одновременно",
         {"title": "+2% кэшбэк на след. покупку", "description": "Код действителен 30 дней.",
          "reward_type": "cashback_boost", "value": 2.0, "prefix": "ACT10"}),
        (25, "active_zone_25", "Активная зона III", "Держи 25 территорий одновременно",
         {"title": "+3% кэшбэк на след. покупку", "description": "Код действителен 30 дней.",
          "reward_type": "cashback_boost", "value": 3.0, "prefix": "ACT25"}),
        (50, "active_zone_50", "Магистр города",    "Держи 50 территорий одновременно",
         {"title": "+5% кэшбэк на след. покупку", "description": "Код действителен 30 дней.",
          "reward_type": "cashback_boost", "value": 5.0, "prefix": "ACT50"}),
    ]

    STREAK_TIERS = [
        (3,  "streak_3",  "Серия 3 дня",  "Открывай ≥1 территории 3 дня подряд",
         {"title": "5 BYN на счёт", "description": "Серия 3 дня. Код 30 дней.",
          "reward_type": "bonus_points", "value": 5.0, "prefix": "STK3"}),
        (7,  "streak_7",  "Серия 7 дней", "Открывай ≥1 территории 7 дней подряд",
         {"title": "15 BYN на счёт", "description": "Недельная серия. Код 30 дней.",
          "reward_type": "bonus_points", "value": 15.0, "prefix": "STK7"}),
        (14, "streak_14", "Серия 14 дней", "Открывай ≥1 территории 14 дней подряд",
         {"title": "50 BYN на счёт", "description": "Двухнедельная серия. Код 30 дней.",
          "reward_type": "bonus_points", "value": 50.0, "prefix": "STK14"}),
    ]

    RESCUE_TIERS = [
        (1,  "rescue_1",  "Спасатель",     "Переоткрой 1 протухшую территорию",
         {"title": "+50 бонусных баллов", "description": "За возвращение в район.",
          "reward_type": "bonus_points", "value": 50.0, "prefix": "RSQ1"}),
        (5,  "rescue_5",  "Спасатель v2",  "Переоткрой 5 протухших территорий",
         {"title": "+200 бонусных баллов", "description": "Мастер возвращения.",
          "reward_type": "bonus_points", "value": 200.0, "prefix": "RSQ5"}),
    ]

    BIG_TX_TIERS = [
        (1,  "big_tx_1",  "Крупная покупка",   "Совершить покупку ≥ 100 BYN",
         {"title": "5% промокод на след. покупку", "description": "Код 30 дней.",
          "reward_type": "discount", "value": 5.0, "prefix": "BIG1"}),
        (5,  "big_tx_5",  "Щедрый день",       "5 покупок ≥ 100 BYN",
         {"title": "10 BYN на счёт", "description": "Код 30 дней.",
          "reward_type": "bonus_points", "value": 10.0, "prefix": "BIG5"}),
        (20, "big_tx_20", "Статус VIP",        "20 покупок ≥ 100 BYN",
         {"title": "50 BYN + статус VIP", "description": "Код 30 дней.",
          "reward_type": "bonus_points", "value": 50.0, "prefix": "BIG20"}),
    ]

    @classmethod
    def check_and_award(cls, session: Session, player_id: str, event: dict):
        """Главный вход. event содержит:
          type: hex_unlocked | transaction_consumed
          hex_id?, timestamp, mcc?, amount?, is_rescue?
        """
        from seed_data import hex_grid_minsk  # локальный импорт — избежать цикла

        new_list = []
        ev_type = event.get("type")

        # --- Активная зона: считаем прямо сейчас ---
        active = _active_hex_ids(session, player_id)
        for threshold, code, name, desc, reward in cls.ACTIVE_TIERS:
            if len(active) >= threshold:
                g = _grant(session, player_id, code, name, desc, reward)
                if g:
                    new_list.append(g)

        # --- Серия дней (по датам unlocked_at в пределах истории) ---
        streak = cls._current_streak(session, player_id)
        for threshold, code, name, desc, reward in cls.STREAK_TIERS:
            if streak >= threshold:
                g = _grant(session, player_id, code, name, desc, reward)
                if g:
                    new_list.append(g)

        # --- Спасатель ---
        if ev_type == "hex_unlocked" and event.get("is_rescue"):
            rescued = cls._rescue_count(session, player_id)
            for threshold, code, name, desc, reward in cls.RESCUE_TIERS:
                if rescued >= threshold:
                    g = _grant(session, player_id, code, name, desc, reward)
                    if g:
                        new_list.append(g)

        # --- Крупная транзакция ---
        if ev_type == "transaction_consumed":
            amount = float(event.get("amount") or 0)
            if amount >= 100:
                big_cnt = cls._big_tx_count(session, player_id)
                for threshold, code, name, desc, reward in cls.BIG_TX_TIERS:
                    if big_cnt >= threshold:
                        g = _grant(session, player_id, code, name, desc, reward)
                        if g:
                            new_list.append(g)

            # --- Бережливый (500 BYN за скользящие 7 дней) ---
            spent_7d = cls._spent_last_days(session, player_id, days=7)
            if spent_7d >= 500:
                # cooldown: не чаще одного раза в 7 дней
                last = session.query(Achievement).filter_by(
                    player_id=player_id, code="thrifty_week"
                ).first()
                if not last or (datetime.utcnow() - last.unlocked_at) >= timedelta(days=7):
                    # one-shot на код "thrifty_week_{YYYY-WW}" — чтобы работал cooldown
                    iso = datetime.utcnow().isocalendar()
                    wcode = f"thrifty_week_{iso[0]}_{iso[1]}"
                    g = _grant(session, player_id, wcode, "Бережливый",
                               "500 BYN за 7 дней",
                               {"title": "3% кэшбэк на след. покупку",
                                "description": "Недельный бонус. Код 30 дней.",
                                "reward_type": "cashback_boost", "value": 3.0, "prefix": "THR"})
                    if g:
                        new_list.append(g)

        # --- Геометрия: сосед / линия / район ---
        grid = hex_grid_minsk()
        qr_to_id, id_to_qr = _axial_map(grid)

        for center in _check_neighbour_ring(active, qr_to_id, id_to_qr):
            code = f"neighbour_ring_{center}"
            g = _grant(session, player_id, code,
                       "Сосед", f"Открой 7 гексов с центром в {center}",
                       {"title": "Бесплатное открытие соседнего гекса",
                        "description": "Используй в приложении для ручного открытия.",
                        "reward_type": "free_unlock", "value": 1.0, "prefix": "NBR"})
            if g:
                new_list.append(g)

        for seg_key in _check_line(active, qr_to_id, id_to_qr, length=4):
            q, r, dq, dr, ln = seg_key
            code = f"line_{q}_{r}_{dq}_{dr}_{ln}"
            g = _grant(session, player_id, code,
                       "Линия", f"4 гекса в ряд",
                       {"title": "3 BYN на счёт", "description": "Код 30 дней.",
                        "reward_type": "bonus_points", "value": 3.0, "prefix": "LIN"})
            if g:
                new_list.append(g)

        for center in _check_district(active, qr_to_id, id_to_qr, radius=2):
            code = f"district_{center}"
            g = _grant(session, player_id, code,
                       "Хозяин района", f"Все гексы в радиусе 2 от {center}",
                       {"title": "10% кэшбэк на след. покупку",
                        "description": "Элитный статус района. Код 30 дней.",
                        "reward_type": "cashback_boost", "value": 10.0, "prefix": "DST"})
            if g:
                new_list.append(g)

        return new_list

    # -------- счётчики --------

    @staticmethod
    def _current_streak(session: Session, player_id: str) -> int:
        rows = (
            session.query(PlayerProgress.unlocked_at)
            .filter_by(player_id=player_id)
            .all()
        )
        if not rows:
            return 0
        days = {r[0].date() for r in rows}
        today = datetime.utcnow().date()
        if today not in days and (today - timedelta(days=1)) not in days:
            return 0
        # начинаем с сегодня или вчера (если сегодня ещё не открывали)
        start = today if today in days else today - timedelta(days=1)
        streak = 0
        d = start
        while d in days:
            streak += 1
            d -= timedelta(days=1)
        return streak

    @staticmethod
    def _rescue_count(session: Session, player_id: str) -> int:
        """Счёт спасений — это quest_type='rescue' в прогрессе."""
        return (
            session.query(PlayerProgress)
            .filter_by(player_id=player_id, quest_type="rescue")
            .count()
        )

    @staticmethod
    def _big_tx_count(session: Session, player_id: str) -> int:
        return (
            session.query(PendingTransaction)
            .filter(PendingTransaction.player_id == player_id)
            .filter(PendingTransaction.consumed_at.isnot(None))
            .filter(PendingTransaction.amount >= 100)
            .count()
        )

    @staticmethod
    def _spent_last_days(session: Session, player_id: str, days: int) -> float:
        cutoff = datetime.utcnow() - timedelta(days=days)
        rows = (
            session.query(PendingTransaction.amount)
            .filter(PendingTransaction.player_id == player_id)
            .filter(PendingTransaction.consumed_at.isnot(None))
            .filter(PendingTransaction.consumed_at >= cutoff)
            .all()
        )
        return sum(float(r[0] or 0) for r in rows)
