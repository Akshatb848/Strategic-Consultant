// ── shared type re-exports ───────────────────────────────────────────────────
export type { SearchResult } from '../lib/webSearch';
import type { SearchResult } from '../lib/webSearch';

export interface AgentInput {
  analysisId: string;
  problemStatement: string;
  organisationContext: string;
  industryContext: string;
  geographyContext: string;
  decisionType: string;
  upstreamResults: Partial<PipelineState>;
  semanticMemoryContext?: string;  // Past analyses context
  searchResults?: SearchResult[];  // Web search results pre-fetched
}

export interface AgentOutput {
  agentId: AgentId;
  status: 'completed' | 'failed' | 'self_corrected';
  data: Record<string, unknown>;
  confidenceScore: number;
  durationMs: number;
  attemptNumber: number;
  selfCorrected: boolean;
  correctionReason?: string;
  tokenUsage: { input: number; output: number };
}

export type AgentId = 'strategist' | 'quant' | 'market_intel' | 'risk' | 'red_team' | 'ethicist' | 'synthesis' | 'cove';

export interface PipelineState {
  analysisId: string;
  problemStatement: string;
  organisationContext: string;
  industryContext: string;
  geographyContext: string;
  decisionType: string;
  status: 'running' | 'completed' | 'failed';
  currentAgent: AgentId | null;
  strategistData: StrategistOutput | null;
  quantData: QuantOutput | null;
  marketIntelData: MarketIntelOutput | null;
  riskData: RiskOutput | null;
  redTeamData: RedTeamOutput | null;
  ethicistData: EthicistOutput | null;
  synthesisData: SynthesisOutput | null;
  coveData: CoVeOutput | null;
  agentConfidences: Record<AgentId, number>;
  selfCorrectionCount: number;
  logicConsistencyPassed: boolean | null;
  overallConfidence: number | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface CompanyProfile {
  name: string;
  estimated_revenue_usd: string;
  revenue_tier: 'MEGA_CAP' | 'LARGE_CAP' | 'MID_CAP' | 'SME' | 'UNSPECIFIED';
  ebitda_margin_pct: number | null;
  market_cap_usd: string;
  headquarters: string;
  primary_sector: string;
  key_subsidiaries_or_divisions: string[];
  [k: string]: unknown;
}

export interface Citation {
  id: string;
  title: string;
  publisher: string;
  url: string;
  year: string;
  relevance: string;
}

export interface StrategistOutput {
  company_profile: CompanyProfile;
  problem_decomposition: string[];
  mece_tree: MECEBranch[];
  analytical_framework: string;
  agent_assignments: Record<string, string>;
  key_hypotheses: string[];
  success_criteria: string[];
  decision_type: string;
  confidence_score: number;
  strategic_priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  time_horizon: string;
  context: { org: string; industry: string; geography: string };
  swot_analysis: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  ansoff_matrix: { current_position: string; recommended_move: string; rationale: string; risk_level: string; expected_revenue_impact: string };
  mckinsey_7s: Record<string, { current_state: string; alignment_with_decision: string }>;
  acquisition_prerequisites: AcquisitionPrerequisites | null;
  citations: Citation[];
  [k: string]: unknown;
}

export interface AcquisitionPrerequisites {
  strategic_fit_score: number;
  integration_complexity: 'Low' | 'Medium' | 'High' | 'Very High';
  synergy_estimate: string;
  build_vs_buy_trigger: string;
  due_diligence_priorities: string[];
  anti_trust_risk: string;
}

export interface MECEBranch {
  label: string;
  sub_questions: string[];
  assigned_agent: AgentId;
}

export interface MarketSizing {
  tam: { value: string; basis: string; cagr: string; year: string };
  sam: { value: string; calculation: string; rationale: string };
  som: { value: string; calculation: string; timeline: string };
  unit_economics: {
    addressable_customers: number;
    average_contract_value_usd: number;
    conversion_rate_pct: number;
    year1_revenue_usd: number;
    gross_margin_pct: number;
  };
}

export interface BCGMatrix {
  quadrant: 'Star' | 'Cash Cow' | 'Question Mark' | 'Dog';
  relative_market_share: number;
  market_growth_rate_pct: number;
  x_axis: number;
  y_axis: number;
  named_market_leader: string;
  strategic_implication: string;
}

export interface QuantOutput {
  company_scale_assumption: string;
  market_sizing: MarketSizing;
  bcg_matrix: BCGMatrix;
  investment_scenarios: InvestmentScenario[];
  monte_carlo_summary: MonteCarloSummary;
  cost_of_inaction: string;
  recommended_scenario: string;
  recommended_budget: string;
  revenue_at_risk: string;
  key_financial_drivers: string[];
  payback_period: string;
  financial_risk_rating: 'HIGH' | 'MEDIUM' | 'LOW';
  sensitivity_factors: string[];
  confidence_score: number;
  cfo_recommendation: string;
  revenue_attribution_methodology: string | null;
  acquisition_premium_analysis: string | null;
  total_acquisition_cost: string | null;
  citations: Citation[];
  [k: string]: unknown;
}

export interface InvestmentScenario {
  scenario: string;
  horizon: string;
  description: string;
  capex: string;
  opex_annual: string;
  risk_reduction: string;
  npv_3yr: string;
  irr: string;
  roi_3yr: string;
  payback_months: number;
  probability_of_success: number;
}

export interface MonteCarloSummary {
  simulations_run: number;
  p10_outcome: string;
  p50_outcome: string;
  p90_outcome: string;
  worst_case: string;
  best_case: string;
  recommended_action: string;
}

export interface BlueOceanStrategy {
  strategy_canvas: Array<{
    factor: string;
    industry_avg: number;
    company_score: number;
    competitor_scores: Record<string, number>;
  }>;
  errc_grid: { eliminate: string[]; reduce: string[]; raise: string[]; create: string[] };
  blue_ocean_move: string;
}

export interface MarketIntelOutput {
  pestle_analysis: PESTLEAnalysis;
  porters_five_forces: PortersFiveForces;
  blue_ocean_strategy: BlueOceanStrategy;
  regulatory_landscape: RegulatoryItem[];
  market_signals: string[];
  key_findings: string[];
  emerging_risks: string[];
  opportunities: string[];
  data_sources: string[];
  confidence_score: number;
  strategic_implication: string;
  citations: Citation[];
  [k: string]: unknown;
}

export interface PESTLEAnalysis {
  political: string[];
  economic: string[];
  social: string[];
  technological: string[];
  legal: string[];
  environmental: string[];
}

export interface PortersFiveForces {
  supplier_power: { rating: 'High' | 'Medium' | 'Low'; rationale: string };
  buyer_power: { rating: 'High' | 'Medium' | 'Low'; rationale: string };
  competitive_rivalry: { rating: 'High' | 'Medium' | 'Low'; rationale: string };
  threat_of_substitution: { rating: 'High' | 'Medium' | 'Low'; rationale: string };
  threat_of_new_entry: { rating: 'High' | 'Medium' | 'Low'; rationale: string };
  overall_attractiveness: 'Very Attractive' | 'Attractive' | 'Moderate' | 'Unattractive';
}

export interface RegulatoryItem {
  name: string;
  jurisdiction: string;
  requirement: string;
  deadline: string;
  penalty_exposure: string;
  compliance_status: 'Compliant' | 'Partially Compliant' | 'Non-Compliant' | 'Unknown';
}

export interface RiskOutput {
  risk_register: RiskItem[];
  critical_risks: string[];
  mitigation_strategies: string[];
  residual_risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  risk_appetite_alignment: string;
  framework_used: string;
  heat_map_data: HeatMapPoint[];
  confidence_score: number;
  board_escalation_required: boolean;
  escalation_rationale: string;
  [k: string]: unknown;
}

export interface RiskItem {
  id: string;
  risk: string;
  category: 'Regulatory' | 'Cyber' | 'Talent' | 'Financial' | 'Operational' | 'Reputational' | 'Strategic';
  likelihood: 'High' | 'Medium' | 'Low';
  impact: 'Critical' | 'High' | 'Medium' | 'Low';
  velocity: 'Immediate' | 'Near-term' | 'Long-term';
  severity_score: number;
  owner: string;
  current_control: string;
  mitigation: string;
  residual_score: number;
}

export interface HeatMapPoint {
  risk_id: string;
  label: string;
  x: number;
  y: number;
  severity: number;
}

export interface RedTeamOutput {
  pre_mortem_scenarios: PreMortemScenario[];
  invalidated_claims: InvalidatedClaim[];
  surviving_claims: string[];
  talent_exodus_risk: string;
  competitor_response_scenarios: string[];
  build_vs_buy_invalidation: string | null;
  integration_failure_risks: string | null;
  confidence_score: number;
  overall_threat_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  red_team_verdict: string;
  [k: string]: unknown;
}

export interface PreMortemScenario {
  scenario: string;
  probability: 'High' | 'Medium' | 'Low';
  financial_impact: string;
  trigger_condition: string;
  mitigation: string;
}

export interface InvalidatedClaim {
  original_claim: string;
  source_agent: AgentId;
  invalidation_reason: string;
  evidence: string;
  severity: 'Fatal' | 'Major' | 'Minor';
}

export interface ValueChainActivity {
  current_state: string;
  competitive_advantage: 'Yes' | 'No' | 'Partial';
  gap_for_execution: string;
}

export interface VRIOItem {
  capability: string;
  valuable: boolean;
  rare: boolean;
  inimitable: boolean;
  organised: boolean;
  vrio_status: 'SUSTAINABLE_COMPETITIVE_ADVANTAGE' | 'UNUSED_COMPETITIVE_ADVANTAGE' | 'TEMPORARY_ADVANTAGE' | 'COMPETITIVE_PARITY' | 'COMPETITIVE_DISADVANTAGE';
  strategic_implication: string;
}

export interface EthicistOutput {
  value_chain_analysis: {
    primary_activities: Record<string, ValueChainActivity>;
    support_activities: Record<string, ValueChainActivity>;
    value_chain_verdict: string;
    margin_concentration: string;
  };
  vrio_assessment: VRIOItem[];
  brand_risk_assessment: string;
  esg_implications: string[];
  cultural_fit_score: number;
  regulatory_ethics_flags: string[];
  stakeholder_impact: StakeholderImpact[];
  capability_readiness_verdict: string;
  recommendation: 'Proceed' | 'Proceed with Conditions' | 'Pause' | 'Do Not Proceed';
  conditions: string[];
  confidence_score: number;
  citations: Citation[];
  [k: string]: unknown;
}

export interface StakeholderImpact {
  stakeholder: string;
  impact_type: 'Positive' | 'Negative' | 'Neutral';
  description: string;
  severity: 'High' | 'Medium' | 'Low';
}

export interface CoVeOutput {
  verification_checks: VerificationCheck[];
  logic_consistent: boolean;
  flagged_claims: FlaggedClaim[];
  self_corrections_applied: SelfCorrection[];
  overall_verification_score: number;
  recommendation: 'PASS' | 'CONDITIONAL_PASS' | 'FAIL_ROUTE_BACK';
  route_back_to?: AgentId;
  final_confidence_adjustment: number;
  llm_judge_score?: number;
  quality_grade?: 'A' | 'B' | 'C' | 'FAIL';
  judge_dimensions?: {
    evidence_quality: number;
    logical_consistency: number;
    specificity: number;
    financial_grounding: number;
    actionability: number;
  };
  [k: string]: unknown;
}

export interface VerificationCheck {
  claim: string;
  source_agent: AgentId;
  verified: boolean;
  evidence: string;
  industry_benchmark?: string;
}

export interface FlaggedClaim {
  claim: string;
  issue: string;
  severity: 'Fatal' | 'Major' | 'Minor';
  correction_applied: boolean;
}

export interface SelfCorrection {
  original: string;
  corrected: string;
  reason: string;
  agent_affected: AgentId;
}

export interface RedTeamResponse {
  fatal_invalidations_resolved: number;
  major_invalidations_adjusted: number;
  recommendation_changed: boolean;
  original_recommendation: string;
  adjustment_rationale: string;
}

export interface FrameworkSoWhat {
  implication: string;
  recommended_action: string;
  risk_of_inaction: string;
}

export interface SynthesisOutput {
  executive_summary: string;
  board_narrative: string;
  strategic_imperatives: string[];
  roadmap: RoadmapPhase[];
  balanced_scorecard: BalancedScorecard;
  competitive_benchmarks: BenchmarkItem[];
  success_metrics: string[];
  decision_recommendation: 'PROCEED' | 'HOLD' | 'ESCALATE' | 'REJECT';
  risk_adjusted_recommendation: string;
  overall_confidence: number;
  frameworks_applied: string[];
  framework_so_whats: Record<string, FrameworkSoWhat> | null;
  dissertation_contribution?: string;
  red_team_response: RedTeamResponse | null;
  three_options: unknown | null;
  build_vs_buy_verdict: string | null;
  citations: Citation[];
  [k: string]: unknown;
}

export interface RoadmapPhase {
  phase: string;
  timeline: string;
  focus: string;
  key_actions: Array<{ action: string; owner: string; deadline: string }>;
  investment: string;
  success_metric: string;
  dependencies: string[];
}

export interface BalancedScorecard {
  financial: { kpi: string; baseline: string; target: string; timeline: string };
  customer: { kpi: string; baseline: string; target: string; timeline: string };
  internal_process: { kpi: string; baseline: string; target: string; timeline: string };
  learning_growth: { kpi: string; baseline: string; target: string; timeline: string };
}

export interface BenchmarkItem {
  dimension: string;
  our_score: number;
  industry_avg: number;
  leader_score: number;
  gap_to_leader: number;
  named_leader: string;
}
