#!/usr/bin/env python3
"""
Enhanced Document Library API
Provides comprehensive document management with advanced features
"""

from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import hashlib
import json
from .deps import get_db_pool, execute_query

router = APIRouter(prefix="/documents", tags=["Document Library"])

# Enhanced document models
class DocumentMetadata(BaseModel):
    category: str = "general"
    tags: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    language: str = "en"
    confidentiality: str = "internal"  # public, internal, confidential, restricted

class EnhancedDocumentItem(BaseModel):
    id: str
    path: str
    display_name: str
    description: Optional[str]
    content_preview: Optional[str]
    type: str  # 'doc' or 'reg'
    category: str
    tags: List[str]
    first_seen: datetime
    last_seen: datetime
    last_accessed: Optional[datetime]
    access_count: int = 0
    chunks: int
    file_size: int
    is_favorite: bool = False
    version: int = 1
    status: str = "active"  # active, archived, draft
    created_by: Optional[str]
    modified_by: Optional[str]

class DocumentLibraryResponse(BaseModel):
    documents: List[EnhancedDocumentItem]
    total_count: int
    page: int
    page_size: int
    categories: List[str]
    tags: List[str]

class DocumentAccessRequest(BaseModel):
    access_type: str = "view"  # view, download, edit
    metadata: Optional[Dict[str, Any]] = None

class FavoriteRequest(BaseModel):
    is_favorite: bool

@router.get("/library", response_model=DocumentLibraryResponse)
async def get_document_library(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    doc_type: Optional[str] = Query(None, description="Filter by document type"),
    status: Optional[str] = Query("active", description="Filter by status"),
    search: Optional[str] = Query(None, description="Search query"),
    sort_by: str = Query("last_seen", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order"),
    include_preview: bool = Query(False, description="Include content preview"),
    include_stats: bool = Query(False, description="Include access statistics"),
    pool = Depends(get_db_pool)
):
    """Get enhanced document library with filtering, search, and pagination"""
    
    try:
        # Base query with enhanced metadata
        base_query = """
        SELECT 
            d.id,
            d.path,
            d.display_name,
            d.description,
            d.type,
            d.first_seen,
            d.last_seen,
            d.chunks,
            d.file_size,
            d.version,
            d.status,
            d.created_by,
            d.modified_by,
            COALESCE(dm.category, 'general') as category,
            COALESCE(dm.tags, '[]') as tags,
            COALESCE(dm.confidentiality, 'internal') as confidentiality,
            COALESCE(da.access_count, 0) as access_count,
            da.last_accessed,
            COALESCE(df.is_favorite, false) as is_favorite
        FROM (
            SELECT 
                path as id,
                path,
                COALESCE(display_name, SUBSTRING(path FROM '[^/]*$')) as display_name,
                NULL as description,
                'doc' as type,
                first_seen,
                last_seen,
                chunks,
                0 as file_size,
                1 as version,
                'active' as status,
                NULL as created_by,
                NULL as modified_by
            FROM corp_docs
            UNION ALL
            SELECT 
                CONCAT('reg:', CAST(id AS CHAR)) as id,
                CONCAT('reg:', CAST(id AS CHAR)) as path,
                title as display_name,
                description,
                'reg' as type,
                created_at as first_seen,
                updated_at as last_seen,
                1 as chunks,
                LENGTH(text) as file_size,
                1 as version,
                'active' as status,
                NULL as created_by,
                NULL as modified_by
            FROM reg_texts
        ) d
        LEFT JOIN document_metadata dm ON d.id = dm.document_id
        LEFT JOIN document_access_stats da ON d.id = da.document_id
        LEFT JOIN document_favorites df ON d.id = df.document_id AND df.user_id = 'current_user'
        """
        
        # Build WHERE conditions
        conditions = ["1=1"]
        params = []
        
        if category:
            conditions.append("COALESCE(dm.category, 'general') = %s")
            params.append(category)
            
        if doc_type:
            conditions.append("d.type = %s")
            params.append(doc_type)
            
        if status:
            conditions.append("d.status = %s")
            params.append(status)
            
        if search:
            conditions.append("""
                (d.display_name LIKE %s 
                 OR d.description LIKE %s 
                 OR dm.tags LIKE %s
                 OR dm.category LIKE %s)
            """)
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term, search_term])
        
        where_clause = " WHERE " + " AND ".join(conditions)
        
        # Add ORDER BY
        sort_mapping = {
            "name": "d.display_name",
            "date": "d.last_seen", 
            "accessed": "da.last_accessed",
            "size": "d.file_size",
            "category": "dm.category"
        }
        
        order_field = sort_mapping.get(sort_by, "d.last_seen")
        order_direction = "DESC" if sort_order.lower() == "desc" else "ASC"
        
        # Get total count
        count_query = f"""
        SELECT COUNT(*) as total
        FROM ({base_query}) sub
        {where_clause}
        """
        
        count_result = await execute_query(pool, count_query, params)
        total_count = count_result[0]['total'] if count_result else 0
        
        # Get paginated results
        offset = (page - 1) * page_size
        paginated_query = f"""
        {base_query}
        {where_clause}
        ORDER BY {order_field} {order_direction}
        LIMIT %s OFFSET %s
        """
        
        params.extend([page_size, offset])
        
        documents_result = await execute_query(pool, paginated_query, params)
        
        # Process results
        documents = []
        for row in documents_result:
            doc_data = dict(row)
            
            # Parse tags JSON
            try:
                doc_data['tags'] = json.loads(doc_data.get('tags', '[]'))
            except:
                doc_data['tags'] = []
            
            # Add content preview if requested
            if include_preview:
                doc_data['content_preview'] = await get_document_preview(doc_data['id'], pool)
            else:
                doc_data['content_preview'] = None
            
            documents.append(EnhancedDocumentItem(**doc_data))
        
        # Get categories and tags for filtering
        categories_query = """
        SELECT DISTINCT COALESCE(category, 'general') as category 
        FROM document_metadata 
        WHERE category IS NOT NULL
        ORDER BY category
        """
        
        tags_query = """
        SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(tags, CONCAT('$[', idx.n, ']'))) as tag
        FROM document_metadata dm
        JOIN (
            SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
        ) idx ON JSON_EXTRACT(dm.tags, CONCAT('$[', idx.n, ']')) IS NOT NULL
        WHERE JSON_LENGTH(dm.tags) > 0
        ORDER BY tag
        """
        
        categories_result = await execute_query(pool, categories_query)
        tags_result = await execute_query(pool, tags_query)
        
        categories = [row['category'] for row in categories_result] if categories_result else []
        tags = [row['tag'] for row in tags_result if row['tag']] if tags_result else []
        
        return DocumentLibraryResponse(
            documents=documents,
            total_count=total_count,
            page=page,
            page_size=page_size,
            categories=categories,
            tags=tags
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load document library: {str(e)}")

async def get_document_preview(document_id: str, pool) -> Optional[str]:
    """Get content preview for a document"""
    try:
        if document_id.startswith('reg:'):
            reg_id = document_id.replace('reg:', '')
            query = "SELECT SUBSTRING(text, 1, 500) as preview FROM reg_texts WHERE id = %s"
            params = [reg_id]
        else:
            query = "SELECT SUBSTRING(content, 1, 500) as preview FROM corp_docs WHERE path = %s"
            params = [document_id]
        
        result = await execute_query(pool, query, params)
        return result[0]['preview'] if result else None
    except:
        return None

@router.get("/recent", response_model=List[EnhancedDocumentItem])
async def get_recent_documents(
    limit: int = Query(10, ge=1, le=50, description="Number of recent documents"),
    user_id: str = Query("current_user", description="User ID for personalized results"),
    pool = Depends(get_db_pool)
):
    """Get recently accessed documents for a user"""
    
    try:
        query = """
        SELECT 
            d.id,
            d.path,
            d.display_name,
            d.description,
            d.type,
            d.first_seen,
            d.last_seen,
            d.chunks,
            d.file_size,
            d.version,
            d.status,
            d.created_by,
            d.modified_by,
            COALESCE(dm.category, 'general') as category,
            COALESCE(dm.tags, '[]') as tags,
            da.access_count,
            da.last_accessed,
            COALESCE(df.is_favorite, false) as is_favorite
        FROM (
            SELECT 
                path as id,
                path,
                COALESCE(display_name, SUBSTRING(path FROM '[^/]*$')) as display_name,
                NULL as description,
                'doc' as type,
                first_seen,
                last_seen,
                chunks,
                0 as file_size,
                1 as version,
                'active' as status,
                NULL as created_by,
                NULL as modified_by
            FROM corp_docs
            UNION ALL
            SELECT 
                CONCAT('reg:', CAST(id AS CHAR)) as id,
                CONCAT('reg:', CAST(id AS CHAR)) as path,
                title as display_name,
                description,
                'reg' as type,
                created_at as first_seen,
                updated_at as last_seen,
                1 as chunks,
                LENGTH(text) as file_size,
                1 as version,
                'active' as status,
                NULL as created_by,
                NULL as modified_by
            FROM reg_texts
        ) d
        LEFT JOIN document_metadata dm ON d.id = dm.document_id
        INNER JOIN document_access_stats da ON d.id = da.document_id AND da.user_id = %s
        LEFT JOIN document_favorites df ON d.id = df.document_id AND df.user_id = %s
        ORDER BY da.last_accessed DESC
        LIMIT %s
        """
        
        result = await execute_query(pool, query, [user_id, user_id, limit])
        
        documents = []
        for row in result:
            doc_data = dict(row)
            try:
                doc_data['tags'] = json.loads(doc_data.get('tags', '[]'))
            except:
                doc_data['tags'] = []
            doc_data['content_preview'] = None
            documents.append(EnhancedDocumentItem(**doc_data))
        
        return documents
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load recent documents: {str(e)}")

@router.get("/favorites", response_model=List[EnhancedDocumentItem])
async def get_favorite_documents(
    limit: Optional[int] = Query(None, ge=1, le=100, description="Limit number of favorites"),
    user_id: str = Query("current_user", description="User ID"),
    pool = Depends(get_db_pool)
):
    """Get user's favorite documents"""
    
    try:
        query = """
        SELECT 
            d.id,
            d.path,
            d.display_name,
            d.description,
            d.type,
            d.first_seen,
            d.last_seen,
            d.chunks,
            d.file_size,
            d.version,
            d.status,
            d.created_by,
            d.modified_by,
            COALESCE(dm.category, 'general') as category,
            COALESCE(dm.tags, '[]') as tags,
            COALESCE(da.access_count, 0) as access_count,
            da.last_accessed,
            true as is_favorite
        FROM (
            SELECT 
                path as id,
                path,
                COALESCE(display_name, SUBSTRING(path FROM '[^/]*$')) as display_name,
                NULL as description,
                'doc' as type,
                first_seen,
                last_seen,
                chunks,
                0 as file_size,
                1 as version,
                'active' as status,
                NULL as created_by,
                NULL as modified_by
            FROM corp_docs
            UNION ALL
            SELECT 
                CONCAT('reg:', CAST(id AS CHAR)) as id,
                CONCAT('reg:', CAST(id AS CHAR)) as path,
                title as display_name,
                description,
                'reg' as type,
                created_at as first_seen,
                updated_at as last_seen,
                1 as chunks,
                LENGTH(text) as file_size,
                1 as version,
                'active' as status,
                NULL as created_by,
                NULL as modified_by
            FROM reg_texts
        ) d
        LEFT JOIN document_metadata dm ON d.id = dm.document_id
        LEFT JOIN document_access_stats da ON d.id = da.document_id AND da.user_id = %s
        INNER JOIN document_favorites df ON d.id = df.document_id AND df.user_id = %s AND df.is_favorite = true
        ORDER BY df.created_at DESC
        """ + (f"LIMIT %s" if limit else "")
        
        params = [user_id, user_id]
        if limit:
            params.append(limit)
            
        result = await execute_query(pool, query, params)
        
        documents = []
        for row in result:
            doc_data = dict(row)
            try:
                doc_data['tags'] = json.loads(doc_data.get('tags', '[]'))
            except:
                doc_data['tags'] = []
            doc_data['content_preview'] = None
            documents.append(EnhancedDocumentItem(**doc_data))
        
        return documents
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load favorite documents: {str(e)}")

@router.post("/{document_id}/access")
async def track_document_access(
    document_id: str,
    request: DocumentAccessRequest = DocumentAccessRequest(),
    user_id: str = Query("current_user", description="User ID"),
    pool = Depends(get_db_pool)
):
    """Track document access for analytics"""
    
    try:
        # Update or insert access statistics
        upsert_query = """
        INSERT INTO document_access_stats (document_id, user_id, access_count, last_accessed, access_type)
        VALUES (%s, %s, 1, %s, %s)
        ON DUPLICATE KEY UPDATE 
            access_count = access_count + 1,
            last_accessed = %s,
            access_type = %s
        """
        
        now = datetime.now()
        params = [document_id, user_id, now, request.access_type, now, request.access_type]
        
        await execute_query(pool, upsert_query, params)
        
        # Log detailed access if metadata provided
        if request.metadata:
            log_query = """
            INSERT INTO document_access_log (document_id, user_id, access_time, access_type, metadata)
            VALUES (%s, %s, %s, %s, %s)
            """
            await execute_query(pool, log_query, [
                document_id, user_id, now, request.access_type, json.dumps(request.metadata)
            ])
        
        return {"status": "success", "message": "Access tracked"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to track access: {str(e)}")

@router.post("/{document_id}/favorite")
async def toggle_favorite(
    document_id: str,
    request: FavoriteRequest,
    user_id: str = Query("current_user", description="User ID"),
    pool = Depends(get_db_pool)
):
    """Toggle document favorite status"""
    
    try:
        if request.is_favorite:
            # Add to favorites
            query = """
            INSERT INTO document_favorites (document_id, user_id, is_favorite, created_at)
            VALUES (%s, %s, true, %s)
            ON DUPLICATE KEY UPDATE 
                is_favorite = true,
                updated_at = %s
            """
            now = datetime.now()
            params = [document_id, user_id, now, now]
        else:
            # Remove from favorites
            query = """
            UPDATE document_favorites 
            SET is_favorite = false, updated_at = %s
            WHERE document_id = %s AND user_id = %s
            """
            params = [datetime.now(), document_id, user_id]
        
        await execute_query(pool, query, params)
        
        return {"status": "success", "is_favorite": request.is_favorite}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update favorite: {str(e)}")

@router.get("/{document_id}/history")
async def get_document_history(
    document_id: str,
    limit: int = Query(20, ge=1, le=100),
    pool = Depends(get_db_pool)
):
    """Get document access history"""
    
    try:
        query = """
        SELECT 
            user_id,
            access_time,
            access_type,
            metadata
        FROM document_access_log 
        WHERE document_id = %s
        ORDER BY access_time DESC
        LIMIT %s
        """
        
        result = await execute_query(pool, query, [document_id, limit])
        
        history = []
        for row in result:
            history_item = dict(row)
            try:
                history_item['metadata'] = json.loads(history_item.get('metadata', '{}'))
            except:
                history_item['metadata'] = {}
            history.append(history_item)
        
        return {"document_id": document_id, "history": history}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load document history: {str(e)}")

@router.get("/analytics/popular")
async def get_popular_documents(
    period: str = Query("week", description="Time period: day, week, month"),
    limit: int = Query(10, ge=1, le=50),
    pool = Depends(get_db_pool)
):
    """Get most popular documents by access count"""
    
    try:
        # Calculate date threshold
        if period == "day":
            threshold = datetime.now() - timedelta(days=1)
        elif period == "month":
            threshold = datetime.now() - timedelta(days=30)
        else:  # week
            threshold = datetime.now() - timedelta(days=7)
        
        query = """
        SELECT 
            das.document_id,
            d.display_name,
            d.type,
            COUNT(*) as access_count,
            COUNT(DISTINCT das.user_id) as unique_users,
            MAX(das.last_accessed) as last_accessed
        FROM document_access_stats das
        JOIN (
            SELECT 
                path as id,
                COALESCE(display_name, SUBSTRING(path FROM '[^/]*$')) as display_name,
                'doc' as type
            FROM corp_docs
            UNION ALL
            SELECT 
                CONCAT('reg:', CAST(id AS CHAR)) as id,
                title as display_name,
                'reg' as type
            FROM reg_texts
        ) d ON das.document_id = d.id
        WHERE das.last_accessed >= %s
        GROUP BY das.document_id, d.display_name, d.type
        ORDER BY access_count DESC, unique_users DESC
        LIMIT %s
        """
        
        result = await execute_query(pool, query, [threshold, limit])
        
        return {
            "period": period,
            "popular_documents": [dict(row) for row in result] if result else []
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get popular documents: {str(e)}")

# Background task for document maintenance
async def cleanup_old_access_logs(pool, days_to_keep: int = 90):
    """Clean up old access logs to prevent database bloat"""
    try:
        threshold = datetime.now() - timedelta(days=days_to_keep)
        query = "DELETE FROM document_access_log WHERE access_time < %s"
        await execute_query(pool, query, [threshold])
    except Exception as e:
        print(f"Failed to cleanup access logs: {e}")

@router.post("/maintenance/cleanup")
async def trigger_maintenance(
    background_tasks: BackgroundTasks,
    days_to_keep: int = Query(90, ge=30, le=365),
    pool = Depends(get_db_pool)
):
    """Trigger document maintenance tasks"""
    
    background_tasks.add_task(cleanup_old_access_logs, pool, days_to_keep)
    return {"status": "success", "message": "Maintenance tasks scheduled"}