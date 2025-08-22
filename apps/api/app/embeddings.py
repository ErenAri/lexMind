from __future__ import annotations

from typing import List, Optional
import os

_st_model = None  # lazy-loaded sentence-transformers model


def _load_model() -> Optional[object]:
    global _st_model
    if _st_model is not None:
        return _st_model
    try:
        # Avoid heavy import unless needed
        from sentence_transformers import SentenceTransformer  # type: ignore
    except Exception:
        _st_model = None
        return None

    model_name = os.getenv("SENTENCE_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    try:
        _st_model = SentenceTransformer(model_name)
    except Exception:
        # If model cannot be loaded, keep None so we fall back to stub
        _st_model = None
    return _st_model


def _resize_vector(values: List[float], target_dim: int) -> List[float]:
    if target_dim <= 0:
        return []
    if len(values) == target_dim:
        return values
    if len(values) > target_dim:
        return values[:target_dim]
    # Repeat to reach target dimension
    repeated: List[float] = []
    while len(repeated) < target_dim:
        remaining = target_dim - len(repeated)
        take = min(remaining, len(values))
        repeated.extend(values[:take])
    return repeated


def _l2_normalize(values: List[float]) -> List[float]:
    import math
    norm = math.sqrt(sum(v * v for v in values)) or 1.0
    return [v / norm for v in values]


def generate_embedding(text: str, dim: int = 384) -> List[float]:
    """Generate a sentence embedding using a local model when available.

    Falls back to a deterministic stub when sentence-transformers is unavailable.
    Always returns a vector of length `dim`, resized and L2-normalized.
    """
    model = _load_model()
    if model is not None:
        try:
            # Encode returns List[float] or numpy array; convert to list
            vec = model.encode(text)  # type: ignore[attr-defined]
            if hasattr(vec, "tolist"):
                vec = vec.tolist()  # type: ignore[assignment]
            resized = _resize_vector(list(vec), dim)
            return _l2_normalize(resized)
        except Exception:
            # fall back to stub
            pass

    # Fallback deterministic stub (kept for resilience)
    seed = abs(hash(text)) % (10**9)
    base = (seed % 1000) / 1000.0
    stub = [base for _ in range(dim)]
    return _l2_normalize(stub)


def is_model_available() -> bool:
    """Return True if a sentence-transformers model could be loaded."""
    return _load_model() is not None