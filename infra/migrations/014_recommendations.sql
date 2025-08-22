-- Smart Document Recommendations System
-- Migration 014: Add recommendation engine and user preference tracking

-- Document similarity and relationship tracking
CREATE TABLE document_similarities (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id_1 INT NOT NULL,
    document_id_2 INT NOT NULL,
    similarity_score DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
    similarity_type ENUM('content', 'metadata', 'usage_pattern', 'compliance_framework', 'topic', 'ai_generated') NOT NULL,
    algorithm_used VARCHAR(50), -- 'tfidf', 'embedding', 'jaccard', 'compliance_overlap', etc.
    calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON, -- Additional details about similarity calculation
    INDEX idx_document_1 (document_id_1),
    INDEX idx_document_2 (document_id_2),
    INDEX idx_similarity_score (similarity_score DESC),
    INDEX idx_similarity_type (similarity_type),
    UNIQUE KEY unique_document_pair_type (document_id_1, document_id_2, similarity_type)
);

-- User interaction and preference tracking
CREATE TABLE user_document_interactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    document_id INT NOT NULL,
    interaction_type ENUM('view', 'download', 'search', 'bookmark', 'share', 'analyze', 'comment', 'version_view') NOT NULL,
    interaction_duration_seconds INT, -- How long they interacted
    interaction_depth ENUM('quick_view', 'browse', 'detailed_review', 'analysis') DEFAULT 'browse',
    session_id VARCHAR(255), -- Group interactions by session
    referrer_source VARCHAR(255), -- How they found this document (search, recommendation, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON, -- Additional context (search terms, scroll depth, etc.)
    INDEX idx_user_id (user_id),
    INDEX idx_document_id (document_id),
    INDEX idx_interaction_type (interaction_type),
    INDEX idx_created_at (created_at),
    INDEX idx_user_document (user_id, document_id)
);

-- Document recommendation scores and tracking
CREATE TABLE document_recommendations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    recommendation_id VARCHAR(36) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    document_id INT NOT NULL,
    recommendation_type ENUM('similar_content', 'compliance_related', 'trending', 'personalized', 'workflow_suggested', 'ai_curated') NOT NULL,
    recommendation_score DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
    reasoning TEXT, -- AI-generated explanation for the recommendation
    source_document_id INT, -- If based on another document
    algorithm_version VARCHAR(20) DEFAULT '1.0',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- When recommendation becomes stale
    presented_at TIMESTAMP NULL, -- When shown to user
    clicked_at TIMESTAMP NULL, -- When user clicked
    dismissed_at TIMESTAMP NULL, -- When user dismissed
    feedback_rating TINYINT, -- 1-5 star rating from user
    feedback_notes TEXT,
    metadata JSON, -- Additional context and features used
    INDEX idx_user_id (user_id),
    INDEX idx_document_id (document_id),
    INDEX idx_recommendation_type (recommendation_type),
    INDEX idx_recommendation_score (recommendation_score DESC),
    INDEX idx_generated_at (generated_at),
    INDEX idx_expires_at (expires_at),
    INDEX idx_user_active (user_id, expires_at, dismissed_at)
);

-- Topic and tag extraction for better recommendations
CREATE TABLE document_topics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    topic_name VARCHAR(100) NOT NULL,
    topic_category VARCHAR(50), -- 'compliance_framework', 'industry', 'document_type', 'risk_level'
    confidence_score DECIMAL(5,4) NOT NULL,
    extraction_method ENUM('ai_nlp', 'metadata', 'manual', 'keyword_matching', 'compliance_analysis') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_document_id (document_id),
    INDEX idx_topic_name (topic_name),
    INDEX idx_topic_category (topic_category),
    INDEX idx_confidence_score (confidence_score DESC),
    UNIQUE KEY unique_document_topic (document_id, topic_name, extraction_method)
);

-- User preferences and recommendation settings
CREATE TABLE user_recommendation_preferences (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    preferred_recommendation_types JSON, -- Array of types they want to see
    excluded_topics JSON, -- Topics they don't want recommendations for
    preferred_compliance_frameworks JSON, -- Which frameworks they work with most
    recommendation_frequency ENUM('real_time', 'daily', 'weekly', 'on_demand') DEFAULT 'real_time',
    max_recommendations_per_session INT DEFAULT 5,
    enable_ai_explanations BOOLEAN DEFAULT TRUE,
    enable_trend_based BOOLEAN DEFAULT TRUE,
    enable_collaborative_filtering BOOLEAN DEFAULT TRUE,
    feedback_weight DECIMAL(3,2) DEFAULT 1.0, -- How much to weight their feedback
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Trending documents and content analytics
CREATE TABLE document_trending_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    metric_date DATE NOT NULL,
    view_count INT DEFAULT 0,
    unique_viewers INT DEFAULT 0,
    download_count INT DEFAULT 0,
    search_appearances INT DEFAULT 0,
    recommendation_clicks INT DEFAULT 0,
    average_interaction_duration DECIMAL(8,2), -- seconds
    bounce_rate DECIMAL(5,4), -- percentage of quick exits
    engagement_score DECIMAL(5,4), -- composite engagement metric
    trending_score DECIMAL(5,4), -- overall trending calculation
    compliance_analysis_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_document_date (document_id, metric_date),
    INDEX idx_document_id (document_id),
    INDEX idx_metric_date (metric_date),
    INDEX idx_trending_score (trending_score DESC),
    INDEX idx_engagement_score (engagement_score DESC)
);

-- Recommendation performance analytics
CREATE TABLE recommendation_analytics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    analytics_date DATE NOT NULL,
    recommendation_type ENUM('similar_content', 'compliance_related', 'trending', 'personalized', 'workflow_suggested', 'ai_curated') NOT NULL,
    total_generated INT DEFAULT 0,
    total_presented INT DEFAULT 0,
    total_clicked INT DEFAULT 0,
    total_dismissed INT DEFAULT 0,
    click_through_rate DECIMAL(5,4),
    average_rating DECIMAL(3,2),
    total_feedback_count INT DEFAULT 0,
    algorithm_version VARCHAR(20) DEFAULT '1.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_date_type (analytics_date, recommendation_type),
    INDEX idx_analytics_date (analytics_date),
    INDEX idx_recommendation_type (recommendation_type),
    INDEX idx_click_through_rate (click_through_rate DESC)
);

-- Create views for easy recommendation querying
CREATE VIEW user_recommendation_feed AS
SELECT 
    r.recommendation_id,
    r.user_id,
    r.document_id,
    d.title as document_title,
    d.path as document_path,
    r.recommendation_type,
    r.recommendation_score,
    r.reasoning,
    r.generated_at,
    r.expires_at,
    CASE 
        WHEN r.clicked_at IS NOT NULL THEN 'clicked'
        WHEN r.dismissed_at IS NOT NULL THEN 'dismissed' 
        WHEN r.presented_at IS NOT NULL THEN 'presented'
        ELSE 'pending'
    END as status
FROM document_recommendations r
JOIN corp_docs d ON r.document_id = d.id
WHERE r.expires_at > NOW() 
AND r.dismissed_at IS NULL;

CREATE VIEW document_engagement_summary AS
SELECT 
    d.id as document_id,
    d.title,
    d.path,
    COUNT(DISTINCT ui.user_id) as unique_users_interacted,
    COUNT(ui.id) as total_interactions,
    AVG(ui.interaction_duration_seconds) as avg_interaction_duration,
    SUM(CASE WHEN ui.interaction_type = 'view' THEN 1 ELSE 0 END) as view_count,
    SUM(CASE WHEN ui.interaction_type = 'download' THEN 1 ELSE 0 END) as download_count,
    MAX(ui.created_at) as last_interaction,
    COALESCE(dtm.trending_score, 0) as current_trending_score
FROM corp_docs d
LEFT JOIN user_document_interactions ui ON d.id = ui.document_id
LEFT JOIN document_trending_metrics dtm ON d.id = dtm.document_id AND dtm.metric_date = CURDATE()
GROUP BY d.id, d.title, d.path, dtm.trending_score;

-- Create triggers to update metrics
DELIMITER //

CREATE TRIGGER update_document_metrics
AFTER INSERT ON user_document_interactions
FOR EACH ROW
BEGIN
    INSERT INTO document_trending_metrics (
        document_id, metric_date, view_count, unique_viewers, download_count, average_interaction_duration
    ) VALUES (
        NEW.document_id, 
        DATE(NEW.created_at),
        CASE WHEN NEW.interaction_type = 'view' THEN 1 ELSE 0 END,
        1, -- Will be corrected by daily aggregation job
        CASE WHEN NEW.interaction_type = 'download' THEN 1 ELSE 0 END,
        NEW.interaction_duration_seconds
    ) ON DUPLICATE KEY UPDATE
        view_count = view_count + CASE WHEN NEW.interaction_type = 'view' THEN 1 ELSE 0 END,
        download_count = download_count + CASE WHEN NEW.interaction_type = 'download' THEN 1 ELSE 0 END,
        average_interaction_duration = (
            (average_interaction_duration * (view_count + download_count - 1) + COALESCE(NEW.interaction_duration_seconds, 0))
            / (view_count + download_count)
        );
END//

CREATE TRIGGER update_recommendation_analytics
AFTER UPDATE ON document_recommendations
FOR EACH ROW
BEGIN
    IF OLD.clicked_at IS NULL AND NEW.clicked_at IS NOT NULL THEN
        INSERT INTO recommendation_analytics (
            analytics_date, recommendation_type, total_clicked
        ) VALUES (
            DATE(NEW.clicked_at), NEW.recommendation_type, 1
        ) ON DUPLICATE KEY UPDATE
            total_clicked = total_clicked + 1,
            click_through_rate = total_clicked / total_presented;
    END IF;
    
    IF OLD.presented_at IS NULL AND NEW.presented_at IS NOT NULL THEN
        INSERT INTO recommendation_analytics (
            analytics_date, recommendation_type, total_presented
        ) VALUES (
            DATE(NEW.presented_at), NEW.recommendation_type, 1
        ) ON DUPLICATE KEY UPDATE
            total_presented = total_presented + 1,
            click_through_rate = total_clicked / total_presented;
    END IF;
END//

DELIMITER ;

-- Insert initial data
INSERT INTO user_recommendation_preferences (user_id, preferred_recommendation_types, preferred_compliance_frameworks) VALUES
('admin', '["personalized", "compliance_related", "trending"]', '["GDPR", "SOX", "HIPAA"]'),
('analyst', '["similar_content", "compliance_related", "ai_curated"]', '["GDPR", "PCI_DSS"]');

-- Sample document topics for existing documents
INSERT INTO document_topics (document_id, topic_name, topic_category, confidence_score, extraction_method) VALUES
(1, 'data_protection', 'compliance_framework', 0.9500, 'ai_nlp'),
(1, 'privacy_policy', 'document_type', 0.8800, 'ai_nlp'),
(1, 'GDPR', 'compliance_framework', 0.9200, 'compliance_analysis');