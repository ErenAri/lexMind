-- Performance Optimization Migration for 10M+ Document Scale
-- Adds tables and indexes for massive scale processing

USE lexmind;

-- ============================================================
-- BULK PROCESSING JOBS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS bulk_processing_jobs (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    job_id VARCHAR(100) NOT NULL UNIQUE,
    job_type ENUM('bulk_ingest', 'bulk_embed', 'bulk_analyze', 'bulk_export') NOT NULL,
    status ENUM('queued', 'processing', 'completed', 'failed', 'cancelled') DEFAULT 'queued',
    
    -- Job metadata
    total_documents BIGINT DEFAULT 0,
    processed_documents BIGINT DEFAULT 0,
    failed_documents BIGINT DEFAULT 0,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    
    -- Timing information
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    estimated_completion TIMESTAMP NULL,
    
    -- Job configuration and results
    request_data JSON,
    result_data JSON,
    error_message TEXT,
    created_by VARCHAR(255),
    
    -- Performance tracking
    performance_metrics JSON,
    
    INDEX idx_bulk_jobs_status (status),
    INDEX idx_bulk_jobs_type (job_type),
    INDEX idx_bulk_jobs_created (created_at DESC),
    INDEX idx_bulk_jobs_user (created_by),
    INDEX idx_bulk_jobs_progress (status, progress_percentage)
);

-- ============================================================
-- PERFORMANCE-OPTIMIZED INDEXES
-- ============================================================

-- Document content search optimization
CREATE INDEX IF NOT EXISTS idx_docs_content_search 
ON documents_partitioned (content_type, upload_date, content_size);

-- Embedding lookups by content type and model
CREATE INDEX IF NOT EXISTS idx_embeddings_content_model 
ON embeddings_enhanced (content_type, embedding_model, created_at);

-- Metrics analytics optimization
CREATE INDEX IF NOT EXISTS idx_metrics_time_type_dims 
ON compliance_metrics (metric_date, metric_type, dimension1, dimension2);

-- Risk assessment filtering and ranking
CREATE INDEX IF NOT EXISTS idx_risk_category_score_date 
ON risk_assessments (risk_category, risk_score, assessment_date);

-- Document versions temporal queries
CREATE INDEX IF NOT EXISTS idx_versions_path_temporal 
ON document_versions (document_path, valid_from, valid_to, is_current);

-- Collaboration events performance
CREATE INDEX IF NOT EXISTS idx_collab_events_time_user 
ON collaboration_events (timestamp DESC, user_id);

-- Query performance log analysis
CREATE INDEX IF NOT EXISTS idx_query_perf_type_time 
ON query_performance_log (query_type, created_at DESC, execution_time_ms);

-- ============================================================
-- PARTITIONED TABLES FOR MASSIVE SCALE
-- ============================================================

-- Large-scale document archive (for 100M+ documents)
CREATE TABLE IF NOT EXISTS documents_archive (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    document_path VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    content_size BIGINT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    archive_date DATE NOT NULL,
    metadata_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_archive_path (document_path),
    INDEX idx_archive_hash (content_hash),
    INDEX idx_archive_type_date (content_type, archive_date),
    INDEX idx_archive_size (content_size DESC)
) PARTITION BY RANGE(YEAR(archive_date)) (
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);

-- Massive-scale embeddings table with hash partitioning
CREATE TABLE IF NOT EXISTS embeddings_massive (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    content_id VARCHAR(255) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    content_type ENUM('regulation', 'document', 'policy', 'email') NOT NULL,
    embedding VECTOR(384) NOT NULL,
    embedding_model VARCHAR(100) DEFAULT 'all-MiniLM-L6-v2',
    chunk_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    VECTOR INDEX vec_idx_massive ((VEC_COSINE_DISTANCE(embedding))) USING HNSW WITH (
        'ef_construction' = '400',
        'ef_search' = '200',
        'M' = '32'
    ),
    INDEX idx_massive_content_id (content_id),
    INDEX idx_massive_content_hash (content_hash),
    INDEX idx_massive_type_model (content_type, embedding_model)
) PARTITION BY HASH(CRC32(content_id)) PARTITIONS 16;

-- ============================================================
-- PERFORMANCE MONITORING TABLES
-- ============================================================

-- System resource usage tracking
CREATE TABLE IF NOT EXISTS system_metrics (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    metric_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- CPU and Memory
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_mb BIGINT,
    memory_available_mb BIGINT,
    
    -- Database specific metrics
    tidb_connections_active INT,
    tidb_connections_total INT,
    tiflash_cpu_usage DECIMAL(5,2),
    tiflash_memory_mb BIGINT,
    
    -- Storage metrics
    storage_used_gb DECIMAL(10,2),
    storage_available_gb DECIMAL(10,2),
    
    -- Network metrics
    network_in_mbps DECIMAL(8,2),
    network_out_mbps DECIMAL(8,2),
    
    INDEX idx_sys_metrics_time (metric_timestamp DESC)
);

-- Query execution plans for optimization
CREATE TABLE IF NOT EXISTS query_plans (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    query_hash VARCHAR(32) NOT NULL,
    query_pattern TEXT NOT NULL,
    execution_plan JSON NOT NULL,
    estimated_cost DECIMAL(12,4),
    actual_cost DECIMAL(12,4),
    execution_time_ms DECIMAL(10,3),
    rows_examined BIGINT,
    rows_returned BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_query_plans_hash (query_hash),
    INDEX idx_query_plans_cost (estimated_cost DESC),
    INDEX idx_query_plans_time (execution_time_ms DESC),
    INDEX idx_query_plans_created (created_at DESC)
);

-- ============================================================
-- ANALYTICS MATERIALIZED VIEWS (Using Tables)
-- ============================================================

-- Pre-computed compliance summary for fast dashboard loading
CREATE TABLE IF NOT EXISTS compliance_summary_mv (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    summary_date DATE NOT NULL,
    
    -- Overall metrics
    total_regulations INT,
    covered_regulations INT,
    coverage_percentage DECIMAL(5,2),
    overall_risk_score DECIMAL(4,2),
    
    -- Risk distribution
    critical_risks INT,
    high_risks INT,
    medium_risks INT,
    low_risks INT,
    
    -- Document metrics
    total_documents BIGINT,
    analyzed_documents BIGINT,
    pending_analysis BIGINT,
    
    -- System metrics
    query_performance_score DECIMAL(5,2),
    system_health_score DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_summary_date (summary_date),
    INDEX idx_summary_updated (updated_at DESC)
);

-- Risk trend analysis for predictive analytics
CREATE TABLE IF NOT EXISTS risk_trends_mv (
    id BIGINT PRIMARY KEY AUTO_RANDOM,
    trend_date DATE NOT NULL,
    regulation_code VARCHAR(50) NOT NULL,
    department VARCHAR(100),
    
    -- Trend metrics
    risk_score DECIMAL(4,2),
    risk_velocity DECIMAL(6,4), -- Rate of risk change
    predicted_risk_30d DECIMAL(4,2),
    confidence_interval DECIMAL(4,2),
    
    -- Contributing factors
    factors_json JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_trends_date_reg (trend_date, regulation_code),
    INDEX idx_trends_dept_score (department, risk_score DESC),
    INDEX idx_trends_velocity (risk_velocity DESC)
);

-- ============================================================
-- TIDB SERVERLESS OPTIMIZATIONS
-- ============================================================

-- Set TiFlash replicas for analytics tables
ALTER TABLE compliance_metrics SET TIFLASH REPLICA 2;
ALTER TABLE risk_assessments SET TIFLASH REPLICA 2;
ALTER TABLE query_performance_log SET TIFLASH REPLICA 1;
ALTER TABLE system_metrics SET TIFLASH REPLICA 1;
ALTER TABLE compliance_summary_mv SET TIFLASH REPLICA 2;

-- Update table statistics for optimal query planning
ANALYZE TABLE documents_partitioned;
ANALYZE TABLE embeddings_enhanced;
ANALYZE TABLE compliance_metrics;
ANALYZE TABLE risk_assessments;
ANALYZE TABLE collaboration_events;

-- ============================================================
-- PERFORMANCE OPTIMIZATION TRIGGERS
-- ============================================================

-- Trigger to update compliance summary materialized view
DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_compliance_summary
    AFTER INSERT ON risk_assessments
    FOR EACH ROW
BEGIN
    INSERT INTO compliance_summary_mv (
        summary_date, total_regulations, covered_regulations, 
        coverage_percentage, overall_risk_score
    )
    SELECT 
        CURDATE(),
        COUNT(DISTINCT dr.id),
        COUNT(DISTINCT CASE WHEN cg.source_id IS NOT NULL THEN dr.id END),
        COUNT(DISTINCT CASE WHEN cg.source_id IS NOT NULL THEN dr.id END) * 100.0 / COUNT(DISTINCT dr.id),
        AVG(NEW.risk_score)
    FROM demo_regulations dr
    LEFT JOIN compliance_graph cg ON dr.regulation_code = cg.source_id
    ON DUPLICATE KEY UPDATE
        total_regulations = VALUES(total_regulations),
        covered_regulations = VALUES(covered_regulations),
        coverage_percentage = VALUES(coverage_percentage),
        overall_risk_score = VALUES(overall_risk_score),
        updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- ============================================================
-- MASSIVE SCALE TEST DATA PREPARATION
-- ============================================================

-- Stored procedure to generate test data for performance benchmarking
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS generate_test_documents(
    IN doc_count INT,
    IN batch_size INT DEFAULT 1000
)
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE batch_start INT;
    DECLARE batch_end INT;
    
    WHILE i < doc_count DO
        SET batch_start = i;
        SET batch_end = LEAST(i + batch_size, doc_count);
        
        -- Insert batch of test documents
        INSERT INTO documents_partitioned (document_path, content_type, content_size, content_text, upload_date)
        SELECT 
            CONCAT('/test/perf_', batch_start + n, '.txt'),
            'test',
            FLOOR(500 + RAND() * 2000),
            CONCAT('Performance test document ', batch_start + n, ' content with random data: ', UUID()),
            CURDATE()
        FROM (
            SELECT @row := @row + 1 as n 
            FROM information_schema.tables t1, 
                 information_schema.tables t2,
                 (SELECT @row := 0) r
            LIMIT batch_size
        ) numbers
        WHERE batch_start + n < batch_end;
        
        SET i = batch_end;
        
        -- Commit batch to avoid long transactions
        COMMIT;
    END WHILE;
END//
DELIMITER ;

-- ============================================================
-- FINAL OPTIMIZATIONS
-- ============================================================

-- Enable compression for large tables
ALTER TABLE documents_partitioned ROW_FORMAT=COMPRESSED KEY_BLOCK_SIZE=8;
ALTER TABLE documents_archive ROW_FORMAT=COMPRESSED KEY_BLOCK_SIZE=8;

-- Set optimal table properties for high-performance workloads
SET SESSION tidb_enable_vectorized_expression = ON;
SET SESSION tidb_enable_chunk_rpc = ON;
SET SESSION tidb_opt_broadcast_cartesian_join = 2;