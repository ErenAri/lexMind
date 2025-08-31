"""
Audit Logger for LexMind
Comprehensive audit trail and compliance reporting system
"""

import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from enum import Enum
import asyncio
from contextlib import asynccontextmanager

from .deps import execute_query

logger = logging.getLogger(__name__)

class EventType(str, Enum):
    USER_ACTION = "user_action"
    SYSTEM_ACTION = "system_action"
    COMPLIANCE_EVENT = "compliance_event"
    SECURITY_EVENT = "security_event"
    WORKFLOW_EVENT = "workflow_event"

class Action(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    ACCESS = "access"
    ANALYZE = "analyze"
    APPROVE = "approve"
    REJECT = "reject"
    UPLOAD = "upload"
    DOWNLOAD = "download"
    EXPORT = "export"
    WORKFLOW_START = "workflow_start"
    WORKFLOW_COMPLETE = "workflow_complete"
    VERSION_CREATE = "version_create"
    ROLLBACK = "rollback"

class ResourceType(str, Enum):
    DOCUMENT = "document"
    USER = "user"
    WORKFLOW = "workflow"
    VERSION = "version"
    COMPLIANCE_ANALYSIS = "compliance_analysis"
    REPORT = "report"
    SEARCH = "search"
    SYSTEM = "system"

class RiskLevel(str, Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ReportType(str, Enum):
    AUDIT_SUMMARY = "audit_summary"
    COMPLIANCE_STATUS = "compliance_status"
    RISK_ASSESSMENT = "risk_assessment"
    USER_ACTIVITY = "user_activity"
    DOCUMENT_ACTIVITY = "document_activity"
    WORKFLOW_SUMMARY = "workflow_summary"
    SECURITY_EVENTS = "security_events"
    CUSTOM = "custom"

class AuditLogger:
    def __init__(self):
        self._current_context = {}
    
    @asynccontextmanager
    async def audit_context(self, **context):
        """Context manager for setting audit context"""
        old_context = self._current_context.copy()
        self._current_context.update(context)
        try:
            yield
        finally:
            self._current_context = old_context
    
    async def log_event(self,
                       event_type: EventType,
                       action: Action,
                       resource_type: ResourceType,
                       resource_id: Optional[str] = None,
                       resource_path: Optional[str] = None,
                       user_id: Optional[str] = None,
                       user_role: Optional[str] = None,
                       session_id: Optional[str] = None,
                       ip_address: Optional[str] = None,
                       user_agent: Optional[str] = None,
                       request_id: Optional[str] = None,
                       before_state: Optional[Dict[str, Any]] = None,
                       after_state: Optional[Dict[str, Any]] = None,
                       metadata: Optional[Dict[str, Any]] = None,
                       compliance_impact: Optional[Dict[str, Any]] = None,
                       risk_level: RiskLevel = RiskLevel.NONE,
                       success: bool = True,
                       error_message: Optional[str] = None,
                       duration_ms: Optional[int] = None) -> Optional[str]:
        """Log an audit event"""
        
        event_id = str(uuid.uuid4())
        
        # Merge context with provided values
        context = self._current_context.copy()
        if user_id is None:
            user_id = context.get('user_id')
        if user_role is None:
            user_role = context.get('user_role')
        if session_id is None:
            session_id = context.get('session_id')
        if ip_address is None:
            ip_address = context.get('ip_address')
        if user_agent is None:
            user_agent = context.get('user_agent')
        if request_id is None:
            request_id = context.get('request_id')
        
        # Combine metadata
        combined_metadata = context.get('metadata', {}).copy()
        if metadata:
            combined_metadata.update(metadata)
        
        try:
            query = """
            INSERT INTO audit_events 
            (event_id, event_type, action, resource_type, resource_id, resource_path,
             user_id, user_role, session_id, ip_address, user_agent, request_id,
             before_state, after_state, metadata, compliance_impact, risk_level,
             success, error_message, duration_ms)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            await execute_query(query, (
                event_id,
                event_type,
                action,
                resource_type,
                resource_id,
                resource_path,
                user_id,
                user_role,
                session_id,
                ip_address,
                user_agent,
                request_id,
                json.dumps(before_state) if before_state else None,
                json.dumps(after_state) if after_state else None,
                json.dumps(combined_metadata) if combined_metadata else None,
                json.dumps(compliance_impact) if compliance_impact else None,
                risk_level,
                success,
                error_message,
                duration_ms
            ))
            
            logger.debug(f"Logged audit event {event_id}: {event_type}.{action} on {resource_type}")
            return event_id
            
        except Exception as e:
            logger.error(f"Failed to log audit event: {str(e)}")
            # Don't raise exception to avoid breaking the main application
            return None
    
    async def log_user_action(self, action: Action, resource_type: ResourceType, 
                            resource_id: Optional[str] = None, **kwargs) -> Optional[str]:
        """Convenience method for logging user actions"""
        return await self.log_event(
            event_type=EventType.USER_ACTION,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            **kwargs
        )
    
    async def log_compliance_event(self, action: Action, resource_id: Optional[str] = None,
                                 frameworks: Optional[List[str]] = None, **kwargs) -> Optional[str]:
        """Convenience method for logging compliance events"""
        compliance_impact = {}
        if frameworks:
            compliance_impact['affected_frameworks'] = frameworks
            compliance_impact['requires_review'] = True
        
        return await self.log_event(
            event_type=EventType.COMPLIANCE_EVENT,
            action=action,
            resource_type=ResourceType.COMPLIANCE_ANALYSIS,
            resource_id=resource_id,
            compliance_impact=compliance_impact,
            **kwargs
        )
    
    async def log_workflow_event(self, action: Action, workflow_id: Optional[str] = None, **kwargs) -> Optional[str]:
        """Convenience method for logging workflow events"""
        return await self.log_event(
            event_type=EventType.WORKFLOW_EVENT,
            action=action,
            resource_type=ResourceType.WORKFLOW,
            resource_id=workflow_id,
            **kwargs
        )
    
    async def log_security_event(self, action: Action, risk_level: RiskLevel = RiskLevel.MEDIUM,
                               **kwargs) -> Optional[str]:
        """Convenience method for logging security events"""
        return await self.log_event(
            event_type=EventType.SECURITY_EVENT,
            action=action,
            resource_type=ResourceType.SYSTEM,
            risk_level=risk_level,
            **kwargs
        )
    
    async def get_audit_trail(self,
                            event_types: Optional[List[EventType]] = None,
                            actions: Optional[List[Action]] = None,
                            resource_types: Optional[List[ResourceType]] = None,
                            user_id: Optional[str] = None,
                            start_date: Optional[datetime] = None,
                            end_date: Optional[datetime] = None,
                            risk_levels: Optional[List[RiskLevel]] = None,
                            limit: int = 100,
                            offset: int = 0) -> List[Dict[str, Any]]:
        """Get filtered audit trail"""
        
        conditions = []
        params = []
        
        if event_types:
            placeholders = ','.join(['%s'] * len(event_types))
            conditions.append(f"event_type IN ({placeholders})")
            params.extend(event_types)
        
        if actions:
            placeholders = ','.join(['%s'] * len(actions))
            conditions.append(f"action IN ({placeholders})")
            params.extend(actions)
        
        if resource_types:
            placeholders = ','.join(['%s'] * len(resource_types))
            conditions.append(f"resource_type IN ({placeholders})")
            params.extend(resource_types)
        
        if user_id:
            conditions.append("user_id = %s")
            params.append(user_id)
        
        if start_date:
            conditions.append("created_at >= %s")
            params.append(start_date)
        
        if end_date:
            conditions.append("created_at <= %s")
            params.append(end_date)
        
        if risk_levels:
            placeholders = ','.join(['%s'] * len(risk_levels))
            conditions.append(f"risk_level IN ({placeholders})")
            params.extend(risk_levels)
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        query = f"""
        SELECT * FROM audit_events 
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        
        result = await execute_query(query, params)
        
        events = []
        for row in result or []:
            event = dict(row)
            
            # Parse JSON fields
            for field in ['before_state', 'after_state', 'metadata', 'compliance_impact']:
                if event[field]:
                    try:
                        event[field] = json.loads(event[field])
                    except:
                        event[field] = {}
                else:
                    event[field] = {}
            
            # Convert datetime to string
            if event['created_at']:
                event['created_at'] = event['created_at'].isoformat()
            
            events.append(event)
        
        return events
    
    async def generate_compliance_report(self,
                                       report_type: ReportType,
                                       title: str,
                                       generated_by: str,
                                       start_date: datetime,
                                       end_date: datetime,
                                       filters: Optional[Dict[str, Any]] = None,
                                       generated_for: str = 'all') -> str:
        """Generate a compliance report"""
        
        report_id = str(uuid.uuid4())
        
        # Generate report content based on type
        normalized_filters: Dict[str, Any] = filters or {}
        if report_type == ReportType.AUDIT_SUMMARY:
            metrics, findings, recommendations = await self._generate_audit_summary(start_date, end_date, normalized_filters)
        elif report_type == ReportType.COMPLIANCE_STATUS:
            metrics, findings, recommendations = await self._generate_compliance_status(start_date, end_date, normalized_filters)
        elif report_type == ReportType.RISK_ASSESSMENT:
            metrics, findings, recommendations = await self._generate_risk_assessment(start_date, end_date, normalized_filters)
        elif report_type == ReportType.USER_ACTIVITY:
            metrics, findings, recommendations = await self._generate_user_activity(start_date, end_date, normalized_filters)
        elif report_type == ReportType.SECURITY_EVENTS:
            metrics, findings, recommendations = await self._generate_security_events(start_date, end_date, normalized_filters)
        else:
            metrics, findings, recommendations = {}, [], []
        
        # Calculate overall scores
        compliance_score = metrics.get('compliance_score', 0)
        risk_score = metrics.get('risk_score', 0)
        
        # Save report to database
        query = """
        INSERT INTO compliance_reports 
        (report_id, report_type, title, generated_by, generated_for, date_range_start, 
         date_range_end, filters, metrics, findings, recommendations, compliance_score, risk_score)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        await execute_query(query, (
            report_id,
            report_type,
            title,
            generated_by,
            generated_for,
            start_date,
            end_date,
            json.dumps(filters or {}),
            json.dumps(metrics),
            json.dumps(findings),
            json.dumps(recommendations),
            compliance_score,
            risk_score
        ))
        
        # Mark report as completed
        await execute_query(
            "UPDATE compliance_reports SET status = 'completed' WHERE report_id = %s",
            (report_id,)
        )
        
        return report_id
    
    async def _generate_audit_summary(self, start_date: datetime, end_date: datetime, 
                                    filters: Dict[str, Any]) -> tuple:
        """Generate audit summary metrics"""
        
        # Get basic event statistics
        stats_query = """
        SELECT 
            COUNT(*) as total_events,
            COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_events,
            COUNT(CASE WHEN risk_level IN ('high', 'critical') THEN 1 END) as high_risk_events,
            COUNT(DISTINCT user_id) as active_users,
            COUNT(DISTINCT DATE(created_at)) as active_days
        FROM audit_events 
        WHERE created_at BETWEEN %s AND %s
        """
        stats_result = await execute_query(stats_query, (start_date, end_date))
        stats = stats_result[0] if stats_result else {}
        
        # Get event breakdown by type
        breakdown_query = """
        SELECT event_type, action, COUNT(*) as count
        FROM audit_events 
        WHERE created_at BETWEEN %s AND %s
        GROUP BY event_type, action
        ORDER BY count DESC
        """
        breakdown_result = await execute_query(breakdown_query, (start_date, end_date))
        
        # Get top users by activity
        users_query = """
        SELECT user_id, COUNT(*) as action_count
        FROM audit_events 
        WHERE created_at BETWEEN %s AND %s AND user_id IS NOT NULL
        GROUP BY user_id
        ORDER BY action_count DESC
        LIMIT 10
        """
        users_result = await execute_query(users_query, (start_date, end_date))
        
        metrics = {
            'total_events': stats.get('total_events', 0),
            'failed_events': stats.get('failed_events', 0),
            'high_risk_events': stats.get('high_risk_events', 0),
            'active_users': stats.get('active_users', 0),
            'active_days': stats.get('active_days', 0),
            'event_breakdown': [dict(row) for row in breakdown_result or []],
            'top_users': [dict(row) for row in users_result or []],
            'compliance_score': max(0, 100 - (stats.get('failed_events', 0) * 2) - (stats.get('high_risk_events', 0) * 5)),
            'risk_score': min(100, (stats.get('failed_events', 0) * 2) + (stats.get('high_risk_events', 0) * 5))
        }
        
        findings = []
        if stats.get('failed_events', 0) > 0:
            findings.append({
                'severity': 'medium',
                'title': 'Failed Operations Detected',
                'description': f"{stats['failed_events']} operations failed during the audit period",
                'recommendation': 'Review failed operations and implement corrective measures'
            })
        
        if stats.get('high_risk_events', 0) > 0:
            findings.append({
                'severity': 'high',
                'title': 'High Risk Events',
                'description': f"{stats['high_risk_events']} high or critical risk events occurred",
                'recommendation': 'Investigate high-risk events and strengthen security controls'
            })
        
        recommendations = [
            'Implement automated monitoring for failed operations',
            'Regular review of high-risk events',
            'User training on security best practices',
            'Enhance logging for better audit trails'
        ]
        
        return metrics, findings, recommendations
    
    async def _generate_compliance_status(self, start_date: datetime, end_date: datetime,
                                        filters: Dict[str, Any]) -> tuple:
        """Generate compliance status report"""
        
        # Get compliance analysis statistics
        analysis_query = """
        SELECT 
            COUNT(*) as total_analyses,
            AVG(compliance_score) as avg_compliance_score,
            COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk_docs,
            COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_risk_docs
        FROM compliance_analysis 
        WHERE created_at BETWEEN %s AND %s
        """
        analysis_result = await execute_query(analysis_query, (start_date, end_date))
        analysis_stats = analysis_result[0] if analysis_result else {}
        
        # Get framework breakdown
        framework_query = """
        SELECT framework_name, COUNT(*) as document_count, AVG(compliance_score) as avg_score
        FROM compliance_analysis ca
        JOIN compliance_frameworks cf ON JSON_CONTAINS(ca.frameworks, JSON_QUOTE(cf.name))
        WHERE ca.created_at BETWEEN %s AND %s
        GROUP BY framework_name
        """
        framework_result = await execute_query(framework_query, (start_date, end_date))
        
        metrics = {
            'total_analyses': analysis_stats.get('total_analyses', 0),
            'avg_compliance_score': round(analysis_stats.get('avg_compliance_score', 0), 2),
            'high_risk_documents': analysis_stats.get('high_risk_docs', 0),
            'critical_risk_documents': analysis_stats.get('critical_risk_docs', 0),
            'framework_breakdown': [dict(row) for row in framework_result or []],
            'compliance_score': analysis_stats.get('avg_compliance_score', 0),
            'risk_score': (analysis_stats.get('high_risk_docs', 0) * 2) + (analysis_stats.get('critical_risk_docs', 0) * 5)
        }
        
        findings = []
        recommendations = [
            'Regular compliance reviews',
            'Update documentation to meet standards',
            'Implement automated compliance checks',
            'Staff training on compliance requirements'
        ]
        
        return metrics, findings, recommendations
    
    async def _generate_risk_assessment(self, start_date: datetime, end_date: datetime,
                                      filters: Dict[str, Any]) -> tuple:
        """Generate risk assessment report"""
        
        # Get risk event statistics
        risk_query = """
        SELECT 
            risk_level,
            COUNT(*) as event_count,
            COUNT(DISTINCT user_id) as affected_users,
            COUNT(DISTINCT resource_id) as affected_resources
        FROM audit_events 
        WHERE created_at BETWEEN %s AND %s AND risk_level != 'none'
        GROUP BY risk_level
        ORDER BY FIELD(risk_level, 'critical', 'high', 'medium', 'low')
        """
        risk_result = await execute_query(risk_query, (start_date, end_date))
        
        # Get security events
        security_query = """
        SELECT action, COUNT(*) as count
        FROM audit_events 
        WHERE created_at BETWEEN %s AND %s AND event_type = 'security_event'
        GROUP BY action
        ORDER BY count DESC
        """
        security_result = await execute_query(security_query, (start_date, end_date))
        
        total_risk_events = sum(row['event_count'] for row in risk_result or [])
        critical_events = next((row['event_count'] for row in risk_result or [] if row['risk_level'] == 'critical'), 0)
        
        metrics = {
            'risk_breakdown': [dict(row) for row in risk_result or []],
            'security_events': [dict(row) for row in security_result or []],
            'total_risk_events': total_risk_events,
            'critical_events': critical_events,
            'compliance_score': max(0, 100 - (total_risk_events * 2)),
            'risk_score': min(100, total_risk_events * 2 + critical_events * 10)
        }
        
        findings = []
        recommendations = [
            'Implement risk monitoring dashboards',
            'Regular security assessments',
            'Incident response plan updates',
            'Security awareness training'
        ]
        
        return metrics, findings, recommendations
    
    async def _generate_user_activity(self, start_date: datetime, end_date: datetime,
                                    filters: Dict[str, Any]) -> tuple:
        """Generate user activity report"""
        
        # Get user activity summary
        activity_query = """
        SELECT 
            user_id,
            SUM(total_actions) as total_actions,
            SUM(login_count) as logins,
            SUM(document_views) as document_views,
            SUM(document_uploads) as uploads,
            SUM(failed_actions) as failed_actions
        FROM user_activity_summary 
        WHERE date BETWEEN %s AND %s
        GROUP BY user_id
        ORDER BY total_actions DESC
        """
        activity_result = await execute_query(activity_query, (start_date.date(), end_date.date()))
        
        metrics = {
            'user_activities': [dict(row) for row in activity_result or []],
            'total_users': len(activity_result or []),
            'compliance_score': 85,  # Default score
            'risk_score': 15
        }
        
        findings = []
        recommendations = [
            'Monitor unusual user activity patterns',
            'Regular access reviews',
            'User training programs',
            'Implement user behavior analytics'
        ]
        
        return metrics, findings, recommendations
    
    async def _generate_security_events(self, start_date: datetime, end_date: datetime,
                                      filters: Dict[str, Any]) -> tuple:
        """Generate security events report"""
        
        # Get security events
        security_query = """
        SELECT 
            action,
            risk_level,
            COUNT(*) as event_count,
            COUNT(DISTINCT user_id) as affected_users
        FROM audit_events 
        WHERE created_at BETWEEN %s AND %s AND event_type = 'security_event'
        GROUP BY action, risk_level
        ORDER BY event_count DESC
        """
        security_result = await execute_query(security_query, (start_date, end_date))
        
        total_security_events = sum(row['event_count'] for row in security_result or [])
        
        metrics = {
            'security_events': [dict(row) for row in security_result or []],
            'total_security_events': total_security_events,
            'compliance_score': max(0, 100 - total_security_events),
            'risk_score': min(100, total_security_events * 3)
        }
        
        findings = []
        recommendations = [
            'Implement real-time security monitoring',
            'Regular security audits',
            'Incident response procedures',
            'Security awareness training'
        ]
        
        return metrics, findings, recommendations

# Global audit logger instance
audit_logger = AuditLogger()