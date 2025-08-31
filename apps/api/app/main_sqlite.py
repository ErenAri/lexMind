"""
LexMind API - SQLite version for development
This version works without vector embeddings and TiDB
"""

import os
import io
import re
import json
import hashlib
from pathlib import Path
import dotenv
from typing import Optional
from urllib.parse import unquote
from fastapi import FastAPI, HTTPException, UploadFile, File, Body, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime, timedelta
import PyPDF2
from pydantic import BaseModel, validator, Field
import logging

# Import existing dependencies but use SQLite
from .sqlite_deps import execute
from .auth import (
    authenticate_user, create_access_token, get_current_user, 
    ACCESS_TOKEN_EXPIRE_MINUTES, Token, User, get_password_hash
)

app = FastAPI(title="LexMind API (SQLite)")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load .env for local development (e.g., SLACK_WEBHOOK_URL)
dotenv.load_dotenv(str((Path(__file__).parent / ".." / ".env").resolve()))

# Simple CORS setup for development
cors_origins = [
    "http://localhost:3000",
    "http://localhost:3001", 
    "http://localhost:3002", 
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

class OkOut(BaseModel):
    ok: bool

class RegIn(BaseModel):
    source: str = Field(..., min_length=1, max_length=100, description="Source of the regulation")
    title: str = Field(..., min_length=1, max_length=500, description="Title of the regulation")
    section: str = Field(..., min_length=1, max_length=200, description="Section identifier")
    text: str = Field(..., min_length=10, max_length=100000, description="Content of the regulation")

    @validator('text')
    def validate_text_content(cls, v):
        if len(v.strip()) < 10:
            raise ValueError('Text content must be at least 10 characters long')
        return v.strip()

    @validator('title', 'section')
    def validate_no_html(cls, v):
        if '<' in v or '>' in v:
            raise ValueError('HTML tags are not allowed')
        return v.strip()

class DocIn(BaseModel):
    path: str = Field(..., min_length=1, max_length=500, description="Document path")
    chunk_idx: int = Field(..., ge=0, description="Chunk index (0-based)")
    content: str = Field(..., min_length=10, max_length=50000, description="Document chunk content")

    @validator('content')
    def validate_content(cls, v):
        if len(v.strip()) < 10:
            raise ValueError('Content must be at least 10 characters long')
        return v.strip()

    @validator('path')
    def validate_path(cls, v):
        # Basic path sanitization
        invalid_chars = ['<', '>', '|', '*', '?', '"']
        for char in invalid_chars:
            if char in v:
                raise ValueError(f'Invalid character "{char}" in path')
        return v.strip()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.get("/")
async def root():
    return {"message": "LexMind API (SQLite) - Ready to accept uploads!"}

# Authentication endpoints
@app.post("/token", response_model=Token)
async def login_for_access_token(
    username: str = Form(...),
    password: str = Form(...),
    remember_me: bool = Form(False)
):
    user = await authenticate_user(username, password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create token with different expiration based on remember_me
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, 
        remember_me=remember_me
    )
    
    # Log the login for security/audit purposes
    logger.info(f"User {username} logged in (remember_me: {remember_me})")
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/ingest/reg", response_model=OkOut)
async def ingest_reg(item: RegIn):
    """Ingest regulation text with enhanced validation"""
    try:
        logger.info(f"Ingesting regulation: {item.title[:50]}...")
        
        # Check for duplicates
        existing_sql = "SELECT COUNT(*) as count FROM reg_texts WHERE title = ? AND section = ?"
        existing = execute(existing_sql, [item.title, item.section])
        if existing and existing[0]['count'] > 0:
            logger.warning(f"Duplicate regulation detected: {item.title}")
            raise HTTPException(
                status_code=409, 
                detail=f"Regulation with title '{item.title}' and section '{item.section}' already exists"
            )
        
        # Insert new regulation
        sql = """
        INSERT INTO reg_texts(source, title, section, text, created_at) 
        VALUES(?, ?, ?, ?, datetime('now'))
        """
        execute(sql, [item.source, item.title, item.section, item.text])
        logger.info(f"Successfully ingested regulation: {item.title}")
        return {"ok": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to ingest regulation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to ingest regulation: {str(e)}")

@app.post("/ingest/doc", response_model=OkOut)
async def ingest_doc(item: DocIn):
    """Ingest document chunk with enhanced validation"""
    try:
        logger.info(f"Ingesting document chunk: {item.path} (chunk {item.chunk_idx})")
        
        # Validate chunk sequence (chunks should be sequential for a given path)
        if item.chunk_idx > 0:
            prev_chunk_sql = "SELECT COUNT(*) as count FROM corp_docs WHERE path = ? AND chunk_idx = ?"
            prev_chunk = execute(prev_chunk_sql, [item.path, item.chunk_idx - 1])
            if not prev_chunk or prev_chunk[0]['count'] == 0:
                logger.warning(f"Missing previous chunk for {item.path} at index {item.chunk_idx - 1}")
                # Don't fail, just log warning - chunks might be uploaded out of order
        
        # Check for duplicate chunks
        existing_sql = "SELECT COUNT(*) as count FROM corp_docs WHERE path = ? AND chunk_idx = ?"
        existing = execute(existing_sql, [item.path, item.chunk_idx])
        if existing and existing[0]['count'] > 0:
            logger.warning(f"Updating existing chunk: {item.path}[{item.chunk_idx}]")
            # Update existing chunk instead of creating duplicate
            update_sql = """
            UPDATE corp_docs SET content = ?, embedding_placeholder = ?, last_updated = datetime('now')
            WHERE path = ? AND chunk_idx = ?
            """
            execute(update_sql, [item.content, "placeholder_embedding", item.path, item.chunk_idx])
        else:
            # Insert new chunk
            sql = """
            INSERT INTO corp_docs(path, chunk_idx, content, embedding_placeholder, created_at) 
            VALUES(?, ?, ?, ?, datetime('now'))
            """
            execute(sql, [item.path, item.chunk_idx, item.content, "placeholder_embedding"])
        
        logger.info(f"Successfully ingested document chunk: {item.path}[{item.chunk_idx}]")
        return {"ok": True}
        
    except Exception as e:
        logger.error(f"Failed to ingest document chunk: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to ingest document chunk: {str(e)}")

@app.post("/ingest/pdf", response_model=OkOut)
async def ingest_pdf(
    file: UploadFile = File(...),
    doc_type: str = Body(..., embed=True)  # "reg" or "doc"
):
    """Ingest PDF file with enhanced validation and error handling"""
    # Validation
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF (.pdf extension)")
    
    if doc_type not in ["reg", "doc"]:
        raise HTTPException(status_code=400, detail="doc_type must be either 'reg' or 'doc'")
    
    # File size validation (25MB limit)
    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    try:
        logger.info(f"Processing PDF: {file.filename} as {doc_type}")
        
        # Read PDF content
        pdf_content = await file.read()
        
        if len(pdf_content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        if len(pdf_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413, 
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Parse PDF
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        except Exception as pdf_error:
            logger.error(f"Failed to parse PDF: {pdf_error}")
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid PDF file or corrupted: {str(pdf_error)}"
            )
        
        if len(pdf_reader.pages) == 0:
            raise HTTPException(status_code=400, detail="PDF file has no pages")
        
        # Extract text from all pages
        text_content = ""
        extracted_pages = 0
        for i, page in enumerate(pdf_reader.pages):
            try:
                page_text = page.extract_text()
                if page_text.strip():
                    text_content += page_text + "\n"
                    extracted_pages += 1
            except Exception as page_error:
                logger.warning(f"Failed to extract text from page {i+1}: {page_error}")
                continue
        
        if not text_content.strip():
            raise HTTPException(
                status_code=400, 
                detail="Could not extract any readable text from PDF. The file may be image-based or corrupted."
            )
        
        if len(text_content.strip()) < 50:
            raise HTTPException(
                status_code=400, 
                detail="Extracted text is too short. PDF may not contain sufficient readable content."
            )
        
        logger.info(f"Extracted {len(text_content)} characters from {extracted_pages} pages")
        
        # Process based on document type
        if doc_type == "reg":
            # Check for duplicates
            section = re.sub(r'[^a-zA-Z0-9\s]', ' ', file.filename.replace('.pdf', ''))
            existing_sql = "SELECT COUNT(*) as count FROM reg_texts WHERE title = ? AND section = ?"
            existing = execute(existing_sql, [file.filename, section])
            if existing and existing[0]['count'] > 0:
                raise HTTPException(
                    status_code=409, 
                    detail=f"Regulation with filename '{file.filename}' already exists"
                )
            
            # Insert as regulation
            sql = """
            INSERT INTO reg_texts(source, title, section, text, created_at) 
            VALUES(?, ?, ?, ?, datetime('now'))
            """
            execute(sql, ["pdf_upload", file.filename, section, text_content])
            logger.info(f"Successfully ingested PDF regulation: {file.filename}")
            
        else:
            # Split into chunks and ingest as document
            chunks = _split_semantic_chunks(text_content)
            
            if len(chunks) == 0:
                raise HTTPException(status_code=400, detail="Failed to create document chunks")
            
            # Check if document already exists and remove old chunks
            existing_sql = "SELECT COUNT(*) as count FROM corp_docs WHERE path = ?"
            existing = execute(existing_sql, [file.filename])
            if existing and existing[0]['count'] > 0:
                logger.info(f"Replacing existing document: {file.filename}")
                delete_sql = "DELETE FROM corp_docs WHERE path = ?"
                execute(delete_sql, [file.filename])
            
            # Insert new chunks
            for i, chunk in enumerate(chunks):
                if len(chunk.strip()) < 10:  # Skip very small chunks
                    continue
                sql = """
                INSERT INTO corp_docs(path, chunk_idx, content, embedding_placeholder, created_at) 
                VALUES(?, ?, ?, ?, datetime('now'))
                """
                execute(sql, [file.filename, i, chunk, "placeholder_embedding"])
            
            logger.info(f"Successfully ingested PDF document: {file.filename} ({len(chunks)} chunks)")
        
        return {"ok": True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error processing PDF {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")

def _split_semantic_chunks(text: str, target: int = 1000, overlap: int = 120) -> list[str]:
    """Split text into semantic chunks"""
    chunks = []
    current = ""
    sentences = text.split('. ')
    
    for sentence in sentences:
        if len(current) + len(sentence) + 2 > target and current:
            chunks.append(current.strip())
            # Keep overlap
            words = current.split()
            if len(words) > overlap // 5:  # Rough estimate
                current = ' '.join(words[-(overlap // 5):]) + '. ' + sentence
            else:
                current = sentence
        else:
            current += ('. ' if current else '') + sentence
    
    if current:
        chunks.append(current.strip())
    
    return chunks

def _ensure_metadata_tables() -> None:
    """Create lightweight metadata/draft tables if they don't exist."""
    try:
        execute(
            """
            CREATE TABLE IF NOT EXISTS doc_metadata (
                path TEXT PRIMARY KEY,
                display_name TEXT,
                description TEXT,
                tags TEXT,
                type TEXT,
                version INTEGER DEFAULT 1,
                last_modified TEXT,
                is_favorite INTEGER DEFAULT 0
            )
            """
        )
        execute(
            """
            CREATE TABLE IF NOT EXISTS doc_drafts (
                path TEXT PRIMARY KEY,
                content TEXT,
                updated_at TEXT
            )
            """
        )
    except Exception as e:
        logger.warning(f"Failed ensuring metadata tables: {e}")

def _ensure_versions_table() -> None:
    try:
        execute(
            """
            CREATE TABLE IF NOT EXISTS doc_versions (
                path TEXT,
                version_number INTEGER,
                content TEXT,
                created_by TEXT,
                created_at TEXT,
                PRIMARY KEY(path, version_number)
            )
            """
        )
    except Exception as e:
        logger.warning(f"Failed ensuring versions table: {e}")

def _ensure_collaboration_tables() -> None:
    try:
        execute(
            """
            CREATE TABLE IF NOT EXISTS doc_collaborators (
                path TEXT,
                user_id TEXT,
                role TEXT,
                added_at TEXT,
                PRIMARY KEY(path, user_id)
            )
            """
        )
        execute(
            """
            CREATE TABLE IF NOT EXISTS doc_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT,
                user_id TEXT,
                content TEXT,
                created_at TEXT
            )
            """
        )
    except Exception as e:
        logger.warning(f"Failed ensuring collaboration tables: {e}")

def _fetch_document_library(include_preview: bool = False, favorites_only: bool = False, limit: Optional[int] = None) -> list[dict]:
    """Build unified document library list from corp_docs + reg_texts joined with doc_metadata."""
    _ensure_metadata_tables()

    # Corporate documents aggregate
    docs_sql = """
    SELECT d.path as path,
           MIN(d.created_at) as first_seen,
           MAX(d.created_at) as last_seen,
           COUNT(*) as chunks,
           SUM(LENGTH(COALESCE(d.content, ''))) as bytes,
           dm.display_name as md_display_name,
           dm.description as md_description,
           dm.tags as md_tags,
           dm.version as md_version,
           dm.is_favorite as md_favorite,
           dm.last_modified as md_last_modified
    FROM corp_docs d
    LEFT JOIN doc_metadata dm ON dm.path = d.path
    GROUP BY d.path
    """

    doc_rows = execute(docs_sql) or []

    # Optionally fetch previews for docs: first chunk
    previews: dict[str, str] = {}
    if include_preview and doc_rows:
        try:
            prev_sql = """
            SELECT x.path, x.content
            FROM (
                SELECT path, content, ROW_NUMBER() OVER (PARTITION BY path ORDER BY chunk_idx) as rn
                FROM corp_docs
            ) x
            WHERE x.rn = 1
            """
            for r in execute(prev_sql) or []:
                previews[r["path"]] = (r.get("content") or "")
        except Exception:
            pass

    items: list[dict] = []

    for r in doc_rows:
        path = r["path"]
        display_name = r.get("md_display_name") or (path.split("/")[-1] if "/" in path else path)
        description = r.get("md_description")
        tags = []
        try:
            if r.get("md_tags"):
                tags = json.loads(r["md_tags"]) or []
        except Exception:
            tags = []
        is_favorite = bool(r.get("md_favorite") or 0)
        version = int(r.get("md_version") or 1)
        content_preview = None
        if include_preview:
            content_preview = (previews.get(path) or "")[:600]

        item = {
            "id": path,
            "path": path,
            "display_name": display_name,
            "description": description,
            "content_preview": content_preview,
            "type": "doc",
            "category": "general",
            "tags": tags,
            "first_seen": r.get("first_seen"),
            "last_seen": r.get("last_seen"),
            "last_accessed": r.get("md_last_modified") or r.get("last_seen"),
            "access_count": 0,
            "chunks": int(r.get("chunks") or 1),
            "file_size": int(r.get("bytes") or 0),
            "is_favorite": is_favorite,
            "version": version,
            "status": "active",
        }

        if favorites_only and not is_favorite:
            continue
        items.append(item)

    # Regulations
    regs_sql = """
    SELECT 'reg:' || rt.title as path,
           rt.title as title,
           rt.section as section,
           rt.text as text,
           rt.created_at as created_at,
           dm.display_name as md_display_name,
           dm.description as md_description,
           dm.tags as md_tags,
           dm.version as md_version,
           dm.is_favorite as md_favorite,
           dm.last_modified as md_last_modified
    FROM reg_texts rt
    LEFT JOIN doc_metadata dm ON dm.path = 'reg:' || rt.title
    """
    reg_rows = execute(regs_sql) or []

    for r in reg_rows:
        path = r["path"]
        display_name = r.get("md_display_name") or r.get("title") or path[4:]
        description = r.get("md_description") or (f"Section: {r.get('section')}" if r.get("section") else None)
        tags = []
        try:
            if r.get("md_tags"):
                tags = json.loads(r["md_tags"]) or []
        except Exception:
            tags = []
        is_favorite = bool(r.get("md_favorite") or 0)
        version = int(r.get("md_version") or 1)
        content_preview = None
        if include_preview:
            content_preview = (r.get("text") or "")[:600]

        item = {
            "id": path,
            "path": path,
            "display_name": display_name,
            "description": description,
            "content_preview": content_preview,
            "type": "reg",
            "category": "regulation",
            "tags": tags,
            "first_seen": r.get("created_at"),
            "last_seen": r.get("created_at"),
            "last_accessed": r.get("md_last_modified") or r.get("created_at"),
            "access_count": 0,
            "chunks": 1,
            "file_size": len((r.get("text") or "").encode("utf-8")),
            "is_favorite": is_favorite,
            "version": version,
            "status": "active",
        }

        if favorites_only and not is_favorite:
            continue
        items.append(item)

    # Sort and limit
    items.sort(key=lambda x: (x.get("last_seen") or ""), reverse=True)
    if limit is not None:
        items = items[: max(0, int(limit))]
    return items

@app.get("/documents/library")
async def documents_library(include_preview: bool = False, include_stats: bool = False):
    try:
        items = _fetch_document_library(include_preview=include_preview)
        return {"documents": items, "stats": {"total": len(items)} if include_stats else None}
    except Exception as e:
        logger.error(f"Library load failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load library")

@app.get("/documents/recent")
async def documents_recent(limit: int = 10):
    try:
        items = _fetch_document_library(include_preview=False)
        return {"documents": items[: max(0, int(limit))]}
    except Exception as e:
        logger.error(f"Recent load failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load recent documents")

@app.get("/documents/favorites")
async def documents_favorites(limit: int = 10):
    try:
        items = _fetch_document_library(include_preview=False, favorites_only=True)
        return {"documents": items[: max(0, int(limit))]}
    except Exception as e:
        logger.error(f"Favorites load failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load favorites")

# Add API versioning for compatibility
def _v1(alias: str, func, methods: list[str]):
    app.add_api_route("/api/v1" + alias, func, methods=methods)

# Add v1 endpoints
_v1("/ingest/reg", ingest_reg, ["POST"])
_v1("/ingest/doc", ingest_doc, ["POST"])
_v1("/ingest/pdf", ingest_pdf, ["POST"])
# Dashboard endpoint
@app.get("/documents")
async def get_documents():
    """Get all documents with metadata"""
    try:
        # Get documents from corp_docs
        docs_sql = """
        SELECT path, content, chunk_idx, created_at,
               COUNT(*) OVER (PARTITION BY path) as chunks
        FROM corp_docs
        ORDER BY path, chunk_idx
        """
        doc_rows = execute(docs_sql)
        
        # Get regulations from reg_texts
        regs_sql = """
        SELECT title as path, section, text as content, created_at,
               1 as chunks
        FROM reg_texts
        ORDER BY title
        """
        reg_rows = execute(regs_sql)
        
        # Process documents (group chunks by path)
        documents = {}
        for row in doc_rows:
            path = row['path']
            if path not in documents:
                documents[path] = {
                    'path': path,
                    'display_name': path.split('/')[-1] if '/' in path else path,
                    'description': None,
                    'resolved': True,
                    'first_seen': row['created_at'],
                    'last_seen': row['created_at'],
                    'chunks': row['chunks'],
                    'type': 'doc'
                }
        
        # Add regulations
        for row in reg_rows:
            path = f"reg:{row['path']}"
            documents[path] = {
                'path': path,
                'display_name': row['path'],
                'description': f"Section: {row['section']}" if row['section'] else None,
                'resolved': True,
                'first_seen': row['created_at'],
                'last_seen': row['created_at'],
                'chunks': 1,
                'type': 'reg'
            }
        
        return {"documents": list(documents.values())}
    except Exception as e:
        logger.error(f"Failed to get documents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get documents: {str(e)}")

@app.get("/documents/{doc_path}")
async def get_document_content(doc_path: str):
    """Get full document content by path (supports corp docs and regulations)"""
    try:
        path = unquote(doc_path)

        if path.startswith("reg:"):
            # Regulation document: fetch by title (after 'reg:')
            title = path[4:]
            reg_sql = """
            SELECT title, section, text, created_at
            FROM reg_texts
            WHERE title = ?
            LIMIT 1
            """
            rows = execute(reg_sql, [title])
            if not rows:
                raise HTTPException(status_code=404, detail="Document not found")
            row = rows[0]
            content = row.get("text", "") or ""
            display_name = row.get("title") or title
            metadata = {
                "display_name": display_name,
                "description": (f"Section: {row.get('section')}" if row.get("section") else None),
                "tags": [],
                "created_at": row.get("created_at"),
                "last_modified": row.get("created_at"),
                "file_size": len(content.encode("utf-8")),
                "type": "reg",
                "version": 1,
            }
            return {"path": path, "content": content, "metadata": metadata}
        else:
            # Corporate document: concatenate chunks by chunk_idx
            doc_sql = """
            SELECT content, created_at
            FROM corp_docs
            WHERE path = ?
            ORDER BY chunk_idx
            """
            rows = execute(doc_sql, [path])
            if not rows:
                raise HTTPException(status_code=404, detail="Document not found")
            contents = [(r.get("content", "") or "") for r in rows]
            content = "\n".join(contents)
            first_created = rows[0].get("created_at")
            last_created = rows[-1].get("created_at")
            display_name = path.split("/")[-1] if "/" in path else path
            metadata = {
                "display_name": display_name,
                "description": None,
                "tags": [],
                "created_at": first_created,
                "last_modified": last_created,
                "file_size": len(content.encode("utf-8")),
                "type": "doc",
                "version": 1,
            }
            return {"path": path, "content": content, "metadata": metadata}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document '{doc_path}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get document: {str(e)}")

@app.post("/documents/{doc_id}/access")
async def track_document_access(doc_id: str, current_user: User = Depends(get_current_user)):
    """Track document access (no-op for SQLite demo; validates existence)."""
    try:
        path = unquote(doc_id)
        if path.startswith("reg:"):
            exists = execute("SELECT 1 FROM reg_texts WHERE title = ? LIMIT 1", [path[4:]])
        else:
            exists = execute("SELECT 1 FROM corp_docs WHERE path = ? LIMIT 1", [path])
        if not exists:
            raise HTTPException(status_code=404, detail="Document not found")
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to track access for '{doc_id}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to track document access: {str(e)}")

@app.post("/documents/{doc_id}/favorite")
async def toggle_favorite(doc_id: str, data: dict = Body(...), current_user: User = Depends(get_current_user)):
    """Toggle favorite flag for a document (stored in doc_metadata)."""
    try:
        _ensure_metadata_tables()
        path = unquote(doc_id)
        is_favorite = 1 if (data or {}).get("is_favorite") else 0

        # Validate existence
        if path.startswith("reg:"):
            exists = execute("SELECT 1 FROM reg_texts WHERE title = ? LIMIT 1", [path[4:]])
            doc_type = "reg"
        else:
            exists = execute("SELECT 1 FROM corp_docs WHERE path = ? LIMIT 1", [path])
            doc_type = "doc"
        if not exists:
            raise HTTPException(status_code=404, detail="Document not found")

        # Ensure column exists (best-effort)
        try:
            execute("ALTER TABLE doc_metadata ADD COLUMN is_favorite INTEGER DEFAULT 0")
        except Exception:
            pass

        # Upsert
        execute(
            """
            INSERT INTO doc_metadata(path, is_favorite, type, last_modified)
            VALUES(?, ?, ?, datetime('now'))
            ON CONFLICT(path) DO UPDATE SET
                is_favorite = excluded.is_favorite,
                type = excluded.type,
                last_modified = datetime('now')
            """,
            [path, is_favorite, doc_type],
        )
        return {"ok": True, "is_favorite": bool(is_favorite)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to toggle favorite for '{doc_id}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle favorite: {str(e)}")

@app.delete("/documents/{doc_path}")
async def delete_document(doc_path: str, current_user: User = Depends(get_current_user)):
    """Delete a document or regulation by path/title."""
    try:
        path = unquote(doc_path)
        if path.startswith("reg:"):
            title = path[4:]
            execute("DELETE FROM reg_texts WHERE title = ?", [title])
            execute("DELETE FROM doc_metadata WHERE path = ?", [path])
        else:
            execute("DELETE FROM corp_docs WHERE path = ?", [path])
            execute("DELETE FROM doc_metadata WHERE path = ?", [path])
        return {"ok": True}
    except Exception as e:
        logger.error(f"Failed to delete document '{doc_path}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")

@app.patch("/documents/{doc_path}")
async def update_document_metadata(doc_path: str, metadata: dict = Body(...), current_user: User = Depends(get_current_user)):
    """Update document metadata (display_name, description, tags)."""
    try:
        _ensure_metadata_tables()
        path = unquote(doc_path)
        is_reg = path.startswith("reg:")
        doc_type = "reg" if is_reg else "doc"

        # Validate existence
        if is_reg:
            exists = execute("SELECT 1 FROM reg_texts WHERE title = ? LIMIT 1", [path[4:]])
        else:
            exists = execute("SELECT 1 FROM corp_docs WHERE path = ? LIMIT 1", [path])
        if not exists:
            raise HTTPException(status_code=404, detail="Document not found")

        display_name = metadata.get("display_name")
        description = metadata.get("description")
        tags = metadata.get("tags") or []

        # Upsert into metadata table
        execute(
            """
            INSERT INTO doc_metadata(path, display_name, description, tags, type, last_modified)
            VALUES(?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(path) DO UPDATE SET
                display_name = excluded.display_name,
                description = excluded.description,
                tags = excluded.tags,
                type = excluded.type,
                last_modified = datetime('now')
            """,
            [path, display_name, description, json.dumps(tags), doc_type],
        )

        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update metadata for '{doc_path}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update metadata: {str(e)}")

@app.post("/documents/{doc_path}/draft")
async def save_document_draft(doc_path: str, data: dict = Body(...), current_user: User = Depends(get_current_user)):
    """Save a draft for a document (non-critical storage)."""
    try:
        _ensure_metadata_tables()
        path = unquote(doc_path)
        content = data.get("content", "")

        # Validate existence (best-effort)
        is_reg = path.startswith("reg:")
        if is_reg:
            exists = execute("SELECT 1 FROM reg_texts WHERE title = ? LIMIT 1", [path[4:]])
        else:
            exists = execute("SELECT 1 FROM corp_docs WHERE path = ? LIMIT 1", [path])
        if not exists:
            raise HTTPException(status_code=404, detail="Document not found")

        execute(
            """
            INSERT INTO doc_drafts(path, content, updated_at)
            VALUES(?, ?, datetime('now'))
            ON CONFLICT(path) DO UPDATE SET
                content = excluded.content,
                updated_at = datetime('now')
            """,
            [path, content],
        )

        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save draft for '{doc_path}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save draft: {str(e)}")

@app.post("/documents/{doc_id}/versions")
async def create_new_version(doc_id: str, data: dict = Body(...), current_user: User = Depends(get_current_user)):
    """Create a new version by replacing the stored content with provided content."""
    try:
        _ensure_metadata_tables()
        path = unquote(doc_id)
        new_content: str = data.get("content", "") or ""

        if not isinstance(new_content, str) or len(new_content.strip()) == 0:
            raise HTTPException(status_code=400, detail="Content is required")

        is_reg = path.startswith("reg:")
        if is_reg:
            title = path[4:]
            # Update regulation text directly
            updated = execute(
                """
                UPDATE reg_texts SET text = ? WHERE title = ?
                """,
                [new_content, title],
            )
            # No rowcount available via our helper; validate existence separately
            exists = execute("SELECT 1 FROM reg_texts WHERE title = ? LIMIT 1", [title])
            if not exists:
                raise HTTPException(status_code=404, detail="Document not found")
        else:
            # Replace corp document chunks with new chunking
            exists = execute("SELECT 1 FROM corp_docs WHERE path = ? LIMIT 1", [path])
            if not exists:
                raise HTTPException(status_code=404, detail="Document not found")
            execute("DELETE FROM corp_docs WHERE path = ?", [path])
            chunks = _split_semantic_chunks(new_content)
            if len(chunks) == 0:
                # Fallback to single chunk
                chunks = [new_content]
            for i, chunk in enumerate(chunks):
                execute(
                    """
                    INSERT INTO corp_docs(path, chunk_idx, content, embedding_placeholder, created_at)
                    VALUES(?, ?, ?, ?, datetime('now'))
                    """,
                    [path, i, chunk, "placeholder_embedding"],
                )

        # Bump version in metadata table
        # Initialize row if missing so we can track version increases
        execute(
            """
            INSERT INTO doc_metadata(path, version, last_modified)
            VALUES(?, 1, datetime('now'))
            ON CONFLICT(path) DO UPDATE SET
                version = COALESCE(version, 1) + 1,
                last_modified = datetime('now')
            """,
            [path],
        )

        # Return the new version number
        row = execute("SELECT version FROM doc_metadata WHERE path = ?", [path])
        new_version = row[0]["version"] if row else 1

        # Persist version snapshot
        try:
            _ensure_versions_table()
            execute(
                """
                INSERT OR REPLACE INTO doc_versions(path, version_number, content, created_by, created_at)
                VALUES(?, ?, ?, ?, datetime('now'))
                """,
                [path, new_version, new_content, current_user.username if hasattr(current_user, 'username') else "system"],
            )
        except Exception as e:
            logger.warning(f"Failed to persist version snapshot for {path} v{new_version}: {e}")

        return {"ok": True, "version": new_version}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create new version for '{doc_id}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create new version: {str(e)}")

def _generate_version_id(path: str, version_number: int) -> str:
    base = f"{path}:{version_number}"
    return hashlib.sha1(base.encode("utf-8")).hexdigest()

@app.get("/documents/{document_id}/versions")
async def get_document_versions(document_id: str):
    """Return version history from doc_versions; seed v1 if missing."""
    try:
        _ensure_metadata_tables()
        _ensure_versions_table()
        path = unquote(document_id)
        # Seed version 1 if table empty for this path
        rows = execute("SELECT version_number FROM doc_versions WHERE path = ? ORDER BY version_number", [path])
        if not rows:
            current_content = _get_document_content_by_path(path)
            execute(
                """
                INSERT OR REPLACE INTO doc_versions(path, version_number, content, created_by, created_at)
                VALUES(?, 1, ?, 'system', datetime('now'))
                """,
                [path, current_content],
            )
            rows = execute("SELECT version_number FROM doc_versions WHERE path = ? ORDER BY version_number", [path])

        # Determine current version from metadata
        row = execute("SELECT version, display_name FROM doc_metadata WHERE path = ?", [path])
        current_version = row[0]["version"] if row and row[0].get("version") is not None else (rows[-1]["version_number"] if rows else 1)
        display_name = (row[0].get("display_name") if row else None) or (path.split("/")[-1] if "/" in path else path)

        # Build version list with file sizes
        version_rows = execute("SELECT version_number, content, created_by, created_at FROM doc_versions WHERE path = ? ORDER BY version_number DESC", [path])
        versions = []
        for r in version_rows:
            vnum = int(r["version_number"])
            content = r.get("content") or ""
            versions.append({
                "version_id": _generate_version_id(path, vnum),
                "document_id": path,
                "version_number": vnum,
                "title": f"{display_name}",
                "content": content,
                "metadata": {
                    "author": r.get("created_by") or "system",
                    "created_at": (r.get("created_at") or datetime.utcnow().isoformat()) + ("Z" if "Z" not in (r.get("created_at") or "") else ""),
                    "file_size": len(content.encode("utf-8")),
                },
                "is_current": vnum == current_version,
            })
        return {"versions": versions}
    except Exception as e:
        logger.error(f"Failed to get versions for '{document_id}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get version history: {str(e)}")

# v1 aliases for new endpoints where needed by the web app
_v1("/documents/{doc_path}", get_document_content, ["GET"])
_v1("/documents/{document_id}/versions", get_document_versions, ["GET"])

def _get_document_content_by_path(path: str) -> str:
    if path.startswith("reg:"):
        title = path[4:]
        rows = execute("SELECT text FROM reg_texts WHERE title = ?", [title])
        return (rows[0]["text"] if rows else "") or ""
    rows = execute("SELECT content FROM corp_docs WHERE path = ? ORDER BY chunk_idx", [path])
    return "\n".join([(r.get("content") or "") for r in rows])

@app.post("/api/v1/documents/{document_id}/compare")
async def compare_document_versions(document_id: str, body: dict = Body(...), current_user: User = Depends(get_current_user)):
    try:
        path = unquote(document_id)
        left_id = str(body.get("left_version")) if body.get("left_version") is not None else None
        right_id = str(body.get("right_version")) if body.get("right_version") is not None else None

        _ensure_versions_table()
        # Load versions
        versions = execute("SELECT version_number, content, created_at FROM doc_versions WHERE path = ? ORDER BY version_number", [path])
        if not versions:
            # seed and reload
            current_content = _get_document_content_by_path(path)
            execute(
                "INSERT OR REPLACE INTO doc_versions(path, version_number, content, created_by, created_at) VALUES(?, 1, ?, 'system', datetime('now'))",
                [path, current_content],
            )
            versions = execute("SELECT version_number, content, created_at FROM doc_versions WHERE path = ? ORDER BY version_number", [path])

        def resolve_content(ver_id: Optional[str]) -> tuple[int, str, str]:
            # Accept numeric version numbers or hashed ids
            if ver_id and ver_id.isdigit():
                vnum = int(ver_id)
                row = next((r for r in versions if int(r["version_number"]) == vnum), None)
                if row:
                    return vnum, row.get("content") or "", (row.get("created_at") or datetime.utcnow().isoformat()) + "Z"
            # fallback: try hash mapping
            for r in versions:
                vnum = int(r["version_number"])
                if _generate_version_id(path, vnum) == ver_id:
                    return vnum, r.get("content") or "", (r.get("created_at") or datetime.utcnow().isoformat()) + "Z"
            # default to latest
            last = versions[-1]
            return int(last["version_number"]), last.get("content") or "", (last.get("created_at") or datetime.utcnow().isoformat()) + "Z"

        left_num, left_content, left_time = resolve_content(left_id)
        right_num, right_content, right_time = resolve_content(right_id)

        # Build diff
        import difflib
        left_lines = left_content.splitlines()
        right_lines = right_content.splitlines()
        sm = difflib.SequenceMatcher(a=left_lines, b=right_lines)
        diff = []
        lno = 1
        rno = 1
        adds = dels = mods = 0
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == 'equal':
                for k in range(i2 - i1):
                    line = left_lines[i1 + k]
                    diff.append({"type": "unchanged", "leftContent": line, "rightContent": line, "leftLineNumber": lno, "rightLineNumber": rno})
                    lno += 1
                    rno += 1
            elif tag == 'delete':
                for k in range(i2 - i1):
                    line = left_lines[i1 + k]
                    diff.append({"type": "removed", "leftContent": line, "leftLineNumber": lno})
                    lno += 1
                    dels += 1
            elif tag == 'insert':
                for k in range(j2 - j1):
                    line = right_lines[j1 + k]
                    diff.append({"type": "added", "rightContent": line, "rightLineNumber": rno})
                    rno += 1
                    adds += 1
            elif tag == 'replace':
                for k in range(max(i2 - i1, j2 - j1)):
                    ltext = left_lines[i1 + k] if i1 + k < i2 else ''
                    rtext = right_lines[j1 + k] if j1 + k < j2 else ''
                    diff.append({"type": "modified", "leftContent": ltext, "rightContent": rtext, "leftLineNumber": lno if ltext else None, "rightLineNumber": rno if rtext else None})
                    if ltext:
                        lno += 1
                    if rtext:
                        rno += 1
                    mods += 1

        display_name = path.split("/")[-1] if "/" in path else path
        left_version = {"version_id": _generate_version_id(path, left_num), "document_id": path, "version_number": left_num, "title": display_name, "metadata": {"author": "system", "created_at": left_time, "file_size": len(left_content.encode('utf-8'))}, "is_current": False}
        right_version = {"version_id": _generate_version_id(path, right_num), "document_id": path, "version_number": right_num, "title": display_name, "metadata": {"author": "system", "created_at": right_time, "file_size": len(right_content.encode('utf-8'))}, "is_current": False}
        return {"leftVersion": left_version, "rightVersion": right_version, "diff": diff, "stats": {"additions": adds, "deletions": dels, "modifications": mods}}
    except Exception as e:
        logger.error(f"Compare failed for '{document_id}': {e}")
        raise HTTPException(status_code=500, detail="Failed to compare versions")

# Legacy compatibility endpoints
@app.get("/versioning/documents/{document_path}/versions")
async def legacy_get_versions(document_path: str):
    return await get_document_versions(document_path)

@app.get("/versioning/documents/{document_path}/versions/compare/{v1}/{v2}")
async def legacy_compare_versions(document_path: str, v1: int, v2: int):
    return await compare_document_versions(document_path, {"left_version": str(v1), "right_version": str(v2)})

@app.get("/versioning/temporal/documents/{document_path}")
async def legacy_temporal(document_path: str, at_time: str):
    # Return the most recent version content as a placeholder for time-travel in SQLite demo
    versions = (await get_document_versions(document_path)).get("versions", [])  # type: ignore
    if not versions:
        raise HTTPException(status_code=404, detail="No versions")
    latest = versions[0]
    return {
        "id": latest["version_number"],
        "document_path": document_path,
        "version_number": latest["version_number"],
        "content": _get_document_content_by_path(unquote(document_path)),
        "metadata": latest.get("metadata", {}),
        "created_by": latest.get("metadata", {}).get("author", "system"),
        "created_at": latest.get("metadata", {}).get("created_at"),
        "valid_from": latest.get("metadata", {}).get("created_at"),
        "valid_to": None,
        "is_current": True,
      }

@app.post("/api/v1/documents/{document_id}/versions/{version_number}/rollback")
async def rollback_document_version(document_id: str, version_number: int, current_user: User = Depends(get_current_user)):
    try:
        _ensure_versions_table()
        path = unquote(document_id)
        rows = execute("SELECT content FROM doc_versions WHERE path = ? AND version_number = ?", [path, version_number])
        if not rows:
            raise HTTPException(status_code=404, detail="Version not found")
        content = rows[0].get("content") or ""

        # Replace storage with selected version content
        if path.startswith("reg:"):
            title = path[4:]
            execute("UPDATE reg_texts SET text = ? WHERE title = ?", [content, title])
        else:
            execute("DELETE FROM corp_docs WHERE path = ?", [path])
            chunks = _split_semantic_chunks(content)
            if not chunks:
                chunks = [content]
            for i, chunk in enumerate(chunks):
                execute(
                    "INSERT INTO corp_docs(path, chunk_idx, content, embedding_placeholder, created_at) VALUES(?, ?, ?, ?, datetime('now'))",
                    [path, i, chunk, "placeholder_embedding"],
                )

        # Record new version after rollback
        md = execute("SELECT version FROM doc_metadata WHERE path = ?", [path])
        current_version = md[0]["version"] if md else 1
        execute(
            "INSERT INTO doc_versions(path, version_number, content, created_by, created_at) VALUES(?, ?, ?, 'system', datetime('now'))",
            [path, current_version + 1, content],
        )
        execute(
            "INSERT INTO doc_metadata(path, version, last_modified) VALUES(?, ?, datetime('now')) ON CONFLICT(path) DO UPDATE SET version = version + 1, last_modified = datetime('now')",
            [path, current_version + 1],
        )
        return {"ok": True, "version": current_version + 1}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Rollback failed for '{document_id}' v{version_number}: {e}")
        raise HTTPException(status_code=500, detail="Failed to rollback version")

@app.get("/serverless/performance/metrics")
async def serverless_performance_metrics():
    try:
        return {
            "total_queries": 42,
            "avg_execution_time": 0.123,
            "cache_hit_rate": 0.76,
            "by_type": {"read": {"count": 30, "total_time": 2.4}, "write": {"count": 12, "total_time": 1.1}},
            "by_region": {"us-east": {"count": 36, "total_time": 2.9}, "eu-west": {"count": 6, "total_time": 0.6}},
        }
    except Exception as e:
        logger.error(f"Serverless metrics failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load performance metrics")

# Simple compliance analyze action (no-op)
@app.post("/compliance/analyze-all")
async def compliance_analyze_all(current_user: User = Depends(get_current_user)):
    try:
        count = get_document_count()
        return {"ok": True, "analyzed": count}
    except Exception as e:
        logger.error(f"Analyze-all failed: {e}")
        raise HTTPException(status_code=500, detail="Analyze failed")

# Analytics endpoints for dashboard widgets
@app.get("/analytics/compliance/coverage")
async def analytics_compliance_coverage():
    try:
        total_docs = get_document_count()
        regulation_coverage = {
            "GDPR": 0.72,
            "SOX": 0.81,
            "PCI DSS": 0.58,
            "ISO 27001": 0.69,
        }
        uncovered = [k for k, v in regulation_coverage.items() if v < 0.4][:2]
        high_risk_gaps = [
            {
                "regulation_code": "GDPR-32",
                "avg_risk_score": 7.9,
                "assessment_count": 3,
                "last_assessment": datetime.utcnow().isoformat() + "Z",
            },
            {
                "regulation_code": "PCI-8",
                "avg_risk_score": 8.4,
                "assessment_count": 2,
                "last_assessment": datetime.utcnow().isoformat() + "Z",
            },
        ]
        trend = []
        for i in range(8):
            day = datetime.utcnow() - timedelta(days=(7 - i))
            for rt in ["gdpr", "financial", "security"]:
                trend.append({
                    "date": day.isoformat() + "Z",
                    "regulation_type": rt,
                    "coverage_percentage": 50 + i * 3 + (5 if rt == "financial" else 0),
                })
        return {
            "regulation_coverage": regulation_coverage,
            "uncovered_regulations": uncovered,
            "high_risk_gaps": high_risk_gaps,
            "coverage_trend": trend,
            "overall_score": 0.705,
        }
    except Exception as e:
        logger.error(f"Coverage analytics failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load coverage analytics")

@app.get("/analytics/performance/metrics")
async def analytics_performance_metrics():
    try:
        data = {
            "query_performance": {
                "read_avg_latency": 42.5,
                "analytics_avg_latency": 88.3,
                "write_avg_latency": 57.1,
            },
            "system_utilization": {
                "cpu_usage": 41.2,
                "memory_usage": 63.5,
                "disk_io": 37.9,
                "connection_pool_usage": 54.3,
                "tiflash_cpu": 48.7,
            },
            "user_activity": {
                "uploads": 4,
                "views": 19,
                "edits": 6,
                "comments": 2,
            },
            "collaboration_stats": {
                "active_sessions": 1,
                "participating_users": 2,
                "avg_participants_per_session": 2.0,
            },
            "cost_efficiency": {
                "tiflash_efficiency_score": 86.5,
                "documents_per_query": 3.7,
                "estimated_monthly_cost": 12.345,
                "avg_cost_per_query": 0.0023,
            },
        }
        return data
    except Exception as e:
        logger.error(f"Performance analytics failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load performance analytics")

@app.get("/analytics/risk/distribution")
async def analytics_risk_distribution(start_date: Optional[str] = None, end_date: Optional[str] = None):
    try:
        # Simple heuristic based on available documents
        total_docs = get_document_count()
        by_category = {
            "critical": max(0, min(3, total_docs // 5)),
            "high": max(0, min(5, total_docs // 3)),
            "medium": max(0, total_docs // 2),
            "low": max(0, max(total_docs - 2, 0)),
        }
        by_regulation = {"GDPR-32": 8.4, "PCI-8": 7.3, "ISO-27001-A.12": 6.1}
        by_department = {"engineering": 7, "finance": 4, "operations": 5}

        trend = []
        for i in range(12):
            day = datetime.utcnow() - timedelta(days=(11 - i))
            for cat, base in [("critical", 8.5), ("high", 6.5), ("medium", 4.5), ("low", 2.0)]:
                trend.append({
                    "date": day.isoformat() + "Z",
                    "risk_category": cat,
                    "risk_count": max(0, int(base // 2) - (11 - i) // 5),
                    "avg_risk_level": max(0.1, min(10.0, base + (i - 6) * 0.2)),
                })

        critical = []
        if total_docs > 0:
            critical.append({
                "document_path": "policies/risk-policy.txt",
                "regulation_code": "GDPR-32",
                "risk_score": 8.7,
                "impact_score": 8.9,
                "likelihood_score": 8.2,
                "mitigation_status": "planned",
                "urgency": "immediate",
            })

        return {
            "by_category": by_category,
            "by_regulation": by_regulation,
            "by_department": by_department,
            "trend_analysis": trend,
            "critical_risks": critical,
        }
    except Exception as e:
        logger.error(f"Risk analytics failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load risk analytics")

# Collaboration/comment stubs to prevent UI errors
@app.get("/api/v1/documents/{document_id}/collaborators")
async def get_collaborators(document_id: str):
    try:
        _ensure_collaboration_tables()
        path = unquote(document_id)
        rows = execute("SELECT user_id, role, added_at FROM doc_collaborators WHERE path = ? ORDER BY added_at DESC", [path])
        return {"collaborators": rows}
    except Exception as e:
        logger.error(f"Failed to get collaborators for '{document_id}': {e}")
        raise HTTPException(status_code=500, detail="Failed to load collaborators")

@app.post("/api/v1/documents/{document_id}/collaborators")
async def add_collaborator(document_id: str, data: dict = Body(...), current_user: User = Depends(get_current_user)):
    try:
        _ensure_collaboration_tables()
        path = unquote(document_id)
        user_id = (data or {}).get("user_id")
        role = (data or {}).get("role") or "editor"
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        execute(
            """
            INSERT OR REPLACE INTO doc_collaborators(path, user_id, role, added_at)
            VALUES(?, ?, ?, datetime('now'))
            """,
            [path, user_id, role],
        )
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add collaborator for '{document_id}': {e}")
        raise HTTPException(status_code=500, detail="Failed to add collaborator")

@app.delete("/api/v1/documents/{document_id}/collaborators/{user_id}")
async def remove_collaborator(document_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    try:
        _ensure_collaboration_tables()
        path = unquote(document_id)
        execute("DELETE FROM doc_collaborators WHERE path = ? AND user_id = ?", [path, user_id])
        return {"ok": True}
    except Exception as e:
        logger.error(f"Failed to remove collaborator '{user_id}' for '{document_id}': {e}")
        raise HTTPException(status_code=500, detail="Failed to remove collaborator")

@app.get("/api/v1/documents/{document_id}/comments")
async def get_comments(document_id: str):
    try:
        _ensure_collaboration_tables()
        path = unquote(document_id)
        rows = execute("SELECT id, user_id, content, created_at FROM doc_comments WHERE path = ? ORDER BY id DESC", [path])
        return {"comments": rows}
    except Exception as e:
        logger.error(f"Failed to get comments for '{document_id}': {e}")
        raise HTTPException(status_code=500, detail="Failed to load comments")

@app.post("/api/v1/documents/{document_id}/comments")
async def add_comment(document_id: str, data: dict = Body(...), current_user: User = Depends(get_current_user)):
    try:
        _ensure_collaboration_tables()
        path = unquote(document_id)
        user_id = (data or {}).get("user_id") or "user"
        content = (data or {}).get("content")
        if not content or not isinstance(content, str) or len(content.strip()) == 0:
            raise HTTPException(status_code=400, detail="content is required")
        execute(
            """
            INSERT INTO doc_comments(path, user_id, content, created_at)
            VALUES(?, ?, ?, datetime('now'))
            """,
            [path, user_id, content.strip()],
        )
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add comment for '{document_id}': {e}")
        raise HTTPException(status_code=500, detail="Failed to add comment")

@app.get("/compliance/dashboard")
async def get_dashboard():
    """Get dashboard data"""
    try:
        # Count documents and regulations
        doc_count_sql = "SELECT COUNT(DISTINCT path) as count FROM corp_docs"
        reg_count_sql = "SELECT COUNT(*) as count FROM reg_texts"
        
        doc_result = execute(doc_count_sql)
        reg_result = execute(reg_count_sql)
        
        total_docs = (doc_result[0]['count'] if doc_result else 0) + (reg_result[0]['count'] if reg_result else 0)
        
        # Mock compliance data for now (you'd calculate this from actual analysis)
        return {
            "total_documents": total_docs,
            "analyzed_documents": total_docs,
            "average_score": 75.5 if total_docs > 0 else 0,
            "compliance_distribution": {
                "compliant": max(0, total_docs - 2),
                "partially_compliant": min(2, total_docs),
                "non_compliant": 0
            },
            "risk_distribution": {
                "low": max(0, total_docs - 3),
                "medium": min(2, total_docs),
                "high": min(1, max(0, total_docs - 1)),
                "critical": 0
            },
            "recent_analyses": [],
            "top_issues": [],
            "framework_coverage": [
                {"name": "GDPR", "full_name": "General Data Protection Regulation", "category": "privacy", "coverage": 65},
                {"name": "SOX", "full_name": "Sarbanes-Oxley Act", "category": "financial", "coverage": 80},
                {"name": "PCI DSS", "full_name": "Payment Card Industry Data Security Standard", "category": "security", "coverage": 45},
                {"name": "ISO 27001", "full_name": "Information Security Management", "category": "security", "coverage": 70}
            ]
        }
    except Exception as e:
        logger.error(f"Failed to get dashboard data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard data: {str(e)}")

# Add auth endpoints
_v1("/auth/login", login_for_access_token, ["POST"])
_v1("/auth/me", read_users_me, ["GET"])
# Chat endpoints  
@app.get("/chat/conversations")
async def get_conversations():
    """Get all conversations for user"""
    try:
        # For now, return empty conversations - you'd implement real chat storage here
        return []
    except Exception as e:
        logger.error(f"Failed to get conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get conversations: {str(e)}")

@app.get("/chat/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: int):
    """Get messages for a conversation"""
    try:
        # For now, return empty messages - you'd implement real message storage here
        return []
    except Exception as e:
        logger.error(f"Failed to get messages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")

@app.post("/chat")
async def send_chat_message(message_data: dict = Body(...)):
    """Send a chat message and get AI response"""
    try:
        user_message = message_data.get('content', '').strip()
        if not user_message:
            raise HTTPException(status_code=400, detail="Message content is required")
        
        logger.info(f"Processing chat message: {user_message[:100]}")
        
        # 1. Search for relevant content with dynamic strategies
        relevant_sources = search_documents_intelligently(user_message)
        
        # 2. Build context from search results
        context = build_context_from_sources(relevant_sources)
        
        # 3. Generate AI response - prioritize direct answers
        if len(relevant_sources) > 0:
            # Always try to give a real AI answer first
            try:
                ai_response = await generate_fast_ai_response(user_message, relevant_sources)
                logger.info("Successfully generated fast AI response")
            except Exception as e:
                logger.warning(f"AI generation failed, using document-based answer: {e}")
                ai_response = generate_document_answer(user_message, relevant_sources)
        else:
            ai_response = f"I don't have information about '{user_message}' in your uploaded documents. I have access to your privacy policy, GDPR regulations, and corporate documents. Try asking about data protection, privacy rights, compliance, or security measures."
        
        # Generate unique IDs for each request
        import time
        import random
        
        conversation_id = int(time.time() * 1000) + random.randint(1, 999)  # Unique timestamp-based ID
        message_id = conversation_id + 1
        current_time = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        
        mock_conversation = {
            "id": conversation_id,
            "title": user_message[:50] + "..." if len(user_message) > 50 else user_message,
            "created_at": current_time,
            "updated_at": current_time,
            "message_count": 2
        }
        
        mock_message = {
            "id": message_id,
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": ai_response,
            "metadata": {
                "sources": relevant_sources
            },
            "created_at": current_time
        }
        
        return {
            "conversation": mock_conversation,
            "message": mock_message
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to send chat message: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send chat message: {str(e)}")

def search_documents_intelligently(query: str, limit: int = 5):
    """Intelligent search with varied strategies based on query type"""
    try:
        sources = []
        logger.info(f"Intelligent search for: '{query}'")
        
        # Extract key terms for better search
        query_lower = query.lower()
        search_terms = extract_search_terms(query_lower)
        
        # Search with different strategies
        for term in search_terms[:3]:  # Limit to top 3 terms to avoid too many results
            term_sources = search_documents_by_term(term, limit)
            for source in term_sources:
                # Add relevance score and avoid duplicates
                source_key = f"{source['path']}_{hash(source['content'][:100])}"
                if not any(s.get('source_key') == source_key for s in sources):
                    source['source_key'] = source_key
                    source['relevance_score'] = calculate_relevance(query_lower, source['content'])
                    sources.append(source)
        
        # Sort by relevance and return top results
        sources.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        logger.info(f"Found {len(sources)} total sources, returning top {limit}")
        
        return sources[:limit]
        
    except Exception as e:
        logger.error(f"Error in intelligent search: {e}")
        return search_documents_sync(query, limit)  # Fallback to original

def extract_search_terms(query: str):
    """Extract meaningful search terms from user query"""
    import re
    
    # Remove common stop words and extract key terms
    stop_words = {'what', 'does', 'our', 'the', 'how', 'do', 'we', 'is', 'are', 'about', 'tell', 'me', 'show', 'can', 'you', 'please'}
    
    # Extract words, keeping important phrases together
    important_phrases = [
        'privacy policy', 'data protection', 'personal data', 'gdpr compliance',
        'data sharing', 'security measures', 'legal obligations', 'user rights',
        'data processing', 'third party', 'contact information', 'retention period'
    ]
    
    terms = []
    
    # Check for important phrases first
    for phrase in important_phrases:
        if phrase in query:
            terms.append(phrase)
    
    # Extract individual meaningful words
    words = re.findall(r'\b\w+\b', query)
    meaningful_words = [w for w in words if w.lower() not in stop_words and len(w) > 2]
    
    # Add top meaningful words
    terms.extend(meaningful_words[:3])
    
    # If no specific terms found, use original query
    if not terms:
        terms = [query]
    
    logger.info(f"Search terms extracted: {terms}")
    return terms

def calculate_relevance(query: str, content: str):
    """Calculate relevance score between query and content"""
    query_words = set(query.lower().split())
    content_words = set(content.lower().split())
    
    # Count matching words
    matches = len(query_words.intersection(content_words))
    
    # Bonus for exact phrase matches
    if query in content.lower():
        matches += 5
    
    # Bonus for content length (longer content might be more comprehensive)
    length_bonus = min(len(content) / 1000, 2)
    
    return matches + length_bonus

def search_documents_by_term(term: str, limit: int = 3):
    """Search documents by a specific term"""
    sources = []
    
    try:
        # Search in regulations
        reg_sql = """
        SELECT title, section, text
        FROM reg_texts 
        WHERE text LIKE ? OR title LIKE ? OR section LIKE ?
        LIMIT ?
        """
        reg_params = [f"%{term}%", f"%{term}%", f"%{term}%", limit // 2 + 1]
        reg_results = execute(reg_sql, reg_params) or []
        
        for reg in reg_results:
            sources.append({
                "type": "regulation",
                "title": reg["title"],
                "section": reg["section"] or "",
                "content": reg["text"][:600] + "..." if len(reg["text"]) > 600 else reg["text"],
                "source": f"Regulation: {reg['title']}",
                "path": f"reg:{reg['title']}"
            })
        
        # Search in corporate documents
        doc_sql = """
        SELECT path, content
        FROM corp_docs
        WHERE content LIKE ? OR path LIKE ?
        ORDER BY path, chunk_idx
        LIMIT ?
        """
        doc_params = [f"%{term}%", f"%{term}%", limit]
        doc_results = execute(doc_sql, doc_params) or []
        
        for doc in doc_results:
            sources.append({
                "type": "document", 
                "path": doc["path"],
                "title": doc["path"].split('/')[-1] if '/' in doc["path"] else doc["path"],
                "content": doc["content"][:600] + "..." if len(doc["content"]) > 600 else doc["content"],
                "source": f"Document: {doc['path']}"
            })
        
    except Exception as e:
        logger.error(f"Error searching by term '{term}': {e}")
    
    return sources

def search_documents_sync(query: str, limit: int = 5):
    """Search through uploaded documents and regulations"""
    try:
        sources = []
        logger.info(f"Searching for query: '{query}'")
        
        # Search in regulations (reg_texts) 
        try:
            reg_sql = """
            SELECT title, section, text
            FROM reg_texts 
            WHERE text LIKE ? OR title LIKE ? OR section LIKE ?
            LIMIT ?
            """
            reg_params = [f"%{query}%", f"%{query}%", f"%{query}%", limit // 2 + 1]
            reg_results = execute(reg_sql, reg_params) or []
            logger.info(f"Found {len(reg_results)} regulations")
            
            for reg in reg_results:
                sources.append({
                    "type": "regulation",
                    "title": reg["title"],
                    "section": reg["section"] or "",
                    "content": reg["text"][:500] + "..." if len(reg["text"]) > 500 else reg["text"],
                    "source": f"Regulation: {reg['title']}"
                })
        except Exception as e:
            logger.error(f"Error searching regulations: {e}")
        
        # Search in corporate documents (corp_docs)
        try:
            doc_sql = """
            SELECT path, content
            FROM corp_docs
            WHERE content LIKE ? OR path LIKE ?
            ORDER BY path, chunk_idx
            LIMIT ?
            """
            doc_params = [f"%{query}%", f"%{query}%", limit // 2 + 1]
            doc_results = execute(doc_sql, doc_params) or []
            logger.info(f"Found {len(doc_results)} document chunks")
            
            for doc in doc_results:
                sources.append({
                    "type": "document", 
                    "path": doc["path"],
                    "title": doc["path"].split('/')[-1] if '/' in doc["path"] else doc["path"],
                    "content": doc["content"][:500] + "..." if len(doc["content"]) > 500 else doc["content"],
                    "source": f"Document: {doc['path']}"
                })
        except Exception as e:
            logger.error(f"Error searching documents: {e}")
        
        logger.info(f"Total sources found: {len(sources)}")
        return sources[:limit]
        
    except Exception as e:
        logger.error(f"Error in search_documents: {e}")
        return []

def build_context_from_sources(sources):
    """Build context string from search results"""
    if not sources:
        return "No relevant documents found in the database."
    
    context_parts = ["Based on your uploaded documents, here's the relevant information:\n"]
    
    for i, source in enumerate(sources, 1):
        source_type = "📋 Regulation" if source["type"] == "regulation" else "📄 Document"
        title = source.get("title", source.get("path", "Unknown"))
        content = source["content"]
        
        context_parts.append(f"{i}. {source_type}: {title}")
        context_parts.append(f"   Content: {content}\n")
    
    return "\n".join(context_parts)

def get_document_count():
    """Get total count of documents"""
    try:
        doc_count = execute("SELECT COUNT(DISTINCT path) as count FROM corp_docs")[0]['count']
        reg_count = execute("SELECT COUNT(*) as count FROM reg_texts")[0]['count']
        return doc_count + reg_count
    except:
        return 0

def generate_intelligent_response(user_query: str, sources):
    """Generate a dynamic, conversational response based on the query and sources"""
    if not sources:
        return f"I searched through your documents for '{user_query}' but didn't find specific matches. Try asking about privacy policy, data protection, GDPR, security measures, or other compliance topics that might be in your uploaded documents."
    
    # Analyze query type for personalized responses
    query_lower = user_query.lower()
    response_templates = get_response_templates(query_lower, len(sources))
    
    # Pick a varied intro based on query characteristics
    import random
    intro = random.choice(response_templates["intros"])
    
    response_parts = [intro.format(query=user_query, count=len(sources)), ""]
    
    # Process sources with more variety
    processed_docs = {}
    for source in sources:
        doc_key = source.get("title", source.get("path", "Unknown"))
        relevance = source.get('relevance_score', 0)
        
        if doc_key not in processed_docs:
            processed_docs[doc_key] = {
                'type': source['type'],
                'contents': [],
                'max_relevance': relevance
            }
        
        processed_docs[doc_key]['contents'].append(source['content'])
        processed_docs[doc_key]['max_relevance'] = max(processed_docs[doc_key]['max_relevance'], relevance)
    
    # Sort by relevance and present intelligently
    sorted_docs = sorted(processed_docs.items(), key=lambda x: x[1]['max_relevance'], reverse=True)
    
    for i, (doc_title, doc_data) in enumerate(sorted_docs[:3]):  # Limit to top 3 docs
        doc_type = "📋 Regulation" if doc_data["type"] == "regulation" else "📄 Document"
        
        # Vary the presentation format
        if i == 0:  # Most relevant - give more detail
            response_parts.append(f"**{doc_type}: {doc_title}**")
            combined_content = " ".join(doc_data['contents'])[:500]
            response_parts.append(f"{combined_content}...")
        else:  # Others - shorter format
            combined_content = " ".join(doc_data['contents'])[:300]
            response_parts.append(f"**{doc_type}: {doc_title}** - {combined_content}...")
        
        response_parts.append("")
    
    # Add dynamic closing based on query and results
    closing = random.choice(response_templates["closings"])
    response_parts.append(closing.format(count=len(sources)))
    
    return "\n".join(response_parts)

def get_response_templates(query_lower: str, source_count: int):
    """Get varied response templates based on query type"""
    templates = {
        "intros": [],
        "closings": []
    }
    
    # Contextual intros based on query type
    if any(word in query_lower for word in ['privacy', 'data protection', 'personal data']):
        templates["intros"] = [
            "Looking at your privacy and data protection policies, I found:",
            "Based on your data protection documentation:",
            "Here's what your privacy policies specify:",
            "From your data protection framework:"
        ]
    elif any(word in query_lower for word in ['gdpr', 'regulation', 'compliance']):
        templates["intros"] = [
            "According to your compliance documentation:",
            "Your regulatory framework shows:",
            "From your compliance policies:",
            "Based on your GDPR and regulatory documents:"
        ]
    elif any(word in query_lower for word in ['security', 'protection', 'safety', 'measures']):
        templates["intros"] = [
            "Your security policies outline:",
            "From your protection measures documentation:",
            "Based on your security framework:",
            "Your safety and protection protocols specify:"
        ]
    elif any(word in query_lower for word in ['policy', 'procedure', 'guideline']):
        templates["intros"] = [
            "Your organizational policies state:",
            "According to your procedures:",
            "Your policy framework includes:",
            "Based on your guidelines:"
        ]
    else:
        templates["intros"] = [
            f"I found {source_count} relevant sections about '{query_lower}':",
            f"Based on your question, here are {source_count} relevant findings:",
            f"From your documents, I located {source_count} sections that address your query:",
            "Here's what I found in your uploaded documents:"
        ]
    
    # Varied closings
    if source_count == 1:
        templates["closings"] = [
            "Would you like me to search for more specific details about this topic?",
            "Feel free to ask for more information about any specific aspect.",
            "Let me know if you need clarification on any part of this policy."
        ]
    elif source_count <= 3:
        templates["closings"] = [
            "Ask me about specific aspects of any of these policies for more details.",
            "I can provide more focused information if you narrow down your question.",
            "Would you like me to explain any particular section in more detail?"
        ]
    else:
        templates["closings"] = [
            f"I found {source_count} relevant sections. Ask more specific questions to get focused answers.",
            "There's quite a bit of information available - try asking about specific aspects.",
            "Lots of relevant content found! Feel free to ask about particular details."
        ]
    
    return templates

def generate_fallback_response(user_query: str, sources):
    """Legacy fallback function - now calls intelligent response"""
    return generate_intelligent_response(user_query, sources)

async def generate_fast_ai_response(user_query: str, sources):
    """Generate a fast, direct AI response using the smallest/fastest model"""
    try:
        import httpx
        
        # Build a focused context from sources
        context_parts = []
        for source in sources[:3]:  # Use only top 3 sources
            content = source['content'][:400]  # Limit content length
            context_parts.append(f"From {source['title']}: {content}")
        
        context = "\n".join(context_parts)
        
        ollama_url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
        
        # Try fastest available model first
        models_to_try = [
            ("mistral:7b-instruct", 15.0),  # Fast model, reasonable timeout
            ("leximind_mistral:latest", 20.0)  # Backup model
        ]
        
        for model_name, timeout in models_to_try:
            try:
                prompt = f"""You are a helpful AI assistant. Answer the user's question directly based on the provided information.

User Question: {user_query}

Available Information:
{context}

Instructions:
- Give a direct, conversational answer to the user's question
- Use information from the provided documents
- Keep your response concise (under 150 words)
- Answer as if you're having a normal conversation
- If the information doesn't fully answer the question, say what you do know

Answer:"""

                payload = {
                    "model": model_name,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 120,  # Limit response length
                        "top_k": 20,
                        "top_p": 0.8
                    }
                }
                
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(f"{ollama_url}/api/generate", json=payload)
                    
                    if response.status_code == 200:
                        result = response.json()
                        ai_response = result.get("response", "").strip()
                        
                        if ai_response and len(ai_response) > 10:
                            logger.info(f"Fast AI response generated with {model_name} ({len(ai_response)} chars)")
                            return ai_response
                
            except Exception as model_error:
                logger.warning(f"Model {model_name} failed: {model_error}")
                continue
        
        # If all models fail, raise exception
        raise Exception("All AI models failed or timed out")
        
    except Exception as e:
        logger.error(f"Fast AI generation failed: {e}")
        raise e

def generate_document_answer(user_query: str, sources):
    """Generate a document-based answer when AI is unavailable"""
    if not sources:
        return "I couldn't find relevant information in your documents."
    
    # Create a direct answer based on the documents
    query_lower = user_query.lower()
    
    # Find the most relevant source
    best_source = max(sources, key=lambda x: x.get('relevance_score', 0))
    
    if any(word in query_lower for word in ['what', 'define', 'explain']):
        intro = f"Based on your documents, {user_query.lower().replace('what', '').replace('?', '').strip()}:"
    elif any(word in query_lower for word in ['how', 'process']):
        intro = f"According to your policies, here's how {user_query.lower().replace('how', '').replace('do we', '').replace('does', '').replace('?', '').strip()}:"
    elif any(word in query_lower for word in ['can', 'may', 'able']):
        intro = f"Your documents indicate that {user_query.lower().replace('can', '').replace('may', '').replace('?', '').strip()}:"
    else:
        intro = f"Regarding {user_query.lower().replace('?', '')}, your documents show:"
    
    # Extract the most relevant content
    content = best_source['content'][:300]
    doc_name = best_source.get('title', 'your policy')
    
    answer = f"{intro}\n\n{content}"
    
    if len(sources) > 1:
        answer += f"\n\n(This information is from {doc_name} and {len(sources)-1} other related document{'s' if len(sources) > 2 else ''})"
    else:
        answer += f"\n\n(From: {doc_name})"
    
    return answer

async def generate_ollama_response(user_query: str, context: str, timeout: float = 60.0):
    """Generate response using Ollama"""
    try:
        import httpx
        
        ollama_url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
        model = os.getenv("OLLAMA_MODEL", "mistral:7b-instruct")
        
        # Try smaller model for faster responses
        available_models = ["mistral:7b-instruct", "leximind_mistral:latest"]
        # You could add logic here to pick the fastest available model
        
        prompt = f"""You are LexMind, a helpful AI assistant specializing in compliance and regulatory matters. You help users understand their uploaded documents and regulations.

User Question: {user_query}

Available Context from Documents:
{context}

Instructions:
- Answer the user's question based on the provided context
- If the context contains relevant information, reference it specifically
- Be helpful and accurate
- If you can't find relevant information in the context, say so clearly
- Keep responses concise but informative (under 300 words)
- Format your response in a conversational way

Response:"""

        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "top_p": 0.9,
                "num_predict": 300
            }
        }
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(f"{ollama_url}/api/generate", json=payload)
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result.get("response", "").strip()
                
                if not ai_response:
                    raise Exception("Empty response from Ollama")
                
                logger.info(f"Generated Ollama response ({len(ai_response)} chars)")
                return ai_response
            else:
                raise Exception(f"Ollama API error: {response.status_code}")
                
    except Exception as e:
        logger.error(f"Ollama generation error: {str(e)}")
        raise e

@app.delete("/chat/conversations/{conversation_id}")
async def delete_conversation(conversation_id: int):
    """Delete a conversation"""
    try:
        # For now, just return success - you'd implement real deletion here
        return {"ok": True}
    except Exception as e:
        logger.error(f"Failed to delete conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete conversation: {str(e)}")

# Add dashboard endpoints
_v1("/compliance/dashboard", get_dashboard, ["GET"])
_v1("/documents", get_documents, ["GET"])
# Add chat endpoints
_v1("/chat/conversations", get_conversations, ["GET"])
_v1("/chat/conversations/{conversation_id}/messages", get_conversation_messages, ["GET"])  
_v1("/chat", send_chat_message, ["POST"])
_v1("/chat/conversations/{conversation_id}", delete_conversation, ["DELETE"])

# -----------------------------
# Agent Orchestrator (SQLite)
# -----------------------------

class AgentRunRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    notify: bool = False

class AgentRunResponse(BaseModel):
    ok: bool
    message: str
    sources_count: int
    steps: list[dict]
    notified: bool = False

async def _send_slack_notification(text: str) -> bool:
    try:
        import httpx
        webhook = os.getenv("SLACK_WEBHOOK_URL")
        if not webhook:
            return False
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(webhook, json={"text": text})
        return True
    except Exception:
        return False

@app.post("/agent/run", response_model=AgentRunResponse)
async def run_agent(request: AgentRunRequest, current_user: User = Depends(get_current_user)):
    steps: list[dict] = []
    try:
        t0 = datetime.utcnow()
        steps.append({"step": "received", "at": t0.isoformat(), "query": request.query})

        # 1) Search documents
        t1 = datetime.utcnow()
        sources = search_documents_intelligently(request.query)
        steps.append({"step": "search", "at": t1.isoformat(), "results": len(sources)})

        # 2) Build context
        t2 = datetime.utcnow()
        context = build_context_from_sources(sources)
        steps.append({"step": "context", "at": t2.isoformat(), "chars": len(context)})

        # 3) Generate AI answer (fast path → fallback)
        t3 = datetime.utcnow()
        try:
            ai_answer = await generate_fast_ai_response(request.query, sources)
        except Exception:
            ai_answer = generate_document_answer(request.query, sources)
        steps.append({"step": "answer", "at": t3.isoformat(), "chars": len(ai_answer)})

        # 4) Optional notification
        notified = False
        if request.notify:
            summary = f"Agent run completed. Query: '{request.query}'. Sources: {len(sources)}.\n\nAnswer:\n{ai_answer[:600]}"
            notified = await _send_slack_notification(summary)
            steps.append({"step": "notify", "at": datetime.utcnow().isoformat(), "notified": notified})

        response = AgentRunResponse(
            ok=True,
            message=ai_answer,
            sources_count=len(sources),
            steps=steps,
            notified=notified,
        )
        # Persist run (best-effort)
        try:
            execute(
                """
                CREATE TABLE IF NOT EXISTS agent_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query TEXT,
                    answer TEXT,
                    sources_count INTEGER,
                    steps_json TEXT,
                    notified INTEGER,
                    created_at TEXT
                )
                """
            )
            execute(
                """
                INSERT INTO agent_runs(query, answer, sources_count, steps_json, notified, created_at)
                VALUES(?, ?, ?, ?, ?, datetime('now'))
                """,
                [
                    request.query,
                    response.message,
                    response.sources_count,
                    json.dumps(response.steps),
                    1 if response.notified else 0,
                ],
            )
        except Exception as e:
            logger.warning(f"Failed to persist agent run: {e}")
        return response
    except Exception as e:
        steps.append({"step": "error", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Agent run failed: {str(e)}")

# v1 alias
_v1("/agent/run", run_agent, ["POST"])

@app.get("/agent/runs")
async def list_agent_runs(limit: int = 20, current_user: User = Depends(get_current_user)):
    try:
        execute(
            """
            CREATE TABLE IF NOT EXISTS agent_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT,
                answer TEXT,
                sources_count INTEGER,
                steps_json TEXT,
                notified INTEGER,
                created_at TEXT
            )
            """
        )
        rows = execute(
            "SELECT id, query, answer, sources_count, steps_json, notified, created_at FROM agent_runs ORDER BY id DESC LIMIT ?",
            [max(0, int(limit))],
        )
        runs = [
            {
                "id": r["id"],
                "query": r.get("query"),
                "answer": r.get("answer"),
                "sources_count": r.get("sources_count") or 0,
                "steps_json": json.loads(r.get("steps_json") or "[]"),
                "notified": bool(r.get("notified") or 0),
                "created_at": r.get("created_at"),
            }
            for r in rows
        ]
        return {"runs": runs}
    except Exception as e:
        logger.error(f"Failed to list agent runs: {e}")
        raise HTTPException(status_code=500, detail="Failed to list agent runs")

@app.get("/agent/runs/{run_id}")
async def get_agent_run(run_id: int, current_user: User = Depends(get_current_user)):
    try:
        row = execute(
            "SELECT id, query, answer, sources_count, steps_json, notified, created_at FROM agent_runs WHERE id = ?",
            [run_id],
        )
        if not row:
            raise HTTPException(status_code=404, detail="Run not found")
        r = row[0]
        return {
            "id": r["id"],
            "query": r.get("query"),
            "answer": r.get("answer"),
            "sources_count": r.get("sources_count") or 0,
            "steps": json.loads(r.get("steps_json") or "[]"),
            "notified": bool(r.get("notified") or 0),
            "created_at": r.get("created_at"),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get agent run {run_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load agent run")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)