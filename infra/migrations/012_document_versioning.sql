-- Document Versioning and Change Tracking
-- Migration 012: Add document versioning, change tracking, and diff analysis

-- Document versions table
CREATE TABLE document_versions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    version_number INT NOT NULL,
    path VARCHAR(500) NOT NULL,
    content LONGTEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for quick comparison
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    metadata JSON, -- Document metadata (author, title, etc.)
    upload_type ENUM('initial', 'update', 'revision', 'rollback') DEFAULT 'update',
    uploaded_by VARCHAR(255) NOT NULL,
    upload_reason TEXT, -- Why this version was created
    is_current BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_document_version (document_id, version_number),
    INDEX idx_document_current (document_id, is_current),
    INDEX idx_hash (content_hash),
    INDEX idx_uploaded_by (uploaded_by),
    FOREIGN KEY (document_id) REFERENCES corp_docs(id) ON DELETE CASCADE
);

-- Document changes table (tracks specific changes between versions)
CREATE TABLE document_changes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    from_version_id BIGINT NOT NULL,
    to_version_id BIGINT NOT NULL,
    change_type ENUM('added', 'modified', 'deleted', 'moved', 'renamed') NOT NULL,
    section_type ENUM('paragraph', 'sentence', 'word', 'line', 'page', 'metadata') DEFAULT 'paragraph',
    old_content TEXT, -- Original content
    new_content TEXT, -- New content
    line_start INT, -- Starting line number
    line_end INT, -- Ending line number
    char_start INT, -- Starting character position
    char_end INT, -- Ending character position
    confidence_score DECIMAL(3,2), -- AI confidence in change detection
    change_summary TEXT, -- Brief description of the change
    impact_assessment ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    compliance_impact JSON, -- Which compliance frameworks are affected
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_version_comparison (from_version_id, to_version_id),
    INDEX idx_change_type (change_type),
    INDEX idx_impact (impact_assessment),
    FOREIGN KEY (from_version_id) REFERENCES document_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (to_version_id) REFERENCES document_versions(id) ON DELETE CASCADE
);

-- Document change approvals table
CREATE TABLE document_change_approvals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version_id BIGINT NOT NULL,
    approver VARCHAR(255) NOT NULL,
    approval_status ENUM('pending', 'approved', 'rejected', 'conditional') DEFAULT 'pending',
    approval_reason TEXT,
    conditions TEXT, -- Conditions that must be met for approval
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_version_approvals (version_id),
    INDEX idx_approver (approver),
    INDEX idx_status (approval_status),
    FOREIGN KEY (version_id) REFERENCES document_versions(id) ON DELETE CASCADE
);

-- Document version tags table (for labeling versions)
CREATE TABLE document_version_tags (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version_id BIGINT NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    tag_value VARCHAR(255),
    tag_type ENUM('status', 'milestone', 'compliance', 'custom') DEFAULT 'custom',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_version_tags (version_id),
    INDEX idx_tag_name (tag_name),
    INDEX idx_tag_type (tag_type),
    FOREIGN KEY (version_id) REFERENCES document_versions(id) ON DELETE CASCADE
);

-- Document version comments table
CREATE TABLE document_version_comments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    version_id BIGINT NOT NULL,
    change_id BIGINT NULL, -- Optional: link to specific change
    commenter VARCHAR(255) NOT NULL,
    comment_type ENUM('general', 'approval', 'concern', 'suggestion', 'question') DEFAULT 'general',
    comment_text TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(255) NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_version_comments (version_id),
    INDEX idx_change_comments (change_id),
    INDEX idx_commenter (commenter),
    INDEX idx_unresolved (is_resolved),
    FOREIGN KEY (version_id) REFERENCES document_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (change_id) REFERENCES document_changes(id) ON DELETE SET NULL
);

-- Update corp_docs table to add versioning support
ALTER TABLE corp_docs ADD COLUMN current_version_id BIGINT NULL;
ALTER TABLE corp_docs ADD COLUMN version_count INT DEFAULT 1;
ALTER TABLE corp_docs ADD COLUMN last_modified_by VARCHAR(255);
ALTER TABLE corp_docs ADD COLUMN is_version_controlled BOOLEAN DEFAULT TRUE;

-- Add foreign key for current version
ALTER TABLE corp_docs ADD CONSTRAINT fk_current_version 
    FOREIGN KEY (current_version_id) REFERENCES document_versions(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_corp_docs_version_controlled ON corp_docs(is_version_controlled);
CREATE INDEX idx_corp_docs_current_version ON corp_docs(current_version_id);

-- Sample version tags will be inserted after documents exist

-- Create a view for easy version history access
CREATE VIEW document_version_history AS
SELECT 
    dv.id,
    dv.document_id,
    cd.path as document_path,
    dv.version_number,
    dv.content_hash,
    dv.file_size,
    dv.upload_type,
    dv.uploaded_by,
    dv.upload_reason,
    dv.is_current,
    dv.created_at,
    COUNT(dc.id) as change_count,
    GROUP_CONCAT(DISTINCT dvt.tag_name ORDER BY dvt.tag_name) as tags,
    COUNT(DISTINCT dvc.id) as comment_count,
    COUNT(DISTINCT dca.id) as approval_count
FROM document_versions dv
JOIN corp_docs cd ON dv.document_id = cd.id
LEFT JOIN document_changes dc ON dv.id = dc.to_version_id
LEFT JOIN document_version_tags dvt ON dv.id = dvt.version_id
LEFT JOIN document_version_comments dvc ON dv.id = dvc.version_id
LEFT JOIN document_change_approvals dca ON dv.id = dca.version_id
GROUP BY dv.id, dv.document_id, cd.path, dv.version_number, dv.content_hash, 
         dv.file_size, dv.upload_type, dv.uploaded_by, dv.upload_reason, 
         dv.is_current, dv.created_at;