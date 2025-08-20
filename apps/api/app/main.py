from fastapi import FastAPI, Body, HTTPException, UploadFile, File, Request, APIRouter, Depends, Query
from fastapi.exceptions import RequestValidationError
from fastapi.security import OAuth2PasswordRequestForm
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import timedelta
from .deps import execute
from .embeddings import generate_embedding as embed
from .auth import (
    authenticate_user, create_access_token, get_current_active_user, 
    require_role, Token, User, ACCESS_TOKEN_EXPIRE_MINUTES, _require_role_legacy
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
    "http://127.0.0.1:3000",
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

# Authentication endpoints
@app.post("/auth/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
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


@app.get("/health", response_model=HealthOut)
async def health():
    return {"ok": True}


@app.get("/health/full", response_model=HealthFullOut)
async def health_full():
    db_ok = True
    llm_ok = True
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
    return {"api": True, "db": db_ok, "llm": llm_ok}


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
