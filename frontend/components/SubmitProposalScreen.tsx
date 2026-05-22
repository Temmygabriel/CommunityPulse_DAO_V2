"use client";
// CommunityPulse V2 — Submit Proposal Screen
// V2 Change: revision fee warning when pot is close to depleted

import { useState } from "react";
import { Community } from "../types";

interface SubmitProposalProps {
  community: Community; playerAddress: string;
  onSubmit: (params: { title: string; amount: number; whatItDoes: string; whoItHelps: string; successMetric: string; timeline: string; }) => void;
  onBack: () => void; loading: string; error: string;
}

export default function SubmitProposalScreen({ community, playerAddress, onSubmit, onBack, loading, error }: SubmitProposalProps) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [whatItDoes, setWhatItDoes] = useState("");
  const [whoItHelps, setWhoItHelps] = useState("");
  const [successMetric, setSuccessMetric] = useState("");
  const [timeline, setTimeline] = useState("");
  const [constitutionOpen, setConstitutionOpen] = useState(false);

  const isLoading = !!loading;
  const maxAllowed = Math.floor(community.pot_balance * community.max_proposal_pct / 100);
  const amountNum = parseInt(amount) || 0;
  const amountValid = amountNum > 0 && amountNum <= maxAllowed;
  const amountWarning = amountNum > maxAllowed && amountNum > 0;

  // V2: warn if pot after fee would be too small for a revision
  const potAfterFee = community.pot_balance - community.proposal_fee;
  const revisionFeeWarning = community.proposal_fee > 0 && potAfterFee < community.proposal_fee * 2;

  const canSubmit = title.trim() && amountValid && whatItDoes.trim() && whoItHelps.trim() && successMetric.trim() && timeline.trim() && !isLoading;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({ title: title.trim(), amount: amountNum, whatItDoes: whatItDoes.trim(), whoItHelps: whoItHelps.trim(), successMetric: successMetric.trim(), timeline: timeline.trim() });
  }

  const constitutionItems = [
    { tag: "PURPOSE", text: community.constitution.purpose },
    { tag: "ALWAYS FUND", text: community.constitution.always_fund },
    { tag: "NEVER FUND", text: community.constitution.never_fund },
    { tag: "WHO BENEFITS", text: community.constitution.who_benefits },
    { tag: "SUCCESS", text: community.constitution.success_looks_like },
  ];

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Dashboard</button>
      <div>
        <h2 className="screen-title">Submit Proposal</h2>
        <p className="screen-sub" style={{ marginTop: "4px" }}>
          {community.name} · Pot: <strong style={{ color: "#00FF87" }}>{community.pot_balance.toLocaleString()}</strong> · Max: <strong style={{ color: "#F0F0F0" }}>{maxAllowed.toLocaleString()}</strong> · Fee: <strong style={{ color: "#F0F0F0" }}>{community.proposal_fee}</strong>
        </p>
      </div>

      {/* V2: revision fee warning */}
      {revisionFeeWarning && (
        <div style={{ padding: "12px 14px", background: "rgba(255,214,0,0.05)", border: "1px solid rgba(255,214,0,0.2)", borderRadius: "12px", fontSize: "13px", color: "#FFD600", lineHeight: 1.5 }}>
          ⚠️ The pot is running low. Note: if this proposal needs revision, the {community.proposal_fee} fee will be deducted again on resubmission — the revision may fail if the pot can't cover it.
        </div>
      )}

      {/* Constitution accordion */}
      <div style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.18)", borderRadius: "14px", overflow: "hidden" }}>
        <button onClick={() => setConstitutionOpen(!constitutionOpen)} style={{ width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "16px" }}>⚖️</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#00D4FF", letterSpacing: "0.04em" }}>READ THE CONSTITUTION BEFORE PROPOSING</span>
          </div>
          <span style={{ color: "#00D4FF", fontSize: "16px" }}>{constitutionOpen ? "▲" : "▼"}</span>
        </button>
        {constitutionOpen && (
          <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid rgba(0,212,255,0.12)" }}>
            {constitutionItems.map(({ tag, text }) => (
              <div key={tag} style={{ paddingTop: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "#00D4FF", textTransform: "uppercase", marginBottom: "4px" }}>{tag}</div>
                <div style={{ fontSize: "13px", color: "#C0C0D0", lineHeight: 1.6 }}>{text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="form-section-title">Your Proposal</div>
        <div className="field-group">
          <label className="field-label">Title — short and punchy</label>
          <input type="text" placeholder="e.g. Open Source Solidity Toolkit for WAFR Devs" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <div className="field-group">
          <label className="field-label">Amount Requested{amountNum > 0 && <span style={{ marginLeft: "8px", color: amountValid ? "#00FF87" : "#FF4D6D", fontSize: "12px" }}>{amountValid ? "✓ within limit" : `✗ exceeds max ${maxAllowed.toLocaleString()}`}</span>}</label>
          <input type="number" min={1} max={maxAllowed} placeholder={`Max ${maxAllowed.toLocaleString()}`} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ borderColor: amountWarning ? "rgba(255,77,109,0.5)" : undefined }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#555566" }}>
            <span>Pot: {community.pot_balance.toLocaleString()} · Max {community.max_proposal_pct}%</span>
            <span style={{ color: "#888899" }}>Fee: {community.proposal_fee} deducted on submit</span>
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">What it does — specifically what will this fund?</label>
          <textarea placeholder="Describe exactly what will be built, created, or delivered." value={whatItDoes} onChange={(e) => setWhatItDoes(e.target.value)} maxLength={500} style={{ minHeight: "100px" }} />
        </div>
        <div className="field-group">
          <label className="field-label">Who it helps — which members benefit and how?</label>
          <textarea placeholder="Name specific member groups or roles who directly benefit." value={whoItHelps} onChange={(e) => setWhoItHelps(e.target.value)} maxLength={300} style={{ minHeight: "80px" }} />
        </div>
        <div className="field-group">
          <label className="field-label">Success metric — how do we know it worked?</label>
          <input type="text" placeholder="e.g. 50 developers use the toolkit within 30 days of launch" value={successMetric} onChange={(e) => setSuccessMetric(e.target.value)} maxLength={200} />
        </div>
        <div className="field-group">
          <label className="field-label">Timeline — when will this be done?</label>
          <input type="text" placeholder="e.g. 6 weeks from funding — v1 delivered by end of month 2" value={timeline} onChange={(e) => setTimeline(e.target.value)} maxLength={200} />
        </div>
      </div>

      <div style={{ padding: "14px 16px", background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "12px", fontSize: "13px", color: "#888899", lineHeight: 1.6 }}>
        <strong style={{ color: "#A78BFA" }}>⚖️ AI Scoring</strong> — the AI will score your proposal 0–100 across five dimensions. Proposals scoring ≥ {community.funding_threshold} are funded automatically. Scores 50–{community.funding_threshold - 1} enter revision. Below 50 are rejected.
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
        {isLoading ? <span className="btn-loading"><span className="spinner" />{loading}</span> : "Submit Proposal →"}
      </button>

      <p className="hint-text">
        {community.proposal_fee > 0 ? `${community.proposal_fee} will be deducted from the pot as a submission fee.` : "No submission fee for this community."}{" "}AI evaluation takes 3–5 minutes.
      </p>
    </div>
  );
}