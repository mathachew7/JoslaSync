# app/utils/rate_limit.py
"""
Lightweight in-memory rate limiter. Fine for a single-worker deployment
(this app runs --workers 1 specifically); would need a shared store
(e.g. Redis) if ever scaled to multiple worker processes.
"""
import time
from collections import defaultdict
from fastapi import HTTPException, Request, status

_attempts: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    now = time.time()
    attempts = _attempts[key]
    cutoff = now - window_seconds
    while attempts and attempts[0] < cutoff:
        attempts.pop(0)
    if len(attempts) >= max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again in a minute.",
        )
    attempts.append(now)


def client_ip(request: Request) -> str:
    # Behind Traefik + Nginx — the real client IP is forwarded via this header.
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
