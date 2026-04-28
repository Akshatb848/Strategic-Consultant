"""
DSR Evaluation Dataset — 10 real MNC strategic scenarios.

Each scenario is drawn from publicly available corporate filings, press
releases, and peer-reviewed case archives.  The source field gives a
citable reference so the examiner can verify the input independently.

Scenario structure mirrors the ASIS analysis creation payload so the
runner can submit them without transformation.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Scenario:
    scenario_id: str          # S01 … S10
    company: str
    decision_type: str        # ACQUIRE | DIVEST | ENTER | EXIT | TRANSFORM | RESTRUCTURE
    geography: str
    sector: str
    annual_revenue_usd_mn: float
    employees: str
    query: str                # submitted verbatim to ASIS and the baseline
    company_context: dict     # structured context block
    published_source: str     # citable reference
    source_url: str


SCENARIOS: list[Scenario] = [
    # ── S01 ─────────────────────────────────────────────────────────────────
    Scenario(
        scenario_id="S01",
        company="Amazon",
        decision_type="ACQUIRE",
        geography="United States",
        sector="Retail / E-commerce",
        annual_revenue_usd_mn=177_866,
        employees="566,000",
        query=(
            "Should Amazon acquire Whole Foods Market for approximately $13.7 billion "
            "to accelerate its entry into physical grocery retail and strengthen "
            "last-mile fulfilment capabilities in the United States?"
        ),
        company_context={
            "company_name": "Amazon",
            "sector": "Retail / E-commerce",
            "geography": "United States",
            "decision_type": "ACQUIRE",
            "annual_revenue_usd_mn": 177_866,
            "employees": "566,000",
            "target_company": "Whole Foods Market",
            "deal_value_usd_mn": 13_700,
        },
        published_source=(
            "Amazon (2017). Amazon to Acquire Whole Foods Market. "
            "Press release, 16 June 2017. SEC Form 8-K, Accession 0001018724-17-008513."
        ),
        source_url="https://ir.aboutamazon.com/news-releases/news-release-details/amazoncom-acquire-whole-foods-market",
    ),

    # ── S02 ─────────────────────────────────────────────────────────────────
    Scenario(
        scenario_id="S02",
        company="Microsoft",
        decision_type="ACQUIRE",
        geography="United States / Global",
        sector="Technology / Gaming",
        annual_revenue_usd_mn=198_270,
        employees="221,000",
        query=(
            "Should Microsoft acquire Activision Blizzard for $68.7 billion "
            "to strengthen its gaming division, accelerate Game Pass subscriber "
            "growth, and build a credible position in the emerging metaverse?"
        ),
        company_context={
            "company_name": "Microsoft",
            "sector": "Technology / Gaming",
            "geography": "United States",
            "decision_type": "ACQUIRE",
            "annual_revenue_usd_mn": 198_270,
            "employees": "221,000",
            "target_company": "Activision Blizzard",
            "deal_value_usd_mn": 68_700,
        },
        published_source=(
            "Microsoft (2022). Microsoft to Acquire Activision Blizzard. "
            "Press release, 18 January 2022. SEC Form 8-K, Accession 0001193125-22-011875."
        ),
        source_url="https://news.microsoft.com/2022/01/18/microsoft-to-acquire-activision-blizzard-to-bring-the-joy-and-community-of-gaming-to-everyone/",
    ),

    # ── S03 ─────────────────────────────────────────────────────────────────
    Scenario(
        scenario_id="S03",
        company="Unilever",
        decision_type="DIVEST",
        geography="Global",
        sector="FMCG / Consumer Goods",
        annual_revenue_usd_mn=60_073,
        employees="148,000",
        query=(
            "Should Unilever divest its Lipton tea brand and tea estates "
            "to a private equity buyer in order to sharpen portfolio focus "
            "on high-growth personal care and home care categories?"
        ),
        company_context={
            "company_name": "Unilever",
            "sector": "FMCG / Consumer Goods",
            "geography": "Global",
            "decision_type": "DIVEST",
            "annual_revenue_usd_mn": 60_073,
            "employees": "148,000",
            "divested_unit": "Ekaterra (Lipton tea brands and estates)",
            "deal_value_usd_mn": 4_500,
        },
        published_source=(
            "Unilever (2021). Unilever announces agreement to sell its Tea business "
            "to CVC Capital Partners. Press release, 18 November 2021. "
            "Unilever Annual Report and Accounts 2021, p. 14."
        ),
        source_url="https://www.unilever.com/news/press-and-media/press-releases/2021/unilever-announces-agreement-to-sell-its-tea-business-to-cvc-capital-partners/",
    ),

    # ── S04 ─────────────────────────────────────────────────────────────────
    Scenario(
        scenario_id="S04",
        company="Tesla",
        decision_type="ENTER",
        geography="India",
        sector="Electric Vehicles / Automotive",
        annual_revenue_usd_mn=81_462,
        employees="127,855",
        query=(
            "Should Tesla enter the Indian passenger EV market through a "
            "combination of CKD assembly and imported premium vehicles, "
            "given the government's new EV import duty concession framework "
            "and PLI scheme incentives?"
        ),
        company_context={
            "company_name": "Tesla",
            "sector": "Electric Vehicles / Automotive",
            "geography": "India",
            "decision_type": "ENTER",
            "annual_revenue_usd_mn": 81_462,
            "employees": "127,855",
            "regulatory_context": "India EV Import Policy 2024, PLI Automotive Scheme",
        },
        published_source=(
            "Ministry of Heavy Industries, Government of India (2024). "
            "Scheme to Promote Manufacturing of Electric Passenger Cars in India. "
            "Gazette Notification, 15 March 2024. "
            "Tesla Inc. Form 10-K 2023, SEC Accession 0001318605-24-000012."
        ),
        source_url="https://heavyindustries.gov.in/",
    ),

    # ── S05 ─────────────────────────────────────────────────────────────────
    Scenario(
        scenario_id="S05",
        company="Shell",
        decision_type="TRANSFORM",
        geography="Global",
        sector="Energy / Oil & Gas",
        annual_revenue_usd_mn=386_201,
        employees="103,000",
        query=(
            "Should Shell accelerate its transformation from integrated oil "
            "and gas to a diversified low-carbon energy company by tripling "
            "renewable energy investment to $10bn per year through 2030, "
            "while managing returns for institutional shareholders?"
        ),
        company_context={
            "company_name": "Shell",
            "sector": "Energy / Oil & Gas",
            "geography": "Global",
            "decision_type": "TRANSFORM",
            "annual_revenue_usd_mn": 386_201,
            "employees": "103,000",
            "transformation_target": "Net-zero by 2050, Powering Progress strategy",
        },
        published_source=(
            "Shell plc (2021). Powering Progress: Shell's strategy to accelerate "
            "the transition to net-zero emissions. Shell plc Annual Report 2023, "
            "pp. 4–18. Shell plc Form 20-F 2023."
        ),
        source_url="https://reports.shell.com/annual-report/2023/",
    ),

    # ── S06 ─────────────────────────────────────────────────────────────────
    Scenario(
        scenario_id="S06",
        company="Tata Motors",
        decision_type="ACQUIRE",
        geography="United Kingdom / Global",
        sector="Automotive",
        annual_revenue_usd_mn=44_000,
        employees="84,000",
        query=(
            "Should Tata Motors acquire Jaguar Land Rover from Ford Motor "
            "Company for $2.3 billion to establish a global premium automotive "
            "brand and gain advanced engineering capabilities for international "
            "market expansion?"
        ),
        company_context={
            "company_name": "Tata Motors",
            "sector": "Automotive",
            "geography": "United Kingdom",
            "decision_type": "ACQUIRE",
            "annual_revenue_usd_mn": 44_000,
            "employees": "84,000",
            "target_company": "Jaguar Land Rover",
            "deal_value_usd_mn": 2_300,
        },
        published_source=(
            "Tata Motors (2008). Tata Motors completes acquisition of Jaguar "
            "Land Rover. Press release, 2 June 2008. "
            "Tata Motors Annual Report 2008–09, pp. 5–9."
        ),
        source_url="https://www.tatamotors.com/press/tata-motors-completes-acquisition-of-jaguar-land-rover/",
    ),

    # ── S07 ─────────────────────────────────────────────────────────────────
    Scenario(
        scenario_id="S07",
        company="HSBC",
        decision_type="EXIT",
        geography="United States",
        sector="Banking / Financial Services",
        annual_revenue_usd_mn=51_680,
        employees="235,000",
        query=(
            "Should HSBC exit US mass-market retail banking by selling its "
            "branch network and consumer loan book to Citizens Financial Group "
            "and Cathay Bank in order to redeploy capital toward Asian and "
            "Middle Eastern growth markets?"
        ),
        company_context={
            "company_name": "HSBC",
            "sector": "Banking / Financial Services",
            "geography": "United States",
            "decision_type": "EXIT",
            "annual_revenue_usd_mn": 51_680,
            "employees": "235,000",
            "divested_unit": "HSBC USA retail branch network (148 branches)",
            "deal_value_usd_mn": 10_000,
        },
        published_source=(
            "HSBC Holdings plc (2021). HSBC agrees sale of its US retail banking "
            "business. Press release, 26 May 2021. HSBC Annual Report 2020, p. 22."
        ),
        source_url="https://www.hsbc.com/news-and-views/news/hsbc-news/2021/hsbc-agrees-sale-of-us-retail-banking-business",
    ),

    # ── S08 ─────────────────────────────────────────────────────────────────
    Scenario(
        scenario_id="S08",
        company="Reliance Industries",
        decision_type="ENTER",
        geography="India",
        sector="Telecommunications",
        annual_revenue_usd_mn=86_000,
        employees="236,000",
        query=(
            "Should Reliance Industries launch Jio, a greenfield 4G LTE "
            "telecommunications network, with a capital investment of ₹1.5 lakh "
            "crore (~$23 billion) and a free-services customer acquisition strategy "
            "to disrupt the incumbent Indian telecom oligopoly?"
        ),
        company_context={
            "company_name": "Reliance Industries",
            "sector": "Telecommunications",
            "geography": "India",
            "decision_type": "ENTER",
            "annual_revenue_usd_mn": 86_000,
            "employees": "236,000",
            "capital_investment_usd_mn": 23_000,
            "launch_strategy": "Free services customer acquisition for 6 months",
        },
        published_source=(
            "Reliance Industries Limited (2016). Annual Report 2015–16, pp. 10–24. "
            "TRAI Performance Indicators Report Q4 2016. "
            "Mukesh Ambani, Chairman's Statement, Reliance AGM 2016."
        ),
        source_url="https://www.ril.com/InvestorRelations/AnnualReport.aspx",
    ),

    # ── S09 ─────────────────────────────────────────────────────────────────
    Scenario(
        scenario_id="S09",
        company="Nestlé",
        decision_type="ACQUIRE",
        geography="United States / Global",
        sector="FMCG / Nutrition & Health",
        annual_revenue_usd_mn=93_439,
        employees="276,000",
        query=(
            "Should Nestlé acquire The Bountiful Company (vitamins, minerals, "
            "and supplements) from KKR for $5.75 billion to accelerate its "
            "nutrition and health science strategy and gain a leading position "
            "in the fast-growing US and global VMS market?"
        ),
        company_context={
            "company_name": "Nestlé",
            "sector": "FMCG / Nutrition & Health",
            "geography": "United States",
            "decision_type": "ACQUIRE",
            "annual_revenue_usd_mn": 93_439,
            "employees": "276,000",
            "target_company": "The Bountiful Company",
            "deal_value_usd_mn": 5_750,
        },
        published_source=(
            "Nestlé S.A. (2021). Nestlé signs agreement to acquire The Bountiful "
            "Company's core brands. Press release, 7 April 2021. "
            "Nestlé Annual Report 2021, pp. 8–10."
        ),
        source_url="https://www.nestle.com/media/pressreleases/allpressreleases/nestle-acquire-bountiful-company-core-brands",
    ),

    # ── S10 ─────────────────────────────────────────────────────────────────
    Scenario(
        scenario_id="S10",
        company="IBM",
        decision_type="DIVEST",
        geography="United States / Global",
        sector="Technology / IT Services",
        annual_revenue_usd_mn=73_620,
        employees="282,100",
        query=(
            "Should IBM spin off its managed infrastructure services business "
            "(subsequently named Kyndryl) as a separately listed public company "
            "to refocus the remaining IBM entity on hybrid cloud and AI, and "
            "unlock value for shareholders by separating two structurally different "
            "business models?"
        ),
        company_context={
            "company_name": "IBM",
            "sector": "Technology / IT Services",
            "geography": "United States",
            "decision_type": "DIVEST",
            "annual_revenue_usd_mn": 73_620,
            "employees": "282,100",
            "divested_unit": "Kyndryl Holdings (managed infrastructure services)",
            "separation_mechanism": "Tax-free spin-off / IPO",
        },
        published_source=(
            "IBM Corporation (2020). IBM Announces Intent to Separate Managed "
            "Infrastructure Services Unit into New Public Company. "
            "Press release, 8 October 2020. "
            "Kyndryl Holdings Inc. Form S-1, SEC Accession 0001867072-21-000001."
        ),
        source_url="https://newsroom.ibm.com/2020-10-08-IBM-Announces-Intent-to-Separate-Managed-Infrastructure-Services-Unit-into-New-Public-Company",
    ),
]

SCENARIO_INDEX: dict[str, Scenario] = {s.scenario_id: s for s in SCENARIOS}
