"use client";
// CommunityPulse — Constitution Screen
// Session 6

import { Community } from "../types";

interface ConstitutionProps {
  community: Community;
  onBack: () => void;
}

const CONSTITUTION_CARDS = [
  {
    key:   "purpose",
    tag:   "PURPOSE",
    icon:  "🎯",
    label: "What this community is for",
  },
  {
    key:   "always_fund",
    tag:   "WE ALWAYS FUND",
    icon:  "✅",
    label: "What we will always fund",
  },
  {
    key:   "never_fund",
    tag:   "WE NEVER FUND",
    icon:  "🚫",
    label: "What we will never fund",
  },
  {
    key:   "who_benefits",
    tag:   "WHO BENEFITS",
    icon:  "👥",
    label: "Who benefits most from our decisions",
  },
  {
    key:   "success_looks_like",
    tag:   "SUCCESS LOOKS LIKE",
    icon:  "🏆",
    label: "What success looks like for us",
  },
];

export default function ConstitutionScreen({ community, onBack }: ConstitutionProps) {
  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Dashboard</button>

      <div>
        <h2 className="screen-title">Constitution</h2>
        <p className="screen-sub" style={{ marginTop: "4px" }}>
          {community.name}
        </p>
      </div>

      {/* ── AI scoring notice ── */}
      <div
        style={{
          padding: "14px 16px",
          background: "rgba(167,139,250,0.05)",
          border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: "12px",
          fontSize: "13px",
          color: "#888899",
          lineHeight: 1.6,
        }}
      >
        ⚖️ The AI reads these five sentences before scoring every proposal. They cannot be changed after the community is created — the constitution is permanent.
      </div>

      {/* ── Five cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {CONSTITUTION_CARDS.map(({ key, tag, icon, label }) => {
          const text = community.constitution[key as keyof typeof community.constitution];
          return (
            <div key={key} className="constitution-card">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.2rem" }}>{icon}</span>
                <div className="constitution-card-tag">{tag}</div>
              </div>
              <div style={{ fontSize: "11px", color: "#555566", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                {label}
              </div>
              <div className="constitution-card-text">{text}</div>
            </div>
          );
        })}
      </div>

      {/* ── Founder info ── */}
      <div
        style={{
          padding: "14px 16px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888899" }}>
          Community Info
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#888899" }}>
          <div>
            Founded by <strong style={{ color: "#F0F0F0" }}>{community.founder_name}</strong>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#555566", wordBreak: "break-all" }}>
            {community.founder}
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "4px" }}>
            <span>🎯 Threshold: <strong style={{ color: "#F0F0F0" }}>{community.funding_threshold}/100</strong></span>
            <span>📏 Max proposal: <strong style={{ color: "#F0F0F0" }}>{community.max_proposal_pct}%</strong></span>
            <span>🎟️ Fee: <strong style={{ color: "#F0F0F0" }}>{community.proposal_fee}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}