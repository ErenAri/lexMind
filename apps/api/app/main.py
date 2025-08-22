from fastapi import FastAPI, Body, HTTPException, UploadFile, File, Request, APIRouter, Depends, Query
from fastapi.exceptions import RequestValidationError
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from .deps import execute
from .embeddings import generate_embedding as embed
from .embeddings import is_model_available
from .compliance_analyzer import compliance_analyzer
from .workflow_engine import workflow_engine
from .version_manager import version_manager, UploadType
from .audit_logger import audit_logger, EventType, Action, ResourceType, RiskLevel, ReportType
from .recommendation_engine import recommendation_engine, RecommendationType, InteractionType, InteractionDepth
from .auth import (
    authenticate_user, create_access_token, get_current_active_user, 
    require_role, Token, User, ACCESS_TOKEN_EXPIRE_MINUTES, _require_role_legacy,
    get_password_hash
)
from .errors import (
    APIError, ValidationError, AuthenticationError, AuthorizationError,
    NotFoundError, ConflictError, DatabaseError, ExternalServiceError,
    api_error_handler, http_error_handler, validation_error_handler, unhandled_error_handler
)
from .middleware import RequestIdMiddleware, LoggingMiddleware, SecurityHeadersMiddleware, ValidationMiddleware, RateLimitMiddleware
import os
from typing import cast
from starlette.types import ExceptionHandler
import httpx
import dotenv
from pathlib import Path
try:
    import PyPDF2  # type: ignore
except Exception:  # keep API import-safe even if optional dep missing
    PyPDF2 = None  # type: ignore
import io
import json

app = FastAPI()

# Add middleware in order (outermost to innermost)
# CORS - restrict origins in production
cors_origins = ["*"] if os.getenv("ENVIRONMENT") == "development" else [
    "http://localhost:3000",
    "http://localhost:3001", 
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    os.getenv("FRONTEND_URL", "")
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    RateLimitMiddleware, 
    calls_per_minute=int(os.getenv("RATE_LIMIT_PER_MINUTE", "100")), 
    calls_per_hour=int(os.getenv("RATE_LIMIT_PER_HOUR", "1000"))
)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(ValidationMiddleware, max_body_size=int(os.getenv("MAX_BODY_SIZE", str(10 * 1024 * 1024))))

# Ensure .env is loaded for endpoints that don't touch the DB
dotenv.load_dotenv(str((Path(__file__).parent / ".." / ".env").resolve()))

class RegIn(BaseModel):
    source: str
    title: str
    section: str
    text: str

class DocIn(BaseModel):
    path: str
    content: str
    chunk_idx: int = 0

class HybridIn(BaseModel):
    query: str
    top_k: int = 10
    offset: int = 0

class TaskIn(BaseModel):
    finding_id: int
    system: str
    external_id: str | None = None
    status: str = "open"
    assignee: str | None = None
    due_date: str | None = None

class ExplainIn(BaseModel):
    regulation_text: str
    document_text: str
    query: str | None = None

class FixItIn(BaseModel):
    regulation_text: str
    document_text: str
    context: str | None = None

class MapIn(BaseModel):
    reg_id: int
    doc_id: int
    confidence: float = 0.8

class DocMarkIn(BaseModel):
    path: str
    resolved: bool

class DocMetaIn(BaseModel):
    path: str
    display_name: str | None = None
    description: str | None = None

class UserCreateIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9_.-]+$')
    email: str | None = Field(None, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(default="viewer", pattern=r'^(viewer|analyst|admin)$')

class UserUpdateIn(BaseModel):
    email: str | None = Field(None, max_length=255)
    role: str | None = Field(None, pattern=r'^(viewer|analyst|admin)$')
    is_active: bool | None = None

class UserPasswordUpdateIn(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)

# Chat Models
class ChatMessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    conversation_id: int | None = None

class ChatMessageOut(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    metadata: dict | None = None
    created_at: str

class ConversationOut(BaseModel):
    id: int
    title: str | None
    created_at: str
    updated_at: str
    message_count: int

class ChatResponseOut(BaseModel):
    message: ChatMessageOut
    conversation: ConversationOut
    sources: list[dict] | None = None

# Compliance Analysis Models
class ComplianceAnalysisOut(BaseModel):
    analysis_id: int
    compliance_score: float
    risk_level: str
    categories: list[str]
    frameworks: list[str]
    summary: str
    analysis: dict
    recommendations: list[dict]

class ComplianceIssue(BaseModel):
    severity: str
    category: str
    title: str
    description: str
    framework: str
    evidence: str

class ComplianceStatusOut(BaseModel):
    doc_id: int
    path: str
    overall_score: float | None
    risk_level: str
    compliance_status: str
    total_issues: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    last_analyzed: str
    categories: list[str] | None = None

class ComplianceDashboardOut(BaseModel):
    total_documents: int
    analyzed_documents: int
    average_score: float
    compliance_distribution: dict
    risk_distribution: dict
    recent_analyses: list[ComplianceStatusOut]
    top_issues: list[dict]
    framework_coverage: list[dict]

class PaginationIn(BaseModel):
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)

# Response Schemas
class Highlight(BaseModel):
    start: int = Field(..., ge=0)
    end: int = Field(..., ge=0)

class HybridResultOut(BaseModel):
    type: str
    id: int
    section: str | None = None
    text: str | None = None
    content: str | None = None
    final_score: float
    highlights: list[Highlight] | None = None

class RecentDocOut(BaseModel):
    id: str | int
    name: str
    type: str
    uploadedAt: str | None = None
    path: str | None = None
    source: str | None = None

class DocumentItemOut(BaseModel):
    path: str
    display_name: str
    description: str | None = None
    resolved: bool
    first_seen: str | None = None
    last_seen: str | None = None
    chunks: int
    type: str

class CoverageItemOut(BaseModel):
    reg_id: int
    section: str | None = None
    evidence_count: int

class CoverageEvidenceOut(BaseModel):
    mapping_id: int
    confidence: float
    doc_id: int
    path: str
    snippet: str | None = None

class RegHeaderOut(BaseModel):
    id: int
    section: str | None = None
    text: str | None = None

class PaginationOut(BaseModel):
    total: int
    limit: int
    offset: int
    has_more: bool

class HybridResponseOut(BaseModel):
    results: list[HybridResultOut]
    pagination: PaginationOut

class RecentDocumentsOut(BaseModel):
    documents: list[RecentDocOut]

class DocumentsOut(BaseModel):
    documents: list[DocumentItemOut]
    pagination: PaginationOut

class CoverageOut(BaseModel):
    items: list[CoverageItemOut]

class CoverageDetailOut(BaseModel):
    reg: RegHeaderOut | None = None
    items: list[CoverageEvidenceOut]

# Generic and utility response schemas
class OkOut(BaseModel):
    ok: bool = True

class DocumentReadOut(BaseModel):
    path: str
    content: str

class HealthOut(BaseModel):
    ok: bool

class HealthFullOut(BaseModel):
    api: bool
    db: bool
    llm: bool
    embed: bool

class ExplainResult(BaseModel):
    summary: str = ""
    risks: list[str] = []

class ExplainOut(BaseModel):
    result: ExplainResult

class FixItAction(BaseModel):
    title: str
    owner: str | None = None
    timeline: str | None = None

class FixItResult(BaseModel):
    actions: list[FixItAction] = []
    notes: str | None = ""

class FixItOut(BaseModel):
    result: FixItResult

# Recommendation models
class RecommendationOut(BaseModel):
    recommendation_id: str
    document_id: int
    title: str
    path: str
    recommendation_type: str
    score: float
    reasoning: str
    source_document_id: int | None = None
    metadata: dict = {}

class RecommendationsResponse(BaseModel):
    recommendations: list[RecommendationOut]
    total: int
    user_profile_summary: dict = {}

class InteractionTrackingIn(BaseModel):
    document_id: int
    interaction_type: str  # view, download, search, bookmark, share, analyze, comment
    duration_seconds: int | None = None
    depth: str = "browse"  # quick_view, browse, detailed_review, analysis
    session_id: str | None = None
    referrer_source: str | None = None
    metadata: dict = {}

class RecommendationFeedbackIn(BaseModel):
    recommendation_id: str
    rating: int  # 1-5 stars
    notes: str | None = None

class UserPreferencesIn(BaseModel):
    preferred_recommendation_types: list[str] | None = None
    excluded_topics: list[str] | None = None
    preferred_compliance_frameworks: list[str] | None = None
    recommendation_frequency: str = "real_time"
    max_recommendations_per_session: int = 5
    enable_ai_explanations: bool = True
    enable_trend_based: bool = True
    enable_collaborative_filtering: bool = True

class UserPreferencesOut(BaseModel):
    user_id: str
    preferred_recommendation_types: list[str]
    excluded_topics: list[str]
    preferred_compliance_frameworks: list[str]
    recommendation_frequency: str
    max_recommendations_per_session: int
    enable_ai_explanations: bool
    enable_trend_based: bool
    enable_collaborative_filtering: bool

class RecommendationAnalyticsOut(BaseModel):
    date_range: dict
    total_recommendations: int
    click_through_rate: float
    average_rating: float
    top_recommendation_types: list[dict]
    user_engagement_metrics: dict

# Authentication endpoints
@app.post("/auth/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username.strip(), form_data.password.strip())
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

# User management endpoints
@app.post("/auth/register", response_model=User)
async def register_user(user_data: UserCreateIn, current_user: User = Depends(require_role(["admin"]))):
    # Check if username already exists
    existing = await execute("SELECT id FROM users WHERE username = %s", [user_data.username])
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")
    
    # Check if email already exists (if provided)
    if user_data.email:
        existing_email = await execute("SELECT id FROM users WHERE email = %s", [user_data.email])
        if existing_email:
            raise HTTPException(status_code=409, detail="Email already exists")
    
    # Hash password and create user
    hashed_password = get_password_hash(user_data.password)
    
    sql = """
    INSERT INTO users (username, email, hashed_password, role, is_active)
    VALUES (%s, %s, %s, %s, %s)
    """
    await execute(sql, [
        user_data.username, 
        user_data.email, 
        hashed_password, 
        user_data.role,
        True
    ])
    
    return User(
        username=user_data.username,
        email=user_data.email,
        role=user_data.role,
        is_active=True
    )

@app.get("/auth/users", response_model=list[User])
async def list_users(current_user: User = Depends(require_role(["admin"]))):
    sql = "SELECT username, email, role, is_active, created_at FROM users ORDER BY created_at DESC"
    rows = await execute(sql, [])
    return [
        User(
            username=row["username"],
            email=row["email"],
            role=row["role"],
            is_active=row["is_active"]
        )
        for row in rows or []
    ]

@app.patch("/auth/users/{username}", response_model=User)
async def update_user(username: str, user_data: UserUpdateIn, current_user: User = Depends(require_role(["admin"]))):
    # Check if user exists
    existing = await execute("SELECT id FROM users WHERE username = %s", [username])
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Build update query dynamically
    updates = []
    values = []
    
    if user_data.email is not None:
        updates.append("email = %s")
        values.append(user_data.email)
    
    if user_data.role is not None:
        updates.append("role = %s")
        values.append(user_data.role)
    
    if user_data.is_active is not None:
        updates.append("is_active = %s")
        values.append(user_data.is_active)
    
    if updates:
        values.append(username)
        sql = f"UPDATE users SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE username = %s"
        await execute(sql, values)
    
    # Return updated user
    user_row = await execute("SELECT username, email, role, is_active FROM users WHERE username = %s", [username])
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")
    
    row = user_row[0]
    return User(
        username=row["username"],
        email=row["email"],
        role=row["role"],
        is_active=row["is_active"]
    )

@app.delete("/auth/users/{username}", response_model=OkOut)
async def delete_user(username: str, current_user: User = Depends(require_role(["admin"]))):
    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await execute("DELETE FROM users WHERE username = %s", [username])
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"ok": True}

@app.patch("/auth/password", response_model=OkOut)
async def update_password(password_data: UserPasswordUpdateIn, current_user: User = Depends(get_current_active_user)):
    from .auth import get_user, verify_password
    
    # Verify current password
    user = await get_user(current_user.username)
    if not user or not verify_password(password_data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password and update
    new_hashed_password = get_password_hash(password_data.new_password)
    await execute("UPDATE users SET hashed_password = %s, updated_at = CURRENT_TIMESTAMP WHERE username = %s", 
                 [new_hashed_password, current_user.username])
    
    return {"ok": True}

@app.post("/ingest/reg", response_model=OkOut)
async def ingest_reg(item: RegIn):
    vec = embed(item.text)
    vec_str = "[" + ",".join(str(x) for x in vec) + "]"
    sql = """
    INSERT INTO reg_texts(source,title,section,text,embedding) VALUES(%s,%s,%s,%s,CAST(%s AS VECTOR(384)))
    """
    await execute(sql, [item.source, item.title, item.section, item.text, vec_str])
    return {"ok": True}

@app.post("/ingest/doc", response_model=OkOut)
async def ingest_doc(item: DocIn):
    vec = embed(item.content)
    vec_str = "[" + ",".join(str(x) for x in vec) + "]"
    sql = """
    INSERT INTO corp_docs(path,chunk_idx,content,embedding) VALUES(%s,%s,%s,CAST(%s AS VECTOR(384)))
    """
    await execute(sql, [item.path, item.chunk_idx, item.content, vec_str])
    return {"ok": True}

def _split_semantic_chunks(text: str, target: int = 1000, overlap: int = 120) -> list[str]:
    import re
    if not text.strip():
        return []
    sentences = re.split(r"(?<=[\.!\?])\s+", text.strip())
    chunks: list[str] = []
    current = ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(current) + len(s) + (1 if current else 0) <= target:
            current = (current + " " + s).strip() if current else s
        else:
            if current:
                chunks.append(current)
                if overlap > 0 and len(current) > overlap:
                    tail = current[-overlap:]
                    current = (tail + " " + s).strip()
                else:
                    current = s
            else:
                chunks.append(s[:target])
                current = s[max(0, len(s) - overlap):]
    if current:
        chunks.append(current)
    return chunks

@app.post("/ingest/pdf", response_model=OkOut)
async def ingest_pdf(
    file: UploadFile = File(...),
    doc_type: str = Body(..., embed=True)  # "reg" or "doc"
):
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    if PyPDF2 is None:
        raise HTTPException(status_code=500, detail="PyPDF2 is not installed on the server")
    
    try:
        # Read PDF content
        pdf_content = await file.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        
        # Extract text from all pages
        text_content = ""
        for page in pdf_reader.pages:
            text_content += page.extract_text() + "\n"
        
        if not text_content.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Determine if it's regulation or document
        if doc_type == "reg":
            # Extract section from filename
            import re
            section = re.sub(r'[^a-zA-Z0-9\s]', ' ', file.filename.replace('.pdf', ''))
            
            # Ingest as regulation with embedding
            rvec = embed(text_content)
            rvec_str = "[" + ",".join(str(x) for x in rvec) + "]"
            await execute(
                "INSERT INTO reg_texts(source,title,section,text,embedding) VALUES(%s,%s,%s,%s,CAST(%s AS VECTOR(384)))",
                ["uploaded", file.filename, section, text_content, rvec_str]
            )
        else:
            # Semantic chunking for documents
            chunks = _split_semantic_chunks(text_content, target=1000, overlap=120)
            for i, chunk in enumerate(chunks):
                vec = embed(chunk)
                vec_str = "[" + ",".join(str(x) for x in vec) + "]"
                
                await execute(
                    "INSERT INTO corp_docs(path,chunk_idx,content,embedding) VALUES(%s,%s,%s,CAST(%s AS VECTOR(384)))",
                    [file.filename, i, chunk, vec_str]
                )
        return {"ok": True}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@app.post("/query/hybrid", response_model=HybridResponseOut)
async def query_hybrid(inp: HybridIn):
    fts_sql = """
    SELECT id, section, text,
           COALESCE((LENGTH(LOWER(text)) - LENGTH(REPLACE(LOWER(text), LOWER(%s), ''))) / NULLIF(LENGTH(%s),0), 0) AS fts_score
    FROM reg_texts
    ORDER BY fts_score DESC
    LIMIT %s
    """
    fts_rows = await execute(fts_sql, [inp.query, inp.query, inp.top_k])

    qvec = embed(inp.query)
    qvec_str = "[" + ",".join(str(x) for x in qvec) + "]"
    vec_sql = """
    SELECT id, content,
           VEC_COSINE_DISTANCE(embedding, CAST(%s AS VECTOR(384))) AS vec_score
    FROM corp_docs
    ORDER BY vec_score ASC
    LIMIT %s
    """
    vec_rows = await execute(vec_sql, [qvec_str, inp.top_k])

    f_max = max([r["fts_score"] for r in fts_rows] or [1.0])
    f_min = min([r["fts_score"] for r in fts_rows] or [0.0])
    v_max = max([r["vec_score"] for r in vec_rows] or [1.0])
    v_min = min([r["vec_score"] for r in vec_rows] or [0.0])

    def norm(x, a, b):
        if a == b:
            return 0.5
        return (x - a) / (b - a)

    # Fetch precomputed regulation vector distance for FTS result set
    reg_items = []
    reg_ids = [r["id"] for r in fts_rows] if fts_rows else []
    reg_vec_map: dict[int, float] = {}
    if reg_ids:
        placeholders = ",".join(["%s"] * len(reg_ids))
        reg_vec_rows = await execute(
            f"SELECT id, VEC_COSINE_DISTANCE(embedding, CAST(%s AS VECTOR(384))) AS reg_vec_dist FROM reg_texts WHERE id IN ({placeholders})",
            [qvec_str, *reg_ids],
        )
        reg_vec_map = {r["id"]: r["reg_vec_dist"] for r in reg_vec_rows or []}
    for fr in fts_rows:
        reg_vec_dist = float(reg_vec_map.get(fr["id"], 1.0))
        reg_items.append({**fr, "reg_vec_dist": reg_vec_dist})

    alpha = 0.6
    merged = []
    for fr in reg_items:
        nf = norm(fr["fts_score"], f_min, f_max)
        # prefer reg that also semantically matches query
        rvn = 1.0 - norm(fr["reg_vec_dist"], 0.0, 2.0)  # distance in [0,2]
        nv = rvn
        score = alpha * nf + (1 - alpha) * nv
        # simple highlight spans for query tokens
        tokens = [t for t in (inp.query or "").lower().split() if len(t) >= 3]
        reg_spans: list[dict[str, int]] = []
        lt = fr["text"].lower()
        for tok in tokens:
            start = 0
            while True:
                idx = lt.find(tok, start)
                if idx == -1:
                    break
                reg_spans.append({"start": idx, "end": idx + len(tok)})
                start = idx + len(tok)
        merged.append({
            "type": "reg",
            "id": fr["id"],
            "section": fr["section"],
            "text": fr["text"],
            "fts_score": fr["fts_score"],
            "vec_score": fr["reg_vec_dist"],
            "final_score": score,
            "highlights": reg_spans
        })
    for vr in vec_rows:
        nf = 0.0
        nv = 1.0 - norm(vr["vec_score"], v_min, v_max)
        score = alpha * nf + (1 - alpha) * nv
        # highlights for docs
        tokens = [t for t in (inp.query or "").lower().split() if len(t) >= 3]
        doc_spans: list[dict[str, int]] = []
        lc = vr["content"].lower()
        for tok in tokens:
            start = 0
            while True:
                idx = lc.find(tok, start)
                if idx == -1:
                    break
                doc_spans.append({"start": idx, "end": idx + len(tok)})
                start = idx + len(tok)
        merged.append({
            "type": "doc",
            "id": vr["id"],
            "content": vr["content"],
            "vec_score": vr["vec_score"],
            "final_score": score,
            "highlights": doc_spans
        })
    merged.sort(key=lambda x: x["final_score"], reverse=True)
    
    # Apply pagination
    total = len(merged)
    start_idx = inp.offset
    end_idx = start_idx + inp.top_k
    paginated_results = merged[start_idx:end_idx]
    
    pagination = PaginationOut(
        total=total,
        limit=inp.top_k,
        offset=inp.offset,
        has_more=end_idx < total
    )
    
    return {"results": paginated_results, "pagination": pagination}

@app.post("/action/task", response_model=OkOut)
async def action_task(inp: TaskIn):
    insert_sql = """
    INSERT INTO tasks(finding_id, system, external_id, status, assignee, due_date)
    VALUES(%s,%s,%s,%s,%s,%s)
    """
    await execute(insert_sql, [inp.finding_id, inp.system, inp.external_id, inp.status, inp.assignee, inp.due_date])
    log_sql = """
    INSERT INTO audit_log(step, payload_json) VALUES(%s, JSON_OBJECT('finding_id', %s, 'system', %s, 'status', %s))
    """
    await execute(log_sql, ["create_task", inp.finding_id, inp.system, inp.status])
    return {"ok": True}


# Documents management endpoints
@app.get("/documents", response_model=DocumentsOut)
async def list_documents(limit: int = Query(default=50, ge=1, le=500), offset: int = Query(default=0, ge=0)):
    # Get total count first
    count_sql = """
    SELECT 
        (SELECT COUNT(DISTINCT path) FROM corp_docs) + 
        (SELECT COUNT(*) FROM reg_texts) as total
    """
    count_result = await execute(count_sql, [])
    total = count_result[0]["total"] if count_result else 0
    
    # Get documents with pagination
    docs_sql = """
    SELECT c.path,
           MIN(c.created_at) AS first_seen,
           MAX(c.created_at) AS last_seen,
           COUNT(*) AS chunks,
           m.display_name,
           m.description,
           COALESCE(m.resolved, FALSE) AS resolved
    FROM corp_docs c
    LEFT JOIN documents_meta m ON m.path = c.path
    GROUP BY c.path, m.display_name, m.description, m.resolved
    ORDER BY last_seen DESC
    LIMIT %s OFFSET %s
    """
    doc_rows = await execute(docs_sql, [limit, offset])
    docs = [{
        "path": r["path"],
        "display_name": r.get("display_name") or r["path"],
        "description": r.get("description"),
        "resolved": bool(r.get("resolved")),
        "first_seen": r["first_seen"].isoformat() if r["first_seen"] else None,
        "last_seen": r["last_seen"].isoformat() if r["last_seen"] else None,
        "chunks": r["chunks"],
        "type": "doc",
    } for r in doc_rows or []]

    # Also include regulations if we have space
    remaining_limit = limit - len(docs)
    remaining_offset = max(0, offset - len(docs))
    
    if remaining_limit > 0:
        regs_sql = """
        SELECT id, title, created_at
        FROM reg_texts
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """
        regs = await execute(regs_sql, [remaining_limit, remaining_offset])
        for r in regs or []:
            docs.append({
                "path": f"reg:{r['id']}",
                "display_name": r.get("title") or f"Reg {r['id']}",
                "description": None,
                "resolved": False,
                "first_seen": r["created_at"].isoformat() if r.get("created_at") else None,
                "last_seen": r["created_at"].isoformat() if r.get("created_at") else None,
                "chunks": 1,
                "type": "reg",
            })
    
    pagination = PaginationOut(
        total=total,
        limit=limit,
        offset=offset,
        has_more=(offset + len(docs)) < total
    )

    return {"documents": docs, "pagination": pagination}


@app.get("/documents/{path:path}", response_model=DocumentReadOut)
async def read_document(path: str):
    # Allow special reg:<id> paths to fetch regulation text
    if path.startswith("reg:"):
        try:
            reg_id = int(path.split(":", 1)[1])
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid regulation path")
        rows = await execute("SELECT text FROM reg_texts WHERE id=%s", [reg_id])
        content = rows[0]["text"] if rows else ""
        return {"path": path, "content": content}
    # Return concatenated content for regular documents
    sql = """
    SELECT content
    FROM corp_docs
    WHERE path=%s
    ORDER BY chunk_idx ASC
    """
    rows = await execute(sql, [path])
    content = "".join([r["content"] for r in rows or []])
    return {"path": path, "content": content}


@app.patch("/documents/{path:path}", response_model=OkOut)
async def update_document_meta(path: str, body: DocMetaIn | DocMarkIn, current_user: User = Depends(require_role(["analyst", "admin"]))): 
    # Upsert into documents_meta
    if isinstance(body, DocMarkIn):
        sql = """
        INSERT INTO documents_meta(path, resolved)
        VALUES(%s,%s)
        ON DUPLICATE KEY UPDATE resolved=VALUES(resolved)
        """
        await execute(sql, [path, body.resolved])
        return {"ok": True}
    else:
        sql = """
        INSERT INTO documents_meta(path, display_name, description)
        VALUES(%s,%s,%s)
        ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), description=VALUES(description)
        """
        await execute(sql, [path, body.display_name, body.description])
        return {"ok": True}


@app.delete("/documents/{path:path}", response_model=OkOut)
async def delete_document(path: str, current_user: User = Depends(require_role(["analyst", "admin"]))): 
    # Delete regulation or document
    if path.startswith("reg:"):
        try:
            reg_id = int(path.split(":", 1)[1])
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid regulation path")
        await execute("DELETE FROM reg_texts WHERE id=%s", [reg_id])
        # keep meta cleanup safe: our meta is keyed by path, so use reg:<id>
        await execute("DELETE FROM documents_meta WHERE path=%s", [path])
    else:
        await execute("DELETE FROM corp_docs WHERE path=%s", [path])
        await execute("DELETE FROM documents_meta WHERE path=%s", [path])
    return {"ok": True}


@app.post("/mappings", response_model=OkOut)
async def create_mapping(inp: MapIn, current_user: User = Depends(require_role(["analyst", "admin"]))): 
    sql = "INSERT INTO mappings(reg_id, doc_id, confidence) VALUES(%s,%s,%s)"
    await execute(sql, [inp.reg_id, inp.doc_id, inp.confidence])
    return {"ok": True}

@app.get("/coverage", response_model=CoverageOut)
async def coverage():
    sql = """
    SELECT r.id as reg_id, r.section, COUNT(m.id) as evidence_count
    FROM reg_texts r
    LEFT JOIN mappings m ON m.reg_id = r.id
    GROUP BY r.id, r.section
    ORDER BY evidence_count DESC
    """
    rows = await execute(sql, [])
    return {"items": rows}


@app.get("/coverage/{reg_id}", response_model=CoverageDetailOut)
async def coverage_detail(reg_id: int):
    header = await execute("SELECT id, section, text FROM reg_texts WHERE id=%s", [reg_id])
    items_sql = """
    SELECT m.id as mapping_id, m.confidence, c.id as doc_id, c.path, LEFT(c.content, 200) as snippet
    FROM mappings m
    JOIN corp_docs c ON c.id = m.doc_id
    WHERE m.reg_id=%s
    ORDER BY m.confidence DESC, c.created_at DESC
    LIMIT 50
    """
    items = await execute(items_sql, [reg_id])
    return {"reg": header[0] if header else None, "items": items}


def _ollama_url() -> str:
    return os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")

def _extract_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except Exception:
        pass
    # try to extract fenced code block
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start:end+1])
    except Exception:
        return None
    return None

# Global error handlers (consistent API errors)
app.add_exception_handler(APIError, cast(ExceptionHandler, api_error_handler))
app.add_exception_handler(HTTPException, cast(ExceptionHandler, http_error_handler))
app.add_exception_handler(RequestValidationError, cast(ExceptionHandler, validation_error_handler))
app.add_exception_handler(Exception, unhandled_error_handler)

@app.post("/ai/explain", response_model=ExplainOut)
async def ai_explain(inp: ExplainIn):
    prompt = (
        "You are a compliance analyst. Given the regulation excerpt and company document excerpt, "
        "explain the relationship, identify any potential compliance risks, and summarize in 5 bullets.\n\n"
        f"Regulation:\n{inp.regulation_text}\n\n"
        f"Document:\n{inp.document_text}\n\n"
        + (f"Query: {inp.query}\n\n" if inp.query else "")
        + "Return STRICT JSON with fields: summary (string), risks (array of strings). No extra commentary."
    )
    model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    payload = {"model": model, "prompt": prompt, "stream": False}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(_ollama_url() + "/api/generate", json=payload)
            r.raise_for_status()
            data = r.json()
        raw = data.get("response", "")
        parsed = _extract_json(raw)
        if parsed and isinstance(parsed, dict):
            summary = str(parsed.get("summary") or "")
            risks = [str(x) for x in (parsed.get("risks") or [])]
            return {"result": {"summary": summary, "risks": risks}}
        return {"result": {"summary": str(raw), "risks": []}}
    except httpx.HTTPStatusError as http_exc:
        # Common case: model not found returns 404 from Ollama
        if http_exc.response is not None and http_exc.response.status_code == 404:
            available = []
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    tags = await client.get(_ollama_url() + "/api/tags")
                    if tags.status_code == 200:
                        tag_json = tags.json()
                        available = [m.get("name") for m in (tag_json.get("models") or []) if m.get("name")]
            except Exception:
                pass
            detail = {
                "error": "model_not_found",
                "message": f"Model '{model}' not found in Ollama. Install it or pick an installed one.",
                "hint": [
                    f"ollama pull {model}",
                    "or set OLLAMA_MODEL to one of: " + ", ".join(available) if available else "ollama list to see installed models",
                ],
            }
            raise HTTPException(status_code=503, detail=detail)
        raise HTTPException(status_code=503, detail=f"LLM backend unavailable: {http_exc}")
    except Exception as exc:  # network/timeouts/unavailable server
        raise HTTPException(status_code=503, detail=f"LLM backend unavailable: {exc}")


@app.post("/ai/fix-it", response_model=FixItOut)
async def ai_fix_it(inp: FixItIn):
    prompt = (
        "You are a compliance officer. Draft a practical remediation plan to address gaps between the regulation and the document. "
        "Provide prioritized actions, owners, and timelines in bullet points.\n\n"
        f"Regulation:\n{inp.regulation_text}\n\n"
        f"Document:\n{inp.document_text}\n\n"
        + (f"Context: {inp.context}\n\n" if inp.context else "")
        + "Return STRICT JSON with fields: actions (array of {title, owner, timeline}), notes (string)."
    )
    model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    payload = {"model": model, "prompt": prompt, "stream": False}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(_ollama_url() + "/api/generate", json=payload)
            r.raise_for_status()
            data = r.json()
        raw = data.get("response", "")
        parsed = _extract_json(raw)
        if parsed and isinstance(parsed, dict):
            actions_src = parsed.get("actions") or []
            actions: list[dict] = []
            for a in actions_src:
                try:
                    title = str(a.get("title") if isinstance(a, dict) else a)
                except Exception:
                    title = str(a)
                owner = a.get("owner") if isinstance(a, dict) else None
                timeline = a.get("timeline") if isinstance(a, dict) else None
                actions.append({"title": title, "owner": owner, "timeline": timeline})
            notes = parsed.get("notes") if isinstance(parsed.get("notes"), str) else ""
            return {"result": {"actions": actions, "notes": notes}}
        return {"result": {"actions": [{"title": str(raw), "owner": None, "timeline": None}], "notes": ""}}
    except httpx.HTTPStatusError as http_exc:
        if http_exc.response is not None and http_exc.response.status_code == 404:
            available = []
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    tags = await client.get(_ollama_url() + "/api/tags")
                    if tags.status_code == 200:
                        tag_json = tags.json()
                        available = [m.get("name") for m in (tag_json.get("models") or []) if m.get("name")]
            except Exception:
                pass
            detail = {
                "error": "model_not_found",
                "message": f"Model '{model}' not found in Ollama. Install it or pick an installed one.",
                "hint": [
                    f"ollama pull {model}",
                    "or set OLLAMA_MODEL to one of: " + ", ".join(available) if available else "ollama list to see installed models",
                ],
            }
            raise HTTPException(status_code=503, detail=detail)
        raise HTTPException(status_code=503, detail=f"LLM backend unavailable: {http_exc}")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"LLM backend unavailable: {exc}")


@app.get("/recent-documents", response_model=RecentDocumentsOut)
async def get_recent_documents():
    # Get recent regulations
    reg_sql = """
    SELECT id, source, title, created_at
    FROM reg_texts
    ORDER BY created_at DESC
    LIMIT 5
    """
    reg_rows = await execute(reg_sql, [])
    
    # Get recent documents
    doc_sql = """
    SELECT DISTINCT path, MIN(created_at) as created_at
    FROM corp_docs
    GROUP BY path
    ORDER BY created_at DESC
    LIMIT 5
    """
    doc_rows = await execute(doc_sql, [])
    
    # Combine and format results
    documents = []
    
    for reg in reg_rows or []:
        documents.append({
            "id": reg["id"],
            "name": reg["title"],
            "type": "reg",
            "uploadedAt": reg["created_at"].isoformat() if reg["created_at"] else None,
            "source": reg["source"]
        })
    
    for doc in doc_rows or []:
        documents.append({
            "id": doc["path"].replace("/", "_").replace(".", "_"),  # Generate a pseudo ID
            "name": doc["path"],
            "type": "doc",
            "uploadedAt": doc["created_at"].isoformat() if doc["created_at"] else None,
            "path": doc["path"]
        })
    
    # Sort by upload time (most recent first)
    documents.sort(key=lambda x: x["uploadedAt"] or "", reverse=True)
    
    # Return top 10 most recent
    return {"documents": documents[:10]}


# Chat endpoints
@app.post("/chat", response_model=ChatResponseOut)
async def send_chat_message(message: ChatMessageIn, current_user: User = Depends(get_current_active_user)):
    """Send a message in a conversation and get AI response based on uploaded documents"""
    try:
        # Resolve numeric user_id from username for conversations table
        user_id_rows = await execute("SELECT id FROM users WHERE username = %s", [current_user.username])
        if not user_id_rows:
            raise HTTPException(status_code=404, detail="User not found")
        db_user_id = user_id_rows[0]["id"]

        # Create or get conversation
        conversation_id = message.conversation_id
        if not conversation_id:
            # Create new conversation with auto-generated title
            title = message.content[:50] + ("..." if len(message.content) > 50 else "")
            conv_sql = "INSERT INTO conversations (user_id, title) VALUES (%s, %s)"
            await execute(conv_sql, [db_user_id, title])
            
            # Get the new conversation ID
            conv_rows = await execute("SELECT LAST_INSERT_ID() as id")
            conversation_id = conv_rows[0]["id"] if conv_rows else None
            if not conversation_id:
                raise HTTPException(status_code=500, detail="Failed to create conversation")
        
        # Store user message
        user_msg_sql = "INSERT INTO messages (conversation_id, role, content) VALUES (%s, %s, %s)"
        await execute(user_msg_sql, [conversation_id, "user", message.content])
        
        # Get relevant documents using hybrid search
        search_query = {"query": message.content, "top_k": 5, "offset": 0}
        search_results = []
        
        # Search regulations
        reg_sql = """
        SELECT id, source, title, section, text,
               MATCH(text) AGAINST(%s IN NATURAL LANGUAGE MODE) as fts_score
        FROM reg_texts
        WHERE MATCH(text) AGAINST(%s IN NATURAL LANGUAGE MODE)
        ORDER BY fts_score DESC
        LIMIT %s
        """
        reg_rows = await execute(reg_sql, [message.content, message.content, 3])
        
        for reg in reg_rows or []:
            search_results.append({
                "type": "regulation",
                "title": reg["title"],
                "section": reg["section"],
                "content": reg["text"],
                "source": reg["source"]
            })
        
        # Search document chunks
        if search_results:
            query_embedding = embed(message.content)
            if query_embedding:
                doc_sql = """
                SELECT path, content, chunk_idx,
                       VEC_COSINE_DISTANCE(embedding, %s) as distance
                FROM corp_docs
                WHERE VEC_COSINE_DISTANCE(embedding, %s) < 0.7
                ORDER BY distance ASC
                LIMIT %s
                """
                doc_rows = await execute(doc_sql, [query_embedding, query_embedding, 2])
                
                for doc in doc_rows or []:
                    search_results.append({
                        "type": "document",
                        "path": doc["path"],
                        "content": doc["content"],
                        "chunk_idx": doc["chunk_idx"]
                    })
        
        # Generate AI response using Ollama
        context = "\n\n".join([f"[{r['type'].upper()}] {r.get('title', r.get('path', 'Document'))}: {r['content'][:500]}..." for r in search_results])
        
        system_prompt = """You are LexMind, an AI compliance assistant. Answer questions based on the provided regulatory and document context. Be concise but thorough. If you cannot answer based on the context, say so.
        
Context:
        {}""".format(context)
        
        messages_for_llm = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message.content}
        ]
        
        model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        url = _ollama_url() + "/api/chat"
        payload = {
            "model": model,
            "messages": messages_for_llm,
            "stream": False
        }
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            
            ai_response = response.json().get("message", {}).get("content", "I apologize, but I couldn't generate a response.")
        
        # Store AI response
        ai_metadata = {"sources": search_results[:3]} if search_results else None
        ai_msg_sql = "INSERT INTO messages (conversation_id, role, content, metadata) VALUES (%s, %s, %s, %s)"
        await execute(ai_msg_sql, [conversation_id, "assistant", ai_response, json.dumps(ai_metadata) if ai_metadata else None])
        
        # Get conversation details
        conv_detail_sql = """
        SELECT c.*, COUNT(m.id) as message_count
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        WHERE c.id = %s
        GROUP BY c.id
        """
        conv_rows = await execute(conv_detail_sql, [conversation_id])
        conv = conv_rows[0] if conv_rows else None
        
        # Get the AI message we just created
        msg_sql = "SELECT * FROM messages WHERE conversation_id = %s AND role = 'assistant' ORDER BY created_at DESC LIMIT 1"
        msg_rows = await execute(msg_sql, [conversation_id])
        ai_msg = msg_rows[0] if msg_rows else None
        if not ai_msg:
            raise HTTPException(status_code=500, detail="Assistant message not found after creation")

        if not conv:
            raise HTTPException(status_code=500, detail="Conversation not found after creation")

        return {
            "message": {
                "id": ai_msg["id"],
                "conversation_id": conversation_id,
                "role": ai_msg["role"],
                "content": ai_msg["content"],
                "metadata": json.loads(ai_msg["metadata"]) if ai_msg["metadata"] else None,
                "created_at": ai_msg["created_at"].isoformat()
            },
            "conversation": {
                "id": conv["id"],
                "title": conv["title"],
                "created_at": conv["created_at"].isoformat(),
                "updated_at": conv["updated_at"].isoformat(),
                "message_count": conv["message_count"]
            },
            "sources": search_results[:3] if search_results else None
        }
        
    except httpx.HTTPError as http_exc:
        raise HTTPException(status_code=503, detail=f"AI service unavailable: {http_exc}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.get("/chat/conversations", response_model=list[ConversationOut])
async def get_conversations(current_user: User = Depends(get_current_active_user)):
    """Get user's conversation list"""
    sql = """
    SELECT c.*, COUNT(m.id) as message_count
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.user_id = %s
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    """
    # Resolve numeric user_id from username
    uid_rows = await execute("SELECT id FROM users WHERE username = %s", [current_user.username])
    db_user_id = uid_rows[0]["id"] if uid_rows else None
    rows = await execute(sql, [db_user_id])
    
    return [{
        "id": row["id"],
        "title": row["title"],
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
        "message_count": row["message_count"]
    } for row in rows or []]


@app.get("/chat/conversations/{conversation_id}/messages", response_model=list[ChatMessageOut])
async def get_conversation_messages(conversation_id: int, current_user: User = Depends(get_current_active_user)):
    """Get messages for a conversation"""
    # Verify user owns this conversation
    conv_sql = "SELECT id FROM conversations WHERE id = %s AND user_id = %s"
    uid_rows = await execute("SELECT id FROM users WHERE username = %s", [current_user.username])
    db_user_id = uid_rows[0]["id"] if uid_rows else None
    conv_rows = await execute(conv_sql, [conversation_id, db_user_id])
    if not conv_rows:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    sql = """
    SELECT * FROM messages
    WHERE conversation_id = %s
    ORDER BY created_at ASC
    """
    rows = await execute(sql, [conversation_id])
    
    return [{
        "id": row["id"],
        "conversation_id": row["conversation_id"],
        "role": row["role"],
        "content": row["content"],
        "metadata": json.loads(row["metadata"]) if row["metadata"] else None,
        "created_at": row["created_at"].isoformat()
    } for row in rows or []]


@app.delete("/chat/conversations/{conversation_id}")
async def delete_conversation(conversation_id: int, current_user: User = Depends(get_current_active_user)):
    """Delete a conversation and all its messages"""
    # Verify user owns this conversation
    conv_sql = "SELECT id FROM conversations WHERE id = %s AND user_id = %s"
    uid_rows = await execute("SELECT id FROM users WHERE username = %s", [current_user.username])
    db_user_id = uid_rows[0]["id"] if uid_rows else None
    conv_rows = await execute(conv_sql, [conversation_id, db_user_id])
    if not conv_rows:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Delete conversation (messages will be deleted by CASCADE)
    await execute("DELETE FROM conversations WHERE id = %s", [conversation_id])
    return {"ok": True}


# Compliance Analysis Endpoints
@app.post("/compliance/analyze", response_model=ComplianceAnalysisOut)
async def analyze_document_compliance(doc_id: int, current_user: User = Depends(require_role(["analyst", "admin"]))):
    """Analyze a document for compliance issues and generate score"""
    try:
        # Get document content
        doc_sql = """
        SELECT id, path, content
        FROM corp_docs
        WHERE id = %s
        LIMIT 1
        """
        doc_rows = await execute(doc_sql, [doc_id])
        
        if not doc_rows:
            raise HTTPException(status_code=404, detail="Document not found")
        
        doc = doc_rows[0]
        
        # Get all chunks for this document
        chunks_sql = """
        SELECT content
        FROM corp_docs
        WHERE path = %s
        ORDER BY chunk_idx ASC
        """
        chunk_rows = await execute(chunks_sql, [doc["path"]])
        
        # Combine all chunks
        full_content = "\n".join([chunk["content"] for chunk in chunk_rows or []])
        
        # Perform compliance analysis
        analysis_result = await compliance_analyzer.analyze_document(
            doc_id, full_content, doc["path"]
        )
        
        return analysis_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/compliance/status/{doc_id}", response_model=ComplianceStatusOut)
async def get_document_compliance_status(doc_id: int, current_user: User = Depends(get_current_active_user)):
    """Get compliance status for a specific document"""
    sql = """
    SELECT dcs.*, cd.path
    FROM document_compliance_status dcs
    LEFT JOIN corp_docs cd ON dcs.doc_id = cd.id
    WHERE dcs.doc_id = %s
    LIMIT 1
    """
    rows = await execute(sql, [doc_id])
    
    if not rows:
        raise HTTPException(status_code=404, detail="Compliance status not found")
    
    status = rows[0]
    
    # Parse metadata for categories
    categories = []
    if status.get("metadata"):
        try:
            metadata = json.loads(status["metadata"])
            categories = metadata.get("categories", [])
        except:
            pass
    
    return {
        "doc_id": status["doc_id"],
        "path": status["path"] or "",
        "overall_score": status["overall_score"],
        "risk_level": status["risk_level"],
        "compliance_status": status["compliance_status"],
        "total_issues": status["total_issues"],
        "critical_issues": status["critical_issues"],
        "high_issues": status["high_issues"],
        "medium_issues": status["medium_issues"],
        "low_issues": status["low_issues"],
        "last_analyzed": status["last_analyzed"].isoformat() if status["last_analyzed"] else "",
        "categories": categories
    }


@app.get("/compliance/dashboard", response_model=ComplianceDashboardOut)
async def get_compliance_dashboard(current_user: User = Depends(get_current_active_user)):
    """Get compliance dashboard overview data"""
    
    # Total documents
    total_docs_sql = "SELECT COUNT(DISTINCT path) as count FROM corp_docs"
    total_docs_rows = await execute(total_docs_sql)
    total_documents = total_docs_rows[0]["count"] if total_docs_rows else 0
    
    # Analyzed documents
    analyzed_docs_sql = "SELECT COUNT(*) as count FROM document_compliance_status"
    analyzed_docs_rows = await execute(analyzed_docs_sql)
    analyzed_documents = analyzed_docs_rows[0]["count"] if analyzed_docs_rows else 0
    
    # Average score
    avg_score_sql = "SELECT AVG(overall_score) as avg_score FROM document_compliance_status WHERE overall_score IS NOT NULL"
    avg_score_rows = await execute(avg_score_sql)
    average_score = float(avg_score_rows[0]["avg_score"] or 0) if avg_score_rows else 0.0
    
    # Compliance distribution
    compliance_dist_sql = """
    SELECT compliance_status, COUNT(*) as count
    FROM document_compliance_status
    GROUP BY compliance_status
    """
    compliance_dist_rows = await execute(compliance_dist_sql)
    compliance_distribution = {row["compliance_status"]: row["count"] for row in compliance_dist_rows or []}
    
    # Risk distribution
    risk_dist_sql = """
    SELECT risk_level, COUNT(*) as count
    FROM document_compliance_status
    GROUP BY risk_level
    """
    risk_dist_rows = await execute(risk_dist_sql)
    risk_distribution = {row["risk_level"]: row["count"] for row in risk_dist_rows or []}
    
    # Recent analyses
    recent_sql = """
    SELECT dcs.*, cd.path
    FROM document_compliance_status dcs
    LEFT JOIN corp_docs cd ON dcs.doc_id = cd.id
    ORDER BY dcs.last_analyzed DESC
    LIMIT 10
    """
    recent_rows = await execute(recent_sql)
    
    recent_analyses = []
    for row in recent_rows or []:
        categories = []
        if row.get("metadata"):
            try:
                metadata = json.loads(row["metadata"])
                categories = metadata.get("categories", [])
            except:
                pass
        
        recent_analyses.append({
            "doc_id": row["doc_id"],
            "path": row["path"] or "",
            "overall_score": row["overall_score"],
            "risk_level": row["risk_level"],
            "compliance_status": row["compliance_status"],
            "total_issues": row["total_issues"],
            "critical_issues": row["critical_issues"],
            "high_issues": row["high_issues"],
            "medium_issues": row["medium_issues"],
            "low_issues": row["low_issues"],
            "last_analyzed": row["last_analyzed"].isoformat() if row["last_analyzed"] else "",
            "categories": categories
        })
    
    # Top issues
    top_issues_sql = """
    SELECT ca.title, ca.description, ca.risk_level, ca.category, COUNT(*) as frequency
    FROM compliance_analysis ca
    WHERE ca.analysis_type = 'compliance_score'
    GROUP BY ca.title, ca.description, ca.risk_level, ca.category
    ORDER BY frequency DESC, ca.risk_level DESC
    LIMIT 10
    """
    top_issues_rows = await execute(top_issues_sql)
    top_issues = [{
        "title": row["title"],
        "description": row["description"],
        "risk_level": row["risk_level"],
        "category": row["category"],
        "frequency": row["frequency"]
    } for row in top_issues_rows or []]
    
    # Framework coverage
    frameworks_sql = "SELECT name, full_name, category FROM compliance_frameworks WHERE is_active = TRUE"
    frameworks_rows = await execute(frameworks_sql)
    framework_coverage = [{
        "name": row["name"],
        "full_name": row["full_name"],
        "category": row["category"],
        "coverage": 0  # TODO: Calculate actual coverage
    } for row in frameworks_rows or []]
    
    return {
        "total_documents": total_documents,
        "analyzed_documents": analyzed_documents,
        "average_score": round(average_score, 1),
        "compliance_distribution": compliance_distribution,
        "risk_distribution": risk_distribution,
        "recent_analyses": recent_analyses,
        "top_issues": top_issues,
        "framework_coverage": framework_coverage
    }


@app.get("/compliance/frameworks")
async def get_compliance_frameworks(current_user: User = Depends(get_current_active_user)):
    """Get available compliance frameworks"""
    sql = "SELECT * FROM compliance_frameworks WHERE is_active = TRUE ORDER BY name"
    rows = await execute(sql)
    
    frameworks = []
    for row in rows or []:
        framework = dict(row)
        # Parse requirements JSON
        try:
            framework["requirements"] = json.loads(framework["requirements"]) if framework["requirements"] else []
        except:
            framework["requirements"] = []
        frameworks.append(framework)
    
    return {"frameworks": frameworks}


# Workflow automation endpoints
class WorkflowTemplateOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    category: str
    trigger_type: str
    trigger_config: dict = {}
    steps: list
    is_active: bool
    created_by: str | None = None
    created_at: str
    updated_at: str

class WorkflowInstanceOut(BaseModel):
    id: int
    template_id: int
    name: str
    status: str
    trigger_data: dict = {}
    context_data: dict = {}
    current_step: int
    total_steps: int
    started_at: str | None = None
    completed_at: str | None = None
    error_message: str | None = None
    assigned_to: str | None = None
    priority: str
    created_at: str
    updated_at: str

class CreateWorkflowInstanceIn(BaseModel):
    template_id: int
    trigger_data: dict = {}
    context_data: dict = {}
    assigned_to: str | None = None

class WorkflowStatusOut(BaseModel):
    instance: dict
    steps: list
    progress: dict


@app.get("/workflow/templates", response_model=dict)
async def get_workflow_templates(current_user: User = Depends(get_current_active_user)):
    """Get available workflow templates"""
    sql = """
    SELECT id, name, description, category, trigger_type, trigger_config, 
           steps, is_active, created_by, created_at, updated_at
    FROM workflow_templates 
    WHERE is_active = TRUE 
    ORDER BY category, name
    """
    rows = await execute(sql)
    
    templates = []
    for row in rows or []:
        template = dict(row)
        # Parse JSON fields
        try:
            template["trigger_config"] = json.loads(template["trigger_config"]) if template["trigger_config"] else {}
            template["steps"] = json.loads(template["steps"]) if template["steps"] else []
        except:
            template["trigger_config"] = {}
            template["steps"] = []
        
        # Convert datetime to string
        if template["created_at"]:
            template["created_at"] = template["created_at"].isoformat()
        if template["updated_at"]:
            template["updated_at"] = template["updated_at"].isoformat()
            
        templates.append(template)
    
    return {"templates": templates}


@app.get("/workflow/instances", response_model=dict)
async def get_workflow_instances(
    status: str = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user)
):
    """Get workflow instances"""
    
    # Build WHERE clause
    where_conditions = ["1=1"]
    params = []
    
    if status:
        where_conditions.append("wi.status = %s")
        params.append(status)
    
    where_clause = " AND ".join(where_conditions)
    
    # Get total count
    count_sql = f"""
    SELECT COUNT(*) as total
    FROM workflow_instances wi
    WHERE {where_clause}
    """
    count_result = await execute(count_sql, params)
    total = count_result[0]["total"] if count_result else 0
    
    # Get instances with pagination
    sql = f"""
    SELECT wi.*, wt.name as template_name
    FROM workflow_instances wi
    JOIN workflow_templates wt ON wi.template_id = wt.id
    WHERE {where_clause}
    ORDER BY wi.created_at DESC
    LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])
    rows = await execute(sql, params)
    
    instances = []
    for row in rows or []:
        instance = dict(row)
        # Parse JSON fields
        try:
            instance["trigger_data"] = json.loads(instance["trigger_data"]) if instance["trigger_data"] else {}
            instance["context_data"] = json.loads(instance["context_data"]) if instance["context_data"] else {}
        except:
            instance["trigger_data"] = {}
            instance["context_data"] = {}
        
        # Convert datetime to string
        for field in ["started_at", "completed_at", "created_at", "updated_at"]:
            if instance[field]:
                instance[field] = instance[field].isoformat()
        
        instances.append(instance)
    
    return {
        "instances": instances,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": offset + limit < total
        }
    }


@app.post("/workflow/instances", response_model=dict)
async def create_workflow_instance(
    request: CreateWorkflowInstanceIn,
    current_user: User = Depends(require_role(["analyst", "admin"]))
):
    """Create and start a new workflow instance"""
    
    try:
        instance_id = await workflow_engine.create_workflow_instance(
            template_id=request.template_id,
            trigger_data=request.trigger_data,
            context_data=request.context_data,
            assigned_to=request.assigned_to or current_user.username
        )
        
        # Start the workflow
        success = await workflow_engine.start_workflow(instance_id)
        
        if success:
            return {"instance_id": instance_id, "status": "started"}
        else:
            raise HTTPException(status_code=500, detail="Failed to start workflow")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create workflow: {str(e)}")


@app.get("/workflow/instances/{instance_id}/status", response_model=WorkflowStatusOut)
async def get_workflow_status(
    instance_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """Get workflow instance status and progress"""
    
    try:
        status = await workflow_engine.get_workflow_status(instance_id)
        
        # Convert datetime fields to strings
        if status["instance"]["created_at"]:
            status["instance"]["created_at"] = status["instance"]["created_at"].isoformat()
        if status["instance"]["updated_at"]:
            status["instance"]["updated_at"] = status["instance"]["updated_at"].isoformat()
        if status["instance"]["started_at"]:
            status["instance"]["started_at"] = status["instance"]["started_at"].isoformat()
        if status["instance"]["completed_at"]:
            status["instance"]["completed_at"] = status["instance"]["completed_at"].isoformat()
        
        # Parse JSON fields
        try:
            status["instance"]["trigger_data"] = json.loads(status["instance"]["trigger_data"]) if status["instance"]["trigger_data"] else {}
            status["instance"]["context_data"] = json.loads(status["instance"]["context_data"]) if status["instance"]["context_data"] else {}
        except:
            status["instance"]["trigger_data"] = {}
            status["instance"]["context_data"] = {}
        
        # Convert step datetime fields
        for step in status["steps"]:
            for field in ["started_at", "completed_at", "created_at", "updated_at"]:
                if step[field]:
                    step[field] = step[field].isoformat()
            
            # Parse JSON fields
            try:
                step["input_data"] = json.loads(step["input_data"]) if step["input_data"] else {}
                step["output_data"] = json.loads(step["output_data"]) if step["output_data"] else {}
            except:
                step["input_data"] = {}
                step["output_data"] = {}
        
        return status
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get workflow status: {str(e)}")


@app.post("/workflow/instances/{instance_id}/resume", response_model=dict)
async def resume_workflow(
    instance_id: int,
    current_user: User = Depends(require_role(["analyst", "admin"]))
):
    """Resume a paused workflow"""
    
    try:
        success = await workflow_engine.resume_workflow(instance_id)
        
        if success:
            return {"status": "resumed"}
        else:
            raise HTTPException(status_code=500, detail="Failed to resume workflow")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume workflow: {str(e)}")


@app.post("/workflow/instances/{instance_id}/cancel", response_model=dict)
async def cancel_workflow(
    instance_id: int,
    current_user: User = Depends(require_role(["analyst", "admin"]))
):
    """Cancel a running workflow"""
    
    try:
        success = await workflow_engine.cancel_workflow(instance_id)
        
        if success:
            return {"status": "cancelled"}
        else:
            raise HTTPException(status_code=500, detail="Failed to cancel workflow")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel workflow: {str(e)}")


@app.post("/workflow/trigger/document-upload", response_model=dict)
async def trigger_document_upload_workflows(
    document_id: int,
    document_path: str,
    current_user: User = Depends(get_current_active_user)
):
    """Trigger workflows for document upload events"""
    
    try:
        # Find templates that should be triggered by document upload
        templates_sql = """
        SELECT id, name, trigger_config 
        FROM workflow_templates 
        WHERE trigger_type = 'document_upload' AND is_active = TRUE
        """
        templates = await execute(templates_sql)
        
        triggered_workflows = []
        
        for template in templates or []:
            try:
                trigger_config = json.loads(template["trigger_config"]) if template["trigger_config"] else {}
                
                # Check if this document type should trigger the workflow
                document_types = trigger_config.get("document_types", [])
                auto_start = trigger_config.get("auto_start", False)
                
                # Simple document type detection based on path
                detected_type = "document"
                if any(keyword in document_path.lower() for keyword in ["policy", "procedure"]):
                    detected_type = "policy"
                elif "contract" in document_path.lower():
                    detected_type = "contract"
                
                # Check if workflow should be triggered
                should_trigger = (
                    not document_types or  # No filter means trigger for all
                    detected_type in document_types or
                    "all" in document_types
                )
                
                if should_trigger:
                    # Create workflow instance
                    instance_id = await workflow_engine.create_workflow_instance(
                        template_id=template["id"],
                        trigger_data={
                            "event": "document_upload",
                            "document_id": document_id,
                            "document_path": document_path,
                            "document_type": detected_type,
                            "triggered_by": current_user.username
                        },
                        context_data={
                            "document_id": document_id,
                            "document_path": document_path,
                            "instance_id": None  # Will be set after creation
                        },
                        assigned_to=current_user.username
                    )
                    
                    # Update context with instance ID
                    await execute(
                        "UPDATE workflow_instances SET context_data = JSON_SET(context_data, '$.instance_id', %s) WHERE id = %s",
                        (instance_id, instance_id)
                    )
                    
                    # Start workflow if auto_start is enabled
                    if auto_start:
                        await workflow_engine.start_workflow(instance_id)
                        status = "started"
                    else:
                        status = "created"
                    
                    triggered_workflows.append({
                        "template_id": template["id"],
                        "template_name": template["name"],
                        "instance_id": instance_id,
                        "status": status
                    })
                    
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to trigger workflow template {template['id']}: {str(e)}")
        
        return {
            "triggered_workflows": triggered_workflows,
            "count": len(triggered_workflows)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger workflows: {str(e)}")


# Document versioning endpoints
class DocumentVersionOut(BaseModel):
    id: int
    document_id: int
    version_number: int
    path: str
    content_hash: str
    file_size: int
    mime_type: str | None = None
    metadata: dict = {}
    upload_type: str
    uploaded_by: str
    upload_reason: str | None = None
    is_current: bool
    is_archived: bool
    created_at: str
    change_count: int = 0
    tags: str | None = None
    comment_count: int = 0
    approval_count: int = 0

class CreateVersionIn(BaseModel):
    content: str
    upload_reason: str | None = None
    upload_type: str = "update"

class VersionComparisonOut(BaseModel):
    version1: dict
    version2: dict
    changes: list
    statistics: dict

class VersionCommentIn(BaseModel):
    comment_text: str
    comment_type: str = "general"
    change_id: int | None = None

class VersionTagIn(BaseModel):
    tag_name: str
    tag_value: str
    tag_type: str = "custom"


@app.get("/documents/{document_id}/versions", response_model=dict)
async def get_document_versions(
    document_id: int,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user)
):
    """Get version history for a document"""
    
    try:
        versions = await version_manager.get_document_versions(document_id, limit)
        
        return {
            "document_id": document_id,
            "versions": versions,
            "total": len(versions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get document versions: {str(e)}")


@app.post("/documents/{document_id}/versions", response_model=dict)
async def create_document_version(
    document_id: int,
    request: CreateVersionIn,
    current_user: User = Depends(require_role(["analyst", "admin"]))
):
    """Create a new version of a document"""
    
    try:
        # Get document path
        doc_query = "SELECT path FROM corp_docs WHERE id = %s"
        doc_result = await execute(doc_query, [document_id])
        
        if not doc_result:
            raise HTTPException(status_code=404, detail="Document not found")
        
        document_path = doc_result[0]['path']
        
        # Create new version
        version_id = await version_manager.create_document_version(
            document_id=document_id,
            content=request.content,
            path=document_path,
            uploaded_by=current_user.username,
            upload_type=UploadType(request.upload_type),
            upload_reason=request.upload_reason
        )
        
        # Trigger document upload workflows
        try:
            await trigger_document_upload_workflows(document_id, document_path, current_user)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to trigger workflows for version creation: {str(e)}")
        
        return {
            "version_id": version_id,
            "document_id": document_id,
            "status": "created"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create document version: {str(e)}")


@app.get("/documents/{document_id}/versions/compare", response_model=VersionComparisonOut)
async def compare_document_versions(
    document_id: int,
    version1: int = Query(..., description="First version number"),
    version2: int = Query(..., description="Second version number"),
    current_user: User = Depends(get_current_active_user)
):
    """Compare two versions of a document"""
    
    try:
        comparison = await version_manager.compare_versions(document_id, version1, version2)
        return comparison
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compare versions: {str(e)}")


@app.post("/documents/{document_id}/versions/{version_number}/rollback", response_model=dict)
async def rollback_document_version(
    document_id: int,
    version_number: int,
    reason: str = Body(..., description="Reason for rollback"),
    current_user: User = Depends(require_role(["admin"]))
):
    """Rollback document to a previous version"""
    
    try:
        version_id = await version_manager.rollback_to_version(
            document_id=document_id,
            target_version=version_number,
            rolled_back_by=current_user.username,
            reason=reason
        )
        
        return {
            "version_id": version_id,
            "document_id": document_id,
            "rolled_back_to": version_number,
            "status": "rollback_complete"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rollback version: {str(e)}")


@app.post("/documents/{document_id}/versions/{version_id}/comments", response_model=dict)
async def add_version_comment(
    document_id: int,
    version_id: int,
    request: VersionCommentIn,
    current_user: User = Depends(get_current_active_user)
):
    """Add a comment to a document version"""
    
    try:
        comment_id = await version_manager.add_version_comment(
            version_id=version_id,
            commenter=current_user.username,
            comment_text=request.comment_text,
            comment_type=request.comment_type,
            change_id=request.change_id
        )
        
        return {
            "comment_id": comment_id,
            "version_id": version_id,
            "status": "comment_added"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add comment: {str(e)}")


@app.post("/documents/{document_id}/versions/{version_id}/tags", response_model=dict)
async def add_version_tag(
    document_id: int,
    version_id: int,
    request: VersionTagIn,
    current_user: User = Depends(require_role(["analyst", "admin"]))
):
    """Add a tag to a document version"""
    
    try:
        tag_id = await version_manager.add_version_tag(
            version_id=version_id,
            tag_name=request.tag_name,
            tag_value=request.tag_value,
            tag_type=request.tag_type,
            created_by=current_user.username
        )
        
        return {
            "tag_id": tag_id,
            "version_id": version_id,
            "status": "tag_added"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add tag: {str(e)}")


@app.get("/documents/{document_id}/versions/{version_id}/changes", response_model=dict)
async def get_version_changes(
    document_id: int,
    version_id: int,
    compare_to: int = Query(None, description="Version ID to compare to (defaults to previous version)"),
    current_user: User = Depends(get_current_active_user)
):
    """Get detailed changes for a specific version"""
    
    try:
        if compare_to is None:
            # Find previous version
            prev_version_query = """
            SELECT id FROM document_versions 
            WHERE document_id = %s AND version_number < (
                SELECT version_number FROM document_versions WHERE id = %s
            )
            ORDER BY version_number DESC
            LIMIT 1
            """
            prev_result = await execute(prev_version_query, [document_id, version_id])
            
            if not prev_result:
                return {"changes": [], "message": "No previous version to compare to"}
            
            compare_to = prev_result[0]['id']
        
        changes = await version_manager.get_version_changes(compare_to, version_id)
        
        return {
            "document_id": document_id,
            "version_id": version_id,
            "compared_to": compare_to,
            "changes": changes,
            "total_changes": len(changes)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get version changes: {str(e)}")


# Audit trail and compliance reporting endpoints
class AuditEventOut(BaseModel):
    event_id: str
    event_type: str
    action: str
    resource_type: str
    resource_id: str | None = None
    resource_path: str | None = None
    user_id: str | None = None
    user_role: str | None = None
    metadata: dict = {}
    compliance_impact: dict = {}
    risk_level: str
    success: bool
    error_message: str | None = None
    duration_ms: int | None = None
    created_at: str

class ComplianceReportOut(BaseModel):
    report_id: str
    report_type: str
    title: str
    generated_by: str
    date_range_start: str
    date_range_end: str
    metrics: dict = {}
    findings: list = []
    recommendations: list = []
    compliance_score: float | None = None
    risk_score: float | None = None
    status: str
    created_at: str

class GenerateReportIn(BaseModel):
    report_type: str
    title: str
    start_date: str
    end_date: str
    filters: dict = {}
    generated_for: str = "all"


@app.get("/audit/events", response_model=dict)
async def get_audit_events(
    event_types: str = Query(None, description="Comma-separated event types"),
    actions: str = Query(None, description="Comma-separated actions"),
    resource_types: str = Query(None, description="Comma-separated resource types"),
    user_id: str = Query(None, description="Filter by user ID"),
    start_date: str = Query(None, description="Start date (ISO format)"),
    end_date: str = Query(None, description="End date (ISO format)"),
    risk_levels: str = Query(None, description="Comma-separated risk levels"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role(["admin"]))
):
    """Get filtered audit trail events"""
    
    try:
        # Parse and convert query parameters to enums
        def _parse_enum_list(value: str | None, enum_cls):
            if not value:
                return None
            items: list = []
            for raw in value.split(','):
                token = raw.strip()
                if not token:
                    continue
                try:
                    items.append(enum_cls(token))
                except Exception:
                    pass
            return items or None

        event_type_list = _parse_enum_list(event_types, EventType)
        action_list = _parse_enum_list(actions, Action)
        resource_type_list = _parse_enum_list(resource_types, ResourceType)
        risk_level_list = _parse_enum_list(risk_levels, RiskLevel)

        start_datetime = datetime.fromisoformat(start_date) if start_date else None
        end_datetime = datetime.fromisoformat(end_date) if end_date else None

        # Build kwargs only with provided filters to satisfy type checker
        kwargs: dict = {"limit": limit, "offset": offset}
        if event_type_list is not None:
            kwargs["event_types"] = event_type_list
        if action_list is not None:
            kwargs["actions"] = action_list
        if resource_type_list is not None:
            kwargs["resource_types"] = resource_type_list
        if user_id is not None:
            kwargs["user_id"] = user_id
        if start_datetime is not None:
            kwargs["start_date"] = start_datetime
        if end_datetime is not None:
            kwargs["end_date"] = end_datetime
        if risk_level_list is not None:
            kwargs["risk_levels"] = risk_level_list

        events = await audit_logger.get_audit_trail(**kwargs)
        
        return {
            "events": events,
            "total": len(events),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get audit events: {str(e)}")


@app.get("/audit/dashboard", response_model=dict)
async def get_audit_dashboard(
    days: int = Query(30, ge=1, le=365, description="Number of days to include"),
    current_user: User = Depends(require_role(["admin"]))
):
    """Get audit dashboard metrics"""
    
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get recent events
        recent_events = await audit_logger.get_audit_trail(
            start_date=start_date,
            end_date=end_date,
            limit=50
        )
        
        # Get basic statistics
        stats_query = """
        SELECT 
            COUNT(*) as total_events,
            COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_events,
            COUNT(CASE WHEN risk_level IN ('high', 'critical') THEN 1 END) as high_risk_events,
            COUNT(DISTINCT user_id) as active_users,
            COUNT(CASE WHEN event_type = 'compliance_event' THEN 1 END) as compliance_events,
            COUNT(CASE WHEN event_type = 'security_event' THEN 1 END) as security_events
        FROM audit_events 
        WHERE created_at >= %s
        """
        stats_result = await execute(stats_query, [start_date])
        stats = stats_result[0] if stats_result else {}
        
        # Get event trends by day
        trends_query = """
        SELECT 
            DATE(created_at) as event_date,
            COUNT(*) as event_count,
            COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_count,
            COUNT(CASE WHEN risk_level IN ('high', 'critical') THEN 1 END) as risk_count
        FROM audit_events 
        WHERE created_at >= %s
        GROUP BY DATE(created_at)
        ORDER BY event_date
        """
        trends_result = await execute(trends_query, [start_date])
        
        # Get top users by activity
        users_query = """
        SELECT 
            user_id,
            COUNT(*) as action_count,
            COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_count
        FROM audit_events 
        WHERE created_at >= %s AND user_id IS NOT NULL
        GROUP BY user_id
        ORDER BY action_count DESC
        LIMIT 10
        """
        users_result = await execute(users_query, [start_date])
        
        return {
            "period_days": days,
            "statistics": {
                "total_events": stats.get('total_events', 0),
                "failed_events": stats.get('failed_events', 0),
                "high_risk_events": stats.get('high_risk_events', 0),
                "active_users": stats.get('active_users', 0),
                "compliance_events": stats.get('compliance_events', 0),
                "security_events": stats.get('security_events', 0)
            },
            "trends": [dict(row) for row in trends_result or []],
            "top_users": [dict(row) for row in users_result or []],
            "recent_events": recent_events[:10]  # Latest 10 events
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get audit dashboard: {str(e)}")


@app.post("/audit/reports", response_model=dict)
async def generate_compliance_report(
    request: GenerateReportIn,
    current_user: User = Depends(require_role(["admin"]))
):
    """Generate a compliance report"""
    
    try:
        start_date = datetime.fromisoformat(request.start_date)
        end_date = datetime.fromisoformat(request.end_date)
        
        report_id = await audit_logger.generate_compliance_report(
            report_type=ReportType(request.report_type),
            title=request.title,
            generated_by=current_user.username,
            start_date=start_date,
            end_date=end_date,
            filters=request.filters,
            generated_for=request.generated_for
        )
        
        return {
            "report_id": report_id,
            "status": "generated",
            "message": "Report generated successfully"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")


@app.get("/audit/reports", response_model=dict)
async def get_compliance_reports(
    report_type: str = Query(None, description="Filter by report type"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role(["admin"]))
):
    """Get generated compliance reports"""
    
    try:
        conditions = ["1=1"]
        params = []
        
        if report_type:
            conditions.append("report_type = %s")
            params.append(report_type)
        
        where_clause = " AND ".join(conditions)
        
        query = f"""
        SELECT report_id, report_type, title, generated_by, generated_for,
               date_range_start, date_range_end, compliance_score, risk_score,
               status, created_at
        FROM compliance_reports 
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        
        result = await execute(query, params)
        
        reports = []
        for row in result or []:
            report = dict(row)
            # Convert datetime fields to strings
            for field in ['date_range_start', 'date_range_end', 'created_at']:
                if report[field]:
                    report[field] = report[field].isoformat()
            reports.append(report)
        
        return {
            "reports": reports,
            "total": len(reports),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get reports: {str(e)}")


@app.get("/audit/reports/{report_id}", response_model=ComplianceReportOut)
async def get_compliance_report(
    report_id: str,
    current_user: User = Depends(require_role(["admin"]))
):
    """Get a specific compliance report"""
    
    try:
        query = """
        SELECT * FROM compliance_reports WHERE report_id = %s
        """
        result = await execute(query, [report_id])
        
        if not result:
            raise HTTPException(status_code=404, detail="Report not found")
        
        report = dict(result[0])
        
        # Parse JSON fields
        for field in ['metrics', 'findings', 'recommendations', 'filters']:
            if report[field]:
                try:
                    report[field] = json.loads(report[field])
                except:
                    report[field] = {}
        
        # Convert datetime fields to strings
        for field in ['date_range_start', 'date_range_end', 'created_at', 'updated_at']:
            if report[field]:
                report[field] = report[field].isoformat()
        
        return report
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get report: {str(e)}")


@app.delete("/audit/reports/{report_id}", response_model=dict)
async def delete_compliance_report(
    report_id: str,
    current_user: User = Depends(require_role(["admin"]))
):
    """Delete a compliance report"""
    
    try:
        # Check if report exists
        check_query = "SELECT report_id FROM compliance_reports WHERE report_id = %s"
        check_result = await execute(check_query, [report_id])
        
        if not check_result:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Delete the report
        delete_query = "DELETE FROM compliance_reports WHERE report_id = %s"
        await execute(delete_query, [report_id])
        
        return {"status": "deleted", "report_id": report_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")


# Recommendation endpoints
@app.get("/recommendations", response_model=RecommendationsResponse)
async def get_user_recommendations(
    limit: int = Query(default=10, ge=1, le=50),
    types: str = Query(default="", description="Comma-separated recommendation types"),
    context_document_id: int = Query(default=None, description="Context document for similar recommendations"),
    current_user: User = Depends(get_current_active_user)
):
    """Get personalized recommendations for the current user"""
    
    try:
        # Parse recommendation types
        recommendation_types = None
        if types:
            type_list = [t.strip() for t in types.split(",") if t.strip()]
            recommendation_types = []
            for t in type_list:
                try:
                    recommendation_types.append(RecommendationType(t))
                except ValueError:
                    pass  # Skip invalid types
        
        # Get recommendations
        recommendations = await recommendation_engine.get_recommendations(
            user_id=current_user.username,
            limit=limit,
            recommendation_types=recommendation_types,
            context_document_id=context_document_id
        )
        
        # Build user profile summary for debugging/transparency
        user_profile = await recommendation_engine._build_user_profile(current_user.username)
        profile_summary = {
            "interaction_count": user_profile.get("interaction_count", 0),
            "preferred_topics": list(user_profile.get("preferred_topics", {}).keys())[:5],
            "compliance_frameworks": user_profile.get("compliance_frameworks", [])[:3],
            "engagement_level": user_profile.get("engagement_level", 0.5)
        }
        
        # Convert to response format
        recommendation_list = []
        for rec in recommendations:
            recommendation_list.append(RecommendationOut(
                recommendation_id=rec.recommendation_id,
                document_id=rec.document_id,
                title=rec.title,
                path=rec.path,
                recommendation_type=rec.recommendation_type.value,
                score=rec.score,
                reasoning=rec.reasoning,
                source_document_id=rec.source_document_id,
                metadata=rec.metadata
            ))
        
        return RecommendationsResponse(
            recommendations=recommendation_list,
            total=len(recommendation_list),
            user_profile_summary=profile_summary
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")


@app.post("/recommendations/interaction", response_model=dict)
async def track_document_interaction(
    interaction: InteractionTrackingIn,
    current_user: User = Depends(get_current_active_user)
):
    """Track user interaction with a document for better recommendations"""
    
    try:
        # Validate interaction type and depth
        try:
            interaction_type = InteractionType(interaction.interaction_type)
            interaction_depth = InteractionDepth(interaction.depth)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid interaction type or depth: {str(e)}")
        
        # Track the interaction
        await recommendation_engine.track_interaction(
            user_id=current_user.username,
            document_id=interaction.document_id,
            interaction_type=interaction_type,
            duration_seconds=interaction.duration_seconds,
            depth=interaction_depth,
            session_id=interaction.session_id,
            referrer_source=interaction.referrer_source,
            metadata=interaction.metadata
        )
        
        # Log audit event
        await audit_logger.log_event(
            event_type=EventType.USER_ACTION,
            action=Action.READ if interaction_type == InteractionType.VIEW else Action.ACCESS,
            resource_type=ResourceType.DOCUMENT,
            resource_id=str(interaction.document_id),
            metadata={
                "interaction_type": interaction_type.value,
                "interaction_depth": interaction_depth.value,
                "duration_seconds": interaction.duration_seconds
            }
        )
        
        return {"status": "tracked", "interaction_type": interaction_type.value}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to track interaction: {str(e)}")


@app.post("/recommendations/feedback", response_model=dict)
async def provide_recommendation_feedback(
    feedback: RecommendationFeedbackIn,
    current_user: User = Depends(get_current_active_user)
):
    """Provide feedback on a recommendation to improve future suggestions"""
    
    try:
        if not 1 <= feedback.rating <= 5:
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
        await recommendation_engine.provide_feedback(
            recommendation_id=feedback.recommendation_id,
            rating=feedback.rating,
            notes=feedback.notes
        )
        
        return {
            "status": "feedback_recorded",
            "recommendation_id": feedback.recommendation_id,
            "rating": feedback.rating
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record feedback: {str(e)}")


@app.get("/recommendations/preferences", response_model=UserPreferencesOut)
async def get_user_recommendation_preferences(
    current_user: User = Depends(get_current_active_user)
):
    """Get user's recommendation preferences"""
    
    try:
        from .deps import get_pool
        pool = await get_pool()
        
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute("""
                    SELECT * FROM user_recommendation_preferences 
                    WHERE user_id = %s
                """, (current_user.username,))
                
                result = await cursor.fetchone()
                
                if result:
                    return UserPreferencesOut(
                        user_id=result[1],  # user_id
                        preferred_recommendation_types=json.loads(result[2] or '[]'),
                        excluded_topics=json.loads(result[3] or '[]'),
                        preferred_compliance_frameworks=json.loads(result[4] or '[]'),
                        recommendation_frequency=result[5] or 'real_time',
                        max_recommendations_per_session=result[6] or 5,
                        enable_ai_explanations=bool(result[7]),
                        enable_trend_based=bool(result[8]),
                        enable_collaborative_filtering=bool(result[9])
                    )
                else:
                    # Return default preferences
                    return UserPreferencesOut(
                        user_id=current_user.username,
                        preferred_recommendation_types=["personalized", "compliance_related", "trending"],
                        excluded_topics=[],
                        preferred_compliance_frameworks=["GDPR", "SOX"],
                        recommendation_frequency="real_time",
                        max_recommendations_per_session=5,
                        enable_ai_explanations=True,
                        enable_trend_based=True,
                        enable_collaborative_filtering=True
                    )
                    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get preferences: {str(e)}")


@app.put("/recommendations/preferences", response_model=UserPreferencesOut)
async def update_user_recommendation_preferences(
    preferences: UserPreferencesIn,
    current_user: User = Depends(get_current_active_user)
):
    """Update user's recommendation preferences"""
    
    try:
        from .deps import get_pool
        pool = await get_pool()
        
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                # Upsert preferences
                await cursor.execute("""
                    INSERT INTO user_recommendation_preferences 
                    (user_id, preferred_recommendation_types, excluded_topics, 
                     preferred_compliance_frameworks, recommendation_frequency,
                     max_recommendations_per_session, enable_ai_explanations,
                     enable_trend_based, enable_collaborative_filtering)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        preferred_recommendation_types = VALUES(preferred_recommendation_types),
                        excluded_topics = VALUES(excluded_topics),
                        preferred_compliance_frameworks = VALUES(preferred_compliance_frameworks),
                        recommendation_frequency = VALUES(recommendation_frequency),
                        max_recommendations_per_session = VALUES(max_recommendations_per_session),
                        enable_ai_explanations = VALUES(enable_ai_explanations),
                        enable_trend_based = VALUES(enable_trend_based),
                        enable_collaborative_filtering = VALUES(enable_collaborative_filtering),
                        updated_at = CURRENT_TIMESTAMP
                """, (
                    current_user.username,
                    json.dumps(preferences.preferred_recommendation_types or []),
                    json.dumps(preferences.excluded_topics or []),
                    json.dumps(preferences.preferred_compliance_frameworks or []),
                    preferences.recommendation_frequency,
                    preferences.max_recommendations_per_session,
                    preferences.enable_ai_explanations,
                    preferences.enable_trend_based,
                    preferences.enable_collaborative_filtering
                ))
                await conn.commit()
        
        # Return updated preferences
        return await get_user_recommendation_preferences(current_user)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update preferences: {str(e)}")


@app.get("/recommendations/analytics", response_model=RecommendationAnalyticsOut)
async def get_recommendation_analytics(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(require_role(["admin", "analyst"]))
):
    """Get recommendation system analytics"""
    
    try:
        from datetime import datetime, timedelta
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        from .deps import get_pool
        pool = await get_pool()
        
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                # Get overall analytics
                await cursor.execute("""
                    SELECT 
                        COUNT(*) as total_recommendations,
                        COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked_count,
                        COUNT(CASE WHEN feedback_rating IS NOT NULL THEN 1 END) as feedback_count,
                        AVG(CASE WHEN feedback_rating IS NOT NULL THEN feedback_rating END) as avg_rating
                    FROM document_recommendations 
                    WHERE generated_at >= %s AND generated_at <= %s
                """, (start_date, end_date))
                
                analytics_result = await cursor.fetchone()
                
                total_recs = analytics_result[0] or 0
                clicked_count = analytics_result[1] or 0
                feedback_count = analytics_result[2] or 0
                avg_rating = float(analytics_result[3] or 0)
                
                ctr = (clicked_count / total_recs) if total_recs > 0 else 0
                
                # Get top recommendation types
                await cursor.execute("""
                    SELECT recommendation_type, COUNT(*) as count,
                           COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicks
                    FROM document_recommendations 
                    WHERE generated_at >= %s AND generated_at <= %s
                    GROUP BY recommendation_type
                    ORDER BY count DESC
                """, (start_date, end_date))
                
                type_results = await cursor.fetchall()
                top_types = []
                for row in type_results:
                    type_ctr = (row[2] / row[1]) if row[1] > 0 else 0
                    top_types.append({
                        "type": row[0],
                        "count": row[1],
                        "clicks": row[2],
                        "click_through_rate": type_ctr
                    })
                
                # Get user engagement metrics
                await cursor.execute("""
                    SELECT 
                        COUNT(DISTINCT user_id) as active_users,
                        AVG(interaction_count) as avg_interactions_per_user,
                        AVG(engagement_level) as avg_engagement_level
                    FROM (
                        SELECT r.user_id, COUNT(r.id) as interaction_count,
                               AVG(CASE WHEN r.clicked_at IS NOT NULL THEN 1.0 ELSE 0.0 END) as engagement_level
                        FROM document_recommendations r
                        WHERE r.generated_at >= %s AND r.generated_at <= %s
                        GROUP BY r.user_id
                    ) user_stats
                """, (start_date, end_date))
                
                engagement_result = await cursor.fetchone()
                
                return RecommendationAnalyticsOut(
                    date_range={
                        "start": start_date.isoformat(),
                        "end": end_date.isoformat(),
                        "days": days
                    },
                    total_recommendations=total_recs,
                    click_through_rate=round(ctr, 4),
                    average_rating=round(avg_rating, 2),
                    top_recommendation_types=top_types,
                    user_engagement_metrics={
                        "active_users": engagement_result[0] or 0,
                        "avg_interactions_per_user": float(engagement_result[1] or 0),
                        "avg_engagement_level": float(engagement_result[2] or 0)
                    }
                )
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


@app.get("/health", response_model=HealthOut)
async def health():
    return {"ok": True}


@app.get("/health/full", response_model=HealthFullOut)
async def health_full():
    db_ok = True
    llm_ok = True
    embed_ok = False
    try:
        await execute("SELECT 1", [])
    except Exception:
        db_ok = False
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(_ollama_url() + "/api/tags")
            llm_ok = r.status_code == 200
    except Exception:
        llm_ok = False
    try:
        embed_ok = is_model_available()
    except Exception:
        embed_ok = False
    return {"api": True, "db": db_ok, "llm": llm_ok, "embed": embed_ok}


# Minimal API versioning: expose health under /api/v1
api_v1 = APIRouter(prefix="/api/v1")

@api_v1.get("/health")
async def v1_health():
    return await health()  # type: ignore

@api_v1.get("/health/full")
async def v1_health_full():
    return await health_full()  # type: ignore

app.include_router(api_v1)

# Register versioned aliases for existing endpoints (temporary dual-stack)
# Note: keep in sync with actual route functions above
def _v1(alias: str, func, methods: list[str]):
    app.add_api_route("/api/v1" + alias, func, methods=methods)

_v1("/ingest/reg", ingest_reg, ["POST"])
_v1("/ingest/doc", ingest_doc, ["POST"])
_v1("/ingest/pdf", ingest_pdf, ["POST"])
_v1("/query/hybrid", query_hybrid, ["POST"])
_v1("/action/task", action_task, ["POST"])
_v1("/ai/explain", ai_explain, ["POST"])
_v1("/ai/fix-it", ai_fix_it, ["POST"])
_v1("/recent-documents", get_recent_documents, ["GET"])
_v1("/documents", list_documents, ["GET"])
_v1("/documents/{path:path}", read_document, ["GET"])
_v1("/documents/{path:path}", update_document_meta, ["PATCH"])
_v1("/documents/{path:path}", delete_document, ["DELETE"])
_v1("/mappings", create_mapping, ["POST"])
_v1("/coverage", coverage, ["GET"])
_v1("/coverage/{reg_id}", coverage_detail, ["GET"])
_v1("/auth/login", login_for_access_token, ["POST"])
_v1("/auth/me", read_users_me, ["GET"])
_v1("/auth/register", register_user, ["POST"])
_v1("/auth/users", list_users, ["GET"])
_v1("/auth/users/{username}", update_user, ["PATCH"])
_v1("/auth/users/{username}", delete_user, ["DELETE"])
_v1("/auth/password", update_password, ["PATCH"])
_v1("/chat", send_chat_message, ["POST"])
_v1("/chat/conversations", get_conversations, ["GET"])
_v1("/chat/conversations/{conversation_id}/messages", get_conversation_messages, ["GET"])
_v1("/chat/conversations/{conversation_id}", delete_conversation, ["DELETE"])
_v1("/compliance/analyze", analyze_document_compliance, ["POST"])
_v1("/compliance/status/{doc_id}", get_document_compliance_status, ["GET"])
_v1("/compliance/dashboard", get_compliance_dashboard, ["GET"])
_v1("/compliance/frameworks", get_compliance_frameworks, ["GET"])
_v1("/recommendations", get_user_recommendations, ["GET"])
_v1("/recommendations/interaction", track_document_interaction, ["POST"])
_v1("/recommendations/feedback", provide_recommendation_feedback, ["POST"])
_v1("/recommendations/preferences", get_user_recommendation_preferences, ["GET"])
_v1("/recommendations/preferences", update_user_recommendation_preferences, ["PUT"])
_v1("/recommendations/analytics", get_recommendation_analytics, ["GET"])
