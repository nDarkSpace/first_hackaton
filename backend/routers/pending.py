# filepath: backend/routers/pending.py
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models import SessionLocal, Partner, PendingTransaction, PlayerProgress, User, Achievement
from achievement_engine import AchievementEngine

router = APIRouter(prefix="/api")

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "demo-admin-token")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class PendingIn(BaseModel):
    player_id: str
    merchant_name: str
    amount: float = 0.0
    mcc_code: str = ""


@router.post("/pending")
def create_pending(body: PendingIn, db: Session = Depends(get_db)):
    """Создать отложенную транзакцию. Гекс не открывается до consume."""
    partner = db.query(Partner).filter_by(name=body.merchant_name).first()
    if not partner:
        raise HTTPException(status_code=404, detail=f"Партнёр '{body.merchant_name}' не найден")

    already_unlocked = db.query(PlayerProgress).filter_by(
        player_id=body.player_id, hex_id=partner.hex_id
    ).first()
    if already_unlocked:
        return {"created": False, "reason": "already_unlocked"}

    existing = db.query(PendingTransaction).filter_by(
        player_id=body.player_id,
        partner_name=partner.name,
        consumed_at=None,
    ).first()
    if existing:
        return {"created": False, "reason": "already_pending", "pending_id": existing.id}

    pt = PendingTransaction(
        player_id=body.player_id,
        partner_name=partner.name,
        amount=body.amount,
        mcc_code=body.mcc_code or partner.mcc_code,
    )
    db.add(pt)
    db.commit()
    db.refresh(pt)
    return {"created": True, "pending_id": pt.id}


@router.get("/pending/{player_id}")
def list_pending(player_id: str, db: Session = Depends(get_db)):
    items = db.query(PendingTransaction).filter_by(
        player_id=player_id, consumed_at=None
    ).order_by(PendingTransaction.created_at.desc()).all()

    names = {i.partner_name for i in items}
    partners = {
        p.name: p for p in db.query(Partner).filter(Partner.name.in_(names)).all()
    }

    out = []
    for i in items:
        p = partners.get(i.partner_name)
        if not p:
            continue
        out.append({
            "pending_id": i.id,
            "partner_name": p.name,
            "category": p.category,
            "cashback_percent": p.cashback_percent,
            "lat": p.lat,
            "lng": p.lng,
            "hex_id": p.hex_id,
            "amount": i.amount,
            "created_at": i.created_at.isoformat(),
        })
    return {"pending": out}


@router.post("/pending/{pending_id}/consume")
def consume_pending(pending_id: int, db: Session = Depends(get_db)):
    pt = db.query(PendingTransaction).filter_by(id=pending_id).first()
    if not pt:
        raise HTTPException(status_code=404, detail="Не найдено")
    if pt.consumed_at is not None:
        raise HTTPException(status_code=400, detail="Уже использовано")

    partner = db.query(Partner).filter_by(name=pt.partner_name).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Партнёр удалён")

    target_hex = partner.hex_id
    hex_unlocked = None
    new_achievements = []

    already = db.query(PlayerProgress).filter_by(
        player_id=pt.player_id, hex_id=target_hex
    ).first()
    if not already:
        db.add(PlayerProgress(
            player_id=pt.player_id,
            hex_id=target_hex,
            unlocked_at=datetime.utcnow(),
            quest_type="pending_purchase",
        ))
        hex_unlocked = target_hex
        event = {
            "type": "hex_unlocked",
            "hex_id": target_hex,
            "timestamp": datetime.utcnow(),
            "mcc": pt.mcc_code,
        }
        new_achievements = AchievementEngine.check_and_award(db, pt.player_id, event)

    pt.consumed_at = datetime.utcnow()
    db.commit()

    return {
        "hex_unlocked": hex_unlocked,
        "reward": {
            "type": "cashback",
            "value": partner.cashback_percent,
            "label": f"{partner.cashback_percent}% кэшбэк в {partner.name}",
        },
        "new_achievements": new_achievements,
        "partner": {
            "name": partner.name,
            "category": partner.category,
            "hex_id": partner.hex_id,
        },
    }


# ---------- ADMIN (вариант C) ----------

class AdminPushIn(BaseModel):
    player_id: str
    merchant_name: str
    amount: float = 0.0


def _check_admin(token: str | None):
    if not token or token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Неверный админ-токен")


@router.get("/admin/users")
def admin_users(x_admin_token: str | None = Header(default=None), db: Session = Depends(get_db)):
    _check_admin(x_admin_token)
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {
        "users": [
            {
                "player_id": u.id,
                "name": u.name,
                "recovery_code": u.recovery_code,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ]
    }


@router.post("/admin/push")
def admin_push(
    body: AdminPushIn,
    x_admin_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Админ от имени банка создаёт pending-транзакцию произвольному игроку."""
    _check_admin(x_admin_token)
    user = db.query(User).filter_by(id=body.player_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Игрок не найден")

    partner = db.query(Partner).filter_by(name=body.merchant_name).first()
    if not partner:
        raise HTTPException(status_code=404, detail="Партнёр не найден")

    already_unlocked = db.query(PlayerProgress).filter_by(
        player_id=body.player_id, hex_id=partner.hex_id
    ).first()
    if already_unlocked:
        return {"created": False, "reason": "already_unlocked"}

    existing = db.query(PendingTransaction).filter_by(
        player_id=body.player_id,
        partner_name=partner.name,
        consumed_at=None,
    ).first()
    if existing:
        return {"created": False, "reason": "already_pending", "pending_id": existing.id}

    pt = PendingTransaction(
        player_id=body.player_id,
        partner_name=partner.name,
        amount=body.amount,
        mcc_code=partner.mcc_code,
    )
    db.add(pt)
    db.commit()
    db.refresh(pt)
    return {"created": True, "pending_id": pt.id}
