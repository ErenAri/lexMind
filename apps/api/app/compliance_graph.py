"""
Compliance Graph Relationships System
Advanced knowledge graph for regulatory compliance connections
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal, Tuple
from datetime import datetime
import json
import logging
import networkx as nx
from collections import defaultdict
import asyncio

from .deps_serverless import execute_read_optimized, execute_write_primary
from .auth import get_current_active_user, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/graph", tags=["Compliance Graph"])

# ============================================================
# PYDANTIC MODELS
# ============================================================

class GraphNode(BaseModel):
    id: str
    type: Literal["regulation", "document", "policy", "control", "risk"]
    title: str
    metadata: Dict[str, Any] = {}
    
class GraphEdge(BaseModel):
    source: str
    target: str
    relationship: Literal[
        "references", "conflicts", "supersedes", "implements", 
        "complies_with", "derives_from", "maps_to", "depends_on",
        "mitigates", "requires", "supports"
    ]
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: Optional[str] = None
    weight: float = Field(default=1.0, ge=0.0, le=10.0)

class ComplianceGraph(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    metadata: Dict[str, Any] = {}

class GraphAnalysis(BaseModel):
    node_count: int
    edge_count: int
    connected_components: int
    most_connected_nodes: List[Dict[str, Any]]
    critical_paths: List[List[str]]
    compliance_gaps: List[Dict[str, Any]]
    risk_propagation: List[Dict[str, Any]]

class GraphTraversal(BaseModel):
    path: List[str]
    path_confidence: float
    relationship_chain: List[str]
    total_distance: float
    
class RegulatoryImpactAnalysis(BaseModel):
    regulation_id: str
    regulation_title: str
    direct_impacts: List[Dict[str, Any]]
    indirect_impacts: List[Dict[str, Any]]
    cascade_analysis: Dict[str, Any]
    risk_amplification: float
    compliance_burden_score: float

# ============================================================
# GRAPH CONSTRUCTION
# ============================================================

@router.get("/build", response_model=ComplianceGraph)
async def build_compliance_graph(
    include_predictions: bool = Query(True),
    confidence_threshold: float = Query(0.5, ge=0.0, le=1.0)
):
    """
    Build comprehensive compliance graph from all relationships
    Creates nodes for regulations, documents, policies and their connections
    """
    
    try:
        # Get all graph relationships
        relationships_query = await execute_read_optimized(
            """SELECT 
                   source_type, source_id, target_type, target_id, 
                   relationship_type, confidence, evidence_text,
                   created_by, created_at, validated_by
               FROM compliance_graph 
               WHERE confidence >= %s
               ORDER BY confidence DESC""",
            [confidence_threshold]
        )
        
        # Get node metadata
        nodes_queries = await asyncio.gather(
            # Regulations as nodes
            execute_read_optimized(
                """SELECT regulation_code as id, regulation_name as title, 
                          'regulation' as type, complexity_score, sector, jurisdiction
                   FROM demo_regulations""",
                []
            ),
            
            # Documents as nodes  
            execute_read_optimized(
                """SELECT DISTINCT document_path as id, 
                          COALESCE(dm.display_name, SUBSTRING_INDEX(document_path, '/', -1)) as title,
                          'document' as type, dm.description, dm.resolved
                   FROM documents_partitioned dp
                   LEFT JOIN documents_meta dm ON dp.document_path = dm.path
                   LIMIT 1000""", # Limit for performance
                []
            ),
            
            # Risk assessments as nodes
            execute_read_optimized(
                """SELECT CONCAT('risk_', id) as id, 
                          CONCAT('Risk Assessment: ', document_path) as title,
                          'risk' as type, risk_category, risk_score, mitigation_status
                   FROM risk_assessments 
                   WHERE risk_category IN ('high', 'critical')
                   ORDER BY risk_score DESC
                   LIMIT 500""",
                []
            )
        )
        
        regulations_data, documents_data, risks_data = nodes_queries
        
        # Build nodes list
        nodes = []
        
        # Add regulation nodes
        for reg in regulations_data:
            nodes.append(GraphNode(
                id=reg['id'],
                type="regulation",
                title=reg['title'],
                metadata={
                    "complexity_score": reg.get('complexity_score', 5),
                    "sector": reg.get('sector', 'general'),
                    "jurisdiction": reg.get('jurisdiction', 'unknown')
                }
            ))
        
        # Add document nodes
        for doc in documents_data:
            nodes.append(GraphNode(
                id=doc['id'],
                type="document", 
                title=doc['title'],
                metadata={
                    "description": doc.get('description', ''),
                    "resolved": bool(doc.get('resolved', False))
                }
            ))
        
        # Add risk nodes
        for risk in risks_data:
            nodes.append(GraphNode(
                id=risk['id'],
                type="risk",
                title=risk['title'],
                metadata={
                    "risk_category": risk['risk_category'],
                    "risk_score": float(risk['risk_score']),
                    "mitigation_status": risk['mitigation_status']
                }
            ))
        
        # Build edges list
        edges = []
        for rel in relationships_query:
            edges.append(GraphEdge(
                source=rel['source_id'],
                target=rel['target_id'],
                relationship=rel['relationship_type'],
                confidence=float(rel['confidence']),
                evidence=rel['evidence_text'],
                weight=float(rel['confidence']) * 10  # Scale confidence to weight
            ))
        
        # Add predicted relationships if enabled
        if include_predictions:
            predicted_edges = await generate_predicted_relationships(nodes, confidence_threshold)
            edges.extend(predicted_edges)
        
        # Build graph metadata
        metadata = {
            "built_at": datetime.now().isoformat(),
            "confidence_threshold": confidence_threshold,
            "include_predictions": include_predictions,
            "total_relationships": len(relationships_query),
            "predicted_relationships": len(edges) - len(relationships_query) if include_predictions else 0
        }
        
        return ComplianceGraph(
            nodes=nodes,
            edges=edges,
            metadata=metadata
        )
        
    except Exception as e:
        logger.error(f"Graph building failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to build graph: {str(e)}")

async def generate_predicted_relationships(
    nodes: List[GraphNode], 
    confidence_threshold: float
) -> List[GraphEdge]:
    """Generate predicted relationships using content similarity and patterns"""
    
    predicted_edges = []
    
    try:
        # Simple content-based predictions (in production, would use ML models)
        regulation_nodes = [n for n in nodes if n.type == "regulation"]
        document_nodes = [n for n in nodes if n.type == "document"]
        
        # Predict regulation-document relationships based on title similarity
        for reg in regulation_nodes[:10]:  # Limit for performance
            reg_keywords = set(reg.title.lower().split())
            
            for doc in document_nodes[:20]:  # Limit for performance
                doc_keywords = set(doc.title.lower().split())
                
                # Simple Jaccard similarity
                intersection = len(reg_keywords.intersection(doc_keywords))
                union = len(reg_keywords.union(doc_keywords))
                
                if union > 0:
                    similarity = intersection / union
                    
                    if similarity > confidence_threshold:
                        predicted_edges.append(GraphEdge(
                            source=reg.id,
                            target=doc.id,
                            relationship="maps_to",
                            confidence=similarity,
                            evidence=f"Predicted based on title similarity ({similarity:.2f})",
                            weight=similarity * 5  # Lower weight for predictions
                        ))
        
        logger.info(f"Generated {len(predicted_edges)} predicted relationships")
        return predicted_edges
        
    except Exception as e:
        logger.error(f"Relationship prediction failed: {e}")
        return []

# ============================================================
# GRAPH ANALYSIS
# ============================================================

@router.get("/analyze", response_model=GraphAnalysis)
async def analyze_compliance_graph(confidence_threshold: float = Query(0.5)):
    """
    Comprehensive graph analysis for compliance insights
    Identifies key nodes, paths, gaps, and risk propagation
    """
    
    try:
        # Build the graph first
        graph_data = await build_compliance_graph(
            include_predictions=False,
            confidence_threshold=confidence_threshold
        )
        
        # Create NetworkX graph for analysis
        G = nx.DiGraph()
        
        # Add nodes
        for node in graph_data.nodes:
            G.add_node(node.id, **node.metadata, type=node.type, title=node.title)
        
        # Add edges
        for edge in graph_data.edges:
            G.add_edge(
                edge.source, edge.target,
                relationship=edge.relationship,
                confidence=edge.confidence,
                weight=edge.weight
            )
        
        # Perform graph analysis
        analysis = perform_graph_analysis(G)
        
        return analysis
        
    except Exception as e:
        logger.error(f"Graph analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

def perform_graph_analysis(G: nx.DiGraph) -> GraphAnalysis:
    """Perform comprehensive graph analysis using NetworkX"""
    
    # Basic graph statistics
    node_count = G.number_of_nodes()
    edge_count = G.number_of_edges()
    connected_components = nx.number_weakly_connected_components(G)
    
    # Find most connected nodes (by degree centrality)
    degree_centrality = nx.degree_centrality(G)
    most_connected = sorted(
        [(node, centrality) for node, centrality in degree_centrality.items()],
        key=lambda x: x[1],
        reverse=True
    )[:10]
    
    most_connected_nodes = []
    for node_id, centrality in most_connected:
        node_data = G.nodes[node_id]
        most_connected_nodes.append({
            "node_id": node_id,
            "title": node_data.get('title', node_id),
            "type": node_data.get('type', 'unknown'),
            "centrality_score": centrality,
            "connection_count": G.degree[node_id]
        })
    
    # Find critical paths (shortest paths between key nodes)
    critical_paths = []
    regulation_nodes = [n for n, d in G.nodes(data=True) if d.get('type') == 'regulation']
    document_nodes = [n for n, d in G.nodes(data=True) if d.get('type') == 'document']
    
    # Sample a few critical paths
    for reg in regulation_nodes[:3]:
        for doc in document_nodes[:3]:
            try:
                if nx.has_path(G, reg, doc):
                    path = nx.shortest_path(G, reg, doc)
                    if len(path) > 2:  # Only include multi-hop paths
                        critical_paths.append(path)
            except nx.NetworkXNoPath:
                continue
    
    # Identify compliance gaps (isolated or weakly connected components)
    compliance_gaps = []
    weak_components = list(nx.weakly_connected_components(G))
    
    for component in weak_components:
        if len(component) < 3:  # Small isolated components
            gap_nodes = []
            for node_id in component:
                node_data = G.nodes[node_id]
                gap_nodes.append({
                    "node_id": node_id,
                    "title": node_data.get('title', node_id),
                    "type": node_data.get('type', 'unknown')
                })
            
            if gap_nodes:
                compliance_gaps.append({
                    "gap_type": "isolated_component",
                    "affected_nodes": gap_nodes,
                    "severity": "high" if any(n['type'] == 'regulation' for n in gap_nodes) else "medium"
                })
    
    # Risk propagation analysis
    risk_propagation = []
    risk_nodes = [n for n, d in G.nodes(data=True) if d.get('type') == 'risk']
    
    for risk_node in risk_nodes[:5]:  # Analyze top 5 risks
        risk_data = G.nodes[risk_node]
        
        # Find nodes reachable from this risk
        reachable = nx.descendants(G, risk_node)
        
        if reachable:
            risk_propagation.append({
                "risk_node": risk_node,
                "risk_title": risk_data.get('title', risk_node),
                "risk_score": risk_data.get('risk_score', 0),
                "affected_nodes_count": len(reachable),
                "propagation_distance": max([
                    nx.shortest_path_length(G, risk_node, target) 
                    for target in list(reachable)[:10]  # Sample for performance
                ]) if reachable else 0
            })
    
    return GraphAnalysis(
        node_count=node_count,
        edge_count=edge_count,
        connected_components=connected_components,
        most_connected_nodes=most_connected_nodes,
        critical_paths=critical_paths,
        compliance_gaps=compliance_gaps,
        risk_propagation=risk_propagation
    )

# ============================================================
# GRAPH TRAVERSAL AND PATHFINDING
# ============================================================

@router.get("/path/{source}/{target}", response_model=List[GraphTraversal])
async def find_compliance_path(
    source: str,
    target: str,
    max_paths: int = Query(3, le=10),
    max_length: int = Query(6, le=10)
):
    """
    Find compliance paths between two entities
    Useful for understanding regulatory connections and dependencies
    """
    
    try:
        # Build graph
        graph_data = await build_compliance_graph(confidence_threshold=0.3)
        
        # Create NetworkX graph
        G = nx.DiGraph()
        
        for node in graph_data.nodes:
            G.add_node(node.id, **node.metadata)
            
        for edge in graph_data.edges:
            G.add_edge(
                edge.source, edge.target,
                relationship=edge.relationship,
                confidence=edge.confidence,
                weight=1.0 / edge.confidence  # Invert for shortest path (higher confidence = shorter path)
            )
        
        # Find paths
        paths = []
        
        try:
            # Find all simple paths up to max_length
            all_paths = list(nx.all_simple_paths(G, source, target, cutoff=max_length))
            
            # Sort by path quality (confidence and length)
            scored_paths = []
            for path in all_paths:
                path_confidence = calculate_path_confidence(G, path)
                path_distance = calculate_path_distance(G, path)
                
                scored_paths.append((path, path_confidence, path_distance))
            
            # Sort by confidence (descending) and distance (ascending)
            scored_paths.sort(key=lambda x: (-x[1], x[2]))
            
            # Build traversal objects
            for path, confidence, distance in scored_paths[:max_paths]:
                relationship_chain = []
                for i in range(len(path) - 1):
                    edge_data = G.edges[path[i], path[i + 1]]
                    relationship_chain.append(edge_data['relationship'])
                
                paths.append(GraphTraversal(
                    path=path,
                    path_confidence=confidence,
                    relationship_chain=relationship_chain,
                    total_distance=distance
                ))
                
        except nx.NetworkXNoPath:
            # No paths found
            pass
        
        return paths
        
    except Exception as e:
        logger.error(f"Path finding failed: {e}")
        raise HTTPException(status_code=500, detail=f"Path finding failed: {str(e)}")

def calculate_path_confidence(G: nx.DiGraph, path: List[str]) -> float:
    """Calculate overall confidence for a path"""
    confidences = []
    for i in range(len(path) - 1):
        edge_data = G.edges[path[i], path[i + 1]]
        confidences.append(edge_data['confidence'])
    
    if not confidences:
        return 0.0
    
    # Use geometric mean for path confidence
    confidence_product = 1.0
    for conf in confidences:
        confidence_product *= conf
    
    return confidence_product ** (1.0 / len(confidences))

def calculate_path_distance(G: nx.DiGraph, path: List[str]) -> float:
    """Calculate total weighted distance for a path"""
    total_distance = 0.0
    for i in range(len(path) - 1):
        edge_data = G.edges[path[i], path[i + 1]]
        total_distance += edge_data['weight']
    
    return total_distance

# ============================================================
# REGULATORY IMPACT ANALYSIS
# ============================================================

@router.get("/impact/{regulation_id}", response_model=RegulatoryImpactAnalysis)
async def analyze_regulatory_impact(regulation_id: str):
    """
    Analyze the impact of a specific regulation across the compliance graph
    Shows direct and indirect effects, cascade analysis
    """
    
    try:
        # Build graph centered around this regulation
        graph_data = await build_compliance_graph(confidence_threshold=0.3)
        
        G = nx.DiGraph()
        
        for node in graph_data.nodes:
            G.add_node(node.id, **node.metadata, title=node.title)
            
        for edge in graph_data.edges:
            G.add_edge(edge.source, edge.target, **edge.dict())
        
        # Check if regulation exists in graph
        if regulation_id not in G.nodes:
            raise HTTPException(status_code=404, detail="Regulation not found in graph")
        
        regulation_title = G.nodes[regulation_id].get('title', regulation_id)
        
        # Find direct impacts (immediate neighbors)
        direct_neighbors = list(G.neighbors(regulation_id))
        direct_impacts = []
        
        for neighbor in direct_neighbors:
            neighbor_data = G.nodes[neighbor]
            edge_data = G.edges[regulation_id, neighbor]
            
            direct_impacts.append({
                "node_id": neighbor,
                "title": neighbor_data.get('title', neighbor),
                "type": neighbor_data.get('type', 'unknown'),
                "relationship": edge_data['relationship'],
                "confidence": edge_data['confidence'],
                "impact_level": categorize_impact(edge_data['confidence'])
            })
        
        # Find indirect impacts (2+ hops away)
        all_reachable = nx.descendants(G, regulation_id)
        indirect_nodes = all_reachable - set(direct_neighbors)
        indirect_impacts = []
        
        for node in list(indirect_nodes)[:20]:  # Limit for performance
            node_data = G.nodes[node]
            try:
                path_length = nx.shortest_path_length(G, regulation_id, node)
                path_confidence = calculate_path_confidence(
                    G, nx.shortest_path(G, regulation_id, node)
                )
                
                indirect_impacts.append({
                    "node_id": node,
                    "title": node_data.get('title', node),
                    "type": node_data.get('type', 'unknown'),
                    "path_length": path_length,
                    "path_confidence": path_confidence,
                    "impact_level": categorize_impact(path_confidence)
                })
            except nx.NetworkXNoPath:
                continue
        
        # Sort by impact level and confidence
        indirect_impacts.sort(key=lambda x: (-x['path_confidence'], x['path_length']))
        indirect_impacts = indirect_impacts[:10]  # Top 10 indirect impacts
        
        # Cascade analysis
        cascade_analysis = {
            "total_reachable_nodes": len(all_reachable),
            "max_cascade_depth": max([
                nx.shortest_path_length(G, regulation_id, node)
                for node in list(all_reachable)[:50]  # Sample for performance
            ]) if all_reachable else 0,
            "cascade_by_type": {},
            "high_impact_cascade_count": len([
                impact for impact in direct_impacts + indirect_impacts 
                if impact.get('impact_level') == 'high'
            ])
        }
        
        # Group cascade by node type
        for node in all_reachable:
            node_type = G.nodes[node].get('type', 'unknown')
            cascade_analysis['cascade_by_type'][node_type] = cascade_analysis['cascade_by_type'].get(node_type, 0) + 1
        
        # Calculate risk amplification (based on connected risk nodes)
        connected_risks = [
            node for node in all_reachable 
            if G.nodes[node].get('type') == 'risk'
        ]
        
        risk_scores = [
            G.nodes[node].get('risk_score', 0) 
            for node in connected_risks
        ]
        
        risk_amplification = sum(risk_scores) / len(risk_scores) if risk_scores else 0.0
        
        # Calculate compliance burden score
        compliance_burden_score = (
            len(direct_impacts) * 1.0 +
            len(indirect_impacts) * 0.5 +
            cascade_analysis['max_cascade_depth'] * 0.3
        )
        
        return RegulatoryImpactAnalysis(
            regulation_id=regulation_id,
            regulation_title=regulation_title,
            direct_impacts=direct_impacts,
            indirect_impacts=indirect_impacts,
            cascade_analysis=cascade_analysis,
            risk_amplification=risk_amplification,
            compliance_burden_score=compliance_burden_score
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Regulatory impact analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Impact analysis failed: {str(e)}")

def categorize_impact(confidence: float) -> str:
    """Categorize impact level based on confidence score"""
    if confidence >= 0.8:
        return "high"
    elif confidence >= 0.6:
        return "medium"
    else:
        return "low"

# ============================================================
# GRAPH RELATIONSHIP MANAGEMENT
# ============================================================

@router.post("/relationships")
async def create_relationship(
    source_type: Literal["regulation", "document", "policy", "control"],
    source_id: str,
    target_type: Literal["regulation", "document", "policy", "control"],
    target_id: str,
    relationship_type: Literal[
        "references", "conflicts", "supersedes", "implements", 
        "complies_with", "derives_from", "maps_to", "depends_on"
    ],
    confidence: float = Query(..., ge=0.0, le=1.0),
    evidence_text: Optional[str] = None,
    current_user: User = Depends(get_current_active_user)
):
    """Create a new relationship in the compliance graph"""
    
    try:
        # Check if relationship already exists
        existing = await execute_read_optimized(
            """SELECT id FROM compliance_graph 
               WHERE source_type = %s AND source_id = %s 
               AND target_type = %s AND target_id = %s 
               AND relationship_type = %s""",
            [source_type, source_id, target_type, target_id, relationship_type]
        )
        
        if existing:
            raise HTTPException(status_code=409, detail="Relationship already exists")
        
        # Create new relationship
        await execute_write_primary(
            """INSERT INTO compliance_graph 
               (source_type, source_id, target_type, target_id, relationship_type, 
                confidence, evidence_text, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            [source_type, source_id, target_type, target_id, relationship_type,
             confidence, evidence_text, current_user.username]
        )
        
        return {
            "message": "Relationship created successfully",
            "relationship": {
                "source": f"{source_type}:{source_id}",
                "target": f"{target_type}:{target_id}",
                "type": relationship_type,
                "confidence": confidence
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Relationship creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create relationship: {str(e)}")

@router.delete("/relationships/{relationship_id}")
async def delete_relationship(
    relationship_id: int,
    current_user: User = Depends(get_current_active_user)
):
    """Delete a relationship from the compliance graph"""
    
    try:
        # Check if relationship exists
        existing = await execute_read_optimized(
            "SELECT id, created_by FROM compliance_graph WHERE id = %s",
            [relationship_id]
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Relationship not found")
        
        # Check permissions (only creator or admin can delete)
        if existing[0]['created_by'] != current_user.username and current_user.role != 'admin':
            raise HTTPException(status_code=403, detail="Not authorized to delete this relationship")
        
        # Delete relationship
        await execute_write_primary(
            "DELETE FROM compliance_graph WHERE id = %s",
            [relationship_id]
        )
        
        return {"message": "Relationship deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Relationship deletion failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete relationship: {str(e)}")