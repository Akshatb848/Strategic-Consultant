export interface AgentInput {
  analysisId: string;
  problemStatement: string;
  organisationContext: string;
  industryContext: string;
  geographyContext: string;
  decisionType: string;
  upstreamResults: Partial<PipelineState>;
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

export interface StrategistOutput {
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
}

export interface MECEBranch {
  label: string;
  sub_questions: string[];
  assigned_agent: AgentId;
}

export interface QuantOutput {
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

export interface MarketIntelOutput {
  pestle_analysis: PESTLEAnalysis;
  porters_five_forces: PortersFiveForces;
  regulatory_landscape: RegulatoryItem[];
  market_signals: string[];
  key_findings: string[];
  emerging_risks: string[];
  opportunities: string[];
  data_sources: string[];
  confidence_score: number;
  strategic_implication: string;
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
  confidence_score: number;
  overall_threat_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  red_team_verdict: string;
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

export interface EthicistOutput {
  brand_risk_assessment: string;
  esg_implications: string[];
  cultural_fit_score: number;
  regulatory_ethics_flags: string[];
  stakeholder_impact: StakeholderImpact[];
  recommendation: 'Proceed' | 'Proceed with Conditions' | 'Pause' | 'Do Not Proceed';
  conditions: string[];
  confidence_score: number;
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
  dissertation_contribution?: string;
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
