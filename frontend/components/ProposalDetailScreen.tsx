"use client";
// CommunityPulse — Proposal Detail Screen
// Session 6

import { useState, useEffect } from "react";
import { Proposal, Community } from "../types";
import { getCommunityMembers } from "../lib/contract";

interface ProposalDetailProps {
  proposal: Proposal;
  community: Community | null;
  playerAddress: string;
  onAddPulse: () => void;
  onRevise: () => void;
  onBack: () => void;
  loading: string;
  error: string;
}

const PRINCIPLE_LABELS: Record<string, string> = {
  purpose_alignment:  "Purpose Alignment",
  community_benefit:  "Community Benefit",
  constitutional_fit: "Constitutional Fit",
  feasibility:        "Feasibility",
  value_for_money:    "Value for Money",
};

function getBarColor(score: number): "green" | "amber" | "red" {
  if (score >= 70) return "green";
  if (score >= 50) return "amber";
  return "red";
}

function getScoreColor(score: number): string {
  if (score >= 70) return "#00FF87";
  if (score >= 50) return "#FFD600";
  return "#FF4D6D";
}

export default function ProposalDetailScreen({
  proposal,
  community,
  playerAddress,
  onAddPulse,
  onRevise,
  onBack,
  loading,
  error,
}: ProposalDetailProps) {
  const [memberAddresses, setMemberAddresses] = useState<string[]>([]);
  const [pulseAddresses, setPulseAddresses] = useState<string[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const isLoading = !!loading;
  const isScored = proposal.total_score !== null;
  const isOwn = proposal.proposer === playerAddress;

  const isMember = memberAddresses.includes(playerAddress);
  const hasPulsed = pulseAddresses.includes(playerAddress);

  const canPulse =
    isMember &&
    !hasPulsed &&
    ["pending", "scoring", "scored"].includes(proposal.status);

  const canRevise =
    isOwn &&
    proposal.status === "revision" &&
    proposal.revision_count === 0;

  // Load member list and pulse list to determine pulse eligibility
  useEffect(() => {
    async function load() {
      if (!community) return;
      try {
        const members = await getCommunityMembers(community.id);
        setMemberAddresses(members || []);
      } catch {
        // silent
      } finally {
        setMembersLoaded(true);
      }
    }
    load();
  }, [community]);

  // Pulse addresses come from proposal_pulses — not directly on proposal object.
  // We track optimistically: if pulse_count changed we know someone pulsed.
  // For "has current user pulsed" we store in local state after they click.
  const [localPulsed, setLocalPulsed] = useState(false);

  function handlePulse() {
    setLocalPulsed(true);
    onAddPulse();
  }

  const effectivelyPulsed = localPulsed || hasPulsed;
  const effectivelyCanPulse = canPulse && !localPulsed;

  const principleEntries = Object.entries(PRINCIPLE_LABELS).map(([key, label]) => ({
    key,
    label,
    score: proposal.principle_scores?.[key as keyof typeof proposal.principle_scores] ?? null,
  }));

  const fundingThreshold = community?.funding_threshold ?? 70;

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Proposals</button>

      {/* ── Status badge ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span className={`status-badge status-badge--${proposal.status}`} style={{ fontSize: "14px", padding: "6px 16px" }}>
          {proposal.status === "funded"   && "✅ "}
          {proposal.status === "revision" && "🔄 "}
          {proposal.status === "rejected" && "❌ "}
          {proposal.status === "scoring"  && "⏳ "}
          {proposal.status === "pending"  && "🕐 "}
          {proposal.status === "scored"   && "📊 "}
          {proposal.status.toUpperCase()}
        </span>
        {proposal.is_revision && (
          <span style={{ fontSize: "12px", color: "#A78BFA", fontWeight: 700, letterSpacing: "0.04em" }}>
            ↩ REVISION OF {proposal.original_proposal_id}
          </span>
        )}
        {isOwn && (
          <span style={{ fontSize: "12px", color: "#00D4FF", fontWeight: 600 }}>
            Your proposal
          </span>
        )}
      </div>

      {/* ── Proposal header ── */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em", color: "#F0F0F0", lineHeight: 1.1, flex: 1 }}>
            {proposal.title}
          </h2>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", color: "#00FF87", letterSpacing: "0.02em", lineHeight: 1 }}>
              {proposal.amount.toLocaleString()}
            </div>
            <div style={{ fontSize: "10px", color: "#555566", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Requested
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <div className="field-label" style={{ marginBottom: "4px" }}>What it does</div>
            <div style={{ fontSize: "14px", color: "#C0C0D0", lineHeight: 1.6 }}>{proposal.what_it_does}</div>
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: "4px" }}>Who it helps</div>
            <div style={{ fontSize: "14px", color: "#C0C0D0", lineHeight: 1.6 }}>{proposal.who_it_helps}</div>
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: "4px" }}>Success metric</div>
            <div style={{ fontSize: "14px", color: "#C0C0D0", lineHeight: 1.6 }}>{proposal.success_metric}</div>
          </div>
          <div>
            <div className="field-label" style={{ marginBottom: "4px" }}>Timeline</div>
            <div style={{ fontSize: "14px", color: "#C0C0D0", lineHeight: 1.6 }}>{proposal.timeline}</div>
          </div>
        </div>

        <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "12px", color: "#555566" }}>
          Proposed by <strong style={{ color: "#888899" }}>{proposal.proposer_name}</strong>
          {" · "}{proposal.id}
        </div>
      </div>

      {/* ── Scoring — only shown after scoring ── */}
      {isScored && (
        <div className="card card--elevated fadeIn" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="section-label">AI Evaluation</div>

          {/* Score summary */}
          <div className="score-summary">
            <span className="base">Base: <strong style={{ color: "#F0F0F0" }}>{proposal.base_score}</strong></span>
            <span className="plus">+</span>
            <span className="pulse-b">Pulse: <strong>{proposal.pulse_bonus}</strong></span>
            <span className="eq">=</span>
            <span className="total" style={{ color: getScoreColor(proposal.total_score!) }}>
              {proposal.total_score}
            </span>
            <span style={{ fontSize: "13px", color: "#555566" }}>/100</span>
          </div>

          {/* Threshold indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#555566" }}>
            <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "100px", position: "relative", overflow: "visible" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: `${proposal.total_score!}%`,
                  background: getScoreColor(proposal.total_score!),
                  borderRadius: "100px",
                  transition: "width 0.8s ease",
                }}
              />
              {/* Threshold marker */}
              <div
                style={{
                  position: "absolute",
                  left: `${fundingThreshold}%`,
                  top: "-3px",
                  width: "2px",
                  height: "10px",
                  background: "#F0F0F0",
                  borderRadius: "1px",
                }}
                title={`Threshold: ${fundingThreshold}`}
              />
            </div>
            <span>Threshold: {fundingThreshold}</span>
          </div>

          {/* Five principle bars */}
          <div className="score-bars">
            {principleEntries.map(({ key, label, score }) => {
              if (score === null) return null;
              const color = getBarColor(score);
              return (
                <div key={key} className="score-bar-row">
                  <div className="score-bar-label">{label}</div>
                  <div className="score-bar-track">
                    <div
                      className={`score-bar-fill score-bar-fill--${color}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <div className={`score-bar-num score-bar-num--${color}`}>{score}</div>
                </div>
              );
            })}
          </div>

          {/* AI reasoning */}
          {proposal.reasoning && (
            <div>
              <div className="field-label" style={{ marginBottom: "6px" }}>Reasoning</div>
              <div className="reasoning-block">{proposal.reasoning}</div>
            </div>
          )}

          {/* Concerns — only for revision or rejected */}
          {proposal.concerns && (proposal.status === "revision" || proposal.status === "rejected") && (
            <div>
              <div className="field-label" style={{ marginBottom: "6px" }}>Concerns</div>
              <div className="concerns-block">{proposal.concerns}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Scoring in progress ── */}
      {(proposal.status === "scoring" || proposal.status === "pending") && (
        <div className="card card--purple" style={{ textAlign: "center", padding: "24px" }}>
          <div className="ai-dots" style={{ justifyContent: "center", marginBottom: "10px" }}>
            <span /><span /><span />
          </div>
          <div style={{ fontSize: "14px", color: "#A78BFA", fontWeight: 600 }}>
            AI is evaluating this proposal...
          </div>
          <div style={{ fontSize: "13px", color: "#555566", marginTop: "6px" }}>
            Check back in a few minutes
          </div>
        </div>
      )}

      {/* ── Pulse section ── */}
      <div className="pulse-section">
        <div className="section-label">Community Pulse</div>

        <div className="pulse-count-display">
          <div className="pulse-count-num">{proposal.pulse_count}</div>
          <div className="pulse-count-label">
            member{proposal.pulse_count !== 1 ? "s" : ""} support this proposal
          </div>
        </div>

        {membersLoaded && (
          effectivelyPulsed ? (
            <div
              style={{
                padding: "12px 16px",
                background: "rgba(167,139,250,0.1)",
                border: "1px solid rgba(167,139,250,0.3)",
                borderRadius: "12px",
                fontSize: "14px",
                color: "#A78BFA",
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              ✓ You supported this
            </div>
          ) : effectivelyCanPulse ? (
            <button
              className="btn-secondary"
              style={{ borderColor: "rgba(167,139,250,0.4)", color: "#A78BFA" }}
              onClick={handlePulse}
              disabled={isLoading}
            >
              {isLoading && loading === "Adding pulse..." ? (
                <span className="btn-loading"><span className="spinner" />Adding pulse...</span>
              ) : (
                "❤️ Add Your Pulse"
              )}
            </button>
          ) : !isMember ? (
            <div style={{ fontSize: "13px", color: "#555566" }}>
              Join this community to add your pulse.
            </div>
          ) : (
            <div style={{ fontSize: "13px", color: "#555566" }}>
              Pulsing is available while the proposal is pending or scoring.
            </div>
          )
        )}

        <div style={{ fontSize: "12px", color: "#555566", lineHeight: 1.5 }}>
          Pulse signals = up to <strong style={{ color: "#A78BFA" }}>+5 bonus points</strong> on the AI score.
          One pulse per member. Not token-weighted.
        </div>
      </div>

      {/* ── Revise button ── */}
      {canRevise && (
        <div
          style={{
            padding: "16px",
            background: "rgba(255,214,0,0.04)",
            border: "1px solid rgba(255,214,0,0.2)",
            borderRadius: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "13px", color: "#FFD600", fontWeight: 600 }}>
            🔄 This proposal is in revision
          </div>
          <div style={{ fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
            The AI flagged concerns. You have one chance to revise and resubmit. Address the concerns above before revising.
          </div>
          <button className="btn-primary" onClick={onRevise} style={{ marginTop: "4px" }}>
            Revise &amp; Resubmit →
          </button>
        </div>
      )}

      {/* ── Already revised ── */}
      {isOwn && proposal.status === "revision" && proposal.revision_count > 0 && (
        <div
          style={{
            padding: "14px 16px",
            background: "rgba(255,77,109,0.05)",
            border: "1px solid rgba(255,77,109,0.2)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#FF4D6D",
            lineHeight: 1.5,
          }}
        >
          ❌ This proposal has already been revised once. No further revisions are allowed.
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
