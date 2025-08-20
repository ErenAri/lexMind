from typing import Any, Dict, Optional, Callable, cast
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import traceback
import logging
import uuid

logger = logging.getLogger(__name__)

class ErrorResponse(BaseModel):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None
    timestamp: Optional[str] = None

class APIError(HTTPException):
    def __init__(
        self,
        status_code: int,
        error_code: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ):
        self.error_code = error_code
        self.message = message
        self.details = details
        self.request_id = request_id
        super().__init__(status_code=status_code, detail=message)

# Specific error types
class ValidationError(APIError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(422, "validation_error", message, details)

class AuthenticationError(APIError):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(401, "authentication_error", message)

class AuthorizationError(APIError):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(403, "authorization_error", message)

class NotFoundError(APIError):
    def __init__(self, resource: str = "Resource"):
        super().__init__(404, "not_found", f"{resource} not found")

class ConflictError(APIError):
    def __init__(self, message: str = "Resource conflict"):
        super().__init__(409, "conflict_error", message)

class DatabaseError(APIError):
    def __init__(self, message: str = "Database operation failed"):
        super().__init__(500, "database_error", message)

class ExternalServiceError(APIError):
    def __init__(self, service: str, message: str = "External service unavailable"):
        super().__init__(503, "external_service_error", f"{service}: {message}")

# Error handler functions
async def api_error_handler(request: Request, exc: Exception) -> JSONResponse:
    from datetime import datetime
    
    request_id = getattr(request.state, 'request_id', str(uuid.uuid4()))
    api_exc = cast(APIError, exc)
    
    error_response = ErrorResponse(
        error=api_exc.error_code,
        message=api_exc.message,
        details=api_exc.details,
        request_id=request_id,
        timestamp=datetime.utcnow().isoformat()
    )
    
    # Log error details
    logger.error(
        f"API Error [{request_id}]: {api_exc.error_code} - {api_exc.message}",
        extra={
            "request_id": request_id,
            "error_code": api_exc.error_code,
            "status_code": api_exc.status_code,
            "details": api_exc.details,
            "path": request.url.path,
            "method": request.method,
        }
    )
    
    return JSONResponse(
        status_code=api_exc.status_code,
        content=error_response.dict()
    )

async def http_error_handler(request: Request, exc: Exception) -> JSONResponse:
    from datetime import datetime
    
    request_id = getattr(request.state, 'request_id', str(uuid.uuid4()))
    http_exc = cast(HTTPException, exc)
    
    error_response = ErrorResponse(
        error="http_error",
        message=str(http_exc.detail),
        request_id=request_id,
        timestamp=datetime.utcnow().isoformat()
    )
    
    logger.warning(
        f"HTTP Error [{request_id}]: {http_exc.status_code} - {http_exc.detail}",
        extra={
            "request_id": request_id,
            "status_code": http_exc.status_code,
            "path": request.url.path,
            "method": request.method,
        }
    )
    
    return JSONResponse(
        status_code=http_exc.status_code,
        content=error_response.dict()
    )

from fastapi.exceptions import RequestValidationError

async def validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    from datetime import datetime
    
    request_id = getattr(request.state, 'request_id', str(uuid.uuid4()))
    val_exc = cast(RequestValidationError, exc)
    
    error_response = ErrorResponse(
        error="validation_error",
        message="Request validation failed",
        details={"validation_errors": val_exc.errors()},
        request_id=request_id,
        timestamp=datetime.utcnow().isoformat()
    )
    
    logger.warning(
        f"Validation Error [{request_id}]: {val_exc.errors()}",
        extra={
            "request_id": request_id,
            "validation_errors": val_exc.errors(),
            "path": request.url.path,
            "method": request.method,
        }
    )
    
    return JSONResponse(
        status_code=422,
        content=error_response.dict()
    )

async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    from datetime import datetime
    
    request_id = getattr(request.state, 'request_id', str(uuid.uuid4()))
    
    # Log full traceback for debugging
    logger.error(
        f"Unhandled Error [{request_id}]: {type(exc).__name__} - {str(exc)}",
        extra={
            "request_id": request_id,
            "exception_type": type(exc).__name__,
            "path": request.url.path,
            "method": request.method,
            "traceback": traceback.format_exc(),
        }
    )
    
    error_response = ErrorResponse(
        error="internal_error",
        message="An unexpected error occurred",
        request_id=request_id,
        timestamp=datetime.utcnow().isoformat()
    )
    
    return JSONResponse(
        status_code=500,
        content=error_response.dict()
    )