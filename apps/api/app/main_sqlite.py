"""
LexMind API - SQLite version for development
This version works without vector embeddings and TiDB
"""

import os
import io
import re
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Body, Depends
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
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)