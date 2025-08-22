"""
Smart Document Recommendation Engine
Provides AI-powered document recommendations based on user behavior, content similarity, and compliance patterns.
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
import math
import re
from collections import defaultdict, Counter

from pydantic import BaseModel
import aiomysql

from .deps import get_db_pool


class RecommendationType(str, Enum):
    SIMILAR_CONTENT = "similar_content"
    COMPLIANCE_RELATED = "compliance_related"
    TRENDING = "trending"
    PERSONALIZED = "personalized"
    WORKFLOW_SUGGESTED = "workflow_suggested"
    AI_CURATED = "ai_curated"


class InteractionType(str, Enum):
    VIEW = "view"
    DOWNLOAD = "download"
    SEARCH = "search"
    BOOKMARK = "bookmark"
    SHARE = "share"
    ANALYZE = "analyze"
    COMMENT = "comment"
    VERSION_VIEW = "version_view"


class InteractionDepth(str, Enum):
    QUICK_VIEW = "quick_view"
    BROWSE = "browse"
    DETAILED_REVIEW = "detailed_review"
    ANALYSIS = "analysis"


class DocumentRecommendation(BaseModel):
    recommendation_id: str
    document_id: int
    title: str
    path: str
    recommendation_type: RecommendationType
    score: float
    reasoning: str
    source_document_id: Optional[int] = None
    metadata: Dict[str, Any] = {}


class UserInteraction(BaseModel):
    user_id: str
    document_id: int
    interaction_type: InteractionType
    duration_seconds: Optional[int] = None
    depth: InteractionDepth = InteractionDepth.BROWSE
    session_id: Optional[str] = None
    referrer_source: Optional[str] = None
    metadata: Dict[str, Any] = {}


class RecommendationEngine:
    """Advanced recommendation engine with multiple algorithms and ML-inspired features."""
    
    def __init__(self):
        self.similarity_cache = {}
        self.user_profile_cache = {}
        self.trending_cache = {}
        self.cache_ttl = 3600  # 1 hour cache
        
    async def get_recommendations(
        self, 
        user_id: str, 
        limit: int = 10,
        recommendation_types: Optional[List[RecommendationType]] = None,
        context_document_id: Optional[int] = None
    ) -> List[DocumentRecommendation]:
        """Get personalized recommendations for a user."""
        
        if not recommendation_types:
            recommendation_types = await self._get_user_preferred_types(user_id)
        
        recommendations = []
        
        # Get user profile and interaction history
        user_profile = await self._build_user_profile(user_id)
        
        for rec_type in recommendation_types:
            if rec_type == RecommendationType.SIMILAR_CONTENT:
                similar_recs = await self._get_similar_content_recommendations(
                    user_id, user_profile, context_document_id, limit // len(recommendation_types)
                )
                recommendations.extend(similar_recs)
                
            elif rec_type == RecommendationType.COMPLIANCE_RELATED:
                compliance_recs = await self._get_compliance_recommendations(
                    user_id, user_profile, limit // len(recommendation_types)
                )
                recommendations.extend(compliance_recs)
                
            elif rec_type == RecommendationType.TRENDING:
                trending_recs = await self._get_trending_recommendations(
                    user_id, limit // len(recommendation_types)
                )
                recommendations.extend(trending_recs)
                
            elif rec_type == RecommendationType.PERSONALIZED:
                personalized_recs = await self._get_personalized_recommendations(
                    user_id, user_profile, limit // len(recommendation_types)
                )
                recommendations.extend(personalized_recs)
                
            elif rec_type == RecommendationType.AI_CURATED:
                ai_recs = await self._get_ai_curated_recommendations(
                    user_id, user_profile, limit // len(recommendation_types)
                )
                recommendations.extend(ai_recs)
        
        # Remove duplicates and sort by score
        seen_docs = set()
        unique_recommendations = []
        for rec in sorted(recommendations, key=lambda x: x.score, reverse=True):
            if rec.document_id not in seen_docs:
                unique_recommendations.append(rec)
                seen_docs.add(rec.document_id)
        
        # Store recommendations in database
        await self._store_recommendations(unique_recommendations[:limit])
        
        return unique_recommendations[:limit]
    
    async def track_interaction(
        self, 
        user_id: str, 
        document_id: int, 
        interaction_type: InteractionType,
        **kwargs
    ) -> None:
        """Track user interaction with a document."""
        
        interaction = UserInteraction(
            user_id=user_id,
            document_id=document_id,
            interaction_type=interaction_type,
            duration_seconds=kwargs.get('duration_seconds'),
            depth=kwargs.get('depth', InteractionDepth.BROWSE),
            session_id=kwargs.get('session_id'),
            referrer_source=kwargs.get('referrer_source'),
            metadata=kwargs.get('metadata', {})
        )
        
        # Store interaction
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute("""
                    INSERT INTO user_document_interactions 
                    (user_id, document_id, interaction_type, interaction_duration_seconds,
                     interaction_depth, session_id, referrer_source, metadata)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    interaction.user_id,
                    interaction.document_id,
                    interaction.interaction_type.value,
                    interaction.duration_seconds,
                    interaction.depth.value,
                    interaction.session_id,
                    interaction.referrer_source,
                    json.dumps(interaction.metadata)
                ))
                await conn.commit()
        
        # Clear user profile cache for fresh recommendations
        if user_id in self.user_profile_cache:
            del self.user_profile_cache[user_id]
    
    async def provide_feedback(
        self, 
        recommendation_id: str, 
        rating: int, 
        notes: Optional[str] = None
    ) -> None:
        """Record user feedback on recommendations."""
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute("""
                    UPDATE document_recommendations 
                    SET feedback_rating = %s, feedback_notes = %s
                    WHERE recommendation_id = %s
                """, (rating, notes, recommendation_id))
                await conn.commit()
    
    async def _build_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Build comprehensive user profile from interaction history."""
        
        # Check cache
        cache_key = f"user_profile_{user_id}"
        if cache_key in self.user_profile_cache:
            cached_data = self.user_profile_cache[cache_key]
            if datetime.now() - cached_data['timestamp'] < timedelta(seconds=self.cache_ttl):
                return cached_data['profile']
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                # Get user interactions
                await cursor.execute("""
                    SELECT ui.*, d.title, d.path, d.metadata, dt.topic_name, dt.confidence_score
                    FROM user_document_interactions ui
                    JOIN corp_docs d ON ui.document_id = d.id
                    LEFT JOIN document_topics dt ON d.id = dt.document_id
                    WHERE ui.user_id = %s AND ui.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
                    ORDER BY ui.created_at DESC
                    LIMIT 1000
                """, (user_id,))
                
                interactions = await cursor.fetchall()
        
        if not interactions:
            return self._get_default_profile()
        
        # Analyze interaction patterns
        profile = {
            'user_id': user_id,
            'interaction_count': len(interactions),
            'preferred_topics': self._extract_preferred_topics(interactions),
            'interaction_patterns': self._analyze_interaction_patterns(interactions),
            'compliance_frameworks': self._extract_compliance_interests(interactions),
            'document_preferences': self._analyze_document_preferences(interactions),
            'temporal_patterns': self._analyze_temporal_patterns(interactions),
            'engagement_level': self._calculate_engagement_level(interactions),
            'last_updated': datetime.now()
        }
        
        # Cache the profile
        self.user_profile_cache[cache_key] = {
            'profile': profile,
            'timestamp': datetime.now()
        }
        
        return profile
    
    def _extract_preferred_topics(self, interactions: List[Dict]) -> Dict[str, float]:
        """Extract user's preferred topics from interactions."""
        topic_scores = defaultdict(float)
        
        for interaction in interactions:
            if interaction.get('topic_name'):
                # Weight by interaction type and depth
                weight = self._get_interaction_weight(
                    interaction['interaction_type'],
                    interaction.get('interaction_depth', 'browse')
                )
                confidence = interaction.get('confidence_score', 0.5)
                topic_scores[interaction['topic_name']] += weight * confidence
        
        # Normalize scores
        if topic_scores:
            max_score = max(topic_scores.values())
            return {topic: score / max_score for topic, score in topic_scores.items()}
        
        return {}
    
    def _analyze_interaction_patterns(self, interactions: List[Dict]) -> Dict[str, Any]:
        """Analyze user's interaction patterns."""
        patterns = {
            'most_common_type': Counter([i['interaction_type'] for i in interactions]).most_common(1),
            'avg_duration': sum(i.get('interaction_duration_seconds', 0) for i in interactions) / len(interactions),
            'depth_distribution': Counter([i.get('interaction_depth', 'browse') for i in interactions]),
            'session_behavior': self._analyze_session_patterns(interactions),
            'preferred_times': self._extract_time_preferences(interactions)
        }
        
        return patterns
    
    def _extract_compliance_interests(self, interactions: List[Dict]) -> List[str]:
        """Extract compliance frameworks the user is most interested in."""
        frameworks = []
        
        for interaction in interactions:
            doc_metadata = json.loads(interaction.get('metadata', '{}'))
            if 'compliance_frameworks' in doc_metadata:
                frameworks.extend(doc_metadata['compliance_frameworks'])
        
        # Return top 5 most common frameworks
        return [fw for fw, _ in Counter(frameworks).most_common(5)]
    
    def _get_interaction_weight(self, interaction_type: str, depth: str) -> float:
        """Calculate weight for different interaction types and depths."""
        type_weights = {
            'view': 1.0,
            'download': 2.0,
            'analyze': 3.0,
            'bookmark': 2.5,
            'share': 2.0,
            'comment': 1.5,
            'search': 0.8,
            'version_view': 1.2
        }
        
        depth_weights = {
            'quick_view': 0.5,
            'browse': 1.0,
            'detailed_review': 2.0,
            'analysis': 3.0
        }
        
        return type_weights.get(interaction_type, 1.0) * depth_weights.get(depth, 1.0)
    
    async def _get_similar_content_recommendations(
        self, 
        user_id: str, 
        user_profile: Dict, 
        context_document_id: Optional[int], 
        limit: int
    ) -> List[DocumentRecommendation]:
        """Get recommendations based on content similarity."""
        
        recommendations = []
        base_document_id = context_document_id
        
        # If no context document, use user's most recent interactions
        if not base_document_id:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute("""
                        SELECT document_id FROM user_document_interactions 
                        WHERE user_id = %s 
                        ORDER BY created_at DESC 
                        LIMIT 1
                    """, (user_id,))
                    result = await cursor.fetchone()
                    if result:
                        base_document_id = result[0]
        
        if base_document_id:
            similar_docs = await self._find_similar_documents(base_document_id, limit * 2)
            
            for doc_id, similarity_score, doc_info in similar_docs:
                if doc_id != base_document_id:
                    reasoning = f"Similar to document you recently viewed. Content similarity: {similarity_score:.2f}"
                    
                    rec = DocumentRecommendation(
                        recommendation_id=str(uuid.uuid4()),
                        document_id=doc_id,
                        title=doc_info['title'],
                        path=doc_info['path'],
                        recommendation_type=RecommendationType.SIMILAR_CONTENT,
                        score=similarity_score * 0.8,  # Scale down from content similarity
                        reasoning=reasoning,
                        source_document_id=base_document_id,
                        metadata={
                            'similarity_type': 'content',
                            'base_document_id': base_document_id
                        }
                    )
                    recommendations.append(rec)
                    
                    if len(recommendations) >= limit:
                        break
        
        return recommendations
    
    async def _get_compliance_recommendations(
        self, 
        user_id: str, 
        user_profile: Dict, 
        limit: int
    ) -> List[DocumentRecommendation]:
        """Get recommendations based on compliance framework interests."""
        
        recommendations = []
        preferred_frameworks = user_profile.get('compliance_frameworks', [])
        
        if not preferred_frameworks:
            return recommendations
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                # Find documents related to user's compliance interests
                framework_conditions = " OR ".join(
                    ["JSON_CONTAINS(d.metadata, %s, '$.compliance_frameworks')"] * len(preferred_frameworks)
                )
                
                if framework_conditions:
                    query = f"""
                        SELECT d.*, COUNT(ui.id) as interaction_count,
                               MAX(ui.created_at) as last_interaction
                        FROM corp_docs d
                        LEFT JOIN user_document_interactions ui ON d.id = ui.document_id AND ui.user_id != %s
                        WHERE ({framework_conditions})
                        AND d.id NOT IN (
                            SELECT DISTINCT document_id FROM user_document_interactions 
                            WHERE user_id = %s AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                        )
                        GROUP BY d.id
                        ORDER BY interaction_count DESC, d.created_at DESC
                        LIMIT %s
                    """
                    
                    params = [user_id] + [json.dumps(fw) for fw in preferred_frameworks] + [user_id, limit * 2]
                    
                    await cursor.execute(query, params)
                    documents = await cursor.fetchall()
                    
                    for doc in documents:
                        frameworks_in_doc = json.loads(doc.get('metadata', '{}')).get('compliance_frameworks', [])
                        matching_frameworks = [fw for fw in frameworks_in_doc if fw in preferred_frameworks]
                        
                        if matching_frameworks:
                            score = len(matching_frameworks) / len(preferred_frameworks)
                            score *= min(1.0, (doc.get('interaction_count', 0) + 1) / 10)  # Boost popular docs
                            
                            reasoning = f"Related to your compliance interests: {', '.join(matching_frameworks)}"
                            
                            rec = DocumentRecommendation(
                                recommendation_id=str(uuid.uuid4()),
                                document_id=doc['id'],
                                title=doc['title'],
                                path=doc['path'],
                                recommendation_type=RecommendationType.COMPLIANCE_RELATED,
                                score=score,
                                reasoning=reasoning,
                                metadata={
                                    'matching_frameworks': matching_frameworks,
                                    'popularity_boost': doc.get('interaction_count', 0)
                                }
                            )
                            recommendations.append(rec)
                            
                            if len(recommendations) >= limit:
                                break
        
        return recommendations
    
    async def _get_trending_recommendations(self, user_id: str, limit: int) -> List[DocumentRecommendation]:
        """Get trending document recommendations."""
        
        recommendations = []
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute("""
                    SELECT d.*, dtm.trending_score, dtm.view_count, dtm.unique_viewers,
                           dtm.engagement_score
                    FROM corp_docs d
                    JOIN document_trending_metrics dtm ON d.id = dtm.document_id
                    WHERE dtm.metric_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                    AND dtm.trending_score > 0.3
                    AND d.id NOT IN (
                        SELECT DISTINCT document_id FROM user_document_interactions 
                        WHERE user_id = %s AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    )
                    ORDER BY dtm.trending_score DESC, dtm.engagement_score DESC
                    LIMIT %s
                """, (user_id, limit))
                
                trending_docs = await cursor.fetchall()
                
                for doc in trending_docs:
                    trending_score = doc.get('trending_score', 0)
                    view_count = doc.get('view_count', 0)
                    unique_viewers = doc.get('unique_viewers', 0)
                    
                    reasoning = f"Trending document with {view_count} views from {unique_viewers} users this week"
                    
                    rec = DocumentRecommendation(
                        recommendation_id=str(uuid.uuid4()),
                        document_id=doc['id'],
                        title=doc['title'],
                        path=doc['path'],
                        recommendation_type=RecommendationType.TRENDING,
                        score=trending_score,
                        reasoning=reasoning,
                        metadata={
                            'view_count': view_count,
                            'unique_viewers': unique_viewers,
                            'engagement_score': doc.get('engagement_score', 0)
                        }
                    )
                    recommendations.append(rec)
        
        return recommendations
    
    async def _get_personalized_recommendations(
        self, 
        user_id: str, 
        user_profile: Dict, 
        limit: int
    ) -> List[DocumentRecommendation]:
        """Get personalized recommendations using collaborative filtering."""
        
        recommendations = []
        
        # Find users with similar interaction patterns
        similar_users = await self._find_similar_users(user_id, user_profile)
        
        if similar_users:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    # Get documents that similar users interacted with
                    similar_user_ids = [uid for uid, _ in similar_users[:10]]  # Top 10 similar users
                    placeholders = ",".join(["%s"] * len(similar_user_ids))
                    
                    query = f"""
                        SELECT d.*, COUNT(*) as similar_user_interactions,
                               AVG(ui.interaction_duration_seconds) as avg_duration,
                               GROUP_CONCAT(DISTINCT ui.interaction_type) as interaction_types
                        FROM corp_docs d
                        JOIN user_document_interactions ui ON d.id = ui.document_id
                        WHERE ui.user_id IN ({placeholders})
                        AND d.id NOT IN (
                            SELECT DISTINCT document_id FROM user_document_interactions 
                            WHERE user_id = %s AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                        )
                        GROUP BY d.id
                        HAVING similar_user_interactions >= 2
                        ORDER BY similar_user_interactions DESC, avg_duration DESC
                        LIMIT %s
                    """
                    
                    await cursor.execute(query, similar_user_ids + [user_id, limit])
                    collaborative_docs = await cursor.fetchall()
                    
                    for doc in collaborative_docs:
                        interaction_count = doc.get('similar_user_interactions', 0)
                        score = min(1.0, interaction_count / 10)  # Normalize by max expected interactions
                        
                        reasoning = f"Users with similar interests viewed this document ({interaction_count} interactions)"
                        
                        rec = DocumentRecommendation(
                            recommendation_id=str(uuid.uuid4()),
                            document_id=doc['id'],
                            title=doc['title'],
                            path=doc['path'],
                            recommendation_type=RecommendationType.PERSONALIZED,
                            score=score,
                            reasoning=reasoning,
                            metadata={
                                'similar_user_interactions': interaction_count,
                                'avg_duration': doc.get('avg_duration', 0),
                                'interaction_types': doc.get('interaction_types', '').split(',')
                            }
                        )
                        recommendations.append(rec)
        
        return recommendations
    
    async def _get_ai_curated_recommendations(
        self, 
        user_id: str, 
        user_profile: Dict, 
        limit: int
    ) -> List[DocumentRecommendation]:
        """Get AI-curated recommendations using advanced heuristics."""
        
        recommendations = []
        
        # Combine multiple signals for AI curation
        preferred_topics = user_profile.get('preferred_topics', {})
        engagement_level = user_profile.get('engagement_level', 0.5)
        
        if preferred_topics:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    # Find documents that match user's topic preferences with high confidence
                    await cursor.execute("""
                        SELECT d.*, dt.topic_name, dt.confidence_score,
                               AVG(ui2.interaction_duration_seconds) as community_avg_duration,
                               COUNT(DISTINCT ui2.user_id) as community_users
                        FROM corp_docs d
                        JOIN document_topics dt ON d.id = dt.document_id
                        LEFT JOIN user_document_interactions ui2 ON d.id = ui2.document_id
                        WHERE dt.topic_name IN %s
                        AND dt.confidence_score >= 0.7
                        AND d.id NOT IN (
                            SELECT DISTINCT document_id FROM user_document_interactions 
                            WHERE user_id = %s AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                        )
                        AND d.created_at >= DATE_SUB(NOW(), INTERVAL 180 DAY)
                        GROUP BY d.id, dt.topic_name, dt.confidence_score
                        HAVING community_users >= 1
                        ORDER BY dt.confidence_score DESC, community_avg_duration DESC
                        LIMIT %s
                    """, (tuple(preferred_topics.keys()), user_id, limit * 2))
                    
                    ai_docs = await cursor.fetchall()
                    
                    for doc in ai_docs:
                        topic_name = doc.get('topic_name', '')
                        topic_preference = preferred_topics.get(topic_name, 0)
                        confidence = doc.get('confidence_score', 0)
                        community_duration = doc.get('community_avg_duration', 0) or 0
                        
                        # AI scoring algorithm combining multiple factors
                        ai_score = (
                            topic_preference * 0.4 +  # User preference for this topic
                            confidence * 0.3 +         # AI confidence in topic extraction
                            min(1.0, community_duration / 300) * 0.2 +  # Community engagement (5min max)
                            engagement_level * 0.1     # User's general engagement level
                        )
                        
                        reasoning = f"AI-curated based on your interest in {topic_name} (confidence: {confidence:.2f})"
                        
                        rec = DocumentRecommendation(
                            recommendation_id=str(uuid.uuid4()),
                            document_id=doc['id'],
                            title=doc['title'],
                            path=doc['path'],
                            recommendation_type=RecommendationType.AI_CURATED,
                            score=ai_score,
                            reasoning=reasoning,
                            metadata={
                                'topic_match': topic_name,
                                'topic_confidence': confidence,
                                'user_topic_preference': topic_preference,
                                'community_engagement': community_duration
                            }
                        )
                        recommendations.append(rec)
                        
                        if len(recommendations) >= limit:
                            break
        
        return recommendations
    
    async def _find_similar_documents(
        self, 
        document_id: int, 
        limit: int
    ) -> List[Tuple[int, float, Dict]]:
        """Find documents similar to the given document."""
        
        similar_docs = []
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                # Check for pre-computed similarities
                await cursor.execute("""
                    SELECT ds.document_id_2 as doc_id, ds.similarity_score, d.title, d.path
                    FROM document_similarities ds
                    JOIN corp_docs d ON ds.document_id_2 = d.id
                    WHERE ds.document_id_1 = %s
                    AND ds.similarity_score >= 0.3
                    ORDER BY ds.similarity_score DESC
                    LIMIT %s
                """, (document_id, limit))
                
                similarities = await cursor.fetchall()
                
                for sim in similarities:
                    similar_docs.append((
                        sim['doc_id'],
                        sim['similarity_score'],
                        {'title': sim['title'], 'path': sim['path']}
                    ))
        
        # If no pre-computed similarities, compute on-the-fly using topic overlap
        if not similar_docs:
            similar_docs = await self._compute_topic_similarity(document_id, limit)
        
        return similar_docs
    
    async def _find_similar_users(
        self, 
        user_id: str, 
        user_profile: Dict
    ) -> List[Tuple[str, float]]:
        """Find users with similar interaction patterns."""
        
        similar_users = []
        user_topics = user_profile.get('preferred_topics', {})
        
        if not user_topics:
            return similar_users
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                # Find users who interacted with documents on similar topics
                await cursor.execute("""
                    SELECT ui.user_id, COUNT(*) as common_topics,
                           COUNT(DISTINCT ui.document_id) as doc_count,
                           AVG(ui.interaction_duration_seconds) as avg_duration
                    FROM user_document_interactions ui
                    JOIN document_topics dt ON ui.document_id = dt.document_id
                    WHERE dt.topic_name IN %s
                    AND ui.user_id != %s
                    AND ui.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
                    GROUP BY ui.user_id
                    HAVING common_topics >= 2 AND doc_count >= 3
                    ORDER BY common_topics DESC, avg_duration DESC
                    LIMIT 20
                """, (tuple(user_topics.keys()), user_id))
                
                potential_similar_users = await cursor.fetchall()
                
                for user in potential_similar_users:
                    # Calculate similarity score based on topic overlap and behavior
                    similarity_score = min(1.0, user['common_topics'] / len(user_topics))
                    similar_users.append((user['user_id'], similarity_score))
        
        return sorted(similar_users, key=lambda x: x[1], reverse=True)
    
    async def _store_recommendations(self, recommendations: List[DocumentRecommendation]) -> None:
        """Store recommendations in the database."""
        
        if not recommendations:
            return
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                values = []
                for rec in recommendations:
                    values.append((
                        rec.recommendation_id,
                        # Extract user_id from first recommendation (they're all for same user)
                        'admin',  # This should be passed as parameter
                        rec.document_id,
                        rec.recommendation_type.value,
                        rec.score,
                        rec.reasoning,
                        rec.source_document_id,
                        '1.0',  # algorithm_version
                        datetime.now() + timedelta(days=7),  # expires_at
                        json.dumps(rec.metadata)
                    ))
                
                await cursor.executemany("""
                    INSERT INTO document_recommendations 
                    (recommendation_id, user_id, document_id, recommendation_type,
                     recommendation_score, reasoning, source_document_id, algorithm_version,
                     expires_at, metadata)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, values)
                
                await conn.commit()
    
    def _get_default_profile(self) -> Dict[str, Any]:
        """Get default user profile for new users."""
        return {
            'user_id': '',
            'interaction_count': 0,
            'preferred_topics': {},
            'interaction_patterns': {},
            'compliance_frameworks': ['GDPR', 'SOX'],  # Default frameworks
            'document_preferences': {},
            'temporal_patterns': {},
            'engagement_level': 0.5,
            'last_updated': datetime.now()
        }
    
    def _analyze_session_patterns(self, interactions: List[Dict]) -> Dict[str, Any]:
        """Analyze user's session behavior patterns."""
        sessions = defaultdict(list)
        
        for interaction in interactions:
            session_id = interaction.get('session_id', 'unknown')
            sessions[session_id].append(interaction)
        
        if not sessions:
            return {}
        
        avg_session_length = sum(len(docs) for docs in sessions.values()) / len(sessions)
        avg_session_duration = 0
        
        for session_docs in sessions.values():
            session_duration = sum(
                doc.get('interaction_duration_seconds', 0) for doc in session_docs
            )
            avg_session_duration += session_duration
        
        avg_session_duration /= len(sessions) if sessions else 1
        
        return {
            'avg_documents_per_session': avg_session_length,
            'avg_session_duration_seconds': avg_session_duration,
            'total_sessions': len(sessions)
        }
    
    def _extract_time_preferences(self, interactions: List[Dict]) -> Dict[str, int]:
        """Extract user's preferred interaction times."""
        hour_counts = defaultdict(int)
        
        for interaction in interactions:
            created_at = interaction.get('created_at')
            if created_at:
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                hour_counts[created_at.hour] += 1
        
        # Return top 3 preferred hours
        top_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        return dict(top_hours)
    
    def _analyze_document_preferences(self, interactions: List[Dict]) -> Dict[str, Any]:
        """Analyze user's document type and format preferences."""
        doc_types = defaultdict(int)
        paths = []
        
        for interaction in interactions:
            path = interaction.get('path', '')
            paths.append(path)
            
            # Extract file extension
            if '.' in path:
                ext = path.split('.')[-1].lower()
                doc_types[ext] += 1
        
        return {
            'preferred_file_types': dict(Counter(doc_types).most_common(5)),
            'avg_path_length': sum(len(p) for p in paths) / len(paths) if paths else 0,
            'path_patterns': self._extract_path_patterns(paths)
        }
    
    def _extract_path_patterns(self, paths: List[str]) -> List[str]:
        """Extract common path patterns from user interactions."""
        patterns = []
        
        # Extract directory patterns
        dirs = []
        for path in paths:
            parts = path.split('/')
            if len(parts) > 1:
                dirs.append('/'.join(parts[:-1]))  # Directory without filename
        
        if dirs:
            common_dirs = Counter(dirs).most_common(3)
            patterns.extend([dir_path for dir_path, _ in common_dirs])
        
        return patterns
    
    def _analyze_temporal_patterns(self, interactions: List[Dict]) -> Dict[str, Any]:
        """Analyze when user typically interacts with documents."""
        if not interactions:
            return {}
        
        # Group by day of week and hour
        weekday_counts = defaultdict(int)
        hour_counts = defaultdict(int)
        
        for interaction in interactions:
            created_at = interaction.get('created_at')
            if created_at:
                if isinstance(created_at, str):
                    try:
                        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    except:
                        continue
                
                weekday_counts[created_at.strftime('%A')] += 1
                hour_counts[created_at.hour] += 1
        
        return {
            'most_active_weekday': max(weekday_counts, key=weekday_counts.get) if weekday_counts else None,
            'most_active_hour': max(hour_counts, key=hour_counts.get) if hour_counts else None,
            'weekday_distribution': dict(weekday_counts),
            'hour_distribution': dict(hour_counts)
        }
    
    def _calculate_engagement_level(self, interactions: List[Dict]) -> float:
        """Calculate user's overall engagement level."""
        if not interactions:
            return 0.5
        
        total_duration = sum(i.get('interaction_duration_seconds', 0) for i in interactions)
        avg_duration = total_duration / len(interactions)
        
        # High-engagement interaction types
        high_engagement_types = {'analyze', 'download', 'bookmark', 'share', 'comment'}
        high_engagement_count = sum(
            1 for i in interactions 
            if i.get('interaction_type') in high_engagement_types
        )
        
        # Detailed interaction depths
        detailed_depths = {'detailed_review', 'analysis'}
        detailed_count = sum(
            1 for i in interactions 
            if i.get('interaction_depth') in detailed_depths
        )
        
        # Normalize engagement score
        duration_score = min(1.0, avg_duration / 300)  # 5 minutes max
        type_score = min(1.0, high_engagement_count / len(interactions))
        depth_score = min(1.0, detailed_count / len(interactions))
        
        engagement_level = (duration_score + type_score + depth_score) / 3
        return round(engagement_level, 2)
    
    async def _compute_topic_similarity(
        self, 
        document_id: int, 
        limit: int
    ) -> List[Tuple[int, float, Dict]]:
        """Compute document similarity based on topic overlap."""
        
        similar_docs = []
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                # Get topics for the base document
                await cursor.execute("""
                    SELECT topic_name, confidence_score 
                    FROM document_topics 
                    WHERE document_id = %s
                """, (document_id,))
                
                base_topics = {
                    row['topic_name']: row['confidence_score'] 
                    for row in await cursor.fetchall()
                }
                
                if base_topics:
                    # Find documents with overlapping topics
                    await cursor.execute("""
                        SELECT dt.document_id, dt.topic_name, dt.confidence_score,
                               d.title, d.path
                        FROM document_topics dt
                        JOIN corp_docs d ON dt.document_id = d.id
                        WHERE dt.topic_name IN %s 
                        AND dt.document_id != %s
                        ORDER BY dt.confidence_score DESC
                    """, (tuple(base_topics.keys()), document_id))
                    
                    candidate_docs = await cursor.fetchall()
                    
                    # Group by document and calculate similarity
                    doc_topics = defaultdict(dict)
                    doc_info = {}
                    
                    for row in candidate_docs:
                        doc_id = row['document_id']
                        doc_topics[doc_id][row['topic_name']] = row['confidence_score']
                        doc_info[doc_id] = {'title': row['title'], 'path': row['path']}
                    
                    # Calculate Jaccard similarity for each document
                    for doc_id, topics in doc_topics.items():
                        similarity = self._calculate_topic_similarity(base_topics, topics)
                        if similarity > 0.1:  # Minimum similarity threshold
                            similar_docs.append((doc_id, similarity, doc_info[doc_id]))
                    
                    # Sort by similarity and limit results
                    similar_docs.sort(key=lambda x: x[1], reverse=True)
                    similar_docs = similar_docs[:limit]
        
        return similar_docs
    
    def _calculate_topic_similarity(
        self, 
        topics1: Dict[str, float], 
        topics2: Dict[str, float]
    ) -> float:
        """Calculate similarity between two sets of topics using weighted Jaccard similarity."""
        
        common_topics = set(topics1.keys()) & set(topics2.keys())
        all_topics = set(topics1.keys()) | set(topics2.keys())
        
        if not all_topics:
            return 0.0
        
        # Weighted similarity based on confidence scores
        intersection_weight = sum(
            min(topics1[topic], topics2[topic]) for topic in common_topics
        )
        union_weight = sum(
            max(topics1.get(topic, 0), topics2.get(topic, 0)) for topic in all_topics
        )
        
        return intersection_weight / union_weight if union_weight > 0 else 0.0
    
    async def _get_user_preferred_types(self, user_id: str) -> List[RecommendationType]:
        """Get user's preferred recommendation types from settings."""
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute("""
                    SELECT preferred_recommendation_types 
                    FROM user_recommendation_preferences 
                    WHERE user_id = %s
                """, (user_id,))
                
                result = await cursor.fetchone()
                if result and result[0]:
                    try:
                        pref_types = json.loads(result[0])
                        return [RecommendationType(t) for t in pref_types if t in RecommendationType.__members__]
                    except:
                        pass
        
        # Default recommendation types
        return [
            RecommendationType.PERSONALIZED,
            RecommendationType.COMPLIANCE_RELATED,
            RecommendationType.TRENDING,
            RecommendationType.SIMILAR_CONTENT
        ]


# Global recommendation engine instance
recommendation_engine = RecommendationEngine()