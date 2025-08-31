-- Demo Data for TiDB Hackathon - Goldman Sachs Compliance Scenario
-- This creates realistic financial compliance data for impressive demos

USE lexmind;

-- ============================================================
-- REALISTIC FINANCIAL REGULATIONS DATA
-- ============================================================

-- Major Financial Regulations
INSERT INTO demo_regulations (regulation_name, regulation_code, jurisdiction, sector, complexity_score, sample_text, key_requirements) VALUES
(
    'Securities Exchange Commission Rule 10b-5', 
    'SEC-10b-5', 
    'United States', 
    'financial', 
    9,
    'It shall be unlawful for any person, directly or indirectly, by the use of any means or instrumentality of interstate commerce, or of the mails or of any facility of any national securities exchange, (a) To employ any device, scheme, or artifice to defraud, (b) To make any untrue statement of a material fact or to omit to state a material fact necessary in order to make the statements made, in the light of the circumstances under which they were made, not misleading, or (c) To engage in any act, practice, or course of business which operates or would operate as a fraud or deceit upon any person, in connection with the purchase or sale of any security.',
    '{"prohibitions": ["fraud", "material misstatement", "omission"], "scope": "securities transactions", "penalties": "civil and criminal"}'
),
(
    'Dodd-Frank Wall Street Reform Act - Volcker Rule', 
    'DODD-FRANK-619', 
    'United States', 
    'financial', 
    10,
    'A banking entity shall not engage in proprietary trading. Proprietary trading means engaging as a principal for the trading account of the banking entity in any transaction to purchase or sell, or otherwise acquire or dispose of, any security, any derivative, any contract of sale of a commodity for future delivery, any option on any such security, derivative, or contract, or any other security or financial instrument that the appropriate Federal banking agencies, the Securities and Exchange Commission, and the Commodity Futures Trading Commission may, by rule as provided in subsection (b)(2), determine.',
    '{"prohibited_activities": ["proprietary trading"], "exceptions": ["market making", "hedging"], "compliance_deadline": "2015-07-21"}'
),
(
    'Basel III Capital Requirements', 
    'BASEL-III', 
    'International', 
    'financial', 
    8,
    'Banks must maintain a minimum capital adequacy ratio of 8% of risk-weighted assets, with Tier 1 capital comprising at least 6% and Common Equity Tier 1 capital comprising at least 4.5%. Additionally, banks must maintain a capital conservation buffer of 2.5% and may be subject to a countercyclical capital buffer of up to 2.5%.',
    '{"minimum_ratios": {"total_capital": 8.0, "tier1_capital": 6.0, "cet1_capital": 4.5}, "buffers": {"conservation": 2.5, "countercyclical": 2.5}}'
),
(
    'Market in Financial Instruments Directive II', 
    'MiFID-II', 
    'European Union', 
    'financial', 
    9,
    'Investment firms shall act honestly, fairly and professionally in accordance with the best interests of their clients and comply with the following principles: (a) all information, including marketing communications, addressed by the investment firm to clients or potential clients shall be fair, clear and not misleading; (b) clients or potential clients shall be provided with adequate information in a comprehensible form so that they are reasonably able to understand the nature and risks of the investment service and of the specific type of financial instrument that is being offered.',
    '{"principles": ["honesty", "fairness", "professionalism"], "requirements": ["clear_information", "risk_disclosure"], "scope": "investment_services"}'
),
(
    'Sarbanes-Oxley Act Section 404', 
    'SOX-404', 
    'United States', 
    'financial', 
    7,
    'Management shall accept responsibility for establishing and maintaining adequate internal control over financial reporting for the company. The registered public accounting firm that prepares or issues the audit report for the company shall attest to, and report on, the assessment made by the management of the company.',
    '{"requirements": ["internal_controls", "management_assessment", "auditor_attestation"], "scope": "public_companies"}'
);

-- Insert corresponding regulation texts
INSERT INTO reg_texts (source, title, section, text) VALUES
('SEC-10b-5', 'Employment of Manipulative and Deceptive Practices', 'General Anti-Fraud Provision', 'It shall be unlawful for any person, directly or indirectly, by the use of any means or instrumentality of interstate commerce, or of the mails or of any facility of any national securities exchange, (a) To employ any device, scheme, or artifice to defraud, (b) To make any untrue statement of a material fact or to omit to state a material fact necessary in order to make the statements made, in the light of the circumstances under which they were made, not misleading, or (c) To engage in any act, practice, or course of business which operates or would operate as a fraud or deceit upon any person, in connection with the purchase or sale of any security.'),

('DODD-FRANK-619', 'Volcker Rule - Proprietary Trading Prohibition', 'Banking Entity Restrictions', 'A banking entity shall not engage in proprietary trading. Proprietary trading means engaging as a principal for the trading account of the banking entity in any transaction to purchase or sell, or otherwise acquire or dispose of, any security, any derivative, any contract of sale of a commodity for future delivery, any option on any such security, derivative, or contract.'),

('BASEL-III', 'Minimum Capital Requirements', 'Capital Adequacy Ratios', 'Banks must maintain a minimum capital adequacy ratio of 8% of risk-weighted assets, with Tier 1 capital comprising at least 6% and Common Equity Tier 1 capital comprising at least 4.5%. The capital conservation buffer shall be 2.5% of risk-weighted assets, bringing the total Common Equity Tier 1 requirement to 7%.'),

('MiFID-II', 'Conduct of Business Rules', 'Client Protection', 'Investment firms shall act honestly, fairly and professionally in accordance with the best interests of their clients. All information addressed to clients shall be fair, clear and not misleading. Clients shall be provided with adequate information about the nature and risks of investment services.'),

('SOX-404', 'Management Assessment of Internal Controls', 'Internal Control Requirements', 'Management shall accept responsibility for establishing and maintaining adequate internal control over financial reporting. The registered public accounting firm shall attest to and report on the management assessment of internal controls.');

-- ============================================================
-- DEMO COMPANY DATA - "GOLDMAN SACHS SCENARIO"
-- ============================================================

INSERT INTO demo_companies (company_name, industry, employee_count, revenue_tier, compliance_maturity) VALUES
('Goldman Sachs Group Inc.', 'banking', 45000, 'enterprise', 'advanced'),
('JPMorgan Chase & Co.', 'banking', 280000, 'enterprise', 'advanced'),
('Morgan Stanley', 'banking', 75000, 'enterprise', 'advanced'),
('Deutsche Bank AG', 'banking', 85000, 'enterprise', 'mature'),
('Credit Suisse Group', 'banking', 52000, 'enterprise', 'mature');

-- ============================================================
-- REALISTIC COMPANY DOCUMENTS (POLICIES & PROCEDURES)
-- ============================================================

-- Goldman Sachs Trading Policy (Synthetic)
INSERT INTO documents_meta (path, display_name, description, resolved) VALUES
('/policies/gs-trading-policy-2025.pdf', 'Goldman Sachs Trading Policy 2025', 'Updated proprietary trading policy following latest regulatory guidance', FALSE),
('/policies/gs-risk-management-framework.pdf', 'Risk Management Framework', 'Comprehensive risk management procedures for trading operations', FALSE),
('/procedures/gs-client-onboarding.pdf', 'Client Onboarding Procedures', 'KYC and AML procedures for new institutional clients', TRUE),
('/policies/gs-information-barriers.pdf', 'Information Barriers Policy', 'Chinese Wall procedures for research and trading divisions', FALSE),
('/compliance/gs-mifid-compliance-manual.pdf', 'MiFID II Compliance Manual', 'European operations compliance procedures', FALSE);

-- Sample document content for demo
INSERT INTO documents_partitioned (document_path, content_type, content_size, content_text, upload_date) VALUES
(
    '/policies/gs-trading-policy-2025.pdf',
    'policy',
    2048576,
    'GOLDMAN SACHS GROUP INC. PROPRIETARY TRADING POLICY

1. PURPOSE AND SCOPE
This policy establishes guidelines for proprietary trading activities to ensure compliance with the Volcker Rule and other applicable regulations. All trading activities must be conducted in accordance with this policy and applicable law.

2. PROHIBITED ACTIVITIES  
The following activities are strictly prohibited:
- Proprietary trading for the firm account except as permitted by regulations
- Short-term speculative positions not related to client activity
- Trading in securities where the firm has material non-public information

3. PERMITTED ACTIVITIES
The following activities are permitted under this policy:
- Market making in connection with client activity
- Trading in government securities
- Hedging activities to mitigate specific risks
- Trading on behalf of customers

4. COMPLIANCE MONITORING
All trading activities are subject to:
- Daily position monitoring and reporting  
- Regular compliance reviews by the Compliance Department
- Independent risk assessment by the Risk Management Division
- Quarterly attestation by business unit heads

5. TRAINING AND CERTIFICATION
All trading personnel must:
- Complete annual Volcker Rule training
- Maintain current Series 7 and appropriate licenses
- Understand and acknowledge this policy annually

This policy is effective January 1, 2025 and supersedes all previous versions.',
    '2025-01-01'
),
(
    '/policies/gs-risk-management-framework.pdf',
    'policy', 
    3145728,
    'RISK MANAGEMENT FRAMEWORK - GOLDMAN SACHS

EXECUTIVE SUMMARY
This document outlines the risk management framework for Goldman Sachs trading operations, designed to ensure appropriate risk controls while maintaining competitive market presence.

RISK CATEGORIES
1. Market Risk - Potential losses from market movements
2. Credit Risk - Risk of counterparty default
3. Operational Risk - Risk from failed internal processes
4. Liquidity Risk - Risk of inability to meet obligations
5. Regulatory Risk - Risk of non-compliance with regulations

RISK LIMITS AND CONTROLS
Daily Value-at-Risk (VaR) limits:
- Equity Trading: $50 million
- Fixed Income: $75 million  
- Commodities: $25 million
- Foreign Exchange: $40 million

ESCALATION PROCEDURES
Risk limit breaches must be:
- Immediately reported to the Chief Risk Officer
- Documented in the daily risk report
- Addressed within 2 business hours
- Reviewed by the Risk Committee if material

REGULATORY COMPLIANCE
This framework ensures compliance with:
- Basel III capital requirements
- Dodd-Frank risk retention rules  
- SEC net capital requirements
- Federal Reserve stress testing requirements',
    '2024-12-15'
);

-- ============================================================
-- COMPLIANCE GRAPH RELATIONSHIPS (DEMO DATA)
-- ============================================================

-- Create relationships between regulations and company policies
INSERT INTO compliance_graph (source_type, source_id, target_type, target_id, relationship_type, confidence, evidence_text) VALUES
('regulation', 'DODD-FRANK-619', 'document', '/policies/gs-trading-policy-2025.pdf', 'implements', 0.950, 'Policy explicitly addresses Volcker Rule prohibitions and permitted activities'),
('regulation', 'SEC-10b-5', 'document', '/policies/gs-information-barriers.pdf', 'complies_with', 0.880, 'Information barriers prevent material non-public information misuse'),
('regulation', 'BASEL-III', 'document', '/policies/gs-risk-management-framework.pdf', 'implements', 0.920, 'Risk limits align with Basel III capital adequacy requirements'),
('regulation', 'MiFID-II', 'document', '/compliance/gs-mifid-compliance-manual.pdf', 'implements', 0.980, 'Dedicated compliance manual for MiFID II requirements'),
('regulation', 'SOX-404', 'document', '/procedures/gs-client-onboarding.pdf', 'complies_with', 0.750, 'Client onboarding includes internal control procedures');

-- Add some conflicting relationships for demo purposes
INSERT INTO compliance_graph (source_type, source_id, target_type, target_id, relationship_type, confidence, evidence_text) VALUES
('regulation', 'DODD-FRANK-619', 'document', '/policies/gs-risk-management-framework.pdf', 'conflicts', 0.650, 'Risk limits may exceed Volcker Rule permitted market making thresholds'),
('regulation', 'MiFID-II', 'document', '/policies/gs-trading-policy-2025.pdf', 'conflicts', 0.700, 'US-focused policy may not address EU best execution requirements');

-- ============================================================
-- RISK ASSESSMENTS (DEMO DATA)
-- ============================================================

INSERT INTO risk_assessments (assessment_date, regulation_id, document_path, risk_category, risk_score, impact_score, likelihood_score, assessment_details, assessed_by) VALUES
('2025-01-15', 1, '/policies/gs-trading-policy-2025.pdf', 'medium', 6.5, 8.5, 3.5, '{"risk_factors": ["policy gaps", "training requirements"], "mitigation_plans": ["enhanced monitoring", "quarterly reviews"]}', 'compliance-team'),
('2025-01-15', 2, '/policies/gs-risk-management-framework.pdf', 'high', 8.2, 9.0, 7.5, '{"risk_factors": ["limit breaches", "model risk"], "mitigation_plans": ["daily monitoring", "model validation"]}', 'risk-team'),
('2025-01-14', 4, '/compliance/gs-mifid-compliance-manual.pdf', 'low', 3.2, 4.0, 2.5, '{"risk_factors": ["minor gaps"], "mitigation_plans": ["policy updates"]}', 'eu-compliance-team');

-- ============================================================
-- PERFORMANCE BENCHMARKING DATA
-- ============================================================

-- Simulate query performance for 10M+ document corpus
INSERT INTO query_performance_log (query_hash, query_type, execution_time_ms, row_count, region, cache_hit) VALUES
-- Vector search performance
('a1b2c3d4', 'read', 45.2, 1000, 'us-west-2', FALSE),
('a1b2c3d4', 'read', 12.8, 1000, 'us-west-2', TRUE),  -- Same query, cached
('e5f6g7h8', 'analytics', 234.7, 50000, 'us-west-2', FALSE),
('i9j0k1l2', 'read', 89.3, 25000, 'us-east-1', FALSE),
('m3n4o5p6', 'write', 156.4, 1, 'us-west-2', FALSE),
-- Hybrid search performance  
('q7r8s9t0', 'read', 67.9, 5000, 'us-west-2', FALSE),
('u1v2w3x4', 'analytics', 445.6, 100000, 'us-west-2', FALSE),
('y5z6a7b8', 'read', 23.1, 500, 'eu-west-1', FALSE);

-- ============================================================
-- COLLABORATION DEMO DATA
-- ============================================================

INSERT INTO collaboration_sessions (session_id, document_path, participants_json, expires_at) VALUES
('550e8400-e29b-41d4-a716-446655440000', '/policies/gs-trading-policy-2025.pdf', '[{"user_id": "jane.smith@gs.com", "role": "compliance_analyst", "location": "NYC"}, {"user_id": "john.doe@gs.com", "role": "risk_manager", "location": "London"}]', DATE_ADD(NOW(), INTERVAL 2 HOUR)),
('550e8400-e29b-41d4-a716-446655440001', '/policies/gs-risk-management-framework.pdf', '[{"user_id": "maria.garcia@gs.com", "role": "senior_analyst", "location": "NYC"}, {"user_id": "david.chen@gs.com", "role": "compliance_director", "location": "Tokyo"}]', DATE_ADD(NOW(), INTERVAL 1 HOUR));

INSERT INTO document_annotations (document_path, user_id, annotation_type, start_offset, end_offset, text_content, annotation_data) VALUES
('/policies/gs-trading-policy-2025.pdf', 'jane.smith@gs.com', 'risk_flag', 1250, 1380, 'Short-term speculative positions not related to client activity', '{"risk_level": "high", "color": "#ff4444", "category": "volcker_violation"}'),
('/policies/gs-trading-policy-2025.pdf', 'john.doe@gs.com', 'comment', 2100, 2200, 'Market making in connection with client activity', '{"comment": "Need clearer definition of client activity", "priority": "medium"}'),
('/policies/gs-risk-management-framework.pdf', 'maria.garcia@gs.com', 'highlight', 3200, 3350, 'Daily Value-at-Risk (VaR) limits', '{"color": "#ffff44", "category": "key_metric"}');

-- ============================================================
-- COMPLIANCE METRICS FOR DASHBOARD
-- ============================================================

INSERT INTO compliance_metrics (metric_date, metric_type, dimension1, dimension2, metric_value, metric_count) VALUES
-- Compliance coverage metrics
('2025-01-15', 'compliance_coverage', 'trading_policies', 'volcker_rule', 87.5, 8),
('2025-01-15', 'compliance_coverage', 'risk_policies', 'basel_III', 92.3, 12),
('2025-01-15', 'compliance_coverage', 'eu_policies', 'mifid_ii', 78.9, 15),

-- Risk assessment metrics  
('2025-01-15', 'risk_distribution', 'high_risk', 'unmitigated', 15.0, 3),
('2025-01-15', 'risk_distribution', 'medium_risk', 'in_progress', 35.0, 7),
('2025-01-15', 'risk_distribution', 'low_risk', 'completed', 50.0, 10),

-- Performance metrics
('2025-01-15', 'query_performance', 'vector_search', 'avg_latency_ms', 67.4, 1000),
('2025-01-15', 'query_performance', 'hybrid_search', 'avg_latency_ms', 45.2, 5000),
('2025-01-15', 'query_performance', 'analytics', 'avg_latency_ms', 340.15, 250);

-- ============================================================
-- DEMO VERIFICATION QUERIES
-- ============================================================

-- These queries will be used in the demo to show impressive performance

/*
-- Query 1: Complex compliance coverage analysis
SELECT 
    r.regulation_code,
    COUNT(DISTINCT cg.target_id) as covered_documents,
    AVG(cg.confidence) as avg_confidence,
    SUM(CASE WHEN ra.risk_category = 'high' THEN 1 ELSE 0 END) as high_risk_count
FROM demo_regulations r
LEFT JOIN compliance_graph cg ON CONCAT(r.regulation_code) = cg.source_id
LEFT JOIN risk_assessments ra ON r.id = ra.regulation_id
GROUP BY r.regulation_code
ORDER BY avg_confidence DESC;

-- Query 2: Real-time collaboration analytics  
SELECT 
    document_path,
    COUNT(DISTINCT session_id) as active_sessions,
    JSON_LENGTH(participants_json) as total_participants,
    COUNT(DISTINCT da.user_id) as annotating_users
FROM collaboration_sessions cs
LEFT JOIN document_annotations da ON cs.document_path = da.document_path
WHERE cs.is_active = TRUE
GROUP BY document_path;

-- Query 3: Performance benchmarking
SELECT 
    query_type,
    region,
    AVG(execution_time_ms) as avg_latency,
    COUNT(*) as query_count,
    SUM(CASE WHEN cache_hit = TRUE THEN 1 ELSE 0 END) / COUNT(*) * 100 as cache_hit_rate
FROM query_performance_log  
GROUP BY query_type, region
ORDER BY avg_latency ASC;
*/