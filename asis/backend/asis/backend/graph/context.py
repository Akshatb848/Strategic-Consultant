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

GEOGRAPHY_ALIASES = (
    ("United States", ("united states", "u.s.", "usa", "us market", " us ")),
    ("Europe", ("europe", "european union", " eu ")),
    ("India", ("india",)),
    ("United Kingdom", ("united kingdom", "uk", "britain")),
    ("Germany", ("germany",)),
    ("France", ("france",)),
    ("Middle East", ("middle east", "gcc region")),
    ("APAC", ("apac", "asia pacific")),
)

THEME_KEYWORDS = {
    "proprietary_ai_platform": ("proprietary ai", "ai platform", "ai-powered platform", "agentic ai platform"),
    "data_ecosystem": ("data ecosystem", "data ecosystems", "data platform", "data moat"),
    "mna_services": ("m&a services", "m&a and technology services", "post-merger integration services", "post merger integration services"),
    "technology_services": ("technology services", "technology consulting", "digital transformation", "tech services"),
    "market_leadership": ("market leadership", "leadership", "differentiate", "sustained"),
}


def extract_problem_context(query: str, company_context: dict) -> dict:
    text = f"{query} {' '.join(str(v) for v in company_context.values() if v)}".strip()
    extracted = dict(company_context)
    extracted.setdefault("company_name", _extract_company_name(query))
    extracted.setdefault("sector", _extract_sector(text))
    extracted.setdefault("geography", _extract_geography(text))
    extracted["decision_type"] = company_context.get("decision_type") or _extract_decision_type(text)
    facts = extract_query_facts(query)
    if facts["geographies"]:
        extracted["geographies"] = facts["geographies"]
        extracted["geography"] = " and ".join(facts["geographies"])
    if facts["named_competitors"]:
        extracted["named_competitors"] = facts["named_competitors"]
    if facts["investment_range_usd_mn"]:
        extracted["investment_range_usd_mn"] = facts["investment_range_usd_mn"]
    if facts["time_horizon_years"]:
        extracted["time_horizon_years"] = facts["time_horizon_years"]
    if facts["strategic_themes"]:
        extracted["strategic_themes"] = facts["strategic_themes"]
    return extracted


def extract_query_facts(query: str) -> dict:
    """Extract high-value board-question facts that must survive the pipeline."""
    return {
        "investment_range_usd_mn": _extract_investment_range(query),
        "time_horizon_years": _extract_time_horizon_years(query),
        "geographies": _extract_geographies(query),
        "named_competitors": _extract_named_competitors(query),
        "strategic_themes": _extract_strategic_themes(query),
    }


def _extract_company_name(query: str) -> str | None:
    match = re.search(
        r"should\s+([A-Z][A-Za-z0-9&.,'\-\s]{1,90}?)\s+"
        r"(?:enter|invest|allocate|fund|exit|divest|restructure|acquire|merge|launch|expand|scale|differentiate|build)",
        query,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).strip(" ,.")
    return None


def _extract_sector(text: str) -> str | None:
    lower = text.lower()
    if any(token in lower for token in ("m&a services", "post-merger integration", "consulting", "professional services")):
        return "Professional Services"
    if any(token in lower for token in ("ai platform", "data ecosystem", "technology services", "technology consulting")):
        return "Technology Consulting"
    for sector in ("fintech", "financial services", "banking", "consulting", "professional services", "technology", "saas", "healthcare", "manufacturing"):
        if sector in lower:
            return sector.title()
    return None


def _extract_geography(text: str) -> str | None:
    geographies = _extract_geographies(text)
    return " and ".join(geographies) if geographies else None


def _extract_decision_type(text: str) -> str | None:
    lower = text.lower()
    service_context = any(
        token in lower
        for token in (
            "m&a services",
            "m&a and technology services",
            "post-merger integration services",
            "post merger integration services",
        )
    )
    if re.search(r"\b(should|whether to)\b.{0,80}\b(acquire|buy|purchase|take a stake|minority stake|takeover)\b", lower):
        return "acquire"
    if not service_context and re.search(r"\b(should|whether to)\b.{0,80}\b(merge|merger)\b", lower):
        return "merge"
    if any(token in lower for token in ("allocate", "invest", "investment", "fund", "proprietary ai", "data ecosystem")):
        return "invest"
    for keyword, decision in DECISION_KEYWORDS.items():
        if keyword in lower:
            return decision
    return None


def _extract_geographies(text: str) -> list[str]:
    lower = f" {text.lower()} "
    found: list[str] = []
    for label, aliases in GEOGRAPHY_ALIASES:
        if any(alias in lower for alias in aliases):
            found.append(label)
    return found


def _extract_investment_range(query: str) -> dict | None:
    cleaned = query.replace(",", "")
    pattern = re.compile(
        r"(?P<currency>[$]|usd|us\$)\s*"
        r"(?P<low>\d+(?:\.\d+)?)\s*(?:m|mn|million)?\s*"
        r"(?:-|to|through|and|--|->|\u2013|\u2014)\s*"
        r"(?:[$]|usd|us\$)?\s*(?P<high>\d+(?:\.\d+)?)\s*(?P<unit>m|mn|million|b|bn|billion)?",
        re.IGNORECASE,
    )
    match = pattern.search(cleaned)
    if not match:
        return None
    low = float(match.group("low"))
    high = float(match.group("high"))
    unit = (match.group("unit") or "m").lower()
    multiplier = 1000 if unit in {"b", "bn", "billion"} else 1
    low *= multiplier
    high *= multiplier
    if high < low:
        low, high = high, low
    return {"min": round(low, 1), "max": round(high, 1), "mid": round((low + high) / 2, 1), "currency": "USD"}


def _extract_time_horizon_years(query: str) -> dict | None:
    lower = query.lower()
    match = re.search(r"(?:next|over|within)\s+(\d+(?:\.\d+)?)\s*(?:-|to|\u2013|\u2014)\s*(\d+(?:\.\d+)?)\s+years?", lower)
    if match:
        low = float(match.group(1))
        high = float(match.group(2))
        return {"min": low, "max": high, "mid": round((low + high) / 2, 1)}
    match = re.search(r"(?:next|over|within)\s+(\d+(?:\.\d+)?)\s+years?", lower)
    if match:
        years = float(match.group(1))
        return {"min": years, "max": years, "mid": years}
    match = re.search(r"(?:next|over|within)\s+(\d+)\s+months?", lower)
    if match:
        years = round(int(match.group(1)) / 12, 1)
        return {"min": years, "max": years, "mid": years}
    return None


def _extract_named_competitors(query: str) -> list[str]:
    known = (
        "McKinsey & Company",
        "Boston Consulting Group",
        "BCG",
        "Bain & Company",
        "Accenture",
        "Deloitte",
        "EY",
        "PwC",
        "KPMG",
        "JP Morgan",
        "JPMorgan Chase",
    )
    lower = query.lower()
    found: list[str] = []
    for name in known:
        name_lower = name.lower()
        if len(name_lower) <= 3:
            matched = bool(re.search(rf"\b{re.escape(name_lower)}\b", lower))
        else:
            matched = name_lower in lower
        if matched and name not in found:
            canonical = "Boston Consulting Group" if name == "BCG" else name
            if canonical not in found:
                found.append(canonical)
    subject = _extract_company_name(query)
    if subject:
        found = [name for name in found if name.lower() != subject.lower()]
    return found


def _extract_strategic_themes(query: str) -> list[str]:
    lower = query.lower()
    themes: list[str] = []
    for theme, tokens in THEME_KEYWORDS.items():
        if any(token in lower for token in tokens):
            themes.append(theme)
    return themes
