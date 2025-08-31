import os
import ssl
import time
import logging
import asyncio
from typing import Optional, Sequence, Any, List, Dict, Tuple
from dataclasses import dataclass
from enum import Enum
import aiomysql
from aiomysql.cursors import DictCursor
from dotenv import load_dotenv
import json
from datetime import datetime, timedelta
import hashlib

logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

class QueryType(Enum):
    READ = "read"
    WRITE = "write"
    ANALYTICS = "analytics"

@dataclass
class QueryMetrics:
    query_hash: str
    execution_time: float
    row_count: int
    query_type: QueryType
    timestamp: datetime
    region: str

@dataclass
class EdgeRegion:
    name: str
    endpoint: str
    latency_ms: float
    available: bool = True

class TiDBServerlessManager:
    def __init__(self):
        self._pools: Dict[str, aiomysql.Pool] = {}
        self._query_metrics: List[QueryMetrics] = []
        self._edge_regions: List[EdgeRegion] = []
        self._cache: Dict[str, Tuple[Any, datetime]] = {}
        self._primary_region = os.getenv("TIDB_REGION", "us-west-2")
        self._initialize_edge_regions()

    def _initialize_edge_regions(self):
        """Initialize edge regions from environment"""
        edge_regions_str = os.getenv("TIDB_EDGE_REGIONS", "")
        if edge_regions_str:
            regions = edge_regions_str.split(",")
            for region in regions:
                # In a real implementation, you'd have different endpoints per region
                # For demo, we'll use the same endpoint but track the "preferred" region
                self._edge_regions.append(EdgeRegion(
                    name=region.strip(),
                    endpoint=os.getenv("TIDB_HOST") or "",
                    latency_ms=self._estimate_latency(region.strip())
                ))

    def _estimate_latency(self, region: str) -> float:
        """Simulate latency estimation for different regions"""
        latency_map = {
            "us-east-1": 25.0,
            "us-west-2": 15.0,  # Primary region
            "eu-west-1": 85.0,
            "ap-southeast-1": 120.0,
        }
        return latency_map.get(region, 50.0)

    def _get_cache_key(self, sql: str, params: Sequence[Any] | None) -> str:
        """Generate cache key for query"""
        content = f"{sql}:{params or []}"
        return hashlib.md5(content.encode()).hexdigest()

    def _is_cacheable_query(self, sql: str) -> bool:
        """Check if query can be cached"""
        sql_upper = sql.upper().strip()
        return (
            sql_upper.startswith("SELECT") and 
            "NOW()" not in sql_upper and 
            "RAND()" not in sql_upper and
            os.getenv("ENABLE_EDGE_CACHING", "false").lower() == "true"
        )

    def _get_from_cache(self, cache_key: str) -> Optional[List[Dict[str, Any]]]:
        """Get result from cache if valid"""
        if cache_key in self._cache:
            result, timestamp = self._cache[cache_key]
            ttl = int(os.getenv("CACHE_TTL_SECONDS", "300"))
            if datetime.now() - timestamp < timedelta(seconds=ttl):
                logger.info(f"Cache hit for query: {cache_key}")
                return result
            else:
                # Remove expired entry
                del self._cache[cache_key]
        return None

    def _store_in_cache(self, cache_key: str, result: List[Dict[str, Any]]):
        """Store result in cache"""
        self._cache[cache_key] = (result, datetime.now())

    def _determine_query_type(self, sql: str) -> QueryType:
        """Determine the type of SQL query"""
        sql_upper = sql.upper().strip()
        if sql_upper.startswith(("SELECT", "SHOW", "DESCRIBE", "EXPLAIN")):
            # Check if it's an analytics query (complex aggregations, joins)
            if any(keyword in sql_upper for keyword in ["GROUP BY", "HAVING", "SUM(", "COUNT(", "AVG(", "WITH"]):
                return QueryType.ANALYTICS
            return QueryType.READ
        return QueryType.WRITE

    async def get_pool(self, region: Optional[str] = None) -> aiomysql.Pool:
        """Get connection pool for specified region"""
        region = region or self._primary_region
        
        if region not in self._pools:
            ca_path = os.getenv("TIDB_CA_CERT")
            ssl_ctx = None
            
            if ca_path and os.path.exists(ca_path):
                ssl_ctx = ssl.create_default_context(cafile=ca_path)
            
            host = os.getenv("TIDB_HOST")
            if not host:
                raise RuntimeError("TIDB_HOST is not set. Add it to .env")

            pool_size = int(os.getenv("TIDB_CONNECTION_POOL_SIZE", "20"))
            max_idle = int(os.getenv("TIDB_MAX_IDLE_CONNECTIONS", "5"))
            
            self._pools[region] = await aiomysql.create_pool(
                host=host,
                port=int(os.getenv("TIDB_PORT", "4000")),
                user=os.getenv("TIDB_USER"),
                password=os.getenv("TIDB_PASSWORD", ""),
                db=os.getenv("TIDB_DATABASE", "lexmind"),
                ssl=ssl_ctx,
                cursorclass=DictCursor,
                minsize=max_idle,
                maxsize=pool_size,
                autocommit=True,
                connect_timeout=int(os.getenv("TIDB_CONNECTION_TIMEOUT", "30")),
                echo=os.getenv("LOG_ALL_QUERIES", "false").lower() == "true"
            )
            
            logger.info(f"Created TiDB Serverless pool for region {region} with {pool_size} max connections")
        
        return self._pools[region]

    async def execute_optimized(
        self, 
        sql: str, 
        params: Sequence[Any] | None = None,
        region: Optional[str] = None,
        force_primary: bool = False
    ) -> List[Dict[str, Any]]:
        """Execute query with serverless optimizations"""
        start_time = time.time()
        query_type = self._determine_query_type(sql)
        
        # Check cache for read queries
        cache_key = None
        if query_type == QueryType.READ and self._is_cacheable_query(sql):
            cache_key = self._get_cache_key(sql, params)
            cached_result = self._get_from_cache(cache_key)
            if cached_result is not None:
                return cached_result

        # Choose optimal region for query
        target_region = region or self._choose_optimal_region(query_type, force_primary)
        
        try:
            pool = await self.get_pool(target_region)
            
            async with pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(sql, params or [])
                    
                    try:
                        rows = await cur.fetchall()
                    except Exception:
                        rows = []
                    
                    execution_time = time.time() - start_time
                    
                    # Store metrics
                    self._record_metrics(sql, execution_time, len(rows), query_type, target_region)
                    
                    # Cache result if applicable
                    if cache_key and query_type == QueryType.READ:
                        self._store_in_cache(cache_key, rows)
                    
                    # Log performance
                    self._log_query_performance(sql, execution_time, len(rows), target_region)
                    
                    return rows
                    
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(
                f"Query failed on {target_region} ({execution_time:.3f}s): {sql[:100]}... - {e}",
                extra={
                    "execution_time": execution_time,
                    "sql": sql,
                    "params": params,
                    "error": str(e),
                    "region": target_region
                }
            )
            raise

    def _choose_optimal_region(self, query_type: QueryType, force_primary: bool) -> str:
        """Choose optimal region based on query type and current performance"""
        if force_primary or query_type == QueryType.WRITE:
            return self._primary_region
        
        # For read queries, we could choose based on latency
        # For this demo, we'll use the primary region but log the decision
        best_region = self._primary_region
        
        if self._edge_regions:
            # In a real implementation, you'd choose based on current latency
            available_regions = [r for r in self._edge_regions if r.available]
            if available_regions:
                best_region = min(available_regions, key=lambda r: r.latency_ms).name
        
        return best_region

    def _record_metrics(self, sql: str, execution_time: float, row_count: int, 
                       query_type: QueryType, region: str):
        """Record query metrics for analytics"""
        if os.getenv("ENABLE_QUERY_METRICS", "true").lower() != "true":
            return
            
        query_hash = hashlib.md5(sql.encode()).hexdigest()[:8]
        
        metric = QueryMetrics(
            query_hash=query_hash,
            execution_time=execution_time,
            row_count=row_count,
            query_type=query_type,
            timestamp=datetime.now(),
            region=region
        )
        
        self._query_metrics.append(metric)
        
        # Keep only last 10000 metrics to avoid memory issues
        if len(self._query_metrics) > 10000:
            self._query_metrics = self._query_metrics[-5000:]

    def _log_query_performance(self, sql: str, execution_time: float, row_count: int, region: str):
        """Log query performance based on thresholds"""
        slow_threshold = float(os.getenv("SLOW_QUERY_THRESHOLD_MS", "100")) / 1000
        
        if execution_time > slow_threshold:
            logger.warning(
                f"Slow query on {region} ({execution_time:.3f}s): {sql[:100]}...",
                extra={
                    "execution_time": execution_time,
                    "sql": sql,
                    "row_count": row_count,
                    "region": region,
                    "performance_category": "slow"
                }
            )
        elif execution_time > 0.02:  # 20ms
            logger.info(
                f"Query on {region} ({execution_time:.3f}s): {sql[:50]}...",
                extra={
                    "execution_time": execution_time,
                    "row_count": row_count,
                    "region": region,
                    "performance_category": "normal"
                }
            )

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        if not self._query_metrics:
            return {"total_queries": 0}
        
        total_queries = len(self._query_metrics)
        avg_execution_time = sum(m.execution_time for m in self._query_metrics) / total_queries
        
        by_type = {}
        by_region = {}
        
        for metric in self._query_metrics:
            # By query type
            if metric.query_type.value not in by_type:
                by_type[metric.query_type.value] = {"count": 0, "total_time": 0}
            by_type[metric.query_type.value]["count"] += 1
            by_type[metric.query_type.value]["total_time"] += metric.execution_time
            
            # By region
            if metric.region not in by_region:
                by_region[metric.region] = {"count": 0, "total_time": 0}
            by_region[metric.region]["count"] += 1
            by_region[metric.region]["total_time"] += metric.execution_time

        return {
            "total_queries": total_queries,
            "avg_execution_time": avg_execution_time,
            "cache_hit_rate": len(self._cache) / max(total_queries, 1),
            "by_type": by_type,
            "by_region": by_region,
            "edge_regions": [
                {
                    "name": r.name,
                    "latency_ms": r.latency_ms,
                    "available": r.available
                } for r in self._edge_regions
            ]
        }

    async def close_all_pools(self):
        """Close all connection pools"""
        for region, pool in self._pools.items():
            pool.close()
            await pool.wait_closed()
            logger.info(f"Closed TiDB Serverless pool for region {region}")
        self._pools.clear()

# Global instance
_serverless_manager: Optional[TiDBServerlessManager] = None

def get_serverless_manager() -> TiDBServerlessManager:
    global _serverless_manager
    if _serverless_manager is None:
        _serverless_manager = TiDBServerlessManager()
    return _serverless_manager

# Backwards compatible functions
async def get_pool() -> aiomysql.Pool:
    """Get default pool for backwards compatibility"""
    manager = get_serverless_manager()
    return await manager.get_pool()

async def execute(sql: str, params: Sequence[Any] | None = None) -> List[Dict[str, Any]]:
    """Execute query with serverless optimizations"""
    manager = get_serverless_manager()
    return await manager.execute_optimized(sql, params)

async def close_pool() -> None:
    """Close all pools"""
    manager = get_serverless_manager()
    await manager.close_all_pools()

# New serverless-specific functions
async def execute_read_optimized(sql: str, params: Sequence[Any] | None = None, 
                                region: Optional[str] = None) -> List[Dict[str, Any]]:
    """Execute read query with edge optimization"""
    manager = get_serverless_manager()
    return await manager.execute_optimized(sql, params, region, force_primary=False)

async def execute_write_primary(sql: str, params: Sequence[Any] | None = None) -> List[Dict[str, Any]]:
    """Execute write query on primary region"""
    manager = get_serverless_manager()
    return await manager.execute_optimized(sql, params, force_primary=True)

def get_performance_metrics() -> Dict[str, Any]:
    """Get current performance metrics"""
    manager = get_serverless_manager()
    return manager.get_performance_metrics()