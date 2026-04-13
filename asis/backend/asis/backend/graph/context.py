from __future__ import annotations

import re


DECISION_KEYWORDS = {
    "enter": "enter",
    "launch": "enter",
    "expand": "enter",
    "exit": "exit",
    "divest": "divest",
    "invest": "invest",
    "fund": "invest",
    "restructure": "restructure",
    "turnaround": "restructure",
    "acquire": "acquire",
    "buy": "acquire",
    "merge": "merge",
}


def extract_problem_context(query: str, company_context: dict) -> dict:
    text = f"{query} {' '.join(str(v) for v in company_context.values() if v)}".strip()
    extracted = dict(company_context)
    extracted.setdefault("company_name", _extract_company_name(query))
    extracted.setdefault("sector", _extract_sector(text))
    extracted.setdefault("geography", _extract_geography(text))
    extracted["decision_type"] = company_context.get("decision_type") or _extract_decision_type(text)
    return extracted


def _extract_company_name(query: str) -> str | None:
    match = re.search(r"should\s+([A-Z][A-Za-z0-9&\-\s]{1,80}?)\s+(?:enter|invest|exit|divest|restructure|acquire|merge)", query, re.IGNORECASE)
    if match:
        return match.group(1).strip(" ,.")
    return None


def _extract_sector(text: str) -> str | None:
    lower = text.lower()
    for sector in ("fintech", "financial services", "banking", "consulting", "professional services", "technology", "saas", "healthcare", "manufacturing"):
        if sector in lower:
            return sector.title()
    return None


def _extract_geography(text: str) -> str | None:
    lower = text.lower()
    for geography in ("india", "united kingdom", "uk", "europe", "united states", "usa", "middle east", "apac"):
        if geography in lower:
            return geography.title()
    return None


def _extract_decision_type(text: str) -> str | None:
    lower = text.lower()
    for keyword, decision in DECISION_KEYWORDS.items():
        if keyword in lower:
            return decision
    return None
