// CommunityPulse V2 — Shared Types
// Changes from V1: Community.member_stake added

export type Screen =
  | "landing"
  | "create_community"
  | "join_community"
  | "community_dashboard"
  | "proposal_feed"
  | "submit_proposal"
  | "proposal_detail"
  | "judging"
  | "constitution"
  | "treasury";

export interface Constitution {
  purpose: string;
  always_fund: string;
  never_fund: string;
  who_benefits: string;
  success_looks_like: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  founder: string;
  founder_name: string;
  constitution: Constitution;
  pot_balance: number;
  funding_threshold: number;
  max_proposal_pct: number;
  proposal_fee: number;
  member_stake: number;    // V2 NEW — USDC required to join (0 = free)
  member_count: number;
  proposal_count: number;
  funded_count: number;
  total_funded: number;
  status: "active" | "paused" | "depleted";
  created_at: number;
}

export interface PrincipleScores {
  purpose_alignment: number | null;
  community_benefit: number | null;
  constitutional_fit: number | null;
  feasibility: number | null;
  value_for_money: number | null;
}

export interface Proposal {
  id: string;
  community_id: string;
  proposer: string;
  proposer_name: string;
  title: string;
  amount: number;
  what_it_does: string;
  who_it_helps: string;
  success_metric: string;
  timeline: string;
  status: "pending" | "scoring" | "scored" | "revision" | "funded" | "rejected";
  is_revision: boolean;
  original_proposal_id: string | null;
  pulse_count: number;
  pulse_bonus: number;
  base_score: number | null;
  total_score: number | null;
  principle_scores: PrincipleScores;
  recommendation: string | null;
  reasoning: string | null;
  concerns: string | null;
  revision_count: number;
  created_at: number;
}

export interface AppState {
  screen: Screen;
  playerAddress: string;
  playerName: string;
  activeCommunityId: string;
  activeProposalId: string;
  community: Community | null;
  proposal: Proposal | null;
  error: string;
  loading: string;
}
