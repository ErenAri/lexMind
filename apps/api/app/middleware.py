from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import uuid
import time
import logging
from collections import defaultdict
from typing import Dict, DefaultDict

logger = logging.getLogger(__name__)

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Add to response headers
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        return response

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        # Log request
        logger.info(
            f"Request [{request_id}]: {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query_params": str(request.query_params),
                "user_agent": request.headers.get("user-agent"),
                "ip": request.client.host if request.client else None,
            }
        )
        
        response = await call_next(request)
        
        # Log response
        process_time = time.time() - start_time
        logger.info(
            f"Response [{request_id}]: {response.status_code} in {process_time:.3f}s",
            extra={
                "request_id": request_id,
                "status_code": response.status_code,
                "process_time": process_time,
            }
        )
        
        response.headers["X-Process-Time"] = str(process_time)
        return response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' ws: wss:;"
        )
        
        return response

class ValidationMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_body_size: int = 10 * 1024 * 1024):  # 10MB default
        super().__init__(app)
        self.max_body_size = max_body_size
    
    async def dispatch(self, request: Request, call_next):
        # Size guard
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                if int(cl) > self.max_body_size:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "error": "payload_too_large",
                            "message": "Request body too large",
                            "details": {"max_size": f"{self.max_body_size // 1024 // 1024}MB"}
                        }
                    )
            except Exception:
                pass
        
        # Content type guard for JSON endpoints (exclude file upload)
        if request.method in {"POST", "PUT", "PATCH"}:
            # Skip validation for specific upload endpoints
            upload_paths = ["/ingest/pdf", "/auth/login"]
            if not any(path in request.url.path for path in upload_paths):
                ct = request.headers.get("content-type", "")
                if "application/json" not in ct and "application/x-www-form-urlencoded" not in ct:
                    return JSONResponse(
                        status_code=415,
                        content={
                            "error": "unsupported_media_type",
                            "message": "Content-Type must be application/json or application/x-www-form-urlencoded",
                            "details": {"received": ct}
                        }
                    )
        
        # Header validation - block suspicious user agents and headers
        user_agent = request.headers.get("user-agent", "").lower()
        suspicious_agents = ["sqlmap", "nmap", "nikto", "burp", "owasp"]
        
        if any(agent in user_agent for agent in suspicious_agents):
            logger.warning(f"Blocked suspicious user agent from {self._get_client_ip(request)}: {user_agent}")
            return JSONResponse(
                status_code=403,
                content={
                    "error": "forbidden",
                    "message": "Request blocked by security policy"
                }
            )
        
        return await call_next(request)
    
    def _get_client_ip(self, request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.client.host if request.client else "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, calls_per_minute: int = 100, calls_per_hour: int = 1000):
        super().__init__(app)
        self.calls_per_minute = calls_per_minute
        self.calls_per_hour = calls_per_hour
        # Format: ip -> [(timestamp, count_minute), (timestamp, count_hour)]
        self.rate_limits: DefaultDict[str, Dict[str, list]] = defaultdict(lambda: {"minute": [], "hour": []})
    
    def _get_client_ip(self, request: Request) -> str:
        # Check for forwarded headers (for reverse proxy)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        
        # Fallback to direct client IP
        return request.client.host if request.client else "unknown"
    
    def _clean_old_requests(self, requests: list, window_seconds: int):
        """Remove requests older than window_seconds"""
        current_time = time.time()
        return [req_time for req_time in requests if current_time - req_time < window_seconds]
    
    def _is_rate_limited(self, ip: str) -> tuple[bool, dict]:
        current_time = time.time()
        ip_data = self.rate_limits[ip]
        
        # Clean old requests and count current
        ip_data["minute"] = self._clean_old_requests(ip_data["minute"], 60)
        ip_data["hour"] = self._clean_old_requests(ip_data["hour"], 3600)
        
        minute_count = len(ip_data["minute"])
        hour_count = len(ip_data["hour"])
        
        # Check limits
        if minute_count >= self.calls_per_minute:
            return True, {
                "error": "rate_limit_exceeded",
                "message": "Too many requests per minute",
                "details": {
                    "limit_per_minute": self.calls_per_minute,
                    "limit_per_hour": self.calls_per_hour,
                    "current_minute": minute_count,
                    "current_hour": hour_count,
                    "retry_after_seconds": 60 - (current_time - min(ip_data["minute"]))
                }
            }
        
        if hour_count >= self.calls_per_hour:
            return True, {
                "error": "rate_limit_exceeded", 
                "message": "Too many requests per hour",
                "details": {
                    "limit_per_minute": self.calls_per_minute,
                    "limit_per_hour": self.calls_per_hour,
                    "current_minute": minute_count,
                    "current_hour": hour_count,
                    "retry_after_seconds": 3600 - (current_time - min(ip_data["hour"]))
                }
            }
        
        return False, {}
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ["/health", "/health/full"]:
            return await call_next(request)
        
        ip = self._get_client_ip(request)
        current_time = time.time()
        
        # Check if rate limited
        is_limited, error_data = self._is_rate_limited(ip)
        
        if is_limited:
            logger.warning(f"Rate limit exceeded for IP {ip}: {error_data['message']}")
            return JSONResponse(
                status_code=429,
                content=error_data,
                headers={
                    "Retry-After": str(int(error_data["details"]["retry_after_seconds"])),
                    "X-RateLimit-Limit-Minute": str(self.calls_per_minute),
                    "X-RateLimit-Limit-Hour": str(self.calls_per_hour),
                    "X-RateLimit-Remaining-Minute": str(max(0, self.calls_per_minute - error_data["details"]["current_minute"])),
                    "X-RateLimit-Remaining-Hour": str(max(0, self.calls_per_hour - error_data["details"]["current_hour"])),
                }
            )
        
        # Record this request
        self.rate_limits[ip]["minute"].append(current_time)
        self.rate_limits[ip]["hour"].append(current_time)
        
        response = await call_next(request)
        
        # Add rate limit headers to response
        ip_data = self.rate_limits[ip]
        minute_count = len(ip_data["minute"])
        hour_count = len(ip_data["hour"])
        
        response.headers["X-RateLimit-Limit-Minute"] = str(self.calls_per_minute)
        response.headers["X-RateLimit-Limit-Hour"] = str(self.calls_per_hour)
        response.headers["X-RateLimit-Remaining-Minute"] = str(max(0, self.calls_per_minute - minute_count))
        response.headers["X-RateLimit-Remaining-Hour"] = str(max(0, self.calls_per_hour - hour_count))
        
        return response