#!/usr/bin/env python3
"""
SQLite setup for LexMind development - creates a local database file
"""

import sqlite3
import os
import sys
from pathlib import Path

def setup_sqlite_db():
    """Create SQLite database with required tables"""
    try:
        # Create database file in the API directory
        db_path = Path(__file__).parent / "lexmind.db"
        print(f"Creating SQLite database at: {db_path}")
        
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Create corp_docs table (simplified without vector types)
        print("Creating corp_docs table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS corp_docs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT,
                chunk_idx INTEGER,
                content TEXT,
                embedding_placeholder TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create reg_texts table
        print("Creating reg_texts table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reg_texts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT,
                title TEXT,
                section TEXT,
                text TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create users table
        print("Creating users table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT,
                hashed_password TEXT NOT NULL,
                role TEXT DEFAULT 'viewer' CHECK (role IN ('viewer', 'analyst', 'admin')),
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert admin user if it doesn't exist
        cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
        result = cursor.fetchone()
        if result[0] == 0:
            print("Creating admin user...")
            # Password: admin123
            hashed_password = "$2b$12$HmS7kqggd17ods25o6SAx.lUg0GDLv1fzvRnzYjlPKJEzmUCH2jX2"
            cursor.execute("""
                INSERT INTO users (username, email, hashed_password, role, is_active)
                VALUES ('admin', 'admin@lexmind.com', ?, 'admin', TRUE)
            """, [hashed_password])
            print("Admin user created with password: admin123")
        
        # Create documents_meta table
        print("Creating documents_meta table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents_meta (
                path TEXT PRIMARY KEY,
                display_name TEXT,
                description TEXT,
                resolved BOOLEAN DEFAULT FALSE,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
        
        print("Database setup completed successfully!")
        print("Summary:")
        print("   - SQLite database created")
        print("   - corp_docs table created (simplified schema)")
        print("   - reg_texts table created") 
        print("   - users table created")
        print("   - documents_meta table created")
        print("   - Admin user: admin/admin123")
        print(f"   - Database file: {db_path}")
        
        # Create .env update instructions
        print("\nTo use this database, update your .env file:")
        print("TIDB_HOST=sqlite")
        print(f"TIDB_DATABASE={db_path}")
        
        return True
        
    except Exception as e:
        print(f"Error setting up database: {e}")
        return False

if __name__ == "__main__":
    print("LexMind SQLite Database Setup Tool")
    print("=" * 40)
    
    success = setup_sqlite_db()
    if success:
        print("\nDatabase is ready!")
        print("You can now upload documents.")
    else:
        print("\nDatabase setup failed.")
        sys.exit(1)