-- Audit Trail and Compliance Reporting
-- Migration 013: Add comprehensive audit logging and compliance reporting

-- Enhanced audit log table with detailed tracking
CREATE TABLE audit_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL UNIQUE, -- UUID for event tracking
    event_type ENUM('user_action', 'system_action', 'compliance_event', 'security_event', 'workflow_event') NOT NULL,
    action ENUM('create', 'read', 'update', 'delete', 'login', 'logout', 'access', 'analyze', 'approve', 'reject', 'upload', 'download', 'export', 'workflow_start', 'workflow_complete', 'version_create', 'rollback') NOT NULL,
    resource_type ENUM('document', 'user', 'workflow', 'version', 'compliance_analysis', 'report', 'search', 'system') NOT NULL,
    resource_id VARCHAR(255), -- ID of the affected resource
    resource_path VARCHAR(500), -- Path or identifier of the resource
    user_id VARCHAR(255), -- User who performed the action
    user_role VARCHAR(50), -- Role of the user at time of action
    session_id VARCHAR(255), -- Session identifier
    ip_address VARCHAR(45), -- IPv4 or IPv6 address
    user_agent TEXT, -- Browser/client information
    request_id VARCHAR(36), -- Request correlation ID
    before_state JSON, -- State before the action
    after_state JSON, -- State after the action
    metadata JSON, -- Additional context and details
    compliance_impact JSON, -- Which compliance frameworks are affected
    risk_level ENUM('none', 'low', 'medium', 'high', 'critical') DEFAULT 'none',
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT, -- Error details if action failed
    duration_ms INT, -- How long the action took
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_type_action (event_type, action),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_user (user_id),
    INDEX idx_timestamp (created_at),
    INDEX idx_session (session_id),
    INDEX idx_risk_level (risk_level),
    INDEX idx_compliance_events (event_type, compliance_impact(255))
);

-- Compliance reports table
CREATE TABLE compliance_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id VARCHAR(36) NOT NULL UNIQUE,
    report_type ENUM('audit_summary', 'compliance_status', 'risk_assessment', 'user_activity', 'document_activity', 'workflow_summary', 'security_events', 'custom') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    generated_by VARCHAR(255) NOT NULL,
    generated_for VARCHAR(255), -- Target audience (user, role, or 'all')
    report_config JSON, -- Configuration used to generate the report
    date_range_start TIMESTAMP NOT NULL,
    date_range_end TIMESTAMP NOT NULL,
    filters JSON, -- Filters applied during generation
    metrics JSON, -- Key metrics and statistics
    findings JSON, -- Important findings and insights
    recommendations JSON, -- AI-generated recommendations
    compliance_score DECIMAL(5,2), -- Overall compliance score
    risk_score DECIMAL(5,2), -- Overall risk score
    file_path VARCHAR(500), -- Path to generated report file
    file_format ENUM('pdf', 'csv', 'json', 'html') DEFAULT 'pdf',
    file_size BIGINT,
    status ENUM('generating', 'completed', 'failed', 'expired') DEFAULT 'generating',
    expires_at TIMESTAMP, -- When the report expires
    download_count INT DEFAULT 0,
    last_downloaded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_type (report_type),
    INDEX idx_generated_by (generated_by),
    INDEX idx_date_range (date_range_start, date_range_end),
    INDEX idx_status (status),
    INDEX idx_expires (expires_at)
);

-- User activity summary table (for performance)
CREATE TABLE user_activity_summary (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    total_actions INT DEFAULT 0,
    login_count INT DEFAULT 0,
    document_views INT DEFAULT 0,
    document_uploads INT DEFAULT 0,
    searches_performed INT DEFAULT 0,
    reports_generated INT DEFAULT 0,
    workflows_started INT DEFAULT 0,
    compliance_analyses INT DEFAULT 0,
    high_risk_actions INT DEFAULT 0,
    failed_actions INT DEFAULT 0,
    session_duration_minutes INT DEFAULT 0,
    unique_documents_accessed INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_date (user_id, date),
    INDEX idx_user_id (user_id),
    INDEX idx_date (date),
    INDEX idx_activity_level (total_actions)
);

-- System compliance metrics table
CREATE TABLE compliance_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    metric_date DATE NOT NULL,
    framework_name VARCHAR(100) NOT NULL,
    total_documents INT DEFAULT 0,
    compliant_documents INT DEFAULT 0,
    non_compliant_documents INT DEFAULT 0,
    pending_review_documents INT DEFAULT 0,
    average_compliance_score DECIMAL(5,2),
    high_risk_documents INT DEFAULT 0,
    critical_issues INT DEFAULT 0,
    resolved_issues INT DEFAULT 0,
    new_issues INT DEFAULT 0,
    workflow_automations INT DEFAULT 0,
    manual_reviews INT DEFAULT 0,
    average_review_time_hours DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_date_framework (metric_date, framework_name),
    INDEX idx_metric_date (metric_date),
    INDEX idx_framework (framework_name)
);

-- Report subscriptions table
CREATE TABLE report_subscriptions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subscription_id VARCHAR(36) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    report_type ENUM('audit_summary', 'compliance_status', 'risk_assessment', 'user_activity', 'document_activity', 'workflow_summary', 'security_events', 'custom') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    frequency ENUM('daily', 'weekly', 'monthly', 'quarterly') NOT NULL,
    delivery_method ENUM('email', 'download', 'api') DEFAULT 'email',
    filters JSON, -- Filters to apply
    recipients JSON, -- Email addresses or user IDs
    next_generation TIMESTAMP NOT NULL,
    last_generated TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_next_generation (next_generation),
    INDEX idx_active (is_active)
);

-- Create views for common audit queries
CREATE VIEW audit_trail_summary AS
SELECT 
    DATE(created_at) as audit_date,
    event_type,
    action,
    resource_type,
    user_id,
    COUNT(*) as event_count,
    COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_count,
    COUNT(CASE WHEN risk_level IN ('high', 'critical') THEN 1 END) as high_risk_count,
    AVG(duration_ms) as avg_duration_ms
FROM audit_events
GROUP BY DATE(created_at), event_type, action, resource_type, user_id;

CREATE VIEW compliance_dashboard_metrics AS
SELECT 
    DATE(created_at) as metric_date,
    COUNT(CASE WHEN event_type = 'compliance_event' AND action = 'analyze' THEN 1 END) as analyses_performed,
    COUNT(CASE WHEN event_type = 'user_action' AND action = 'upload' THEN 1 END) as documents_uploaded,
    COUNT(CASE WHEN event_type = 'workflow_event' AND action = 'workflow_start' THEN 1 END) as workflows_started,
    COUNT(CASE WHEN event_type = 'user_action' AND action = 'download' THEN 1 END) as documents_downloaded,
    COUNT(CASE WHEN event_type = 'user_action' AND action = 'export' THEN 1 END) as reports_exported,
    COUNT(CASE WHEN risk_level IN ('high', 'critical') THEN 1 END) as high_risk_events,
    COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_events,
    COUNT(DISTINCT user_id) as active_users
FROM audit_events
GROUP BY DATE(created_at);

-- Create triggers to update activity summaries
DELIMITER //

CREATE TRIGGER update_user_activity_summary
AFTER INSERT ON audit_events
FOR EACH ROW
BEGIN
    INSERT INTO user_activity_summary (
        user_id, date, total_actions,
        login_count, document_views, document_uploads, searches_performed,
        workflows_started, compliance_analyses, high_risk_actions, failed_actions
    ) VALUES (
        NEW.user_id, DATE(NEW.created_at), 1,
        CASE WHEN NEW.action = 'login' THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'read' AND NEW.resource_type = 'document' THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'upload' THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'read' AND NEW.resource_type = 'search' THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'workflow_start' THEN 1 ELSE 0 END,
        CASE WHEN NEW.action = 'analyze' THEN 1 ELSE 0 END,
        CASE WHEN NEW.risk_level IN ('high', 'critical') THEN 1 ELSE 0 END,
        CASE WHEN NEW.success = FALSE THEN 1 ELSE 0 END
    ) ON DUPLICATE KEY UPDATE
        total_actions = total_actions + 1,
        login_count = login_count + CASE WHEN NEW.action = 'login' THEN 1 ELSE 0 END,
        document_views = document_views + CASE WHEN NEW.action = 'read' AND NEW.resource_type = 'document' THEN 1 ELSE 0 END,
        document_uploads = document_uploads + CASE WHEN NEW.action = 'upload' THEN 1 ELSE 0 END,
        searches_performed = searches_performed + CASE WHEN NEW.action = 'read' AND NEW.resource_type = 'search' THEN 1 ELSE 0 END,
        workflows_started = workflows_started + CASE WHEN NEW.action = 'workflow_start' THEN 1 ELSE 0 END,
        compliance_analyses = compliance_analyses + CASE WHEN NEW.action = 'analyze' THEN 1 ELSE 0 END,
        high_risk_actions = high_risk_actions + CASE WHEN NEW.risk_level IN ('high', 'critical') THEN 1 ELSE 0 END,
        failed_actions = failed_actions + CASE WHEN NEW.success = FALSE THEN 1 ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP;
END//

DELIMITER ;

-- Insert some sample audit events
INSERT INTO audit_events (event_id, event_type, action, resource_type, resource_id, user_id, user_role, metadata, risk_level) VALUES
(UUID(), 'system_action', 'create', 'system', 'audit_system', 'system', 'system', '{"message": "Audit system initialized"}', 'none'),
(UUID(), 'user_action', 'login', 'user', 'admin', 'admin', 'admin', '{"login_method": "password"}', 'none'),
(UUID(), 'compliance_event', 'analyze', 'document', '1', 'admin', 'admin', '{"frameworks": ["GDPR", "SOX"]}', 'medium');