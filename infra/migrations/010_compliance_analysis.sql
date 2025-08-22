USE lexmind;

-- Compliance analysis results table
CREATE TABLE IF NOT EXISTS compliance_analysis (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  doc_id BIGINT,
  reg_id BIGINT,
  analysis_type ENUM('risk_assessment', 'gap_analysis', 'compliance_score', 'recommendation') NOT NULL,
  score DECIMAL(5,2) DEFAULT NULL, -- 0-100 compliance score
  risk_level ENUM('low', 'medium', 'high', 'critical') DEFAULT NULL,
  category VARCHAR(100), -- e.g., 'data_protection', 'financial', 'healthcare'
  title VARCHAR(255),
  description TEXT,
  recommendation TEXT,
  evidence TEXT, -- Supporting text from documents
  confidence DECIMAL(5,2) DEFAULT NULL, -- AI confidence in analysis
  metadata JSON NULL, -- Additional analysis data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_compliance_doc_id (doc_id),
  INDEX idx_compliance_reg_id (reg_id),
  INDEX idx_compliance_type (analysis_type),
  INDEX idx_compliance_risk (risk_level),
  INDEX idx_compliance_category (category),
  INDEX idx_compliance_score (score DESC),
  INDEX idx_compliance_created_at (created_at DESC)
);

-- Compliance frameworks and standards reference
CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  name VARCHAR(100) NOT NULL, -- e.g., 'GDPR', 'SOX', 'HIPAA', 'ISO27001'
  full_name VARCHAR(255),
  description TEXT,
  version VARCHAR(50),
  category VARCHAR(100), -- e.g., 'data_protection', 'financial', 'security'
  requirements JSON, -- Array of requirement objects
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_frameworks_name (name),
  INDEX idx_frameworks_category (category),
  INDEX idx_frameworks_active (is_active)
);

-- Document compliance status tracking
CREATE TABLE IF NOT EXISTS document_compliance_status (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  doc_id BIGINT,
  path VARCHAR(255),
  overall_score DECIMAL(5,2) DEFAULT NULL,
  risk_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  compliance_status ENUM('compliant', 'partially_compliant', 'non_compliant', 'unknown') DEFAULT 'unknown',
  total_issues INT DEFAULT 0,
  critical_issues INT DEFAULT 0,
  high_issues INT DEFAULT 0,
  medium_issues INT DEFAULT 0,
  low_issues INT DEFAULT 0,
  last_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  analysis_version INT DEFAULT 1,
  metadata JSON NULL,
  INDEX idx_doc_compliance_doc_id (doc_id),
  INDEX idx_doc_compliance_path (path),
  INDEX idx_doc_compliance_score (overall_score DESC),
  INDEX idx_doc_compliance_risk (risk_level),
  INDEX idx_doc_compliance_status (compliance_status),
  INDEX idx_doc_compliance_analyzed (last_analyzed DESC)
);

-- Insert default compliance frameworks
INSERT IGNORE INTO compliance_frameworks (name, full_name, description, category, requirements) VALUES
('GDPR', 'General Data Protection Regulation', 'EU data protection regulation', 'data_protection', JSON_ARRAY(
  JSON_OBJECT('id', 'lawful_basis', 'title', 'Lawful Basis for Processing', 'description', 'Must have valid legal basis for processing personal data'),
  JSON_OBJECT('id', 'consent', 'title', 'Consent Management', 'description', 'Clear and explicit consent for data processing'),
  JSON_OBJECT('id', 'data_minimization', 'title', 'Data Minimization', 'description', 'Collect only necessary personal data'),
  JSON_OBJECT('id', 'retention', 'title', 'Data Retention', 'description', 'Define and enforce data retention policies'),
  JSON_OBJECT('id', 'rights', 'title', 'Data Subject Rights', 'description', 'Enable data subject rights (access, rectification, erasure)'),
  JSON_OBJECT('id', 'breach', 'title', 'Breach Notification', 'description', 'Report data breaches within 72 hours'),
  JSON_OBJECT('id', 'dpo', 'title', 'Data Protection Officer', 'description', 'Appoint DPO when required'),
  JSON_OBJECT('id', 'privacy_by_design', 'title', 'Privacy by Design', 'description', 'Implement privacy by design and default')
)),
('SOX', 'Sarbanes-Oxley Act', 'US financial regulation for public companies', 'financial', JSON_ARRAY(
  JSON_OBJECT('id', 'financial_controls', 'title', 'Internal Financial Controls', 'description', 'Establish internal controls over financial reporting'),
  JSON_OBJECT('id', 'ceo_cfo_cert', 'title', 'CEO/CFO Certification', 'description', 'Executive certification of financial statements'),
  JSON_OBJECT('id', 'audit_committee', 'title', 'Audit Committee', 'description', 'Independent audit committee oversight'),
  JSON_OBJECT('id', 'external_audit', 'title', 'External Auditor Independence', 'description', 'Maintain auditor independence')
)),
('HIPAA', 'Health Insurance Portability and Accountability Act', 'US healthcare privacy regulation', 'healthcare', JSON_ARRAY(
  JSON_OBJECT('id', 'phi_protection', 'title', 'PHI Protection', 'description', 'Protect patient health information'),
  JSON_OBJECT('id', 'access_controls', 'title', 'Access Controls', 'description', 'Implement proper access controls for PHI'),
  JSON_OBJECT('id', 'audit_logs', 'title', 'Audit Logs', 'description', 'Maintain audit logs for PHI access'),
  JSON_OBJECT('id', 'business_associates', 'title', 'Business Associate Agreements', 'description', 'Proper agreements with business associates')
)),
('ISO27001', 'ISO/IEC 27001', 'Information security management standard', 'security', JSON_ARRAY(
  JSON_OBJECT('id', 'isms', 'title', 'Information Security Management System', 'description', 'Establish ISMS framework'),
  JSON_OBJECT('id', 'risk_assessment', 'title', 'Risk Assessment', 'description', 'Regular security risk assessments'),
  JSON_OBJECT('id', 'security_controls', 'title', 'Security Controls', 'description', 'Implement appropriate security controls'),
  JSON_OBJECT('id', 'incident_response', 'title', 'Incident Response', 'description', 'Security incident response procedures')
));