from __future__ import annotations

from asis.backend.schemas.common import Citation


GENERAL_REFERENCES = [
    Citation(
        title="World Economic Outlook",
        source="IMF",
        url="https://www.imf.org/en/Publications/WEO",
        published_at="2025-10-01",
        excerpt="Macro demand, inflation and cross-border capital assumptions should align with current global conditions.",
    ),
    Citation(
        title="Global Economic Prospects",
        source="World Bank",
        url="https://www.worldbank.org/en/publication/global-economic-prospects",
        published_at="2025-12-01",
        excerpt="Growth resilience, financing costs and geographic risk should be grounded in current market evidence.",
    ),
]

SECTOR_REFERENCES = {
    "financial": [
        Citation(
            title="Digital Lending Guidelines",
            source="Reserve Bank of India",
            url="https://rbi.org.in",
            published_at="2025-08-01",
            excerpt="Financial-services expansion and fintech operating models must consider lending, consumer duty and data controls.",
        ),
        Citation(
            title="India Fintech Report",
            source="IBEF",
            url="https://www.ibef.org",
            published_at="2025-11-15",
            excerpt="Fintech growth rates, funding trends and adoption benchmarks inform addressable-market assumptions.",
        ),
    ],
    "consulting": [
        Citation(
            title="Professional Services Market Update",
            source="Dun & Bradstreet",
            url="https://www.dnb.com",
            published_at="2025-09-12",
            excerpt="Consulting margin, talent-utilisation and win-rate assumptions should reflect current client spend patterns.",
        ),
        Citation(
            title="India Services Sector Brief",
            source="IBEF",
            url="https://www.ibef.org",
            published_at="2025-10-20",
            excerpt="Professional-services growth and digital demand remain closely linked to enterprise transformation budgets.",
        ),
        Citation(
            title="Technology Report 2025",
            source="Bain & Company",
            url="https://www.bain.com/insights/topics/technology-report/",
            published_at="2025-09-23",
            excerpt="Enterprise AI differentiation increasingly depends on data foundations, workflow redesign and scaled adoption rather than pilots alone.",
        ),
        Citation(
            title="McKinsey Technology Trends Outlook 2025",
            source="McKinsey & Company",
            url="https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/the-top-trends-in-tech",
            published_at="2025-07-01",
            excerpt="AI, agentic systems, cloud and data architecture trends should inform technology-services investment assumptions and capability timing.",
        ),
        Citation(
            title="From Potential to Profit: Closing the AI Impact Gap",
            source="Boston Consulting Group",
            url="https://www.bcg.com/publications/2025/closing-the-ai-impact-gap",
            published_at="2025-01-15",
            excerpt="AI investment cases should distinguish pilots from scaled value capture and track whether spending creates measurable business outcomes.",
        ),
    ],
    "technology": [
        Citation(
            title="Technology Trends Outlook",
            source="McKinsey",
            url="https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights",
            published_at="2025-07-01",
            excerpt="AI and cloud investment scenarios should be benchmarked against adoption maturity and execution risk.",
        ),
        Citation(
            title="Technology Sector Outlook",
            source="NASSCOM",
            url="https://nasscom.in",
            published_at="2025-11-05",
            excerpt="India technology market sizing and delivery-capability benchmarks remain useful for competitive positioning.",
        ),
    ],
    "automotive": [
        Citation(
            title="Automotive software and electronics market outlook",
            source="McKinsey",
            url="https://www.mckinsey.com/features/mckinsey-center-for-future-mobility/our-insights/mapping-the-automotive-software-and-electronics-landscape",
            published_at="2026-02-01",
            excerpt="Automotive software, electronics, connectivity and AI-enabled value pools should be treated separately from generic enterprise-software demand.",
        ),
        Citation(
            title="2026 Global Automotive Supplier Study",
            source="BCG",
            url="https://www.bcg.com/publications/2026/the-2026-global-automotive-supplier-study",
            published_at="2026-03-01",
            excerpt="Automotive supplier strategy should reflect margin pressure, portfolio rotation, electrification exposure and software-defined vehicle economics.",
        ),
    ],
}

GEOGRAPHY_REFERENCES = {
    "india": [
        Citation(
            title="Digital Personal Data Protection Act",
            source="MeitY",
            url="https://www.meity.gov.in",
            published_at="2025-01-01",
            excerpt="Indian market-entry and operating-model decisions must account for privacy, consent and localisation controls.",
        ),
        Citation(
            title="India Economic Survey",
            source="Government of India",
            url="https://www.indiabudget.gov.in/economicsurvey/",
            published_at="2025-12-31",
            excerpt="Demand outlook, capex intensity and policy momentum remain core drivers for India-market strategy.",
        ),
    ],
    "uk": [
        Citation(
            title="Competition and Markets Authority Guidance",
            source="UK CMA",
            url="https://www.gov.uk/cma-cases",
            published_at="2025-09-01",
            excerpt="Strategic expansion in the UK should account for competition scrutiny and consumer-protection expectations.",
        )
    ],
    "europe": [
        Citation(
            title="EU Artificial Intelligence Act",
            source="European Commission",
            url="https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
            published_at="2025-08-01",
            excerpt="European AI platform and data-ecosystem strategies must account for risk-based AI governance and compliance obligations.",
        )
    ],
    "united states": [
        Citation(
            title="AI Risk Management Framework",
            source="NIST",
            url="https://www.nist.gov/itl/ai-risk-management-framework",
            published_at="2025-01-01",
            excerpt="US AI platform strategies should define governance, measurement and risk controls for trustworthy AI systems.",
        )
    ],
}


def infer_sector_key(context: dict) -> str | None:
    sector = (context.get("sector") or "").lower()
    if any(token in sector for token in ("auto", "mobility", "vehicle", "ev", "battery")):
        return "automotive"
    if "fin" in sector or "bank" in sector:
        return "financial"
    if "consult" in sector or "professional" in sector or "advis" in sector:
        return "consulting"
    if "tech" in sector or "software" in sector or "saas" in sector:
        return "technology"
    return None


def infer_geography_key(context: dict) -> str | None:
    geography = (context.get("geography") or "").lower()
    if "india" in geography:
        return "india"
    if "europe" in geography or "european" in geography:
        return "europe"
    if "united states" in geography or geography in {"us", "usa"}:
        return "united states"
    if "uk" in geography or "united kingdom" in geography or "britain" in geography:
        return "uk"
    return None


def build_citations(context: dict, limit: int = 4) -> list[dict]:
    items = list(GENERAL_REFERENCES)
    sector_key = infer_sector_key(context)
    if sector_key:
        items.extend(SECTOR_REFERENCES.get(sector_key, []))
    geography_text = (context.get("geography") or "").lower()
    geography_keys = []
    for key in ("india", "europe", "united states", "uk"):
        if key in geography_text or (key == "uk" and "united kingdom" in geography_text):
            geography_keys.append(key)
    inferred = infer_geography_key(context)
    if inferred and inferred not in geography_keys:
        geography_keys.append(inferred)
    for geography_key in geography_keys:
        items.extend(GEOGRAPHY_REFERENCES.get(geography_key, []))
    return [item.model_dump() for item in items[:limit]]
