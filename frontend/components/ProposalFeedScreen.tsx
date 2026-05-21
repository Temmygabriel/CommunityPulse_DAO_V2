"use client";
// CommunityPulse — Proposal Feed Screen
// Session 5

import { useState, useEffect } from "react";
import { Community, Proposal } from "../types";
import { getCommunityProposals } from "../lib/contract";

interface ProposalFeedProps {
  community: Community;
  playerAddress: string;
  onSelectProposal: (proposal: Proposal) => void;
  onBack: () => void;
  loading: string;
}

type FilterStatus = "all" | "pending" | "funded" | "revision" | "rejected" | "scoring";

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: "all",      label: "All"      },
  { value: "funded",   label: "Funded"   },
  { value: "pending",  label: "Pending"  },
  { value: "revision", label: "Revision" },
  { value: "rejected", label: "Rejected" },
  { value: "scoring",  label: "Scoring"  },
];

export default function ProposalFeedScreen({
  community,
  playerAddress,
  onSelectProposal,
  onBack,
  loading,
}: ProposalFeedProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    async function load() {
      setFeedLoading(true);
      try {
        const data = await getCommunityProposals(community.id);
        // Most recent first
        const sorted = (data || []).sort(
          (a: Proposal, b: Proposal) => b.created_at - a.created_at
        );
        setProposals(sorted);
      } catch {
        // silent
      } finally {
        setFeedLoading(false);
      }
    }
    load();
  }, [community.id]);

  const filtered =
    filter === "all"
      ? proposals
      : proposals.filter((p) => p.status === filter);

  function getStatusEmoji(status: string) {
    switch (status) {
      case "funded":   return "✅";
      case "revision": return "🔄";
      case "rejected": return "❌";
      case "scoring":  return "⏳";
      case "pending":  return "🕐";
      case "scored":   return "📊";
      default:         return "•";
    }
  }

  function getScoreColor(score: number | null) {
    if (score === null) return "#555566";
    if (score >= community.funding_threshold) return "#00FF87";
    if (score >= 50) return "#FFD600";
    return "#FF4D6D";
  }

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Dashboard</button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="screen-title">Proposals</h2>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.2rem", color: "#555566", letterSpacing: "0.06em" }}>
          {community.name}
        </span>
      </div>

      {/* ── Filter tabs ── */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          overflowX: "auto",
          paddingBottom: "2px",
        }}
      >
        {STATUS_FILTERS.map(({ value, label }) => {
          const count = value === "all"
            ? proposals.length
            : proposals.filter((p) => p.status === value).length;
          const active = filter === value;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                padding: "6px 14px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                transition: "all 0.15s",
                background: active ? "rgba(0,255,135,0.12)" : "rgba(255,255,255,0.04)",
                color: active ? "#00FF87" : "#888899",
                border: active
                  ? "1px solid rgba(0,255,135,0.35)"
                  : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {label} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* ── Feed ── */}
      {feedLoading ? (
        <div className="loading-state">
          <span className="spinner" />
          <span>Loading proposals...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {filter === "all"
            ? "No proposals yet. Be the first to submit one."
            : `No ${filter} proposals.`}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((proposal) => {
            const isOwn = proposal.proposer === playerAddress;
            return (
              <div
                key={proposal.id}
                className="proposal-card"
                onClick={() => onSelectProposal(proposal)}
                style={{
                  borderColor: isOwn
                    ? "rgba(0,212,255,0.2)"
                    : "rgba(255,255,255,0.08)",
                }}
              >
                <div className="proposal-card-header">
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
                    <div className="proposal-card-title">
                      {getStatusEmoji(proposal.status)} {proposal.title}
                      {isOwn && (
                        <span style={{ fontSize: "11px", color: "#00D4FF", marginLeft: "8px", fontWeight: 400 }}>
                          (yours)
                        </span>
                      )}
                    </div>
                    {proposal.is_revision && (
                      <div style={{ fontSize: "11px", color: "#A78BFA", fontWeight: 600, letterSpacing: "0.04em" }}>
                        ↩ REVISION
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
                    <div className="proposal-card-amount">{proposal.amount.toLocaleString()}</div>
                    <span className={`status-badge status-badge--${proposal.status}`}>
                      {proposal.status}
                    </span>
                  </div>
                </div>

                <div className="proposal-card-what">{proposal.what_it_does}</div>

                <div className="proposal-card-meta">
                  <div className="proposal-card-proposer">
                    by {proposal.proposer_name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {/* Score if available */}
                    {proposal.total_score !== null && (
                      <div style={{ fontSize: "13px", fontWeight: 700, color: getScoreColor(proposal.total_score) }}>
                        {proposal.total_score}/100
                      </div>
                    )}
                    <div className="pulse-count">
                      ❤️ {proposal.pulse_count}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
