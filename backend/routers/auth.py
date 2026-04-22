# filepath: backend/routers/auth.py
import re
import time
import uuid
import secrets
import string
from collections import defaultdict, deque
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models import SessionLocal, User

router = APIRouter(prefix="/api/auth")

RECOVERY_ALPHABET = string.ascii_uppercase + string.digits
NAME_RE = re.compile(r"^[\w\s.\-]{1,30}$", re.UNICODE)

_rate_buckets: dict[str, deque] = defaultdict(deque)
RATE_LIMIT = 5      # запросов
RATE_WINDOW = 60    # секунд


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _rate_limit(key: str):
    now = time.time()
    bucket = _rate_buckets[key]
    while bucket and now - bucket[0] > RATE_WINDOW:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Слишком много запросов, подожди минуту")
    bucket.append(now)


def _generate_recovery_code(db: Session) -> str:
    for _ in range(20):
        code = "".join(secrets.choice(RECOVERY_ALPHABET) for _ in range(6))
        if not db.query(User).filter_by(recovery_code=code).first():
            return code
    raise HTTPException(status_code=500, detail="Не удалось создать код")


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=30)


class RestoreIn(BaseModel):
    recovery_code: str = Field(min_length=6, max_length=6)


@router.post("/register")
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"register:{ip}")

    name = body.name.strip()
    if not NAME_RE.match(name):
        raise HTTPException(status_code=400, detail="Имя: 1-30 символов, только буквы/цифры/пробел/.-")

    user = User(
        id=str(uuid.uuid4()),
        name=name,
        recovery_code=_generate_recovery_code(db),
    )
    db.add(user)
    db.commit()
    return {
        "player_id": user.id,
        "name": user.name,
        "recovery_code": user.recovery_code,
    }


@router.post("/restore")
def restore(body: RestoreIn, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"restore:{ip}")

    code = body.recovery_code.strip().upper()
    user = db.query(User).filter_by(recovery_code=code).first()
    if not user:
        raise HTTPException(status_code=404, detail="Код не найден")
    return {
        "player_id": user.id,
        "name": user.name,
        "recovery_code": user.recovery_code,
    }


@router.get("/me/{player_id}")
def me(player_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(id=player_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return {
        "player_id": user.id,
        "name": user.name,
        "recovery_code": user.recovery_code,
    }
