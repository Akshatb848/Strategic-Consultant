from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
from urllib.parse import urlparse

import httpx

from asis.backend.config.logging import logger
from asis.backend.config.settings import get_settings


class EvidenceProviderError(RuntimeError):
    """Raised when a report cannot establish a verified live evidence base."""


def _is_http_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _research_query(query: str, context: dict[str, Any]) -> str:
    company = context.get("company_name") or "the company in the question"
    sector = context.get("sector") or "the relevant industry"
    geography = context.get("geography") or "the target geography"
    decision_type = context.get("decision_type") or "the proposed strategic decision"
    return (
        f"{company} {sector} {geography} {decision_type}. {query}. "
        "Use current primary, regulatory, company, market, and financial sources; "
        "return evidence relevant to this exact decision."
    )


def _verify_url(client: httpx.Client, url: str) -> bool:
    if not _is_http_url(url):
        return False
    try:
        response = client.get(url, follow_redirects=True)
        return 200 <= response.status_code < 400 and bool(response.url.host)
    except httpx.HTTPError:
        return False


def retrieve_live_evidence(
    *,
    query: str,
    context: dict[str, Any],
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Retrieve and URL-verify evidence before any agent is allowed to reason.

    The pipeline deliberately has no static-reference fallback in production. A
    report with no verified evidence is less useful than a visible failed run.
    """
    settings = get_settings()
    if not settings.tavily_api_key:
        raise EvidenceProviderError(
            "LIVE_EVIDENCE_PROVIDER_UNAVAILABLE: TAVILY_API_KEY is not configured. "
            "ASIS will not generate a report from static or illustrative references."
        )

    max_results = max(3, int(limit or settings.evidence_max_results))
    research_query = _research_query(query, context)
    endpoint = f"{settings.tavily_api_base.rstrip('/')}/search"
    timeout = settings.evidence_request_timeout_seconds
    headers = {"Content-Type": "application/json"}
    payload = {
        "api_key": settings.tavily_api_key,
        "query": research_query,
        "search_depth": "advanced",
        "topic": "general",
        "max_results": max_results * 2,
        "include_answer": False,
        "include_raw_content": False,
        "include_images": False,
    }

    try:
        with httpx.Client(timeout=timeout, headers=headers) as client:
            response = client.post(endpoint, json=payload)
            response.raise_for_status()
            body = response.json()
            candidates = body.get("results") if isinstance(body, dict) else None
            if not isinstance(candidates, list):
                raise EvidenceProviderError("LIVE_EVIDENCE_INVALID_RESPONSE: Tavily returned no results list.")

            citations: list[dict[str, Any]] = []
            seen_urls: set[str] = set()
            retrieved_at = datetime.now(timezone.utc).isoformat()
            for item in candidates:
                if not isinstance(item, dict):
                    continue
                url = str(item.get("url") or "").strip()
                if not url or url in seen_urls or not _verify_url(client, url):
                    continue
                title = str(item.get("title") or "").strip()
                content = str(item.get("content") or "").strip()
                if not title or not content:
                    continue
                seen_urls.add(url)
                citations.append(
                    {
                        "id": f"src_{sha256(url.encode('utf-8')).hexdigest()[:16]}",
                        "title": title,
                        "source": str(urlparse(url).netloc or "Web source"),
                        "url": url,
                        "published_at": str(item.get("published_date") or "Unknown"),
                        "excerpt": content[:1200],
                        "verification_status": "verified",
                        "retrieved_at": retrieved_at,
                        "retrieval_query": research_query,
                        "source_type": "live_web",
                    }
                )
                if len(citations) >= max_results:
                    break
    except EvidenceProviderError:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        logger.error("live_evidence_retrieval_failed", error=str(exc))
        raise EvidenceProviderError(
            f"LIVE_EVIDENCE_RETRIEVAL_FAILED: {type(exc).__name__}. "
            "ASIS will not generate a report without verified evidence."
        ) from exc

    if len(citations) < 5:
        raise EvidenceProviderError(
            f"LIVE_EVIDENCE_INSUFFICIENT: only {len(citations)} verified sources were retrieved; "
            "at least 5 are required for an auditable report."
        )
    logger.info(
        "live_evidence_retrieved",
        source_count=len(citations),
        query=research_query,
    )
    return citations
