-- Compliance Workflow Automation Tables
-- Migration 011: Add workflow automation tables for automated compliance processes

-- Workflow templates table
CREATE TABLE workflow_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category ENUM('document_review', 'compliance_check', 'risk_assessment', 'audit_preparation', 'policy_update') NOT NULL,
    trigger_type ENUM('document_upload', 'scheduled', 'manual', 'compliance_change', 'risk_threshold') NOT NULL,
    trigger_config JSON, -- Configuration for triggers (schedule, conditions, etc.)
    steps JSON NOT NULL, -- Array of workflow steps with actions and conditions
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_trigger_type (trigger_type),
    INDEX idx_active (is_active)
);

-- Workflow instances table (tracks actual workflow executions)
CREATE TABLE workflow_instances (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed', 'cancelled', 'paused') DEFAULT 'pending',
    trigger_data JSON, -- Data that triggered this workflow
    context_data JSON, -- Additional context (document IDs, user info, etc.)
    current_step INT DEFAULT 0,
    total_steps INT NOT NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    error_message TEXT NULL,
    assigned_to VARCHAR(255),
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    INDEX idx_template_status (template_id, status),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_priority (priority),
    INDEX idx_status (status)
);

-- Workflow step executions table
CREATE TABLE workflow_step_executions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    instance_id BIGINT NOT NULL,
    step_number INT NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type ENUM('document_analysis', 'compliance_check', 'user_review', 'notification', 'data_extraction', 'report_generation', 'approval', 'automation') NOT NULL,
    status ENUM('pending', 'running', 'completed', 'failed', 'skipped') DEFAULT 'pending',
    input_data JSON,
    output_data JSON,
    error_message TEXT NULL,
    assigned_to VARCHAR(255),
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    duration_seconds INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
    INDEX idx_instance_step (instance_id, step_number),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_status (status)
);

-- Workflow triggers table (for scheduled and event-based triggers)
CREATE TABLE workflow_triggers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    trigger_type ENUM('cron', 'document_upload', 'compliance_score_change', 'deadline_approaching', 'manual') NOT NULL,
    trigger_condition JSON NOT NULL, -- Conditions for when to trigger
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP NULL,
    next_trigger_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
    INDEX idx_template_active (template_id, is_active),
    INDEX idx_next_trigger (next_trigger_at)
);

-- Workflow notifications table
CREATE TABLE workflow_notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    instance_id BIGINT NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    notification_type ENUM('email', 'in_app', 'slack', 'webhook') NOT NULL,
    subject VARCHAR(500),
    message TEXT NOT NULL,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    sent_at TIMESTAMP NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
    INDEX idx_instance_recipient (instance_id, recipient),
    INDEX idx_status (status)
);

-- Insert default workflow templates
INSERT INTO workflow_templates (name, description, category, trigger_type, trigger_config, steps, created_by) VALUES
(
    'Document Compliance Review',
    'Automated compliance review workflow for newly uploaded documents',
    'document_review',
    'document_upload',
    '{"document_types": ["policy", "procedure", "contract"], "auto_start": true}',
    '[
        {
            "id": 1,
            "name": "Document Analysis",
            "type": "document_analysis",
            "action": "analyze_compliance",
            "config": {"frameworks": ["GDPR", "SOX", "HIPAA", "ISO27001"]},
            "auto_complete": true
        },
        {
            "id": 2,
            "name": "Risk Assessment",
            "type": "compliance_check",
            "action": "assess_risk",
            "config": {"threshold": 70},
            "auto_complete": true
        },
        {
            "id": 3,
            "name": "Expert Review",
            "type": "user_review",
            "action": "assign_review",
            "config": {"role": "analyst", "sla_hours": 24},
            "auto_complete": false,
            "condition": {"risk_level": ["high", "critical"]}
        },
        {
            "id": 4,
            "name": "Generate Report",
            "type": "report_generation",
            "action": "generate_compliance_report",
            "config": {"format": "pdf", "include_recommendations": true},
            "auto_complete": true
        },
        {
            "id": 5,
            "name": "Notify Stakeholders",
            "type": "notification",
            "action": "send_notification",
            "config": {"recipients": ["compliance_team"], "template": "compliance_review_complete"},
            "auto_complete": true
        }
    ]',
    'system'
),
(
    'Monthly Compliance Check',
    'Scheduled monthly compliance assessment across all documents',
    'compliance_check',
    'scheduled',
    '{"schedule": "0 0 1 * *", "timezone": "UTC"}',
    '[
        {
            "id": 1,
            "name": "Gather Documents",
            "type": "data_extraction",
            "action": "collect_documents",
            "config": {"date_range": "last_month", "include_regulations": true},
            "auto_complete": true
        },
        {
            "id": 2,
            "name": "Compliance Analysis",
            "type": "compliance_check",
            "action": "bulk_analyze",
            "config": {"frameworks": ["all"], "parallel": true},
            "auto_complete": true
        },
        {
            "id": 3,
            "name": "Risk Aggregation",
            "type": "automation",
            "action": "calculate_risk_metrics",
            "config": {"include_trends": true},
            "auto_complete": true
        },
        {
            "id": 4,
            "name": "Executive Summary",
            "type": "report_generation",
            "action": "generate_executive_report",
            "config": {"format": "pdf", "charts": true, "period": "monthly"},
            "auto_complete": true
        },
        {
            "id": 5,
            "name": "Management Review",
            "type": "user_review",
            "action": "assign_review",
            "config": {"role": "admin", "sla_hours": 72},
            "auto_complete": false
        }
    ]',
    'system'
),
(
    'High Risk Alert',
    'Immediate response workflow for high-risk compliance issues',
    'risk_assessment',
    'compliance_change',
    '{"risk_threshold": 80, "immediate": true}',
    '[
        {
            "id": 1,
            "name": "Immediate Alert",
            "type": "notification",
            "action": "urgent_notification",
            "config": {"recipients": ["compliance_manager", "legal_team"], "priority": "critical"},
            "auto_complete": true
        },
        {
            "id": 2,
            "name": "Document Quarantine",
            "type": "automation",
            "action": "quarantine_document",
            "config": {"status": "under_review"},
            "auto_complete": true
        },
        {
            "id": 3,
            "name": "Expert Assignment",
            "type": "user_review",
            "action": "assign_expert",
            "config": {"role": "senior_analyst", "sla_hours": 2},
            "auto_complete": false
        },
        {
            "id": 4,
            "name": "Mitigation Plan",
            "type": "automation",
            "action": "generate_mitigation_plan",
            "config": {"include_timeline": true},
            "auto_complete": true
        }
    ]',
    'system'
);

-- Insert default triggers
INSERT INTO workflow_triggers (template_id, trigger_type, trigger_condition) VALUES
(1, 'document_upload', '{"document_types": ["policy", "procedure", "contract"]}'),
(2, 'cron', '{"schedule": "0 0 1 * *", "timezone": "UTC"}'),
(3, 'compliance_score_change', '{"threshold": 80, "direction": "below"}')