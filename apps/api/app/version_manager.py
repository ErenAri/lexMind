"""
Document Version Manager for LexMind
Handles document versioning, change tracking, and diff analysis
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from enum import Enum
from difflib import SequenceMatcher
import re

from .deps import execute_query

logger = logging.getLogger(__name__)

class UploadType(str, Enum):
    INITIAL = "initial"
    UPDATE = "update"
    REVISION = "revision"
    ROLLBACK = "rollback"

class ChangeType(str, Enum):
    ADDED = "added"
    MODIFIED = "modified"
    DELETED = "deleted"
    MOVED = "moved"
    RENAMED = "renamed"

class ImpactLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class VersionManager:
    def __init__(self):
        self.diff_threshold = 0.7  # Similarity threshold for change detection
    
    async def create_document_version(self, 
                                    document_id: int, 
                                    content: str, 
                                    path: str,
                                    uploaded_by: str,
                                    upload_type: UploadType = UploadType.UPDATE,
                                    upload_reason: str | None = None,
                                    metadata: Optional[Dict[str, Any]] = None) -> int:
        """Create a new version of a document"""
        
        # Calculate content hash
        content_hash = self._calculate_hash(content)
        file_size = len(content.encode('utf-8'))
        
        # Get current version number
        current_version_result = await execute_query(
            "SELECT MAX(version_number) as max_version FROM document_versions WHERE document_id = %s",
            (document_id,)
        )
        
        current_max = current_version_result[0]['max_version'] if current_version_result else 0
        new_version_number = (current_max or 0) + 1
        
        # Check if content actually changed
        if current_max:
            latest_version_result = await execute_query(
                "SELECT content_hash FROM document_versions WHERE document_id = %s AND version_number = %s",
                (document_id, current_max)
            )
            
            if latest_version_result and latest_version_result[0]['content_hash'] == content_hash:
                raise ValueError("No changes detected - content is identical to current version")
        
        # Detect MIME type from path
        mime_type = self._detect_mime_type(path)
        
        # Create new version
        version_query = """
        INSERT INTO document_versions 
        (document_id, version_number, path, content, content_hash, file_size, 
         mime_type, metadata, upload_type, uploaded_by, upload_reason, is_current)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
        """
        
        await execute_query(version_query, (
            document_id,
            new_version_number,
            path,
            content,
            content_hash,
            file_size,
            mime_type,
            json.dumps(metadata or {}),
            upload_type,
            uploaded_by,
            upload_reason
        ))
        
        # Get the new version ID
        version_id_result = await execute_query("SELECT LAST_INSERT_ID() as id")
        version_id = version_id_result[0]['id']
        
        # Update previous version to not be current
        if current_max:
            await execute_query(
                "UPDATE document_versions SET is_current = FALSE WHERE document_id = %s AND version_number = %s",
                (document_id, current_max)
            )
        
        # Update corp_docs table
        await execute_query(
            """UPDATE corp_docs 
               SET current_version_id = %s, version_count = %s, last_modified_by = %s, updated_at = NOW()
               WHERE id = %s""",
            (version_id, new_version_number, uploaded_by, document_id)
        )
        
        # Analyze changes if this isn't the first version
        if current_max:
            await self._analyze_changes(document_id, current_max, new_version_number)
        
        logger.info(f"Created version {new_version_number} for document {document_id}")
        return version_id
    
    async def _analyze_changes(self, document_id: int, from_version: int, to_version: int):
        """Analyze changes between two versions"""
        
        # Get content from both versions
        versions_query = """
        SELECT version_number, content, id
        FROM document_versions 
        WHERE document_id = %s AND version_number IN (%s, %s)
        ORDER BY version_number
        """
        versions_result = await execute_query(versions_query, (document_id, from_version, to_version))
        
        if len(versions_result) != 2:
            logger.error(f"Could not find both versions for comparison")
            return
        
        old_version = versions_result[0]
        new_version = versions_result[1]
        
        old_content = old_version['content']
        new_content = new_version['content']
        
        # Split content into lines for analysis
        old_lines = old_content.split('\n')
        new_lines = new_content.split('\n')
        
        # Use difflib to find changes
        differ = SequenceMatcher(None, old_lines, new_lines)
        changes = []
        
        for tag, i1, i2, j1, j2 in differ.get_opcodes():
            if tag != 'equal':
                change_type = self._map_diff_tag_to_change_type(tag)
                old_text = '\n'.join(old_lines[i1:i2]) if i1 < i2 else ''
                new_text = '\n'.join(new_lines[j1:j2]) if j1 < j2 else ''
                
                # Calculate impact based on content
                impact = self._assess_change_impact(old_text, new_text, change_type)
                
                # Generate change summary
                summary = self._generate_change_summary(old_text, new_text, change_type)
                
                # Analyze compliance impact
                compliance_impact = self._analyze_compliance_impact(old_text, new_text)
                
                change_data = {
                    'from_version_id': old_version['id'],
                    'to_version_id': new_version['id'],
                    'change_type': change_type,
                    'old_content': old_text,
                    'new_content': new_text,
                    'line_start': i1 + 1,  # 1-based line numbers
                    'line_end': i2,
                    'confidence_score': 0.95,  # High confidence for difflib results
                    'change_summary': summary,
                    'impact_assessment': impact,
                    'compliance_impact': json.dumps(compliance_impact)
                }
                
                changes.append(change_data)
        
        # Insert changes into database
        for change in changes:
            change_query = """
            INSERT INTO document_changes 
            (from_version_id, to_version_id, change_type, old_content, new_content,
             line_start, line_end, confidence_score, change_summary, impact_assessment, compliance_impact)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            await execute_query(change_query, (
                change['from_version_id'],
                change['to_version_id'],
                change['change_type'],
                change['old_content'],
                change['new_content'],
                change['line_start'],
                change['line_end'],
                change['confidence_score'],
                change['change_summary'],
                change['impact_assessment'],
                change['compliance_impact']
            ))
        
        logger.info(f"Analyzed {len(changes)} changes between versions {from_version} and {to_version}")
    
    def _map_diff_tag_to_change_type(self, tag: str) -> ChangeType:
        """Map difflib tags to our change types"""
        mapping = {
            'insert': ChangeType.ADDED,
            'delete': ChangeType.DELETED,
            'replace': ChangeType.MODIFIED
        }
        return mapping.get(tag, ChangeType.MODIFIED)
    
    def _assess_change_impact(self, old_text: str, new_text: str, change_type: ChangeType) -> ImpactLevel:
        """Assess the impact level of a change"""
        
        # Critical keywords that indicate high impact
        critical_keywords = [
            'shall', 'must', 'required', 'mandatory', 'compliance', 
            'regulation', 'legal', 'penalty', 'violation', 'audit',
            'security', 'privacy', 'confidential', 'restricted'
        ]
        
        high_impact_keywords = [
            'policy', 'procedure', 'process', 'control', 'standard',
            'responsibility', 'authority', 'approval', 'review'
        ]
        
        combined_text = (old_text + ' ' + new_text).lower()
        
        # Check for critical keywords
        if any(keyword in combined_text for keyword in critical_keywords):
            return ImpactLevel.CRITICAL
        
        # Check for high impact keywords
        if any(keyword in combined_text for keyword in high_impact_keywords):
            return ImpactLevel.HIGH
        
        # Consider change type
        if change_type == ChangeType.DELETED:
            return ImpactLevel.HIGH
        elif change_type == ChangeType.ADDED:
            return ImpactLevel.MEDIUM
        else:  # Modified
            # Calculate similarity
            similarity = SequenceMatcher(None, old_text, new_text).ratio()
            if similarity < 0.3:  # Major changes
                return ImpactLevel.HIGH
            elif similarity < 0.7:  # Moderate changes
                return ImpactLevel.MEDIUM
            else:  # Minor changes
                return ImpactLevel.LOW
    
    def _generate_change_summary(self, old_text: str, new_text: str, change_type: ChangeType) -> str:
        """Generate a human-readable summary of the change"""
        
        if change_type == ChangeType.ADDED:
            words = len(new_text.split())
            return f"Added {words} words of new content"
        
        elif change_type == ChangeType.DELETED:
            words = len(old_text.split())
            return f"Deleted {words} words of content"
        
        elif change_type == ChangeType.MODIFIED:
            old_words = len(old_text.split())
            new_words = len(new_text.split())
            
            if new_words > old_words:
                return f"Modified content, added {new_words - old_words} words"
            elif new_words < old_words:
                return f"Modified content, removed {old_words - new_words} words"
            else:
                return f"Modified {old_words} words of content"
        
        return "Content changed"
    
    def _analyze_compliance_impact(self, old_text: str, new_text: str) -> Dict[str, Any]:
        """Analyze which compliance frameworks might be affected by this change"""
        
        combined_text = (old_text + ' ' + new_text).lower()
        
        # Framework keywords
        framework_keywords = {
            'GDPR': ['gdpr', 'data protection', 'personal data', 'privacy', 'consent', 'data subject'],
            'SOX': ['sox', 'sarbanes', 'financial', 'internal control', 'audit', 'financial reporting'],
            'HIPAA': ['hipaa', 'health', 'medical', 'patient', 'phi', 'protected health information'],
            'ISO27001': ['iso27001', 'information security', 'security management', 'risk management'],
            'PCI DSS': ['pci', 'payment card', 'cardholder', 'payment data', 'card data']
        }
        
        affected_frameworks = []
        
        for framework, keywords in framework_keywords.items():
            if any(keyword in combined_text for keyword in keywords):
                affected_frameworks.append(framework)
        
        return {
            'affected_frameworks': affected_frameworks,
            'requires_review': len(affected_frameworks) > 0,
            'analysis_date': datetime.utcnow().isoformat()
        }
    
    def _calculate_hash(self, content: str) -> str:
        """Calculate SHA-256 hash of content"""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    def _detect_mime_type(self, path: str) -> str:
        """Detect MIME type from file extension"""
        extension = path.lower().split('.')[-1]
        
        mime_map = {
            'pdf': 'application/pdf',
            'txt': 'text/plain',
            'md': 'text/markdown',
            'html': 'text/html',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'json': 'application/json',
            'xml': 'application/xml'
        }
        
        return mime_map.get(extension, 'application/octet-stream')
    
    async def get_document_versions(self, document_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get version history for a document"""
        
        query = """
        SELECT dv.*, dvh.change_count, dvh.tags, dvh.comment_count, dvh.approval_count
        FROM document_versions dv
        LEFT JOIN document_version_history dvh ON dv.id = dvh.id
        WHERE dv.document_id = %s
        ORDER BY dv.version_number DESC
        LIMIT %s
        """
        
        result = await execute_query(query, (document_id, limit))
        
        versions = []
        for row in result or []:
            version = dict(row)
            
            # Parse JSON fields
            try:
                version['metadata'] = json.loads(version['metadata']) if version['metadata'] else {}
            except:
                version['metadata'] = {}
            
            # Convert datetime to string
            if version['created_at']:
                version['created_at'] = version['created_at'].isoformat()
            
            versions.append(version)
        
        return versions
    
    async def get_version_changes(self, from_version_id: int, to_version_id: int) -> List[Dict[str, Any]]:
        """Get detailed changes between two versions"""
        
        query = """
        SELECT dc.*, 
               fv.version_number as from_version_number,
               tv.version_number as to_version_number
        FROM document_changes dc
        JOIN document_versions fv ON dc.from_version_id = fv.id
        JOIN document_versions tv ON dc.to_version_id = tv.id
        WHERE dc.from_version_id = %s AND dc.to_version_id = %s
        ORDER BY dc.line_start
        """
        
        result = await execute_query(query, (from_version_id, to_version_id))
        
        changes = []
        for row in result or []:
            change = dict(row)
            
            # Parse JSON fields
            try:
                change['compliance_impact'] = json.loads(change['compliance_impact']) if change['compliance_impact'] else {}
            except:
                change['compliance_impact'] = {}
            
            # Convert datetime to string
            if change['created_at']:
                change['created_at'] = change['created_at'].isoformat()
            
            changes.append(change)
        
        return changes
    
    async def rollback_to_version(self, document_id: int, target_version: int, rolled_back_by: str, reason: str) -> int:
        """Rollback document to a previous version"""
        
        # Get the target version content
        target_query = """
        SELECT path, content FROM document_versions 
        WHERE document_id = %s AND version_number = %s
        """
        target_result = await execute_query(target_query, (document_id, target_version))
        
        if not target_result:
            raise ValueError(f"Version {target_version} not found for document {document_id}")
        
        target_data = target_result[0]
        
        # Create new version with rollback content
        version_id = await self.create_document_version(
            document_id=document_id,
            content=target_data['content'],
            path=target_data['path'],
            uploaded_by=rolled_back_by,
            upload_type=UploadType.ROLLBACK,
            upload_reason=f"Rollback to version {target_version}: {reason}"
        )
        
        logger.info(f"Rolled back document {document_id} to version {target_version}")
        return version_id
    
    async def add_version_comment(self, version_id: int, commenter: str, comment_text: str, 
                                comment_type: str = 'general', change_id: int | None = None) -> int:
        """Add a comment to a document version"""
        
        comment_query = """
        INSERT INTO document_version_comments 
        (version_id, change_id, commenter, comment_type, comment_text)
        VALUES (%s, %s, %s, %s, %s)
        """
        
        await execute_query(comment_query, (version_id, change_id, commenter, comment_type, comment_text))
        
        # Get the comment ID
        comment_id_result = await execute_query("SELECT LAST_INSERT_ID() as id")
        comment_id = comment_id_result[0]['id']
        
        logger.info(f"Added comment to version {version_id}")
        return comment_id
    
    async def add_version_tag(self, version_id: int, tag_name: str, tag_value: str, 
                            tag_type: str = 'custom', created_by: str = 'system') -> int:
        """Add a tag to a document version"""
        
        tag_query = """
        INSERT INTO document_version_tags 
        (version_id, tag_name, tag_value, tag_type, created_by)
        VALUES (%s, %s, %s, %s, %s)
        """
        
        await execute_query(tag_query, (version_id, tag_name, tag_value, tag_type, created_by))
        
        # Get the tag ID
        tag_id_result = await execute_query("SELECT LAST_INSERT_ID() as id")
        tag_id = tag_id_result[0]['id']
        
        return tag_id
    
    async def compare_versions(self, document_id: int, version1: int, version2: int) -> Dict[str, Any]:
        """Compare two versions and return detailed diff"""
        
        # Get version content
        versions_query = """
        SELECT id, version_number, content, created_at, uploaded_by
        FROM document_versions 
        WHERE document_id = %s AND version_number IN (%s, %s)
        ORDER BY version_number
        """
        versions_result = await execute_query(versions_query, (document_id, version1, version2))
        
        if len(versions_result) != 2:
            raise ValueError("Could not find both versions for comparison")
        
        v1_data = versions_result[0]
        v2_data = versions_result[1]
        
        # Get changes between versions
        changes = await self.get_version_changes(
            versions_result[0]['id'],
            versions_result[1]['id']
        )
        
        # Calculate statistics
        stats = {
            'additions': len([c for c in changes if c['change_type'] == 'added']),
            'deletions': len([c for c in changes if c['change_type'] == 'deleted']),
            'modifications': len([c for c in changes if c['change_type'] == 'modified']),
            'total_changes': len(changes)
        }
        
        return {
            'version1': {
                'number': v1_data['version_number'],
                'content': v1_data['content'],
                'created_at': v1_data['created_at'].isoformat() if v1_data['created_at'] else None,
                'uploaded_by': v1_data['uploaded_by']
            },
            'version2': {
                'number': v2_data['version_number'],
                'content': v2_data['content'],
                'created_at': v2_data['created_at'].isoformat() if v2_data['created_at'] else None,
                'uploaded_by': v2_data['uploaded_by']
            },
            'changes': changes,
            'statistics': stats
        }

# Global version manager instance
version_manager = VersionManager()