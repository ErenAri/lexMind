#!/usr/bin/env python3
"""
Debug authentication server
"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import traceback

# Use SQLite deps
from app.sqlite_deps import execute
from app.auth import authenticate_user, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta

app = FastAPI(title="Debug Auth Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Token(BaseModel):
    access_token: str
    token_type: str

@app.get("/")
async def root():
    return {"message": "Debug Auth Server Running"}

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        print(f"Login attempt: username={form_data.username}")
        
        # Test database connection
        try:
            users = execute("SELECT username FROM users LIMIT 1")
            print(f"Database test: {len(users)} users found")
        except Exception as e:
            print(f"Database error: {e}")
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        # Test authentication
        user = await authenticate_user(form_data.username, form_data.password)
        print(f"Authentication result: {user is not None}")
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Test token creation
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
        )
        print(f"Token created successfully")
        
        return {"access_token": access_token, "token_type": "bearer"}
        
    except Exception as e:
        print(f"Login error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)