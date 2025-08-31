-- Document Library Enhancement Migration
-- Adds comprehensive document management features

-- Document metadata table for enhanced categorization
CREATE TABLE IF NOT EXISTS document_metadata (
    document_id VARCHAR(255) PRIMARY KEY,
    category VARCHAR(100) DEFAULT 'general',
    tags JSON DEFAULT '[]',
    description TEXT,
    language VARCHAR(10) DEFAULT 'en',
    confidentiality ENUM('public', 'internal', 'confidential', 'restricted') DEFAULT 'internal',
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_confidentiality (confidentiality),
    INDEX idx_created_at (created_at)
);

-- Document access statistics for analytics
CREATE TABLE IF NOT EXISTS document_access_stats (
    document_id VARCHAR(255),
    user_id VARCHAR(100),
    access_count INT DEFAULT 1,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    first_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_type VARCHAR(50) DEFAULT 'view',
    
    PRIMARY KEY (document_id, user_id),
    INDEX idx_last_accessed (last_accessed),
    INDEX idx_access_count (access_count),
    INDEX idx_user_id (user_id)
);

-- Document favorites for personalized experience
CREATE TABLE IF NOT EXISTS document_favorites (
    document_id VARCHAR(255),
    user_id VARCHAR(100),
    is_favorite BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (document_id, user_id),
    INDEX idx_user_favorites (user_id, is_favorite),
    INDEX idx_created_at (created_at)
);

-- Detailed access log for audit and analytics
CREATE TABLE IF NOT EXISTS document_access_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    access_type VARCHAR(50) DEFAULT 'view',
    session_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON,
    
    INDEX idx_document_access (document_id, access_time),
    INDEX idx_user_access (user_id, access_time),
    INDEX idx_access_time (access_time),
    INDEX idx_access_type (access_type)
);

-- Document versions for history tracking
CREATE TABLE IF NOT EXISTS document_versions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id VARCHAR(255) NOT NULL,
    version_number INT NOT NULL,
    content_hash VARCHAR(64),
    file_size BIGINT DEFAULT 0,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_description TEXT,
    is_current BOOLEAN DEFAULT false,
    
    UNIQUE KEY unique_doc_version (document_id, version_number),
    INDEX idx_document_current (document_id, is_current),
    INDEX idx_created_at (created_at)
);

-- Document relationships for compliance mapping
CREATE TABLE IF NOT EXISTS document_relationships (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_document_id VARCHAR(255) NOT NULL,
    target_document_id VARCHAR(255) NOT NULL,
    relationship_type ENUM('references', 'implements', 'supersedes', 'complements', 'conflicts') NOT NULL,
    confidence_score DECIMAL(3,2) DEFAULT 1.00,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    
    UNIQUE KEY unique_relationship (source_document_id, target_document_id, relationship_type),
    INDEX idx_source_doc (source_document_id),
    INDEX idx_target_doc (target_document_id),
    INDEX idx_relationship_type (relationship_type),
    INDEX idx_confidence (confidence_score)
);

-- Document tags for flexible categorization
CREATE TABLE IF NOT EXISTS document_tags (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    usage_count INT DEFAULT 0,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_name (name),
    INDEX idx_usage_count (usage_count)
);

-- Document collections for organization
CREATE TABLE IF NOT EXISTS document_collections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    owner_user_id VARCHAR(100) NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_owner (owner_user_id),
    INDEX idx_public (is_public),
    INDEX idx_name (name)
);

-- Document collection memberships
CREATE TABLE IF NOT EXISTS document_collection_items (
    collection_id BIGINT,
    document_id VARCHAR(255),
    added_by VARCHAR(100),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sort_order INT DEFAULT 0,
    
    PRIMARY KEY (collection_id, document_id),
    FOREIGN KEY (collection_id) REFERENCES document_collections(id) ON DELETE CASCADE,
    INDEX idx_collection (collection_id, sort_order),
    INDEX idx_document (document_id)
);

-- Enhanced corp_docs table with additional metadata columns
ALTER TABLE corp_docs 
ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS content_type VARCHAR(100) DEFAULT 'text/plain',
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS status ENUM('active', 'archived', 'draft') DEFAULT 'active',
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
ADD INDEX IF NOT EXISTS idx_status (status),
ADD INDEX IF NOT EXISTS idx_version (version),
ADD INDEX IF NOT EXISTS idx_content_type (content_type);

-- Enhanced reg_texts table with additional metadata
ALTER TABLE reg_texts 
ADD COLUMN IF NOT EXISTS status ENUM('active', 'archived', 'draft') DEFAULT 'active',
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(100),
ADD INDEX IF NOT EXISTS idx_status (status),
ADD INDEX IF NOT EXISTS idx_version (version),
ADD INDEX IF NOT EXISTS idx_jurisdiction (jurisdiction);

-- Insert default categories and tags
INSERT IGNORE INTO document_tags (name, description, color) VALUES
('compliance', 'Compliance and regulatory documents', '#EF4444'),
('policy', 'Internal policies and procedures', '#3B82F6'),
('regulation', 'External regulations and rules', '#F59E0B'),
('financial', 'Financial and accounting documents', '#10B981'),
('legal', 'Legal contracts and agreements', '#8B5CF6'),
('training', 'Training and educational materials', '#06B6D4'),
('audit', 'Audit reports and findings', '#F97316'),
('risk', 'Risk assessments and management', '#EF4444'),
('security', 'Security policies and procedures', '#DC2626'),
('privacy', 'Privacy and data protection', '#7C3AED');

-- Create views for easier querying
CREATE OR REPLACE VIEW enhanced_documents AS
SELECT 
    d.document_id,
    d.path,
    d.display_name,
    d.type,
    d.first_seen,
    d.last_seen,
    d.chunks,
    d.file_size,
    d.status,
    d.version,
    dm.category,
    dm.tags,
    dm.description,
    dm.confidentiality,
    COALESCE(das.access_count, 0) as total_access_count,
    das.last_accessed,
    CASE WHEN df.is_favorite = 1 THEN true ELSE false END as is_favorite
FROM (
    SELECT 
        path as document_id,
        path,
        COALESCE(display_name, SUBSTRING(path FROM '[^/]*$')) as display_name,
        'doc' as type,
        first_seen,
        last_seen,
        chunks,
        COALESCE(file_size, 0) as file_size,
        COALESCE(status, 'active') as status,
        COALESCE(version, 1) as version
    FROM corp_docs
    UNION ALL
    SELECT 
        CONCAT('reg:', CAST(id AS CHAR)) as document_id,
        CONCAT('reg:', CAST(id AS CHAR)) as path,
        title as display_name,
        'reg' as type,
        created_at as first_seen,
        updated_at as last_seen,
        1 as chunks,
        LENGTH(text) as file_size,
        COALESCE(status, 'active') as status,
        COALESCE(version, 1) as version
    FROM reg_texts
) d
LEFT JOIN document_metadata dm ON d.document_id = dm.document_id
LEFT JOIN (
    SELECT document_id, SUM(access_count) as access_count, MAX(last_accessed) as last_accessed
    FROM document_access_stats
    GROUP BY document_id
) das ON d.document_id = das.document_id
LEFT JOIN (
    SELECT document_id, MAX(is_favorite) as is_favorite
    FROM document_favorites
    WHERE is_favorite = 1
    GROUP BY document_id
) df ON d.document_id = df.document_id;

-- Create analytics view for popular documents
CREATE OR REPLACE VIEW document_analytics AS
SELECT 
    ed.document_id,
    ed.display_name,
    ed.type,
    ed.category,
    ed.total_access_count,
    ed.last_accessed,
    COUNT(DISTINCT das.user_id) as unique_users,
    AVG(das.access_count) as avg_user_access,
    COUNT(df.document_id) as favorite_count,
    CASE 
        WHEN ed.last_accessed >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 'active'
        WHEN ed.last_accessed >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 'moderate'
        ELSE 'low'
    END as activity_level
FROM enhanced_documents ed
LEFT JOIN document_access_stats das ON ed.document_id = das.document_id
LEFT JOIN document_favorites df ON ed.document_id = df.document_id AND df.is_favorite = 1
GROUP BY ed.document_id, ed.display_name, ed.type, ed.category, ed.total_access_count, ed.last_accessed;

-- Add some sample metadata for demo documents
INSERT IGNORE INTO document_metadata (document_id, category, tags, description) VALUES
('/policies/gs-trading-policy-2025.pdf', 'policy', '["trading", "compliance", "financial"]', 'Goldman Sachs Trading Policy 2025'),
('/procedures/risk-assessment-guide.pdf', 'procedure', '["risk", "assessment", "compliance"]', 'Risk Assessment Procedures'),
('/training/compliance-training-2025.pdf', 'training', '["training", "compliance", "education"]', 'Annual Compliance Training Materials'),
('/audits/sox-compliance-report-2024.pdf', 'audit', '["audit", "sox", "compliance"]', 'SOX Compliance Audit Report 2024'),
('/policies/data-privacy-policy.pdf', 'policy', '["privacy", "data", "security"]', 'Data Privacy and Protection Policy');

-- Update regulation metadata
INSERT IGNORE INTO document_metadata (document_id, category, tags, description) 
SELECT 
    CONCAT('reg:', CAST(id AS CHAR)) as document_id,
    CASE 
        WHEN title LIKE '%Dodd-Frank%' THEN 'financial-regulation'
        WHEN title LIKE '%Basel%' THEN 'banking-regulation' 
        WHEN title LIKE '%SEC%' THEN 'securities-regulation'
        WHEN title LIKE '%GDPR%' OR title LIKE '%Privacy%' THEN 'privacy-regulation'
        ELSE 'regulation'
    END as category,
    JSON_ARRAY('regulation', 'compliance') as tags,
    description
FROM reg_texts 
WHERE id IS NOT NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_enhanced_docs_category ON document_metadata(category);
CREATE INDEX IF NOT EXISTS idx_enhanced_docs_access ON document_access_stats(last_accessed DESC);
CREATE INDEX IF NOT EXISTS idx_enhanced_docs_favorites ON document_favorites(user_id, is_favorite);

-- Add full-text search indexes
ALTER TABLE document_metadata ADD FULLTEXT(description);
ALTER TABLE corp_docs ADD FULLTEXT(content) IF NOT EXISTS;
ALTER TABLE reg_texts ADD FULLTEXT(text, description) IF NOT EXISTS;