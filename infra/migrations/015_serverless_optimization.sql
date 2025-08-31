-- TiDB Serverless Optimization Migration
-- This migration adds advanced TiDB features for hackathon performance

USE lexmind;

-- ============================================================
-- TEMPORAL TABLES FOR DOCUMENT VERSIONING
-- ============================================================

-- Document versions with temporal tracking
CREATE TABLE IF NOT EXISTS document_versions (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    document_path VARCHAR(255) NOT NULL,
    version_number INT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    metadata_json JSON,
    created_by VARCHAR(255) DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP NULL,
    is_current BOOLEAN DEFAULT TRUE,
    
    INDEX idx_doc_versions_path (document_path),
    INDEX idx_doc_versions_current (document_path, is_current),
    INDEX idx_doc_versions_time (valid_from, valid_to),
    INDEX idx_doc_versions_hash (content_hash),
    UNIQUE INDEX idx_doc_versions_path_version (document_path, version_number)
);

-- Regulation versions for tracking regulatory changes
CREATE TABLE IF NOT EXISTS regulation_versions (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    regulation_source VARCHAR(255) NOT NULL,
    regulation_title VARCHAR(255) NOT NULL,
    version_number INT NOT NULL,
    content_changes_json JSON, -- Track what changed
    effective_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    supersedes_version INT NULL,
    
    INDEX idx_reg_versions_source (regulation_source),
    INDEX idx_reg_versions_effective (effective_date DESC),
    INDEX idx_reg_versions_current (regulation_source, effective_date DESC)
);

-- ============================================================
-- COMPLIANCE GRAPH RELATIONSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS compliance_graph (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    source_type ENUM('regulation', 'document', 'policy', 'control') NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    target_type ENUM('regulation', 'document', 'policy', 'control') NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    relationship_type ENUM(
        'references', 'conflicts', 'supersedes', 'implements', 
        'complies_with', 'derives_from', 'maps_to', 'depends_on'
    ) NOT NULL,
    confidence DECIMAL(4,3) DEFAULT 0.800,
    evidence_text TEXT,
    created_by VARCHAR(255) DEFAULT 'system',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_by VARCHAR(255) NULL,
    validated_at TIMESTAMP NULL,
    
    INDEX idx_graph_source (source_type, source_id),
    INDEX idx_graph_target (target_type, target_id),
    INDEX idx_graph_relationship (relationship_type, confidence DESC),
    INDEX idx_graph_traverse (source_type, source_id, relationship_type),
    UNIQUE INDEX idx_graph_unique (source_type, source_id, target_type, target_id, relationship_type)
);

-- ============================================================
-- REAL-TIME COLLABORATION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS collaboration_sessions (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    session_id VARCHAR(36) NOT NULL UNIQUE,
    document_path VARCHAR(255),
    regulation_id BIGINT,
    participants_json JSON, -- Array of user objects
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    INDEX idx_collab_document (document_path),
    INDEX idx_collab_regulation (regulation_id),
    INDEX idx_collab_expires (expires_at),
    INDEX idx_collab_active (is_active, expires_at)
);

CREATE TABLE IF NOT EXISTS collaboration_events (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    session_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    event_type ENUM('join', 'leave', 'annotation', 'highlight', 'comment', 'edit') NOT NULL,
    event_data JSON NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_collab_events_session (session_id, timestamp DESC),
    INDEX idx_collab_events_user (user_id, timestamp DESC),
    INDEX idx_collab_events_type (event_type, timestamp DESC)
);

CREATE TABLE IF NOT EXISTS document_annotations (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    document_path VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    annotation_type ENUM('highlight', 'comment', 'risk_flag', 'compliance_note') NOT NULL,
    start_offset INT NOT NULL,
    end_offset INT NOT NULL,
    text_content TEXT,
    annotation_data JSON, -- Styling, colors, risk levels, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT FALSE,
    
    INDEX idx_annotations_document (document_path),
    INDEX idx_annotations_user (user_id),
    INDEX idx_annotations_type (annotation_type),
    INDEX idx_annotations_position (document_path, start_offset, end_offset)
);

-- ============================================================
-- ADVANCED ANALYTICS TABLES (OLAP-optimized)
-- ============================================================

CREATE TABLE IF NOT EXISTS compliance_metrics (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    metric_date DATE NOT NULL,
    metric_type VARCHAR(100) NOT NULL,
    dimension1 VARCHAR(255), -- e.g., department, regulation_type
    dimension2 VARCHAR(255), -- e.g., risk_level, document_type  
    dimension3 VARCHAR(255), -- additional grouping
    metric_value DECIMAL(15,4) NOT NULL,
    metric_count BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_metrics_date_type (metric_date DESC, metric_type),
    INDEX idx_metrics_dimensions (metric_type, dimension1, dimension2),
    INDEX idx_metrics_value (metric_type, metric_value DESC)
);

CREATE TABLE IF NOT EXISTS risk_assessments (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    assessment_date DATE NOT NULL,
    regulation_id BIGINT,
    document_path VARCHAR(255),
    risk_category ENUM('high', 'medium', 'low', 'critical') NOT NULL,
    risk_score DECIMAL(5,2) NOT NULL,
    impact_score DECIMAL(5,2) NOT NULL,
    likelihood_score DECIMAL(5,2) NOT NULL,
    mitigation_status ENUM('none', 'planned', 'in_progress', 'completed') DEFAULT 'none',
    assessment_details JSON,
    assessed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_risk_date (assessment_date DESC),
    INDEX idx_risk_category (risk_category, risk_score DESC),
    INDEX idx_risk_regulation (regulation_id),
    INDEX idx_risk_document (document_path),
    INDEX idx_risk_score (risk_score DESC, likelihood_score DESC)
);

-- ============================================================
-- PERFORMANCE MONITORING TABLES  
-- ============================================================

CREATE TABLE IF NOT EXISTS query_performance_log (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    query_hash VARCHAR(32) NOT NULL,
    query_type ENUM('read', 'write', 'analytics') NOT NULL,
    execution_time_ms DECIMAL(10,3) NOT NULL,
    row_count BIGINT DEFAULT 0,
    region VARCHAR(50) DEFAULT 'primary',
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_perf_hash (query_hash),
    INDEX idx_perf_time (created_at DESC),
    INDEX idx_perf_execution (execution_time_ms DESC),
    INDEX idx_perf_type_time (query_type, execution_time_ms DESC)
);

-- ============================================================
-- ADVANCED VECTOR SEARCH OPTIMIZATION
-- ============================================================

-- Enhanced embeddings table with metadata
CREATE TABLE IF NOT EXISTS embeddings_enhanced (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    content_type ENUM('regulation', 'document', 'policy', 'email') NOT NULL,
    content_id VARCHAR(255) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    embedding VECTOR(384) NOT NULL, -- Using smaller, faster embeddings
    embedding_model VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2',
    chunk_index INT DEFAULT 0,
    chunk_text TEXT,
    metadata_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    VECTOR INDEX vec_idx_enhanced ((VEC_COSINE_DISTANCE(embedding))) USING HNSW,
    INDEX idx_embed_content (content_type, content_id),
    INDEX idx_embed_hash (content_hash),
    INDEX idx_embed_model (embedding_model)
);

-- ============================================================
-- TiDB-SPECIFIC OPTIMIZATIONS
-- ============================================================

-- Partitioned table for large-scale document storage
CREATE TABLE IF NOT EXISTS documents_partitioned (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    document_path VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    content_size BIGINT NOT NULL,
    content_text LONGTEXT,
    upload_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_docs_part_path (document_path),
    INDEX idx_docs_part_type (content_type),
    INDEX idx_docs_part_size (content_size DESC)
) PARTITION BY RANGE(YEAR(upload_date)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);

-- ============================================================
-- DEMO DATA PREPARATION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS demo_regulations (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    regulation_name VARCHAR(255) NOT NULL,
    regulation_code VARCHAR(50) NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL,
    sector ENUM('financial', 'healthcare', 'technology', 'manufacturing', 'general') NOT NULL,
    complexity_score INT DEFAULT 5, -- 1-10 scale
    sample_text LONGTEXT NOT NULL,
    key_requirements JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_demo_code (regulation_code),
    INDEX idx_demo_jurisdiction (jurisdiction),
    INDEX idx_demo_sector (sector),
    FULLTEXT INDEX ft_demo_text (sample_text)
);

CREATE TABLE IF NOT EXISTS demo_companies (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    company_name VARCHAR(255) NOT NULL,
    industry ENUM('banking', 'insurance', 'tech', 'pharma', 'manufacturing') NOT NULL,
    employee_count INT NOT NULL,
    revenue_tier ENUM('startup', 'small', 'medium', 'large', 'enterprise') NOT NULL,
    compliance_maturity ENUM('basic', 'developing', 'mature', 'advanced') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_demo_company_industry (industry),
    INDEX idx_demo_company_size (revenue_tier, employee_count)
);

-- ============================================================
-- FINAL PERFORMANCE OPTIMIZATIONS
-- ============================================================

-- Add columnar storage hints for analytics (TiFlash)
ALTER TABLE compliance_metrics SET TIFLASH REPLICA 1;
ALTER TABLE risk_assessments SET TIFLASH REPLICA 1;
ALTER TABLE query_performance_log SET TIFLASH REPLICA 1;

-- Set table properties for better performance
ALTER TABLE corp_docs SET GLOBAL_STATS = ON;
ALTER TABLE reg_texts SET GLOBAL_STATS = ON;
ALTER TABLE compliance_graph SET GLOBAL_STATS = ON;

-- Create covering indexes for common query patterns
CREATE INDEX idx_corp_docs_covering ON corp_docs(path, chunk_idx, created_at);
CREATE INDEX idx_reg_texts_covering ON reg_texts(source, title, created_at);
CREATE INDEX idx_mappings_covering ON mappings(reg_id, doc_id, confidence, created_at);