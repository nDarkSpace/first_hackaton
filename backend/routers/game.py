# filepath: backend/routers/game.py
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models import SessionLocal, Partner, PlayerProgress, Achievement
from seed_data import hex_grid_minsk
from achievement_engine import AchievementEngine

router = APIRouter(prefix="/api")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TransactionIn(BaseModel):
    player_id: str
    merchant_name: str
    mcc_code: str
    amount: float
    currency: str = "BYN"
    timestamp: str | None = None


@router.get("/hexes/{player_id}")
def get_hexes(player_id: str, db: Session = Depends(get_db)):
    grid = hex_grid_minsk()
    unlocked_ids = {
        pp.hex_id for pp in
        db.query(PlayerProgress).filter_by(player_id=player_id).all()
    }
    partners_by_hex = {}
    for p in db.query(Partner).all():
        partners_by_hex.setdefault(p.hex_id, []).append(p)

    hexes_out = []
    for h in grid:
        hid = h["hex_id"]
        is_unlocked = hid in unlocked_ids
        partner_data = None
        if is_unlocked and partners_by_hex.get(hid):
            p = partners_by_hex[hid][0]
            partner_data = {
                "name": p.name,
                "category": p.category,
                "cashback_percent": p.cashback_percent,
            }

        hexes_out.append({
            "hex_id": hid,
            "ring": h["ring"],
            "center": {"lat": h["center_lat"], "lng": h["center_lng"]},
            "vertices": h["vertices"],
            "is_unlocked": is_unlocked,
            "partner": partner_data,
            "active_quest": None,
        })

    ach_count = db.query(Achievement).filter_by(player_id=player_id).count()

    return {
        "hexes": hexes_out,
        "stats": {
            "total": len(grid),
            "unlocked": len(unlocked_ids),
            "achievements_count": ach_count,
        },
    }


@router.post("/transaction")
def post_transaction(tx: TransactionIn, db: Session = Depends(get_db)):
    player_id = tx.player_id
    if not player_id:
        return {"hex_unlocked": None, "reward": None, "new_achievements": [], "message": "Нет player_id"}

    partner = db.query(Partner).filter_by(name=tx.merchant_name).first()
    if not partner:
        return {
            "hex_unlocked": None,
            "reward": None,
            "new_achievements": [],
            "message": f"Партнёр '{tx.merchant_name}' не найден",
        }

    target_hex = partner.hex_id
    already = db.query(PlayerProgress).filter_by(
        player_id=player_id, hex_id=target_hex
    ).first()

    hex_unlocked = None
    new_achievements = []

    if not already:
        db.add(PlayerProgress(
            player_id=player_id,
            hex_id=target_hex,
            unlocked_at=datetime.utcnow(),
            quest_type="purchase",
        ))
        db.commit()
        hex_unlocked = target_hex

        ts = datetime.utcnow()
        if tx.timestamp:
            try:
                ts = datetime.fromisoformat(tx.timestamp.replace("Z", "+00:00"))
            except Exception:
                ts = datetime.utcnow()

        event = {
            "type": "hex_unlocked",
            "hex_id": target_hex,
            "timestamp": ts,
            "mcc": tx.mcc_code,
        }
        new_achievements = AchievementEngine.check_and_award(db, player_id, event)

    reward = {
        "type": "cashback",
        "value": partner.cashback_percent,
        "label": f"{partner.cashback_percent}% кэшбэк в {partner.name}",
    }

    return {
        "hex_unlocked": hex_unlocked,
        "reward": reward,
        "new_achievements": new_achievements,
        "partner": {
            "name": partner.name,
            "category": partner.category,
            "hex_id": partner.hex_id,
        },
    }


@router.get("/partners")
def get_partners(db: Session = Depends(get_db)):
    partners = db.query(Partner).order_by(Partner.name).all()
    return {
        "partners": [
            {
                "name": p.name,
                "category": p.category,
                "mcc_code": p.mcc_code,
                "lat": p.lat,
                "lng": p.lng,
                "cashback_percent": p.cashback_percent,
                "hex_id": p.hex_id,
            }
            for p in partners
        ]
    }


@router.get("/player/{player_id}/profile")
def get_profile(player_id: str, db: Session = Depends(get_db)):
    progress = db.query(PlayerProgress).filter_by(player_id=player_id).all()
    unlocked_ids = [p.hex_id for p in progress]

    achs = db.query(Achievement).filter_by(player_id=player_id).all()
    ach_list = [
        {
            "code": a.code,
            "name": a.name,
            "description": a.description,
            "unlocked_at": a.unlocked_at.isoformat(),
        }
        for a in achs
    ]

    total = len(hex_grid_minsk())

    return {
        "player_id": player_id,
        "unlocked_hexes": unlocked_ids,
        "unlocked_count": len(unlocked_ids),
        "total_hexes": total,
        "achievements": ach_list,
        "active_quest": None,
    }
