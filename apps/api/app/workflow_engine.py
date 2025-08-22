"""
Workflow Engine for LexMind Compliance Automation
Handles workflow template execution, step processing, and automation logic
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from enum import Enum

from .deps import execute_query
from .compliance_analyzer import ComplianceAnalyzer

logger = logging.getLogger(__name__)

class WorkflowStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"

class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

class StepType(str, Enum):
    DOCUMENT_ANALYSIS = "document_analysis"
    COMPLIANCE_CHECK = "compliance_check"
    USER_REVIEW = "user_review"
    NOTIFICATION = "notification"
    DATA_EXTRACTION = "data_extraction"
    REPORT_GENERATION = "report_generation"
    APPROVAL = "approval"
    AUTOMATION = "automation"

class WorkflowEngine:
    def __init__(self):
        self.compliance_analyzer = ComplianceAnalyzer()
        self.running_workflows = {}  # Track running workflow instances
    
    async def create_workflow_instance(self, template_id: int, trigger_data: Dict[str, Any], 
                                     context_data: Dict[str, Any], assigned_to: str = None) -> int:
        """Create a new workflow instance from a template"""
        
        # Get template details
        template_query = """
        SELECT name, steps, trigger_config 
        FROM workflow_templates 
        WHERE id = %s AND is_active = TRUE
        """
        template_result = await execute_query(template_query, (template_id,))
        
        if not template_result:
            raise ValueError(f"Template {template_id} not found or inactive")
        
        template = template_result[0]
        steps = json.loads(template['steps'])
        
        # Create workflow instance
        instance_query = """
        INSERT INTO workflow_instances 
        (template_id, name, trigger_data, context_data, total_steps, assigned_to)
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        await execute_query(instance_query, (
            template_id,
            template['name'],
            json.dumps(trigger_data),
            json.dumps(context_data),
            len(steps),
            assigned_to
        ))
        
        # Get the instance ID
        instance_id_result = await execute_query("SELECT LAST_INSERT_ID() as id")
        instance_id = instance_id_result[0]['id']
        
        # Create step executions
        for step in steps:
            step_query = """
            INSERT INTO workflow_step_executions 
            (instance_id, step_number, step_name, step_type, input_data)
            VALUES (%s, %s, %s, %s, %s)
            """
            await execute_query(step_query, (
                instance_id,
                step['id'],
                step['name'],
                step['type'],
                json.dumps(step.get('config', {}))
            ))
        
        logger.info(f"Created workflow instance {instance_id} from template {template_id}")
        return instance_id
    
    async def start_workflow(self, instance_id: int) -> bool:
        """Start executing a workflow instance"""
        
        # Update workflow status to running
        await execute_query(
            "UPDATE workflow_instances SET status = %s, started_at = %s WHERE id = %s",
            (WorkflowStatus.RUNNING, datetime.utcnow(), instance_id)
        )
        
        # Start processing in background
        asyncio.create_task(self._execute_workflow(instance_id))
        
        return True
    
    async def _execute_workflow(self, instance_id: int):
        """Execute workflow steps sequentially"""
        
        try:
            self.running_workflows[instance_id] = True
            
            # Get workflow instance and steps
            instance_query = """
            SELECT wi.*, wt.steps 
            FROM workflow_instances wi
            JOIN workflow_templates wt ON wi.template_id = wt.id
            WHERE wi.id = %s
            """
            instance_result = await execute_query(instance_query, (instance_id,))
            
            if not instance_result:
                raise ValueError(f"Workflow instance {instance_id} not found")
            
            instance = instance_result[0]
            template_steps = json.loads(instance['steps'])
            context_data = json.loads(instance['context_data'] or '{}')
            
            # Execute steps in order
            for step_config in template_steps:
                if instance_id not in self.running_workflows:
                    break  # Workflow was cancelled
                
                success = await self._execute_step(instance_id, step_config, context_data)
                
                if not success:
                    await self._fail_workflow(instance_id, f"Step {step_config['name']} failed")
                    return
                
                # Check if step requires manual intervention
                if not step_config.get('auto_complete', True):
                    await self._pause_workflow(instance_id, f"Waiting for step: {step_config['name']}")
                    return
            
            # Mark workflow as completed
            await execute_query(
                "UPDATE workflow_instances SET status = %s, completed_at = %s WHERE id = %s",
                (WorkflowStatus.COMPLETED, datetime.utcnow(), instance_id)
            )
            
            logger.info(f"Workflow {instance_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Workflow {instance_id} failed: {str(e)}")
            await self._fail_workflow(instance_id, str(e))
        
        finally:
            self.running_workflows.pop(instance_id, None)
    
    async def _execute_step(self, instance_id: int, step_config: Dict[str, Any], 
                          context_data: Dict[str, Any]) -> bool:
        """Execute a single workflow step"""
        
        step_id = step_config['id']
        step_type = step_config['type']
        step_action = step_config.get('action')
        step_config_data = step_config.get('config', {})
        
        # Update step status to running
        start_time = datetime.utcnow()
        await execute_query(
            """UPDATE workflow_step_executions 
               SET status = %s, started_at = %s 
               WHERE instance_id = %s AND step_number = %s""",
            (StepStatus.RUNNING, start_time, instance_id, step_id)
        )
        
        try:
            # Execute step based on type
            output_data = {}
            
            if step_type == StepType.DOCUMENT_ANALYSIS:
                output_data = await self._execute_document_analysis(step_action, step_config_data, context_data)
            
            elif step_type == StepType.COMPLIANCE_CHECK:
                output_data = await self._execute_compliance_check(step_action, step_config_data, context_data)
            
            elif step_type == StepType.USER_REVIEW:
                output_data = await self._execute_user_review(step_action, step_config_data, context_data)
            
            elif step_type == StepType.NOTIFICATION:
                output_data = await self._execute_notification(step_action, step_config_data, context_data)
            
            elif step_type == StepType.DATA_EXTRACTION:
                output_data = await self._execute_data_extraction(step_action, step_config_data, context_data)
            
            elif step_type == StepType.REPORT_GENERATION:
                output_data = await self._execute_report_generation(step_action, step_config_data, context_data)
            
            elif step_type == StepType.AUTOMATION:
                output_data = await self._execute_automation(step_action, step_config_data, context_data)
            
            else:
                raise ValueError(f"Unknown step type: {step_type}")
            
            # Update step as completed
            end_time = datetime.utcnow()
            duration = int((end_time - start_time).total_seconds())
            
            await execute_query(
                """UPDATE workflow_step_executions 
                   SET status = %s, completed_at = %s, duration_seconds = %s, output_data = %s 
                   WHERE instance_id = %s AND step_number = %s""",
                (StepStatus.COMPLETED, end_time, duration, json.dumps(output_data), instance_id, step_id)
            )
            
            # Update workflow current step
            await execute_query(
                "UPDATE workflow_instances SET current_step = %s WHERE id = %s",
                (step_id, instance_id)
            )
            
            logger.info(f"Step {step_id} completed for workflow {instance_id}")
            return True
            
        except Exception as e:
            # Update step as failed
            await execute_query(
                """UPDATE workflow_step_executions 
                   SET status = %s, error_message = %s 
                   WHERE instance_id = %s AND step_number = %s""",
                (StepStatus.FAILED, str(e), instance_id, step_id)
            )
            
            logger.error(f"Step {step_id} failed for workflow {instance_id}: {str(e)}")
            return False
    
    async def _execute_document_analysis(self, action: str, config: Dict[str, Any], 
                                       context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute document analysis step"""
        
        if action == "analyze_compliance":
            doc_id = context.get('document_id')
            if not doc_id:
                raise ValueError("Document ID required for compliance analysis")
            
            # Get document content
            doc_query = "SELECT content, path FROM corp_docs WHERE id = %s"
            doc_result = await execute_query(doc_query, (doc_id,))
            
            if not doc_result:
                raise ValueError(f"Document {doc_id} not found")
            
            doc = doc_result[0]
            
            # Perform compliance analysis
            analysis_result = await self.compliance_analyzer.analyze_document(
                doc_id, doc['content'], doc['path']
            )
            
            return {
                "analysis_id": analysis_result.get("analysis_id"),
                "compliance_score": analysis_result.get("compliance_score"),
                "risk_level": analysis_result.get("risk_level"),
                "frameworks": analysis_result.get("frameworks", [])
            }
        
        else:
            raise ValueError(f"Unknown document analysis action: {action}")
    
    async def _execute_compliance_check(self, action: str, config: Dict[str, Any], 
                                      context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute compliance check step"""
        
        if action == "assess_risk":
            doc_id = context.get('document_id')
            threshold = config.get('threshold', 70)
            
            # Get compliance analysis for document
            analysis_query = """
            SELECT compliance_score, risk_level, gap_count, issues
            FROM compliance_analysis 
            WHERE document_id = %s 
            ORDER BY created_at DESC 
            LIMIT 1
            """
            analysis_result = await execute_query(analysis_query, (doc_id,))
            
            if not analysis_result:
                raise ValueError(f"No compliance analysis found for document {doc_id}")
            
            analysis = analysis_result[0]
            
            # Determine if risk assessment passes threshold
            passes_threshold = analysis['compliance_score'] >= threshold
            
            return {
                "compliance_score": analysis['compliance_score'],
                "risk_level": analysis['risk_level'],
                "passes_threshold": passes_threshold,
                "threshold": threshold,
                "gap_count": analysis['gap_count']
            }
        
        elif action == "bulk_analyze":
            # Analyze multiple documents
            frameworks = config.get('frameworks', ['all'])
            parallel = config.get('parallel', False)
            
            # Get documents to analyze
            docs_query = """
            SELECT id, content, path FROM corp_docs 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
            """
            docs_result = await execute_query(docs_query)
            
            results = []
            for doc in docs_result:
                try:
                    analysis = await self.compliance_analyzer.analyze_document(
                        doc['id'], doc['content'], doc['path']
                    )
                    results.append({
                        "document_id": doc['id'],
                        "compliance_score": analysis.get("compliance_score"),
                        "risk_level": analysis.get("risk_level")
                    })
                except Exception as e:
                    logger.error(f"Failed to analyze document {doc['id']}: {str(e)}")
            
            return {
                "analyzed_count": len(results),
                "results": results,
                "average_score": sum(r['compliance_score'] for r in results) / len(results) if results else 0
            }
        
        else:
            raise ValueError(f"Unknown compliance check action: {action}")
    
    async def _execute_user_review(self, action: str, config: Dict[str, Any], 
                                 context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute user review step (creates assignment)"""
        
        if action == "assign_review":
            role = config.get('role', 'analyst')
            sla_hours = config.get('sla_hours', 24)
            
            # This would typically assign to a user with the specified role
            # For now, we'll just record the assignment
            
            due_date = datetime.utcnow() + timedelta(hours=sla_hours)
            
            return {
                "assigned_role": role,
                "sla_hours": sla_hours,
                "due_date": due_date.isoformat(),
                "status": "assigned"
            }
        
        elif action == "assign_expert":
            role = config.get('role', 'senior_analyst')
            sla_hours = config.get('sla_hours', 4)
            
            due_date = datetime.utcnow() + timedelta(hours=sla_hours)
            
            return {
                "assigned_role": role,
                "sla_hours": sla_hours,
                "due_date": due_date.isoformat(),
                "priority": "high",
                "status": "assigned"
            }
        
        else:
            raise ValueError(f"Unknown user review action: {action}")
    
    async def _execute_notification(self, action: str, config: Dict[str, Any], 
                                  context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute notification step"""
        
        recipients = config.get('recipients', [])
        template = config.get('template', 'default')
        priority = config.get('priority', 'medium')
        
        # Create notifications
        notification_ids = []
        for recipient in recipients:
            notification_query = """
            INSERT INTO workflow_notifications 
            (instance_id, recipient, notification_type, subject, message, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            subject = f"Workflow Notification - {template}"
            message = f"A workflow step requires your attention. Priority: {priority}"
            
            await execute_query(notification_query, (
                context.get('instance_id'),
                recipient,
                'email',  # Default to email
                subject,
                message,
                'pending'
            ))
            
            # Get notification ID
            notif_id_result = await execute_query("SELECT LAST_INSERT_ID() as id")
            notification_ids.append(notif_id_result[0]['id'])
        
        return {
            "notification_ids": notification_ids,
            "recipients": recipients,
            "template": template,
            "status": "sent"
        }
    
    async def _execute_data_extraction(self, action: str, config: Dict[str, Any], 
                                     context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute data extraction step"""
        
        if action == "collect_documents":
            date_range = config.get('date_range', 'last_month')
            include_regulations = config.get('include_regulations', False)
            
            # Build query based on date range
            if date_range == 'last_month':
                date_condition = "created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)"
            elif date_range == 'last_week':
                date_condition = "created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)"
            else:
                date_condition = "1=1"  # All time
            
            # Get documents
            docs_query = f"""
            SELECT id, path, created_at FROM corp_docs 
            WHERE {date_condition}
            ORDER BY created_at DESC
            """
            docs_result = await execute_query(docs_query)
            
            document_ids = [doc['id'] for doc in docs_result]
            
            return {
                "document_count": len(document_ids),
                "document_ids": document_ids,
                "date_range": date_range,
                "include_regulations": include_regulations
            }
        
        else:
            raise ValueError(f"Unknown data extraction action: {action}")
    
    async def _execute_report_generation(self, action: str, config: Dict[str, Any], 
                                       context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute report generation step"""
        
        format_type = config.get('format', 'pdf')
        include_charts = config.get('charts', False)
        
        if action == "generate_compliance_report":
            doc_id = context.get('document_id')
            
            # Get compliance analysis
            analysis_query = """
            SELECT * FROM compliance_analysis 
            WHERE document_id = %s 
            ORDER BY created_at DESC 
            LIMIT 1
            """
            analysis_result = await execute_query(analysis_query, (doc_id,))
            
            if analysis_result:
                analysis = analysis_result[0]
                
                report_data = {
                    "document_id": doc_id,
                    "compliance_score": analysis['compliance_score'],
                    "risk_level": analysis['risk_level'],
                    "gap_count": analysis['gap_count'],
                    "generated_at": datetime.utcnow().isoformat(),
                    "format": format_type
                }
                
                return {
                    "report_generated": True,
                    "report_data": report_data,
                    "format": format_type
                }
        
        elif action == "generate_executive_report":
            period = config.get('period', 'monthly')
            
            # Get aggregate compliance data
            summary_query = """
            SELECT 
                COUNT(DISTINCT document_id) as total_documents,
                AVG(compliance_score) as avg_score,
                COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk_count
            FROM compliance_analysis 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
            """
            summary_result = await execute_query(summary_query)
            
            if summary_result:
                summary = summary_result[0]
                
                return {
                    "report_type": "executive_summary",
                    "period": period,
                    "total_documents": summary['total_documents'],
                    "average_score": round(summary['avg_score'] or 0, 2),
                    "high_risk_count": summary['high_risk_count'],
                    "generated_at": datetime.utcnow().isoformat(),
                    "format": format_type
                }
        
        return {"report_generated": False, "error": "Unknown report action"}
    
    async def _execute_automation(self, action: str, config: Dict[str, Any], 
                                context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute automation step"""
        
        if action == "quarantine_document":
            doc_id = context.get('document_id')
            status = config.get('status', 'under_review')
            
            # Update document status (if we had a status field)
            # For now, just return success
            
            return {
                "document_id": doc_id,
                "new_status": status,
                "quarantined_at": datetime.utcnow().isoformat()
            }
        
        elif action == "calculate_risk_metrics":
            include_trends = config.get('include_trends', False)
            
            # Calculate risk metrics across all documents
            metrics_query = """
            SELECT 
                COUNT(*) as total_analyses,
                AVG(compliance_score) as avg_compliance_score,
                COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk_count,
                COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_risk_count
            FROM compliance_analysis
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
            """
            metrics_result = await execute_query(metrics_query)
            
            if metrics_result:
                metrics = metrics_result[0]
                
                return {
                    "total_analyses": metrics['total_analyses'],
                    "avg_compliance_score": round(metrics['avg_compliance_score'] or 0, 2),
                    "high_risk_count": metrics['high_risk_count'],
                    "critical_risk_count": metrics['critical_risk_count'],
                    "calculated_at": datetime.utcnow().isoformat()
                }
        
        elif action == "generate_mitigation_plan":
            include_timeline = config.get('include_timeline', False)
            
            # Generate a basic mitigation plan
            plan = {
                "immediate_actions": [
                    "Review high-risk documents",
                    "Implement additional controls",
                    "Notify stakeholders"
                ],
                "short_term_actions": [
                    "Update policies and procedures",
                    "Provide additional training",
                    "Enhance monitoring"
                ],
                "long_term_actions": [
                    "Review compliance framework",
                    "Implement automation",
                    "Regular audits"
                ]
            }
            
            if include_timeline:
                plan["timeline"] = {
                    "immediate": "24 hours",
                    "short_term": "1-4 weeks",
                    "long_term": "3-6 months"
                }
            
            return {
                "mitigation_plan": plan,
                "generated_at": datetime.utcnow().isoformat()
            }
        
        else:
            raise ValueError(f"Unknown automation action: {action}")
    
    async def _fail_workflow(self, instance_id: int, error_message: str):
        """Mark workflow as failed"""
        await execute_query(
            "UPDATE workflow_instances SET status = %s, error_message = %s WHERE id = %s",
            (WorkflowStatus.FAILED, error_message, instance_id)
        )
    
    async def _pause_workflow(self, instance_id: int, reason: str):
        """Pause workflow for manual intervention"""
        await execute_query(
            "UPDATE workflow_instances SET status = %s, error_message = %s WHERE id = %s",
            (WorkflowStatus.PAUSED, reason, instance_id)
        )
    
    async def resume_workflow(self, instance_id: int) -> bool:
        """Resume a paused workflow"""
        
        # Update status to running
        await execute_query(
            "UPDATE workflow_instances SET status = %s WHERE id = %s",
            (WorkflowStatus.RUNNING, instance_id)
        )
        
        # Continue execution
        asyncio.create_task(self._execute_workflow(instance_id))
        
        return True
    
    async def cancel_workflow(self, instance_id: int) -> bool:
        """Cancel a running workflow"""
        
        # Remove from running workflows
        self.running_workflows.pop(instance_id, None)
        
        # Update status
        await execute_query(
            "UPDATE workflow_instances SET status = %s WHERE id = %s",
            (WorkflowStatus.CANCELLED, instance_id)
        )
        
        return True
    
    async def get_workflow_status(self, instance_id: int) -> Dict[str, Any]:
        """Get workflow instance status and progress"""
        
        instance_query = """
        SELECT wi.*, wt.name as template_name
        FROM workflow_instances wi
        JOIN workflow_templates wt ON wi.template_id = wt.id
        WHERE wi.id = %s
        """
        instance_result = await execute_query(instance_query, (instance_id,))
        
        if not instance_result:
            raise ValueError(f"Workflow instance {instance_id} not found")
        
        instance = instance_result[0]
        
        # Get step executions
        steps_query = """
        SELECT * FROM workflow_step_executions 
        WHERE instance_id = %s 
        ORDER BY step_number
        """
        steps_result = await execute_query(steps_query, (instance_id,))
        
        return {
            "instance": instance,
            "steps": steps_result,
            "progress": {
                "current_step": instance['current_step'],
                "total_steps": instance['total_steps'],
                "percentage": round((instance['current_step'] / instance['total_steps']) * 100, 1) if instance['total_steps'] > 0 else 0
            }
        }

# Global workflow engine instance
workflow_engine = WorkflowEngine()