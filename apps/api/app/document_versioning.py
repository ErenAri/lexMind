"""
Document Versioning System with Temporal Tables
Advanced TiDB features for tracking document changes over time
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import hashlib
import asyncio
import logging

from .deps_serverless import execute_read_optimized, execute_write_primary
from .auth import get_current_active_user, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/versioning", tags=["Document Versioning"])

# ============================================================
# PYDANTIC MODELS  
# ============================================================

class DocumentVersion(BaseModel):
    id: int
    document_path: str
    version_number: int
    content_hash: str
    content: str
    metadata: Dict[str, Any] = {}
    created_by: str
    created_at: datetime
    valid_from: datetime
    valid_to: Optional[datetime] = None
    is_current: bool = True

class VersionComparison(BaseModel):
    document_path: str
    version1: int
    version2: int
    changes: List[Dict[str, Any]]
    similarity_score: float
    change_summary: Dict[str, Any]

class VersionHistory(BaseModel):
    document_path: str
    versions: List[DocumentVersion]
    total_versions: int
    created_span_days: int
    average_changes_per_version: float

class RegulationChange(BaseModel):
    regulation_source: str
    regulation_title: str
    version_number: int
    effective_date: datetime
    content_changes: Dict[str, Any]
    supersedes_version: Optional[int] = None
    impact_assessment: Dict[str, Any] = {}

# ============================================================
# DOCUMENT VERSIONING ENDPOINTS
# ============================================================

@router.post("/documents/{document_path}/versions")
async def create_document_version(
    document_path: str,
    content: str,
    metadata: Dict[str, Any] = {},
    current_user: User = Depends(get_current_active_user)
):
    """Create a new version of a document with temporal tracking"""
    
    try:
        # Get current version number
        current_version_result = await execute_read_optimized(
            "SELECT MAX(version_number) as max_version FROM document_versions WHERE document_path = %s",
            [document_path]
        )
        
        current_max = current_version_result[0]['max_version'] if current_version_result else 0
        next_version = (current_max or 0) + 1
        
        # Generate content hash
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        
        # Check if content has actually changed
        if current_max:
            latest_version = await execute_read_optimized(
                "SELECT content_hash FROM document_versions WHERE document_path = %s AND version_number = %s",
                [document_path, current_max]
            )
            
            if latest_version and latest_version[0]['content_hash'] == content_hash:
                raise HTTPException(
                    status_code=400, 
                    detail="Content unchanged. No new version created."
                )
        
        # Invalidate previous current version
        if current_max:
            await execute_write_primary(
                """UPDATE document_versions 
                   SET is_current = FALSE, valid_to = NOW() 
                   WHERE document_path = %s AND is_current = TRUE""",
                [document_path]
            )
        
        # Create new version
        await execute_write_primary(
            """INSERT INTO document_versions 
               (document_path, version_number, content_hash, content, metadata_json, created_by, valid_from, is_current)
               VALUES (%s, %s, %s, %s, %s, %s, NOW(), TRUE)""",
            [document_path, next_version, content_hash, content, json.dumps(metadata), current_user.username]
        )
        
        # Update document metadata
        await execute_write_primary(
            """INSERT INTO documents_meta (path, display_name, description, updated_at)
               VALUES (%s, %s, %s, NOW())
               ON DUPLICATE KEY UPDATE 
               display_name = VALUES(display_name),
               description = VALUES(description),
               updated_at = NOW()""",
            [
                document_path, 
                metadata.get('display_name', document_path.split('/')[-1]),
                metadata.get('description', '')
            ]
        )
        
        return {
            "document_path": document_path,
            "version_number": next_version,
            "content_hash": content_hash,
            "created_by": current_user.username,
            "message": f"Version {next_version} created successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to create document version: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create version: {str(e)}")

@router.get("/documents/{document_path}/versions", response_model=VersionHistory)
async def get_document_versions(document_path: str):
    """Get complete version history for a document"""
    
    try:
        # Get all versions
        versions_data = await execute_read_optimized(
            """SELECT id, document_path, version_number, content_hash, content, 
                      metadata_json, created_by, created_at, valid_from, valid_to, is_current
               FROM document_versions 
               WHERE document_path = %s 
               ORDER BY version_number DESC""",
            [document_path]
        )
        
        if not versions_data:
            raise HTTPException(status_code=404, detail="Document not found")
        
        versions = []
        for v in versions_data:
            versions.append(DocumentVersion(
                id=v['id'],
                document_path=v['document_path'],
                version_number=v['version_number'],
                content_hash=v['content_hash'],
                content=v['content'],
                metadata=json.loads(v['metadata_json'] or '{}'),
                created_by=v['created_by'],
                created_at=v['created_at'],
                valid_from=v['valid_from'],
                valid_to=v['valid_to'],
                is_current=bool(v['is_current'])
            ))
        
        # Calculate statistics
        first_version = versions[-1]  # Last in descending order
        last_version = versions[0]    # First in descending order
        
        created_span = (last_version.created_at - first_version.created_at).days
        total_content_length = sum(len(v.content) for v in versions)
        avg_changes = total_content_length / len(versions) if versions else 0
        
        return VersionHistory(
            document_path=document_path,
            versions=versions,
            total_versions=len(versions),
            created_span_days=created_span,
            average_changes_per_version=avg_changes
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document versions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get versions: {str(e)}")

@router.get("/documents/{document_path}/versions/{version_number}")
async def get_document_version(document_path: str, version_number: int):
    """Get a specific version of a document"""
    
    try:
        version_data = await execute_read_optimized(
            """SELECT id, document_path, version_number, content_hash, content, 
                      metadata_json, created_by, created_at, valid_from, valid_to, is_current
               FROM document_versions 
               WHERE document_path = %s AND version_number = %s""",
            [document_path, version_number]
        )
        
        if not version_data:
            raise HTTPException(status_code=404, detail="Version not found")
        
        v = version_data[0]
        return DocumentVersion(
            id=v['id'],
            document_path=v['document_path'],
            version_number=v['version_number'],
            content_hash=v['content_hash'],
            content=v['content'],
            metadata=json.loads(v['metadata_json'] or '{}'),
            created_by=v['created_by'],
            created_at=v['created_at'],
            valid_from=v['valid_from'],
            valid_to=v['valid_to'],
            is_current=bool(v['is_current'])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document version: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get version: {str(e)}")

@router.get("/documents/{document_path}/versions/compare/{version1}/{version2}", response_model=VersionComparison)
async def compare_document_versions(document_path: str, version1: int, version2: int):
    """Compare two versions of a document and analyze changes"""
    
    try:
        # Get both versions
        versions_data = await execute_read_optimized(
            """SELECT version_number, content, created_by, created_at
               FROM document_versions 
               WHERE document_path = %s AND version_number IN (%s, %s)
               ORDER BY version_number""",
            [document_path, version1, version2]
        )
        
        if len(versions_data) != 2:
            raise HTTPException(status_code=404, detail="One or both versions not found")
        
        v1, v2 = versions_data
        
        # Analyze changes (simplified diff algorithm for demo)
        changes = analyze_content_changes(v1['content'], v2['content'])
        similarity = calculate_similarity(v1['content'], v2['content'])
        
        # Generate change summary
        change_summary = {
            "lines_added": sum(1 for c in changes if c['type'] == 'addition'),
            "lines_removed": sum(1 for c in changes if c['type'] == 'deletion'),
            "lines_modified": sum(1 for c in changes if c['type'] == 'modification'),
            "similarity_percentage": round(similarity * 100, 2),
            "change_magnitude": "minor" if similarity > 0.9 else "moderate" if similarity > 0.7 else "major"
        }
        
        return VersionComparison(
            document_path=document_path,
            version1=version1,
            version2=version2,
            changes=changes,
            similarity_score=similarity,
            change_summary=change_summary
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to compare versions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to compare versions: {str(e)}")

# ============================================================
# REGULATION VERSIONING ENDPOINTS
# ============================================================

@router.post("/regulations/versions")
async def create_regulation_version(
    regulation_source: str,
    regulation_title: str,
    content_changes: Dict[str, Any],
    effective_date: datetime,
    supersedes_version: Optional[int] = None,
    current_user: User = Depends(get_current_active_user)
):
    """Create a new version of a regulation with change tracking"""
    
    try:
        # Get next version number
        current_version_result = await execute_read_optimized(
            "SELECT MAX(version_number) as max_version FROM regulation_versions WHERE regulation_source = %s",
            [regulation_source]
        )
        
        next_version = (current_version_result[0]['max_version'] or 0) + 1 if current_version_result else 1
        
        # Create new regulation version
        await execute_write_primary(
            """INSERT INTO regulation_versions 
               (regulation_source, regulation_title, version_number, content_changes_json, 
                effective_date, supersedes_version)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            [regulation_source, regulation_title, next_version, json.dumps(content_changes), 
             effective_date, supersedes_version]
        )
        
        return {
            "regulation_source": regulation_source,
            "version_number": next_version,
            "effective_date": effective_date.isoformat(),
            "message": f"Regulation version {next_version} created successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to create regulation version: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create regulation version: {str(e)}")

@router.get("/regulations/{regulation_source}/versions")
async def get_regulation_versions(regulation_source: str):
    """Get all versions of a regulation"""
    
    try:
        versions_data = await execute_read_optimized(
            """SELECT regulation_source, regulation_title, version_number, 
                      content_changes_json, effective_date, created_at, supersedes_version
               FROM regulation_versions 
               WHERE regulation_source = %s 
               ORDER BY version_number DESC""",
            [regulation_source]
        )
        
        versions = []
        for v in versions_data:
            versions.append(RegulationChange(
                regulation_source=v['regulation_source'],
                regulation_title=v['regulation_title'],
                version_number=v['version_number'],
                effective_date=v['effective_date'],
                content_changes=json.loads(v['content_changes_json'] or '{}'),
                supersedes_version=v['supersedes_version']
            ))
        
        return {
            "regulation_source": regulation_source,
            "versions": versions,
            "total_versions": len(versions)
        }
        
    except Exception as e:
        logger.error(f"Failed to get regulation versions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get regulation versions: {str(e)}")

# ============================================================
# TEMPORAL QUERIES
# ============================================================

@router.get("/temporal/documents/{document_path}")
async def get_document_at_time(document_path: str, at_time: datetime):
    """Get document content as it existed at a specific point in time"""
    
    try:
        # Find the version that was current at the specified time
        version_data = await execute_read_optimized(
            """SELECT content, version_number, created_by, valid_from, valid_to
               FROM document_versions 
               WHERE document_path = %s 
               AND valid_from <= %s 
               AND (valid_to IS NULL OR valid_to > %s)
               LIMIT 1""",
            [document_path, at_time, at_time]
        )
        
        if not version_data:
            raise HTTPException(
                status_code=404, 
                detail=f"No version found for {document_path} at {at_time}"
            )
        
        v = version_data[0]
        return {
            "document_path": document_path,
            "content": v['content'],
            "version_number": v['version_number'],
            "created_by": v['created_by'],
            "valid_from": v['valid_from'],
            "valid_to": v['valid_to'],
            "queried_time": at_time
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document at time: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to query temporal data: {str(e)}")

@router.get("/temporal/changes")
async def get_changes_between_dates(
    start_date: datetime,
    end_date: datetime,
    document_paths: Optional[List[str]] = None
):
    """Get all document changes that occurred between two dates"""
    
    try:
        where_clause = "WHERE created_at BETWEEN %s AND %s"
        params = [start_date, end_date]
        
        if document_paths:
            placeholders = ','.join(['%s'] * len(document_paths))
            where_clause += f" AND document_path IN ({placeholders})"
            params.extend(document_paths)
        
        changes_data = await execute_read_optimized(
            f"""SELECT document_path, version_number, created_by, created_at, 
                       content_hash, metadata_json
                FROM document_versions 
                {where_clause}
                ORDER BY created_at DESC""",
            params
        )
        
        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "total_changes": len(changes_data),
            "changes": changes_data
        }
        
    except Exception as e:
        logger.error(f"Failed to get changes between dates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get temporal changes: {str(e)}")

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def analyze_content_changes(content1: str, content2: str) -> List[Dict[str, Any]]:
    """Analyze differences between two content strings"""
    
    lines1 = content1.split('\n')
    lines2 = content2.split('\n')
    
    changes = []
    
    # Simple line-by-line diff (for demo purposes)
    max_lines = max(len(lines1), len(lines2))
    
    for i in range(max_lines):
        line1 = lines1[i] if i < len(lines1) else None
        line2 = lines2[i] if i < len(lines2) else None
        
        if line1 is None:
            changes.append({
                "type": "addition",
                "line_number": i + 1,
                "content": line2,
                "change_type": "new_line"
            })
        elif line2 is None:
            changes.append({
                "type": "deletion", 
                "line_number": i + 1,
                "content": line1,
                "change_type": "removed_line"
            })
        elif line1 != line2:
            changes.append({
                "type": "modification",
                "line_number": i + 1,
                "old_content": line1,
                "new_content": line2,
                "change_type": "modified_line"
            })
    
    return changes

def calculate_similarity(content1: str, content2: str) -> float:
    """Calculate similarity score between two content strings"""
    
    if not content1 and not content2:
        return 1.0
    
    if not content1 or not content2:
        return 0.0
    
    # Simple character-level similarity
    set1 = set(content1.lower())
    set2 = set(content2.lower())
    
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    
    return intersection / union if union > 0 else 0.0