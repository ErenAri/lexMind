"""
Simplified version of main.py that works without vector embeddings
This is a temporary fix until the full database is set up
"""

import os
import io
import re
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
import PyPDF2
from pydantic import BaseModel

# Import existing dependencies
from app.deps import execute

app = FastAPI(title="LexMind API (Simplified)")

# Add CORS middleware directly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"]
)

class OkOut(BaseModel):
    ok: bool

class RegIn(BaseModel):
    source: str
    title: str
    section: str
    text: str

class DocIn(BaseModel):
    path: str
    chunk_idx: int
    content: str

@app.get("/")
async def root():
    return {"message": "LexMind API (Simplified) - Ready to accept uploads!"}

@app.post("/ingest/reg", response_model=OkOut)
async def ingest_reg(item: RegIn):
    """Ingest regulation text (simplified - no embeddings)"""
    sql = """
    INSERT INTO reg_texts(source, title, section, text) VALUES(%s, %s, %s, %s)
    """
    await execute(sql, [item.source, item.title, item.section, item.text])
    return {"ok": True}

@app.post("/ingest/doc", response_model=OkOut)
async def ingest_doc(item: DocIn):
    """Ingest document chunk (simplified - no embeddings)"""
    sql = """
    INSERT INTO corp_docs(path, chunk_idx, content, embedding_placeholder) VALUES(%s, %s, %s, %s)
    """
    # Store a placeholder instead of actual embedding
    await execute(sql, [item.path, item.chunk_idx, item.content, "placeholder_embedding"])
    return {"ok": True}

@app.post("/ingest/pdf", response_model=OkOut)
async def ingest_pdf(
    file: UploadFile = File(...),
    doc_type: str = Body(..., embed=True)  # "reg" or "doc"
):
    """Ingest PDF file (simplified - no embeddings)"""
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
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
            section = re.sub(r'[^a-zA-Z0-9\s]', ' ', file.filename.replace('.pdf', ''))
            
            # Ingest as regulation (simplified)
            sql = """
            INSERT INTO reg_texts(source, title, section, text) VALUES(%s, %s, %s, %s)
            """
            await execute(sql, ["pdf_upload", file.filename, section, text_content])
            
        else:
            # Split into chunks and ingest as document (simplified)
            chunks = _split_semantic_chunks(text_content)
            
            for i, chunk in enumerate(chunks):
                sql = """
                INSERT INTO corp_docs(path, chunk_idx, content, embedding_placeholder) VALUES(%s, %s, %s, %s)
                """
                await execute(sql, [file.filename, i, chunk, "placeholder_embedding"])
        
        return {"ok": True}
        
    except Exception as e:
        print(f"Error processing PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

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

_v1("/ingest/reg", ingest_reg, ["POST"])
_v1("/ingest/doc", ingest_doc, ["POST"])
_v1("/ingest/pdf", ingest_pdf, ["POST"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)