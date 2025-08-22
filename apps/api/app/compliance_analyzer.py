"""
Real-time compliance analysis engine
Analyzes documents for compliance gaps, risks, and scores
"""

import os
import json
import re
from typing import List, Dict, Any, Optional, Tuple
import httpx
from .deps import execute

class ComplianceAnalyzer:
    """AI-powered compliance analysis engine"""
    
    def __init__(self):
        self.ollama_url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
        self.model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        
        # Compliance keywords and patterns
        self.compliance_keywords = {
            'data_protection': [
                'personal data', 'gdpr', 'privacy policy', 'consent', 'data subject',
                'data controller', 'data processor', 'data retention', 'data breach',
                'right to erasure', 'right to rectification', 'data portability',
                'privacy by design', 'lawful basis', 'sensitive data'
            ],
            'financial': [
                'financial reporting', 'internal controls', 'audit', 'sox', 'sarbanes oxley',
                'financial statements', 'revenue recognition', 'expense reporting',
                'segregation of duties', 'authorization controls', 'ceo certification',
                'cfo certification', 'material weakness', 'deficiency'
            ],
            'healthcare': [
                'phi', 'protected health information', 'hipaa', 'patient data',
                'medical records', 'healthcare privacy', 'business associate',
                'minimum necessary', 'authorization', 'breach notification',
                'covered entity', 'health information', 'treatment records'
            ],
            'security': [
                'information security', 'iso 27001', 'cybersecurity', 'access control',
                'encryption', 'vulnerability', 'security incident', 'risk assessment',
                'security controls', 'incident response', 'business continuity',
                'disaster recovery', 'penetration testing', 'security awareness'
            ]
        }
        
        # Risk indicators
        self.risk_indicators = {
            'high': [
                'breach', 'violation', 'non-compliant', 'missing', 'inadequate',
                'unauthorized', 'unsecured', 'unencrypted', 'expired', 'overdue'
            ],
            'medium': [
                'review', 'update', 'improve', 'enhance', 'clarify', 'consider',
                'may need', 'should consider', 'recommended', 'suggested'
            ],
            'low': [
                'compliant', 'adequate', 'sufficient', 'proper', 'appropriate',
                'secured', 'encrypted', 'authorized', 'approved', 'documented'
            ]
        }

    async def analyze_document(self, doc_id: int, content: str, path: str) -> Dict[str, Any]:
        """Perform comprehensive compliance analysis on a document"""
        
        # Detect compliance categories
        categories = self._detect_compliance_categories(content)
        
        # Get compliance frameworks for detected categories
        frameworks = await self._get_relevant_frameworks(categories)
        
        # Perform AI analysis
        ai_analysis = await self._ai_analyze_compliance(content, frameworks)
        
        # Calculate compliance score
        compliance_score = self._calculate_compliance_score(content, ai_analysis)
        
        # Determine risk level
        risk_level = self._determine_risk_level(ai_analysis, compliance_score)
        
        # Generate recommendations
        recommendations = await self._generate_recommendations(content, ai_analysis, frameworks)
        
        # Store analysis results
        analysis_id = await self._store_analysis_results(
            doc_id, path, compliance_score, risk_level, categories, 
            ai_analysis, recommendations
        )
        
        return {
            'analysis_id': analysis_id,
            'compliance_score': compliance_score,
            'risk_level': risk_level,
            'categories': categories,
            'frameworks': [f['name'] for f in frameworks],
            'analysis': ai_analysis,
            'recommendations': recommendations,
            'summary': self._generate_summary(compliance_score, risk_level, ai_analysis)
        }

    def _detect_compliance_categories(self, content: str) -> List[str]:
        """Detect which compliance categories apply to the document"""
        content_lower = content.lower()
        categories = []
        
        for category, keywords in self.compliance_keywords.items():
            keyword_count = sum(1 for keyword in keywords if keyword in content_lower)
            keyword_ratio = keyword_count / len(keywords)
            
            # If more than 10% of keywords found, include category
            if keyword_ratio > 0.1:
                categories.append(category)
        
        return categories or ['general']

    async def _get_relevant_frameworks(self, categories: List[str]) -> List[Dict[str, Any]]:
        """Get compliance frameworks relevant to detected categories"""
        if not categories or categories == ['general']:
            # Get all frameworks
            sql = "SELECT * FROM compliance_frameworks WHERE is_active = TRUE"
            rows = await execute(sql)
        else:
            # Get frameworks matching categories
            placeholders = ','.join(['%s'] * len(categories))
            sql = f"SELECT * FROM compliance_frameworks WHERE category IN ({placeholders}) AND is_active = TRUE"
            rows = await execute(sql, categories)
        
        return [dict(row) for row in rows or []]

    async def _ai_analyze_compliance(self, content: str, frameworks: List[Dict]) -> Dict[str, Any]:
        """Use AI to analyze compliance aspects of the document"""
        
        framework_context = "\n".join([
            f"- {fw['name']} ({fw['full_name']}): {fw['description']}"
            for fw in frameworks[:3]  # Limit to top 3 to avoid token limits
        ])
        
        prompt = f"""You are a compliance expert. Analyze this document for compliance issues, gaps, and risks.

Relevant Compliance Frameworks:
{framework_context}

Document Content (first 2000 chars):
{content[:2000]}

Provide analysis in this JSON format:
{{
    "compliance_issues": [
        {{
            "severity": "critical|high|medium|low",
            "category": "data_protection|financial|healthcare|security|general",
            "title": "Brief issue title",
            "description": "Detailed description",
            "framework": "Relevant framework name",
            "evidence": "Supporting text from document"
        }}
    ],
    "strengths": [
        {{
            "category": "compliance category",
            "description": "What the document does well"
        }}
    ],
    "gaps": [
        {{
            "framework": "Framework name",
            "requirement": "Missing requirement",
            "description": "What's missing and why it matters"
        }}
    ],
    "overall_assessment": "Brief overall compliance assessment"
}}

Focus on specific, actionable findings with evidence from the document."""

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": "You are a compliance expert. Always respond with valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False
                    }
                )
                
                if response.status_code == 200:
                    ai_response = response.json().get("message", {}).get("content", "{}")
                    try:
                        # Extract JSON from response
                        json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
                        if json_match:
                            return json.loads(json_match.group())
                    except json.JSONDecodeError:
                        pass
        except Exception as e:
            print(f"AI analysis error: {e}")
        
        # Fallback analysis
        return self._fallback_analysis(content, frameworks)

    def _fallback_analysis(self, content: str, frameworks: List[Dict]) -> Dict[str, Any]:
        """Fallback rule-based analysis when AI is unavailable"""
        content_lower = content.lower()
        issues = []
        strengths = []
        gaps = []
        
        # Simple keyword-based analysis
        for category, keywords in self.compliance_keywords.items():
            category_score = sum(1 for keyword in keywords if keyword in content_lower)
            
            if category_score > 0:
                strengths.append({
                    "category": category,
                    "description": f"Document addresses {category} compliance topics"
                })
            
            # Check for risk indicators
            for risk_level, indicators in self.risk_indicators.items():
                for indicator in indicators:
                    if indicator in content_lower:
                        severity = 'high' if risk_level == 'high' else 'medium' if risk_level == 'medium' else 'low'
                        issues.append({
                            "severity": severity,
                            "category": category,
                            "title": f"Potential {risk_level} risk indicator found",
                            "description": f"Document contains '{indicator}' which may indicate compliance concerns",
                            "framework": "General",
                            "evidence": f"Contains term: {indicator}"
                        })
        
        return {
            "compliance_issues": issues[:10],  # Limit results
            "strengths": strengths[:5],
            "gaps": gaps,
            "overall_assessment": "Automated analysis completed. Manual review recommended."
        }

    def _calculate_compliance_score(self, content: str, ai_analysis: Dict) -> float:
        """Calculate overall compliance score (0-100)"""
        issues = ai_analysis.get('compliance_issues', [])
        strengths = ai_analysis.get('strengths', [])
        
        # Base score
        score = 70.0
        
        # Deduct points for issues
        for issue in issues:
            severity = issue.get('severity', 'medium')
            if severity == 'critical':
                score -= 20
            elif severity == 'high':
                score -= 15
            elif severity == 'medium':
                score -= 10
            else:
                score -= 5
        
        # Add points for strengths
        score += min(len(strengths) * 5, 20)
        
        # Document length factor (longer docs tend to be more comprehensive)
        length_factor = min(len(content) / 10000, 1.0) * 10
        score += length_factor
        
        return max(0.0, min(100.0, score))

    def _determine_risk_level(self, ai_analysis: Dict, compliance_score: float) -> str:
        """Determine overall risk level"""
        issues = ai_analysis.get('compliance_issues', [])
        
        # Check for critical issues
        critical_issues = [i for i in issues if i.get('severity') == 'critical']
        if critical_issues:
            return 'critical'
        
        # Check for high issues
        high_issues = [i for i in issues if i.get('severity') == 'high']
        if high_issues:
            return 'high'
        
        # Use score-based assessment
        if compliance_score >= 80:
            return 'low'
        elif compliance_score >= 60:
            return 'medium'
        else:
            return 'high'

    async def _generate_recommendations(self, content: str, ai_analysis: Dict, frameworks: List[Dict]) -> List[Dict[str, Any]]:
        """Generate actionable recommendations"""
        recommendations = []
        
        issues = ai_analysis.get('compliance_issues', [])
        gaps = ai_analysis.get('gaps', [])
        
        # Recommendations based on issues
        for issue in issues[:5]:  # Top 5 issues
            recommendations.append({
                'type': 'fix_issue',
                'priority': issue.get('severity', 'medium'),
                'title': f"Address {issue.get('title', 'compliance issue')}",
                'description': issue.get('description', ''),
                'category': issue.get('category', 'general'),
                'framework': issue.get('framework', 'General')
            })
        
        # Recommendations based on gaps
        for gap in gaps[:3]:  # Top 3 gaps
            recommendations.append({
                'type': 'fill_gap',
                'priority': 'medium',
                'title': f"Implement {gap.get('requirement', 'missing requirement')}",
                'description': gap.get('description', ''),
                'category': 'general',
                'framework': gap.get('framework', 'General')
            })
        
        # General recommendations
        if not recommendations:
            recommendations.append({
                'type': 'general',
                'priority': 'low',
                'title': 'Regular compliance review',
                'description': 'Schedule regular reviews to ensure ongoing compliance',
                'category': 'general',
                'framework': 'General'
            })
        
        return recommendations

    async def _store_analysis_results(self, doc_id: int, path: str, compliance_score: float, 
                                    risk_level: str, categories: List[str], 
                                    ai_analysis: Dict, recommendations: List[Dict]) -> int:
        """Store analysis results in database"""
        
        # Store document compliance status
        status_sql = """
        INSERT INTO document_compliance_status 
        (doc_id, path, overall_score, risk_level, compliance_status, total_issues, 
         critical_issues, high_issues, medium_issues, low_issues, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
        overall_score = VALUES(overall_score),
        risk_level = VALUES(risk_level),
        compliance_status = VALUES(compliance_status),
        total_issues = VALUES(total_issues),
        critical_issues = VALUES(critical_issues),
        high_issues = VALUES(high_issues),
        medium_issues = VALUES(medium_issues),
        low_issues = VALUES(low_issues),
        last_analyzed = CURRENT_TIMESTAMP,
        metadata = VALUES(metadata)
        """
        
        issues = ai_analysis.get('compliance_issues', [])
        total_issues = len(issues)
        critical_issues = len([i for i in issues if i.get('severity') == 'critical'])
        high_issues = len([i for i in issues if i.get('severity') == 'high'])
        medium_issues = len([i for i in issues if i.get('severity') == 'medium'])
        low_issues = len([i for i in issues if i.get('severity') == 'low'])
        
        compliance_status = 'compliant' if compliance_score >= 80 else \
                          'partially_compliant' if compliance_score >= 60 else 'non_compliant'
        
        metadata = {
            'categories': categories,
            'ai_analysis': ai_analysis,
            'recommendations': recommendations
        }
        
        await execute(status_sql, [
            doc_id, path, compliance_score, risk_level, compliance_status,
            total_issues, critical_issues, high_issues, medium_issues, low_issues,
            json.dumps(metadata)
        ])
        
        # Store individual analysis records
        analysis_sql = """
        INSERT INTO compliance_analysis 
        (doc_id, analysis_type, score, risk_level, category, title, description, 
         recommendation, confidence, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        # Store main analysis
        analysis_rows = await execute("SELECT LAST_INSERT_ID() as id")
        analysis_id = analysis_rows[0]['id'] if analysis_rows else 1
        
        await execute(analysis_sql, [
            doc_id, 'compliance_score', compliance_score, risk_level, 
            ','.join(categories), 'Overall Compliance Analysis',
            ai_analysis.get('overall_assessment', 'Compliance analysis completed'),
            json.dumps(recommendations), 85.0, json.dumps(ai_analysis)
        ])
        
        return analysis_id

    def _generate_summary(self, compliance_score: float, risk_level: str, ai_analysis: Dict) -> str:
        """Generate human-readable summary of analysis"""
        issues_count = len(ai_analysis.get('compliance_issues', []))
        strengths_count = len(ai_analysis.get('strengths', []))
        
        summary = f"Compliance Score: {compliance_score:.1f}/100 (Risk Level: {risk_level.title()}). "
        
        if issues_count > 0:
            summary += f"Found {issues_count} compliance issue(s) requiring attention. "
        
        if strengths_count > 0:
            summary += f"Identified {strengths_count} compliance strength(s). "
        
        if compliance_score >= 80:
            summary += "Document demonstrates good compliance practices."
        elif compliance_score >= 60:
            summary += "Document has room for compliance improvements."
        else:
            summary += "Document requires significant compliance review."
        
        return summary

# Global analyzer instance
compliance_analyzer = ComplianceAnalyzer()