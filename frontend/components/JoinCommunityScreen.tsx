"use client";
// CommunityPulse V2 — Join Community Screen
// V2 Changes: two-step ARC stake flow with localStorage retry pattern.
//
// Flow:
//   1. Look up community (unchanged from V1)
//   2. Show stake requirement
//   3. Check community status before touching ARC (guard against depleted/paused)
//   4. Approve USDC on ARC
//   5. depositStake on ARC → store tx hash in localStorage IMMEDIATELY
//   6. join_community on GenLayer with hash as proof
//   7. On success: clear localStorage key, navigate to dashboard
//   8. On GenLayer failure: show "Retry Join" — re-attempts step 6 with stored hash

import { useState } from "react";
import { Community } from "../types";
import { getCommunity } from "../lib/contract";
import { approveUsdc, depositStake } from "../lib/arcContract";

interface JoinCommunityProps {
  playerAddress: string;
  playerPrivateKey: string;      // V2 NEW — needed for ARC sign
  playerName: string;
  onJoin: (communityId: string, name: string, arcTxHash: string) => void;
  onBack: () => void;
  loading: string;
  error: string;
}

type LookupState = "idle" | "loading" | "found" | "error";
type StepState = "idle" | "approving" | "depositing" | "joining" | "retrying" | "done";

export default function JoinCommunityScreen({
  playerAddress,
  playerPrivateKey,
  playerName,
  onJoin,
  onBack,
  loading,
  error,
}: JoinCommunityProps) {
  const [communityId, setCommunityId] = useState("");
  const [nameInput, setNameInput] = useState(playerName);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [foundCommunity, setFoundCommunity] = useState<Community | null>(null);
  const [lookupError, setLookupError] = useState("");

  const [stepState, setStepState] = useState<StepState>("idle");
  const [stepError, setStepError] = useState("");
  const [canRetry, setCanRetry] = useState(false);

  const isLoading = !!loading || stepState !== "idle";

  // ── Lookup ─────────────────────────────────────────────────────────────────

  async function handleLookup() {
    const trimmed = communityId.trim().toUpperCase();
    if (!trimmed) return;

    setLookupState("loading");
    setLookupError("");
    setFoundCommunity(null);
    setStepState("idle");
    setStepError("");
    setCanRetry(false);

    try {
      const data = await getCommunity(trimmed);
      if (data.error) {
        setLookupState("error");
        setLookupError("Community not found. Check the ID and try again.");
        return;
      }
      setFoundCommunity(data);
      setLookupState("found");
    } catch {
      setLookupState("error");
      setLookupError("Could not reach the contract. Check your connection.");
    }
  }

  // ── Join with stake ────────────────────────────────────────────────────────

  async function handleJoinWithStake() {
    if (!foundCommunity || !nameInput.trim()) return;

    // Guard: check community is still active before touching ARC.
    // A community could become depleted between lookup and join click.
    if (foundCommunity.status !== "active") {
      setStepError("This community is no longer active. Cannot join.");
      return;
    }

    const stakeKey = `cp_pending_stake_${foundCommunity.id}_${playerAddress}`;

    setStepError("");
    setCanRetry(false);

    try {
      // ── Step 1: ARC deposit (skip if already stored from a previous failed attempt) ──
      let arcTxHash = localStorage.getItem(stakeKey);

      if (!arcTxHash) {
        // Fresh join — need to approve then deposit
        if (foundCommunity.member_stake > 0) {
          setStepState("approving");
          await approveUsdc(playerPrivateKey, foundCommunity.member_stake);

          setStepState("depositing");
          arcTxHash = await depositStake(
            playerPrivateKey,
            foundCommunity.id,
            playerAddress,
            foundCommunity.member_stake
          );

          // Store IMMEDIATELY — before the GenLayer call.
          // If GenLayer fails, the hash is here for retry.
          localStorage.setItem(stakeKey, arcTxHash);
        } else {
          // Zero stake community — use a placeholder hash.
          // GenLayer gate checks non-empty, any string passes.
          arcTxHash = "FREE_JOIN";
        }
      }
      // If arcTxHash was already in localStorage (retry path), skip ARC entirely.

      // ── Step 2: GenLayer join ──
      setStepState("joining");
      onJoin(foundCommunity.id, nameInput.trim(), arcTxHash);
      // App.tsx handler calls joinCommunity and navigates on success.
      // On success, App.tsx must also call localStorage.removeItem(stakeKey).

    } catch (err: any) {
      console.error("handleJoinWithStake failed:", err?.message, err);

      const storedHash = localStorage.getItem(stakeKey);
      if (storedHash) {
        // ARC succeeded but we hit an error before GenLayer (network blip, etc.)
        setStepError(
          "Stake deposited on ARC but joining GenLayer failed. " +
          "Your USDC is safe in escrow. Click Retry Join to complete."
        );
        setCanRetry(true);
      } else {
        setStepError(
          err?.message?.includes("user rejected")
            ? "Transaction cancelled in wallet."
            : "Failed to deposit stake. Check your USDC balance and try again."
        );
      }
      setStepState("idle");
    }
  }

  async function handleRetryJoin() {
    if (!foundCommunity || !nameInput.trim()) return;
    const stakeKey = `cp_pending_stake_${foundCommunity.id}_${playerAddress}`;
    const arcTxHash = localStorage.getItem(stakeKey);
    if (!arcTxHash) {
      setStepError("No stored stake hash found. Please restart the join flow.");
      setCanRetry(false);
      return;
    }

    setStepState("retrying");
    setStepError("");
    onJoin(foundCommunity.id, nameInput.trim(), arcTxHash);
  }

  // ── Step label ─────────────────────────────────────────────────────────────

  function getStepLabel(): string {
    switch (stepState) {
      case "approving":  return "Approving USDC...";
      case "depositing": return "Depositing stake on ARC...";
      case "joining":    return "Joining community on GenLayer...";
      case "retrying":   return "Retrying GenLayer join...";
      default:           return "";
    }
  }

  const constitutionTags = foundCommunity
    ? [
        { label: "Purpose",     value: foundCommunity.constitution.purpose },
        { label: "Always Fund", value: foundCommunity.constitution.always_fund },
        { label: "Never Fund",  value: foundCommunity.constitution.never_fund },
      ]
    : [];

  const hasStake = (foundCommunity?.member_stake ?? 0) > 0;

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <h2 className="screen-title">Join a Community</h2>
      <p className="screen-sub">
        Enter a Community ID to look it up, then join with your name.
      </p>

      {/* ── Lookup form ── */}
      <div className="form-section">
        <div className="form-section-title">Find Community</div>

        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            placeholder="COM000001"
            value={communityId}
            onChange={(e) => {
              setCommunityId(e.target.value.toUpperCase());
              setLookupState("idle");
              setFoundCommunity(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            maxLength={9}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", letterSpacing: "0.1em", flex: 1 }}
          />
          <button
            className="btn-outline"
            onClick={handleLookup}
            disabled={!communityId.trim() || lookupState === "loading"}
            style={{ width: "auto", padding: "0 1.5rem", whiteSpace: "nowrap" }}
          >
            {lookupState === "loading" ? (
              <span className="btn-loading"><span className="spinner" />Looking up...</span>
            ) : (
              "Look Up"
            )}
          </button>
        </div>

        {lookupError && <p className="error-text">{lookupError}</p>}
      </div>

      {/* ── Community preview ── */}
      {lookupState === "found" && foundCommunity && (
        <div
          className="card card--green fadeIn"
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em", color: "#F0F0F0", lineHeight: 1.1 }}>
                {foundCommunity.name}
              </div>
              <div style={{ fontSize: "13px", color: "#888899", marginTop: "4px", lineHeight: 1.5 }}>
                {foundCommunity.description}
              </div>
            </div>
            <span className={`status-badge status-badge--${foundCommunity.status}`}>
              {foundCommunity.status}
            </span>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {[
              ["👥", foundCommunity.member_count, "members"],
              ["💰", foundCommunity.pot_balance, "in pot"],
              ["✅", foundCommunity.funded_count, "funded"],
              ["🎯", `${foundCommunity.funding_threshold}/100`, "threshold"],
            ].map(([icon, val, lbl]) => (
              <div key={String(lbl)} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ fontSize: "13px", color: "#F0F0F0", fontWeight: 600 }}>
                  {icon} {val}
                </div>
                <div style={{ fontSize: "11px", color: "#555566", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {lbl}
                </div>
              </div>
            ))}
          </div>

          {/* V2: Stake requirement */}
          <div
            style={{
              padding: "12px 14px",
              background: hasStake
                ? "rgba(167,139,250,0.08)"
                : "rgba(255,255,255,0.02)",
              border: `1px solid ${hasStake ? "rgba(167,139,250,0.25)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: "10px",
            }}
          >
            {hasStake ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#A78BFA" }}>
                  🔒 {foundCommunity.member_stake} USDC stake required to join
                </div>
                <div style={{ fontSize: "12px", color: "#888899", lineHeight: 1.5 }}>
                  Your stake is held in escrow on ARC testnet. It is returned if you leave cleanly.
                  It is forfeited if the founder removes you for misconduct.
                </div>
                <div style={{ fontSize: "11px", color: "#555566", lineHeight: 1.4 }}>
                  Need USDC? Faucet: <span style={{ color: "#00D4FF" }}>faucet.circle.com</span> → Arc Testnet → USDC
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "13px", color: "#888899" }}>
                ✓ Free to join — no USDC stake required.
              </div>
            )}
          </div>

          {/* Constitution peek */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888899" }}>
              Constitution
            </div>
            {constitutionTags.map(({ label, value }) => (
              <div key={label} style={{ fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
                <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}:{" "}
                </span>
                {value}
              </div>
            ))}
          </div>

          {/* Founder */}
          <div style={{ fontSize: "12px", color: "#555566" }}>
            Founded by <strong style={{ color: "#888899" }}>{foundCommunity.founder_name}</strong>
          </div>
        </div>
      )}

      {/* ── Join form — shown once community found ── */}
      {lookupState === "found" && foundCommunity && (
        <div className="form-section fadeIn">
          <div className="form-section-title">Join as</div>

          <div className="field-group">
            <label className="field-label">Your Display Name</label>
            <input
              type="text"
              placeholder="How the community will see you..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={30}
              disabled={isLoading}
            />
          </div>

          {/* Depleted warning */}
          {foundCommunity.status === "depleted" && (
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(255,77,109,0.06)",
                border: "1px solid rgba(255,77,109,0.2)",
                borderRadius: "12px",
                fontSize: "13px",
                color: "#FF4D6D",
                lineHeight: 1.5,
              }}
            >
              ⚠️ This community's pot is depleted. You can join and propose once funds are deposited.
              {hasStake && " Note: your USDC stake would be locked even while the pot is empty."}
            </div>
          )}

          {/* V2: Step indicators when active */}
          {stepState !== "idle" && (
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(0,212,255,0.05)",
                border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {hasStake && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                    <span style={{ color: (stepState === "approving" || stepState === "depositing") ? "#00D4FF" : "#555566", fontSize: "16px" }}>
                      {(stepState === "approving" || stepState === "depositing") ? "⏳" : "✓"}
                    </span>
                    <span style={{ color: (stepState === "approving" || stepState === "depositing") ? "#00D4FF" : "#888899", fontWeight: 600 }}>
                      Step 1: Approve &amp; Deposit USDC → ARC
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                    <span style={{ color: (stepState === "joining" || stepState === "retrying") ? "#00D4FF" : "#555566", fontSize: "16px" }}>
                      {stepState === "joining" || stepState === "retrying" ? "⏳" : "○"}
                    </span>
                    <span style={{ color: (stepState === "joining" || stepState === "retrying") ? "#00D4FF" : "#555566", fontWeight: 600 }}>
                      Step 2: Confirm Membership → GenLayer
                    </span>
                  </div>
                </>
              )}
              {getStepLabel() && (
                <div style={{ fontSize: "12px", color: "#555566", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="spinner" />
                  {getStepLabel()}
                </div>
              )}
            </div>
          )}

          {/* Errors */}
          {(stepError || error) && (
            <p className="error-text">{stepError || error}</p>
          )}

          {/* Retry button */}
          {canRetry && (
            <button
              className="btn-outline"
              onClick={handleRetryJoin}
              disabled={isLoading}
              style={{ borderColor: "rgba(255,214,0,0.4)", color: "#FFD600" }}
            >
              {stepState === "retrying" ? (
                <span className="btn-loading"><span className="spinner" />Retrying...</span>
              ) : (
                "🔄 Retry Join (stake already deposited)"
              )}
            </button>
          )}

          {/* Main join button — hidden when retry is available */}
          {!canRetry && (
            <button
              className="btn-primary"
              onClick={handleJoinWithStake}
              disabled={!nameInput.trim() || isLoading || foundCommunity.status !== "active"}
            >
              {isLoading ? (
                <span className="btn-loading">
                  <span className="spinner" />
                  {loading || getStepLabel() || "Joining..."}
                </span>
              ) : hasStake ? (
                `🔒 Stake ${foundCommunity.member_stake} USDC & Join →`
              ) : (
                `Join ${foundCommunity.name} →`
              )}
            </button>
          )}
        </div>
      )}

      {/* ── Tip ── */}
      <div
        style={{
          padding: "14px 16px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px",
          fontSize: "13px",
          color: "#555566",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "#888899" }}>Tip:</strong> Ask the community founder for the ID — it looks like{" "}
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.08em", color: "#F0F0F0" }}>COM000001</span>.
        {hasStake && " Make sure your wallet has enough USDC before joining."}
      </div>
    </div>
  );
}
