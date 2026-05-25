"use client";
// CommunityPulse V2 — Join Community Screen
// Fix: live USDC balance check with funding prompt before stake button is enabled

import { useState, useEffect } from "react";
import { Community } from "../types";
import { getCommunity } from "../lib/contract";
import { approveUsdc, depositStake, getUsdcBalance } from "../lib/arcContract";

interface JoinCommunityProps {
  playerAddress: string;
  playerPrivateKey: string;
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

  // V2 Fix: live balance check
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const isLoading = !!loading || stepState !== "idle";
  const hasStake = (foundCommunity?.member_stake ?? 0) > 0;
  const hasEnoughBalance =
    !hasStake ||
    walletBalance === null ||
    walletBalance >= (foundCommunity?.member_stake ?? 0);

  // Load balance when a staked community is found
  useEffect(() => {
    if (!foundCommunity || !hasStake || !playerAddress) return;
    setBalanceLoading(true);
    getUsdcBalance(playerAddress)
      .then(setWalletBalance)
      .catch(() => setWalletBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [foundCommunity, hasStake, playerAddress]);

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
    setWalletBalance(null);

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

    if (foundCommunity.status !== "active") {
      setStepError("This community is no longer active. Cannot join.");
      return;
    }

    const stakeKey = `cp_pending_stake_${foundCommunity.id}_${playerAddress}`;
    setStepError("");
    setCanRetry(false);

    try {
      let arcTxHash = localStorage.getItem(stakeKey);

      if (!arcTxHash) {
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

          localStorage.setItem(stakeKey, arcTxHash);
        } else {
          arcTxHash = "FREE_JOIN";
        }
      }

      setStepState("joining");
      onJoin(foundCommunity.id, nameInput.trim(), arcTxHash);

    } catch (err: any) {
      console.error("handleJoinWithStake failed:", err?.message, err);

      const storedHash = localStorage.getItem(stakeKey);
      if (storedHash) {
        setStepError(
          "Stake deposited on ARC but joining GenLayer failed. " +
          "Your USDC is safe in escrow. Click Retry Join to complete."
        );
        setCanRetry(true);
      } else {
        setStepError(
          err?.message?.includes("user rejected")
            ? "Transaction cancelled."
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

  function getStepLabel(): string {
    switch (stepState) {
      case "approving":  return "Approving USDC...";
      case "depositing": return "Depositing stake on ARC...";
      case "joining":    return "Joining community on GenLayer...";
      case "retrying":   return "Retrying GenLayer join...";
      default:           return "";
    }
  }

  function copyAddress() {
    navigator.clipboard.writeText(playerAddress);
  }

  const constitutionTags = foundCommunity
    ? [
        { label: "Purpose",     value: foundCommunity.constitution.purpose },
        { label: "Always Fund", value: foundCommunity.constitution.always_fund },
        { label: "Never Fund",  value: foundCommunity.constitution.never_fund },
      ]
    : [];

  const shortAddress = playerAddress
    ? playerAddress.slice(0, 6) + "..." + playerAddress.slice(-4)
    : "";

  const needsFunding =
    hasStake &&
    walletBalance !== null &&
    walletBalance < (foundCommunity?.member_stake ?? 0);

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
              setWalletBalance(null);
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
            ) : "Look Up"}
          </button>
        </div>
        {lookupError && <p className="error-text">{lookupError}</p>}
      </div>

      {/* ── Community preview ── */}
      {lookupState === "found" && foundCommunity && (
        <div className="card card--green fadeIn" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
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

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {[
              ["👥", foundCommunity.member_count, "members"],
              ["💰", foundCommunity.pot_balance, "in pot"],
              ["✅", foundCommunity.funded_count, "funded"],
              ["🎯", `${foundCommunity.funding_threshold}/100`, "threshold"],
            ].map(([icon, val, lbl]) => (
              <div key={String(lbl)} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ fontSize: "13px", color: "#F0F0F0", fontWeight: 600 }}>{icon} {val}</div>
                <div style={{ fontSize: "11px", color: "#555566", textTransform: "uppercase", letterSpacing: "0.06em" }}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* Stake requirement */}
          <div style={{
            padding: "12px 14px",
            background: hasStake ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${hasStake ? "rgba(167,139,250,0.25)" : "rgba(255,255,255,0.06)"}`,
            borderRadius: "10px",
          }}>
            {hasStake ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#A78BFA" }}>
                  🔒 {foundCommunity.member_stake} USDC stake required to join
                </div>
                <div style={{ fontSize: "12px", color: "#888899", lineHeight: 1.5 }}>
                  Your stake is held in escrow on ARC testnet. Returned on clean exit, forfeited if slashed.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "13px", color: "#888899" }}>✓ Free to join — no USDC stake required.</div>
            )}
          </div>

          {/* Constitution peek */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888899" }}>Constitution</div>
            {constitutionTags.map(({ label, value }) => (
              <div key={label} style={{ fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
                <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}: </span>
                {value}
              </div>
            ))}
          </div>

          <div style={{ fontSize: "12px", color: "#555566" }}>
            Founded by <strong style={{ color: "#888899" }}>{foundCommunity.founder_name}</strong>
          </div>
        </div>
      )}

      {/* ── Join form ── */}
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

          {/* ── WALLET FUNDING SECTION — shown when stake > 0 ── */}
          {hasStake && (
            <div style={{
              padding: "14px 16px",
              background: "rgba(0,212,255,0.04)",
              border: "1px solid rgba(0,212,255,0.15)",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#00D4FF" }}>
                Your Wallet
              </div>

              {/* Address row */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF87", flexShrink: 0 }} />
                <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#888899", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {playerAddress}
                </span>
                <button
                  onClick={copyAddress}
                  style={{ fontSize: "11px", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "6px", padding: "3px 8px", background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", flexShrink: 0 }}
                >
                  Copy
                </button>
              </div>

              {/* Balance row */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                <span style={{ color: "#888899" }}>Balance:</span>
                {balanceLoading ? (
                  <span className="spinner" style={{ width: 12, height: 12 }} />
                ) : walletBalance === null ? (
                  <span style={{ color: "#555566" }}>—</span>
                ) : (
                  <span style={{
                    fontWeight: 700,
                    color: walletBalance >= foundCommunity.member_stake ? "#00FF87" : "#FF4D6D",
                  }}>
                    {walletBalance.toFixed(2)} USDC
                  </span>
                )}
                <span style={{ color: "#555566", fontSize: "11px" }}>on ARC Testnet</span>
              </div>

              {/* Funding prompt — only shown when balance is too low */}
              {needsFunding && (
                <div style={{
                  padding: "12px 14px",
                  background: "rgba(255,77,109,0.06)",
                  border: "1px solid rgba(255,77,109,0.2)",
                  borderRadius: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#FF4D6D" }}>
                    ⚠️ You need at least {foundCommunity.member_stake} USDC to join
                  </div>
                  <div style={{ fontSize: "12px", color: "#888899", lineHeight: 1.6 }}>
                    Your wallet currently has <strong style={{ color: "#FF4D6D" }}>{walletBalance?.toFixed(2)} USDC</strong>.
                    You need <strong style={{ color: "#F0F0F0" }}>{foundCommunity.member_stake} USDC</strong> to stake.
                  </div>
                  <div style={{ fontSize: "12px", color: "#888899", lineHeight: 1.7 }}>
                    <strong style={{ color: "#00D4FF" }}>How to get testnet USDC:</strong><br />
                    1. Go to{" "}
                    <a
                      href="https://faucet.circle.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#00D4FF", textDecoration: "underline" }}
                    >
                      faucet.circle.com
                    </a>
                    <br />
                    2. Select <strong style={{ color: "#F0F0F0" }}>Arc Testnet</strong> as the network<br />
                    3. Paste your wallet address: <strong style={{ color: "#F0F0F0", fontFamily: "monospace", fontSize: "11px" }}>{shortAddress}</strong>{" "}
                    <button
                      onClick={copyAddress}
                      style={{ fontSize: "10px", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "4px", padding: "1px 6px", background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                    >
                      Copy
                    </button>
                    <br />
                    4. Click <strong style={{ color: "#F0F0F0" }}>Request</strong> — you'll receive free testnet USDC<br />
                    5. Come back here and click Join
                  </div>
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setBalanceLoading(true);
                      getUsdcBalance(playerAddress)
                        .then(setWalletBalance)
                        .catch(() => setWalletBalance(null))
                        .finally(() => setBalanceLoading(false));
                    }}
                    style={{ borderColor: "rgba(0,212,255,0.3)", color: "#00D4FF", marginTop: "4px" }}
                  >
                    {balanceLoading ? (
                      <span className="btn-loading"><span className="spinner" />Checking...</span>
                    ) : "🔄 Refresh Balance"}
                  </button>
                </div>
              )}

              {/* Success — enough balance */}
              {!needsFunding && walletBalance !== null && walletBalance >= foundCommunity.member_stake && (
                <div style={{ fontSize: "12px", color: "#00FF87", fontWeight: 600 }}>
                  ✓ Sufficient balance — ready to stake
                </div>
              )}
            </div>
          )}

          {/* Depleted warning */}
          {foundCommunity.status === "depleted" && (
            <div style={{ padding: "12px 14px", background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.2)", borderRadius: "12px", fontSize: "13px", color: "#FF4D6D", lineHeight: 1.5 }}>
              ⚠️ This community's pot is depleted. You can join but proposals can't be funded until the pot is topped up.
            </div>
          )}

          {/* Step indicators */}
          {stepState !== "idle" && (
            <div style={{ padding: "12px 14px", background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
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

          {(stepError || error) && <p className="error-text">{stepError || error}</p>}

          {canRetry && (
            <button
              className="btn-outline"
              onClick={handleRetryJoin}
              disabled={isLoading}
              style={{ borderColor: "rgba(255,214,0,0.4)", color: "#FFD600" }}
            >
              {stepState === "retrying" ? (
                <span className="btn-loading"><span className="spinner" />Retrying...</span>
              ) : "🔄 Retry Join (stake already deposited)"}
            </button>
          )}

          {!canRetry && (
            <button
              className="btn-primary"
              onClick={handleJoinWithStake}
              disabled={
                !nameInput.trim() ||
                isLoading ||
                foundCommunity.status !== "active" ||
                needsFunding
              }
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

          {needsFunding && (
            <p style={{ fontSize: "12px", color: "#555566", textAlign: "center", lineHeight: 1.5 }}>
              The Join button will unlock once your wallet has enough USDC.
            </p>
          )}
        </div>
      )}

      {/* ── Tip ── */}
      <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", fontSize: "13px", color: "#555566", lineHeight: 1.6 }}>
        <strong style={{ color: "#888899" }}>Tip:</strong> Ask the community founder for the ID — it looks like{" "}
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.08em", color: "#F0F0F0" }}>COM000001</span>.
      </div>
    </div>
  );
}