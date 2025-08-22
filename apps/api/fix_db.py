#!/usr/bin/env python3
"""
Quick database fix for LexMind - creates missing tables if they don't exist
"""

import os
import sys
import asyncio
import aiomysql
from dotenv import load_dotenv

load_dotenv()

async def fix_database():
    """Create missing tables and fix schema issues"""
    try:
        # Connect to MySQL/TiDB
        conn = await aiomysql.connect(
            host=os.getenv("TIDB_HOST", "127.0.0.1"),
            port=int(os.getenv("TIDB_PORT", "4000")),
            user=os.getenv("TIDB_USER", "root"),
            password=os.getenv("TIDB_PASSWORD", ""),
            autocommit=True
        )
        cursor = await conn.cursor()
        
        # Create database if it doesn't exist
        db_name = os.getenv("TIDB_DATABASE", "lexmind")
        print(f"Creating database {db_name} if it doesn't exist...")
        await cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        await cursor.execute(f"USE {db_name}")
        
        # Create corp_docs table with simplified schema (no vector for now)
        print("Creating corp_docs table...")
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS corp_docs (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                path VARCHAR(255),
                chunk_idx INT,
                content TEXT,
                embedding_placeholder TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create reg_texts table
        print("Creating reg_texts table...")
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS reg_texts (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                source VARCHAR(255),
                title VARCHAR(255),
                section VARCHAR(255),
                text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FULLTEXT INDEX fts_text (text)
            )
        """)
        
        # Create other necessary tables
        print("Creating additional tables...")
        
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255),
                hashed_password VARCHAR(255) NOT NULL,
                role ENUM('viewer', 'analyst', 'admin') DEFAULT 'viewer',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert admin user if it doesn't exist
        await cursor.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
        result = await cursor.fetchone()
        if result[0] == 0:
            print("Creating admin user...")
            # Password: admin123
            hashed_password = "$2b$12$HmS7kqggd17ods25o6SAx.lUg0GDLv1fzvRnzYjlPKJEzmUCH2jX2"
            await cursor.execute("""
                INSERT INTO users (username, email, hashed_password, role, is_active)
                VALUES ('admin', 'admin@lexmind.com', %s, 'admin', TRUE)
            """, [hashed_password])
            print("Admin user created with password: admin123")
        
        await cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents_meta (
                path VARCHAR(255) PRIMARY KEY,
                display_name VARCHAR(255),
                description TEXT,
                resolved BOOLEAN DEFAULT FALSE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        
        await cursor.close()
        conn.close()
        
        print("Database setup completed successfully!")
        print("Summary:")
        print("   - Database created")
        print("   - corp_docs table created (simplified schema)")
        print("   - reg_texts table created") 
        print("   - users table created")
        print("   - documents_meta table created")
        print("   - Admin user: admin/admin123")
        
    except Exception as e:
        print(f"Error setting up database: {e}")
        print("Make sure you have MySQL/MariaDB running on localhost:3306")
        print("   or TiDB running on localhost:4000")
        return False
    
    return True

if __name__ == "__main__":
    print("LexMind Database Fix Tool")
    print("=" * 40)
    
    success = asyncio.run(fix_database())
    if success:
        print("\nDatabase is ready!")
        print("You can now upload documents without the embedding error.")
    else:
        print("\nDatabase setup failed.")
        print("Please check your database connection and try again.")
        sys.exit(1)