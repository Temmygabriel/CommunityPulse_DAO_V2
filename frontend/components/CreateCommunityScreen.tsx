"use client";
// CommunityPulse V2 — Create Community Screen
// Changes from V1: memberStake field in Treasury Settings section

import { useState } from "react";

interface CreateCommunityProps {
  playerAddress: string;
  playerName: string;
  onSubmit: (params: {
    founderName: string;
    communityName: string;
    description: string;
    constitutionPurpose: string;
    constitutionAlwaysFund: string;
    constitutionNeverFund: string;
    constitutionWhoBenefits: string;
    constitutionSuccess: string;
    initialPot: number;
    fundingThreshold: number;
    maxProposalPct: number;
    proposalFee: number;
    memberStake: number;       // V2 NEW
  }) => void;
  onBack: () => void;
  loading: string;
  error: string;
}

export default function CreateCommunityScreen({
  playerAddress,
  playerName,
  onSubmit,
  onBack,
  loading,
  error,
}: CreateCommunityProps) {
  const [founderName, setFounderName] = useState(playerName);
  const [communityName, setCommunityName] = useState("");
  const [description, setDescription] = useState("");

  // Constitution
  const [purpose, setPurpose] = useState("");
  const [alwaysFund, setAlwaysFund] = useState("");
  const [neverFund, setNeverFund] = useState("");
  const [whoBenefits, setWhoBenefits] = useState("");
  const [success, setSuccess] = useState("");

  // Treasury settings
  const [initialPot, setInitialPot] = useState(5000);
  const [fundingThreshold, setFundingThreshold] = useState(70);
  const [maxProposalPct, setMaxProposalPct] = useState(30);
  const [proposalFee, setProposalFee] = useState(10);
  const [memberStake, setMemberStake] = useState(2);   // V2 NEW — default 2 USDC

  const isLoading = !!loading;

  const canSubmit =
    founderName.trim() &&
    communityName.trim() &&
    description.trim() &&
    purpose.trim() &&
    alwaysFund.trim() &&
    neverFund.trim() &&
    whoBenefits.trim() &&
    success.trim() &&
    initialPot > 0 &&
    memberStake >= 0 &&
    !isLoading;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      founderName: founderName.trim(),
      communityName: communityName.trim(),
      description: description.trim(),
      constitutionPurpose: purpose.trim(),
      constitutionAlwaysFund: alwaysFund.trim(),
      constitutionNeverFund: neverFund.trim(),
      constitutionWhoBenefits: whoBenefits.trim(),
      constitutionSuccess: success.trim(),
      initialPot,
      fundingThreshold,
      maxProposalPct,
      proposalFee,
      memberStake,
    });
  }

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <h2 className="screen-title">Found a Community</h2>
      <p className="screen-sub">
        Write your constitution carefully — the AI will use it to judge every proposal forever.
      </p>

      {/* ── Identity ── */}
      <div className="form-section">
        <div className="form-section-title">Your Identity</div>

        <div
          style={{
            padding: "10px 14px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "12px",
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#555566",
          }}
        >
          {playerAddress}
        </div>

        <div className="field-group">
          <label className="field-label">Your Display Name</label>
          <input
            type="text"
            placeholder="How members will see you..."
            value={founderName}
            onChange={(e) => setFounderName(e.target.value)}
            maxLength={30}
          />
        </div>
      </div>

      {/* ── Community Info ── */}
      <div className="form-section">
        <div className="form-section-title">Community</div>

        <div className="field-group">
          <label className="field-label">Community Name</label>
          <input
            type="text"
            placeholder="e.g. Lagos Dev Guild, Green Africa Fund..."
            value={communityName}
            onChange={(e) => setCommunityName(e.target.value)}
            maxLength={60}
          />
        </div>

        <div className="field-group">
          <label className="field-label">Description</label>
          <textarea
            placeholder="One paragraph — what is this community and who is it for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            style={{ minHeight: "80px" }}
          />
        </div>
      </div>

      {/* ── Constitution ── */}
      <div className="form-section">
        <div className="form-section-title">Constitution — 5 Sentences</div>

        <div
          style={{
            padding: "12px 14px",
            background: "rgba(0,212,255,0.04)",
            border: "1px solid rgba(0,212,255,0.15)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#888899",
            lineHeight: 1.6,
          }}
        >
          ⚖️ The AI reads these five sentences before scoring every proposal. Be specific.
          Vague constitutions produce inconsistent scores.
        </div>

        <div className="field-group">
          <label className="field-label">Purpose — What is this community for?</label>
          <textarea
            placeholder="e.g. We exist to fund open-source developer tools that make building on-chain faster and cheaper for African developers."
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={300}
            style={{ minHeight: "80px" }}
          />
        </div>

        <div className="field-group">
          <label className="field-label">We Always Fund — What will you always fund?</label>
          <textarea
            placeholder="e.g. We always fund proposals that ship working code, reduce transaction costs, or improve developer education."
            value={alwaysFund}
            onChange={(e) => setAlwaysFund(e.target.value)}
            maxLength={300}
            style={{ minHeight: "80px" }}
          />
        </div>

        <div className="field-group">
          <label className="field-label">We Never Fund — What will you never fund?</label>
          <textarea
            placeholder="e.g. We never fund marketing campaigns, token speculation, or anything that does not produce a tangible community artifact."
            value={neverFund}
            onChange={(e) => setNeverFund(e.target.value)}
            maxLength={300}
            style={{ minHeight: "80px" }}
          />
        </div>

        <div className="field-group">
          <label className="field-label">Who Benefits — Who benefits most from decisions?</label>
          <textarea
            placeholder="e.g. Decisions should primarily benefit junior developers and first-time contributors, not established teams with existing funding."
            value={whoBenefits}
            onChange={(e) => setWhoBenefits(e.target.value)}
            maxLength={300}
            style={{ minHeight: "80px" }}
          />
        </div>

        <div className="field-group">
          <label className="field-label">Success — What does success look like?</label>
          <textarea
            placeholder="e.g. Success means at least one funded project ships and is used by 10 or more community members within 60 days."
            value={success}
            onChange={(e) => setSuccess(e.target.value)}
            maxLength={300}
            style={{ minHeight: "80px" }}
          />
        </div>
      </div>

      {/* ── Treasury Settings ── */}
      <div className="form-section">
        <div className="form-section-title">Treasury Settings</div>

        {/* Starting Pot */}
        <div className="field-group">
          <label className="field-label">Starting Pot (simulated on studionet)</label>
          <input
            type="number"
            min={100}
            max={1000000}
            value={initialPot}
            onChange={(e) => setInitialPot(Math.max(100, parseInt(e.target.value) || 100))}
          />
        </div>

        {/* Funding Threshold */}
        <div className="field-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="field-label">Funding Threshold</label>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.4rem", color: "#00FF87", letterSpacing: "0.04em" }}>
              {fundingThreshold}/100
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            value={fundingThreshold}
            onChange={(e) => setFundingThreshold(parseInt(e.target.value))}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#555566" }}>
            <span>50 — Lenient</span>
            <span>95 — Very strict</span>
          </div>
        </div>

        {/* Max Proposal Size */}
        <div className="field-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="field-label">Max Proposal Size (% of pot)</label>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.4rem", color: "#00D4FF", letterSpacing: "0.04em" }}>
              {maxProposalPct}%
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            value={maxProposalPct}
            onChange={(e) => setMaxProposalPct(parseInt(e.target.value))}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#555566" }}>
            <span>5% — Conservative</span>
            <span>50% — Aggressive</span>
          </div>
          <div style={{ fontSize: "12px", color: "#555566" }}>
            Max single proposal: <strong style={{ color: "#F0F0F0" }}>{Math.floor(initialPot * maxProposalPct / 100)}</strong> from a {initialPot} pot
          </div>
        </div>

        {/* Proposal Fee */}
        <div className="field-group">
          <label className="field-label">Proposal Submission Fee</label>
          <input
            type="number"
            min={0}
            max={1000}
            value={proposalFee}
            onChange={(e) => setProposalFee(Math.max(0, parseInt(e.target.value) || 0))}
          />
          <div style={{ fontSize: "12px", color: "#555566" }}>
            Goes into the pot. Discourages spam proposals.
          </div>
        </div>

        {/* ── V2 NEW: Member Stake ── */}
        <div className="field-group">
          <label className="field-label">
            Member Stake (USDC to join)
          </label>
          <input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={memberStake}
            onChange={(e) => setMemberStake(Math.max(0, parseFloat(e.target.value) || 0))}
          />
          <div style={{ fontSize: "12px", color: "#555566", lineHeight: 1.5 }}>
            Members pay this in testnet USDC to join. Their stake is returned on clean exit,
            forfeited if you remove them for misconduct.
            Set 0 for free entry. Faucet gives 10–20 USDC/day — keep between 1–5 for testing.
          </div>
          {memberStake > 0 && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(167,139,250,0.06)",
                border: "1px solid rgba(167,139,250,0.2)",
                borderRadius: "10px",
                fontSize: "12px",
                color: "#A78BFA",
                lineHeight: 1.5,
              }}
            >
              🔒 Sybil resistance active — each wallet must deposit <strong>{memberStake} USDC</strong> on ARC testnet to join.
              10 wallets = {memberStake * 10} USDC cost. Economic deterrent against Sybil attacks.
            </div>
          )}
          {memberStake === 0 && (
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(255,214,0,0.04)",
                border: "1px solid rgba(255,214,0,0.15)",
                borderRadius: "10px",
                fontSize: "12px",
                color: "#FFD600",
                lineHeight: 1.5,
              }}
            >
              ⚠️ Free entry — no Sybil resistance. Anyone can join with a fresh wallet at no cost.
            </div>
          )}
        </div>
      </div>

      {/* ── Summary preview ── */}
      {communityName.trim() && (
        <div
          style={{
            padding: "16px",
            background: "rgba(0,255,135,0.03)",
            border: "1px solid rgba(0,255,135,0.15)",
            borderRadius: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888899" }}>
            Community Preview
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.4rem", letterSpacing: "0.04em", color: "#F0F0F0" }}>
            {communityName}
          </div>
          <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#555566", flexWrap: "wrap" }}>
            <span>💰 Pot: <strong style={{ color: "#00FF87" }}>{initialPot}</strong></span>
            <span>🎯 Threshold: <strong style={{ color: "#F0F0F0" }}>{fundingThreshold}/100</strong></span>
            <span>📏 Max: <strong style={{ color: "#F0F0F0" }}>{maxProposalPct}% per proposal</strong></span>
            <span>🎟️ Fee: <strong style={{ color: "#F0F0F0" }}>{proposalFee}</strong></span>
            <span>🔒 Stake: <strong style={{ color: "#A78BFA" }}>{memberStake > 0 ? `${memberStake} USDC` : "Free"}</strong></span>
          </div>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {isLoading ? (
          <span className="btn-loading">
            <span className="spinner" />
            {loading}
          </span>
        ) : (
          "🏛️ FOUND THIS COMMUNITY"
        )}
      </button>

      <p className="hint-text">
        All 5 constitution fields are required. Your address becomes the founder permanently.
        The member stake is set once and cannot be changed.
      </p>
    </div>
  );
}
