"use client";
// CommunityPulse — Judging Screen
// Session 5
// Two contexts: "community" (waiting for create tx) and "proposal" (waiting for AI eval)

import { useState } from "react";

interface JudgingProps {
  context: "community" | "proposal";
  communityName: string;
  proposalId: string;
  proposalTitle: string;
  onGoHome: () => void;
  onViewProposals: () => void;
}

export default function JudgingScreen({
  context,
  communityName,
  proposalId,
  proposalTitle,
  onGoHome,
  onViewProposals,
}: JudgingProps) {
  const [copied, setCopied] = useState(false);

  function copyProposalId() {
    if (!proposalId) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(proposalId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => fallbackCopy(proposalId));
    } else {
      fallbackCopy(proposalId);
    }
  }

  function fallbackCopy(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
    document.body.removeChild(textarea);
  }

  // ── Shared escape buttons ──
  const escapeButtons = (
    <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "400px" }}>
      <button className="btn-outline" onClick={onGoHome} style={{ flex: 1 }}>
        ← Home
      </button>
      {context === "proposal" && (
        <button className="btn-secondary" onClick={onViewProposals} style={{ flex: 1 }}>
          View Proposals →
        </button>
      )}
    </div>
  );

  if (context === "community") {
    return (
      <div className="screen screen--centered fadeIn">
        <div className="submitted-state">

          <div className="judging-block">
            <div className="judging-icon">🏛️</div>
            <div className="judging-title">Setting Up Community</div>
            {communityName && (
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.4rem", color: "#F0F0F0", letterSpacing: "0.06em" }}>
                {communityName}
              </div>
            )}
            <p className="judging-sub">
              Deploying your community to the GenLayer network.
              Writing your constitution on-chain.
            </p>
            <div className="ai-dots" style={{ marginTop: "8px" }}>
              <span /><span /><span />
            </div>
            <p style={{ fontSize: "13px", color: "#555566", lineHeight: 1.6 }}>
              This takes <strong style={{ color: "#A78BFA" }}>30–60 seconds</strong>. Please keep this tab open.
            </p>
          </div>

          <div
            style={{
              padding: "16px 18px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              width: "100%",
              maxWidth: "420px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888899" }}>
              What happens next
            </div>
            {[
              ["1", "Community ID is assigned (e.g. COM000001)"],
              ["2", "You land on the community dashboard"],
              ["3", "Share your ID to invite members"],
              ["4", "Members can submit proposals immediately"],
            ].map(([step, text]) => (
              <div key={step} style={{ display: "flex", gap: "12px", alignItems: "flex-start", fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1rem", color: "#00FF87", minWidth: "16px" }}>{step}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {escapeButtons}

        </div>
      </div>
    );
  }

  // ── Proposal evaluation context ──
  return (
    <div className="screen screen--centered fadeIn">
      <div className="submitted-state">

        <div className="judging-block">
          <div className="judging-icon">⚖️</div>
          <div className="judging-title">AI is Evaluating</div>
          {proposalTitle && (
            <div style={{ fontSize: "14px", color: "#C0C0D0", fontStyle: "italic", lineHeight: 1.5 }}>
              "{proposalTitle}"
            </div>
          )}
          <p className="judging-sub">
            Reading the constitution. Scoring against your community values.
            Calculating pulse bonus.
          </p>
          <div className="ai-dots" style={{ marginTop: "8px" }}>
            <span /><span /><span />
          </div>
          <p style={{ fontSize: "13px", color: "#555566", lineHeight: 1.6 }}>
            This takes <strong style={{ color: "#A78BFA" }}>3–5 minutes</strong>. You can come back later using your proposal ID.
          </p>
        </div>

        {/* Proposal ID escape hatch */}
        {proposalId && (
          <div
            style={{
              background: "rgba(0,212,255,0.06)",
              border: "1px solid rgba(0,212,255,0.2)",
              borderRadius: "12px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              width: "100%",
              maxWidth: "400px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#00D4FF" }}>
              Your Proposal ID — save this
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "2rem",
                letterSpacing: "0.14em",
                color: "#F0F0F0",
                cursor: "pointer",
              }}
              onClick={copyProposalId}
              title="Click to copy"
            >
              {proposalId}
            </div>
            <button
              onClick={copyProposalId}
              style={{
                fontSize: "12px",
                color: copied ? "#00FF87" : "#00D4FF",
                border: `1px solid ${copied ? "rgba(0,255,135,0.4)" : "rgba(0,212,255,0.2)"}`,
                borderRadius: "8px",
                padding: "4px 12px",
                background: copied ? "rgba(0,255,135,0.08)" : "none",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                margin: "0 auto",
                transition: "all 0.2s",
              }}
            >
              {copied ? "✓ Copied!" : "Copy ID"}
            </button>
            <div style={{ fontSize: "13px", color: "#888899", lineHeight: 1.6 }}>
              Can't wait? Use the buttons below to go home or view proposals once scoring is complete.
            </div>
          </div>
        )}

        {/* What the AI checks */}
        <div
          style={{
            padding: "16px 18px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "100%",
            maxWidth: "400px",
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#888899" }}>
            What the AI scores
          </div>
          {[
            ["🎯", "Purpose alignment",  "Does it match the community's stated mission?"],
            ["👥", "Community benefit",  "Does it help the majority of members?"],
            ["📜", "Constitutional fit", "Does it respect the always/never fund rules?"],
            ["🔧", "Feasibility",        "Is the timeline and metric realistic?"],
            ["💸", "Value for money",    "Is the amount reasonable for the outcome?"],
            ["❤️",  "Pulse bonus",        "Up to +5 pts from community support"],
          ].map(([icon, label, desc]) => (
            <div key={String(label)} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "15px", flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontSize: "13px", color: "#F0F0F0", fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: "12px", color: "#555566", lineHeight: 1.4 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {escapeButtons}

      </div>
    </div>
  );
}