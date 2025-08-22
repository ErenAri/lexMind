from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class User(BaseModel):
    username: str
    email: Optional[str] = None
    role: str = "viewer"
    is_active: bool = True

class UserInDB(User):
    hashed_password: str

# Database-based user management (replaces fake_users_db)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def get_user_sync(username: str) -> Optional[UserInDB]:
    from .sqlite_deps import execute
    sql = "SELECT id, username, email, hashed_password, role, is_active FROM users WHERE username = ? AND is_active = 1"
    rows = execute(sql, [username])
    if not rows:
        return None
    
    row = rows[0]
    return UserInDB(
        username=row["username"],
        email=row["email"] or "",
        hashed_password=row["hashed_password"],
        role=row["role"],
        is_active=bool(row["is_active"])
    )

async def get_user(username: str) -> Optional[UserInDB]:
    return get_user_sync(username)

def authenticate_user_sync(username: str, password: str) -> Optional[UserInDB]:
    user = get_user_sync(username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    
    # Update last_login timestamp
    from .sqlite_deps import execute
    execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE username = ?", [username])
    
    return user

async def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    return authenticate_user_sync(username, password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not isinstance(sub, str) or not sub:
            raise credentials_exception
        username = sub
    except JWTError:
        raise credentials_exception
    
    user = await get_user(username=username)
    if user is None:
        raise credentials_exception
    return User(username=user.username, email=user.email, role=user.role, is_active=user.is_active)

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_role(allowed_roles: list[str]):
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted"
            )
        return current_user
    return role_checker

# Legacy compatibility function for existing endpoints
def _require_role_legacy(request, allowed: list[str]) -> None:
    """Legacy function for compatibility with existing endpoints"""
    role = request.headers.get("x-role", "viewer").lower()
    if role not in allowed:
        raise HTTPException(status_code=403, detail="forbidden")