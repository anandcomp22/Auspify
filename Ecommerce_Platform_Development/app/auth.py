import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from fastapi import Depends, HTTPException, Security, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User, SessionToken

security_bearer = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=4)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_session(db: Session, user_id: int) -> SessionToken:
    token = secrets.token_hex(32)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=settings.TOKEN_EXPIRE_HOURS)
    session_obj = SessionToken(
        token=token,
        user_id=user_id,
        created_at=now,
        expires_at=expires
    )
    db.add(session_obj)
    db.commit()
    db.refresh(session_obj)
    return session_obj

def delete_session(db: Session, token: str) -> bool:
    session_obj = db.query(SessionToken).filter(SessionToken.token == token).first()
    if session_obj:
        db.delete(session_obj)
        db.commit()
        return True
    return False

def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: Session = Depends(get_db)
) -> Optional[User]:
    token = None
    if credentials:
        token = credentials.credentials
    elif "session_token" in request.cookies:
        token = request.cookies.get("session_token")
    elif "authorization" in request.headers:
        hdr = request.headers["authorization"]
        if hdr.startswith("Bearer "):
            token = hdr[7:].strip()

    if not token:
        return None

    session_obj = db.query(SessionToken).filter(SessionToken.token == token).first()
    if not session_obj:
        return None

    now = datetime.now(timezone.utc)
    session_expires = session_obj.expires_at
    if session_expires.tzinfo is None:
        session_expires = session_expires.replace(tzinfo=timezone.utc)

    if session_expires < now:
        db.delete(session_obj)
        db.commit()
        return None

    return session_obj.user

def get_current_user(
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> User:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication session required or expired",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return current_user

def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required for this operation"
        )
    return current_user
