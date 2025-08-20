#!/usr/bin/env python3
"""
Migration script to apply database indexes and performance optimizations.
Run this after the main schema migration.
"""

import asyncio
import os
from pathlib import Path
from app.deps import execute
import dotenv

# Load environment variables
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    dotenv.load_dotenv(env_path)

async def run_sql_file(file_path: Path):
    """Execute SQL commands from a file."""
    print(f"Executing {file_path.name}...")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Split by semicolon and execute each statement
        statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
        
        for stmt in statements:
            if stmt.upper().startswith(('CREATE', 'ALTER', 'ANALYZE', 'UPDATE')):
                try:
                    await execute(stmt, [])
                    print(f"  ✓ Executed: {stmt[:50]}...")
                except Exception as e:
                    print(f"  ✗ Failed: {stmt[:50]}... - {e}")
                    # Continue with other statements
        
        print(f"✓ Completed {file_path.name}")
        return True
        
    except Exception as e:
        print(f"✗ Failed to execute {file_path.name}: {e}")
        return False

async def main():
    print("🚀 Starting database index migration...")
    
    # Get migration files
    migrations_dir = Path(__file__).parent / ".." / ".." / "infra" / "migrations"
    migration_files = [
        migrations_dir / "002_indexes.sql",
        migrations_dir / "003_performance.sql",
    ]
    
    # Check files exist
    for file_path in migration_files:
        if not file_path.exists():
            print(f"✗ Migration file not found: {file_path}")
            return
    
    # Execute migrations
    success_count = 0
    for file_path in migration_files:
        if await run_sql_file(file_path):
            success_count += 1
    
    print(f"\n🎯 Migration complete: {success_count}/{len(migration_files)} files executed successfully")
    
    # Show index summary
    print("\n📊 Checking created indexes...")
    try:
        indexes = await execute("SHOW INDEX FROM corp_docs", [])
        print(f"corp_docs indexes: {len(indexes)}")
        
        indexes = await execute("SHOW INDEX FROM reg_texts", [])
        print(f"reg_texts indexes: {len(indexes)}")
        
        indexes = await execute("SHOW INDEX FROM mappings", [])
        print(f"mappings indexes: {len(indexes)}")
        
    except Exception as e:
        print(f"Could not retrieve index info: {e}")

if __name__ == "__main__":
    asyncio.run(main())