#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(__file__))

from app.sqlite_deps import execute

# Test database connection
try:
    rows = execute("SELECT * FROM users WHERE username = ?", ["admin"])
    print("Database query successful:")
    for row in rows:
        print(f"  {row}")
except Exception as e:
    print(f"Database error: {e}")

# Test password verification
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    if rows:
        stored_hash = rows[0]["hashed_password"]
        test_password = "admin123"
        result = pwd_context.verify(test_password, stored_hash)
        print(f"Password verification for '{test_password}': {result}")
except Exception as e:
    print(f"Password verification error: {e}")

# Test JWT creation
try:
    from app.auth import create_access_token
    token = create_access_token({"sub": "admin", "role": "admin"})
    print(f"JWT token created: {token[:20]}...")
except Exception as e:
    print(f"JWT creation error: {e}")