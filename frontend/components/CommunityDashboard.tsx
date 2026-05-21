"use client";
// CommunityPulse V2 — Community Dashboard
// V2 Changes:
//   - Founder sees member list with stake amounts + [Slash] button per member
//   - Non-founder members see [Leave and Reclaim Stake] button
//   - member_stake shown in community stats
//   - relay balance warning (if < 1 USDC, demo could stall)

import { useState, useEffect } from "react";
import { Community, Screen } from "../types";
import { getCommunityMembers } from "../lib/contract";
import { getStakeBalance, getRelayBalance } from "../lib/arcContract";

interface CommunityDashboardProps {
  community: Community;
  playerAddress: string;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onSlashMember: (targetAddress: string) => void;
  onLeaveCommunity: () => void;
  loading: string;
  error: string;
}

interface MemberEntry {
  address: string;
  stake: number | null;  // null while loading
}

export default function CommunityDashboard({
  community,
  playerAddress,
  onNavigate,
  onBack,
  onSlashMember,
  onLeaveCommunity,
  loading,
  error,
}: CommunityDashboardProps) {
  const isFounder = community.founder === playerAddress;
  const maxProposal = Math.floor(community.pot_balance * community.max_proposal_pct / 100);

  // Member panel state (founder view)
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [slashTarget, setSlashTarget] = useState<string | null>(null);
  const [slashConfirm, setSlashConfirm] = useState(false);

  // Leave state (non-founder)
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  // Relay health warning
  const [relayBalance, setRelayBalance] = useState<number | null>(null);

  const isLoading = !!loading;

  function copyId() {
    navigator.clipboard.writeText(community.id);
  }

  // Load member list + stakes whenever community changes
  useEffect(() => {
    async function loadMembers() {
      setMembersLoading(true);
      try {
        const addrs: string[] = await getCommunityMembers(community.id);
        // Initialise entries with null stake (loads asynchronously)
        setMembers(addrs.map((a) => ({ address: a, stake: null })));

        // Load stakes in parallel if community has member_stake > 0
        if (community.member_stake > 0) {
          const stakeResults = await Promise.allSettled(
            addrs.map((a) => getStakeBalance(community.id, a))
          );
          setMembers(
            addrs.map((a, i) => ({
              address: a,
              stake:
                stakeResults[i].status === "fulfilled"
                  ? (stakeResults[i] as PromiseFulfilledResult<number>).value
                  : 0,
            }))
          );
        } else {
          // No stake community — show 0 for everyone
          setMembers(addrs.map((a) => ({ address: a, stake: 0 })));
        }
      } catch {
        // silent — member panel is non-critical
      } finally {
        setMembersLoading(false);
      }
    }

    if (isFounder) {
      loadMembers();
    }
  }, [community.id, community.member_count, isFounder, community.member_stake]);

  // Check relay balance on mount for founder (low balance = demo stalls)
  useEffect(() => {
    if (!isFounder || community.member_stake === 0) return;
    getRelayBalance()
      .then(setRelayBalance)
      .catch(() => setRelayBalance(null));
  }, [isFounder, community.member_stake]);

  function handleSlashClick(address: string) {
    setSlashTarget(address);
    setSlashConfirm(true);
  }

  function confirmSlash() {
    if (slashTarget) {
      onSlashMember(slashTarget);
    }
    setSlashConfirm(false);
    setSlashTarget(null);
  }

  function cancelSlash() {
    setSlashConfirm(false);
    setSlashTarget(null);
  }

  function formatAddress(addr: string): string {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  }

  const isMember = members.some((m) => m.address === playerAddress);
  const myStake = members.find((m) => m.address === playerAddress)?.stake ?? null;

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Home</button>

      {/* ── Community header ── */}
      <div className="community-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <div className="community-header-name">{community.name}</div>
            {isFounder && (
              <div style={{ fontSize: "11px", color: "#00FF87", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: "2px" }}>
                👑 You founded this
              </div>
            )}
          </div>
          <span className={`status-badge status-badge--${community.status}`}>
            {community.status}
          </span>
        </div>

        <div className="community-header-desc">{community.description}</div>

        <div className="community-header-stats">
          <div className="community-stat">
            <div className="community-stat-val">{community.pot_balance.toLocaleString()}</div>
            <div className="community-stat-lbl">Pot Balance</div>
          </div>
          <div className="community-stat">
            <div className="community-stat-val">{community.member_count}</div>
            <div className="community-stat-lbl">Members</div>
          </div>
          <div className="community-stat">
            <div className="community-stat-val">{community.funded_count}</div>
            <div className="community-stat-lbl">Funded</div>
          </div>
          <div className="community-stat">
            <div className="community-stat-val">{community.funding_threshold}</div>
            <div className="community-stat-lbl">Threshold</div>
          </div>
        </div>

        {/* Community ID banner */}
        <div className="id-banner">
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
            <div className="id-banner-label">Community ID — share to invite members</div>
            <div className="id-banner-value">{community.id}</div>
          </div>
          <button className="id-banner-copy" onClick={copyId}>Copy</button>
        </div>
      </div>

      {/* ── Relay balance warning — founder only, stake-enabled communities ── */}
      {isFounder && community.member_stake > 0 && relayBalance !== null && relayBalance < 1 && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(255,214,0,0.06)",
            border: "1px solid rgba(255,214,0,0.25)",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#FFD600",
            lineHeight: 1.5,
          }}
        >
          ⚠️ Relay wallet balance is low ({relayBalance.toFixed(2)} USDC). Release and slash calls will fail when it reaches 0.
          Top up the relay wallet from <span style={{ color: "#00D4FF" }}>faucet.circle.com</span> to keep the demo running.
        </div>
      )}

      {/* ── Pot status alert ── */}
      {community.status === "depleted" && (
        <div
          style={{
            padding: "14px 16px",
            background: "rgba(255,77,109,0.06)",
            border: "1px solid rgba(255,77,109,0.25)",
            borderRadius: "12px",
            fontSize: "14px",
            color: "#FF4D6D",
            lineHeight: 1.6,
          }}
        >
          ⚠️ The pot is depleted. Deposit funds to re-activate proposal submissions.
          <button
            className="btn-danger"
            onClick={() => onNavigate("treasury")}
            style={{ marginTop: "10px", width: "auto", padding: "0.6rem 1.2rem", fontSize: "0.9rem" }}
          >
            Go to Treasury →
          </button>
        </div>
      )}

      {/* ── Nav grid ── */}
      <div className="section-label">What do you want to do?</div>
      <div className="dashboard-nav">

        <button className="dashboard-nav-item" onClick={() => onNavigate("proposal_feed")}>
          <div className="dashboard-nav-icon">📋</div>
          <div className="dashboard-nav-label">Proposals</div>
          <div className="dashboard-nav-sub">{community.proposal_count} submitted</div>
        </button>

        <button
          className="dashboard-nav-item"
          onClick={() => onNavigate("submit_proposal")}
          disabled={community.status === "depleted"}
          style={{ opacity: community.status === "depleted" ? 0.5 : 1 }}
        >
          <div className="dashboard-nav-icon">✍️</div>
          <div className="dashboard-nav-label">Submit Proposal</div>
          <div className="dashboard-nav-sub">Max {maxProposal.toLocaleString()} from pot</div>
        </button>

        <button className="dashboard-nav-item" onClick={() => onNavigate("treasury")}>
          <div className="dashboard-nav-icon">💰</div>
          <div className="dashboard-nav-label">Treasury</div>
          <div className="dashboard-nav-sub">{community.total_funded.toLocaleString()} total funded</div>
        </button>

        <button className="dashboard-nav-item" onClick={() => onNavigate("constitution")}>
          <div className="dashboard-nav-icon">⚖️</div>
          <div className="dashboard-nav-label">Constitution</div>
          <div className="dashboard-nav-sub">5 governing rules</div>
        </button>

      </div>

      {/* ── Governance rules ── */}
      <div
        style={{
          padding: "16px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div className="section-label">Governance Rules</div>
        {[
          ["🎯", `Proposals need ${community.funding_threshold}/100 to be funded`],
          ["📏", `Max proposal size: ${community.max_proposal_pct}% of pot (${maxProposal.toLocaleString()})`],
          ["🎟️", `Proposal fee: ${community.proposal_fee} (goes into pot)`],
          ["💡", "Scores 50–69 enter revision — one resubmit allowed"],
          ["❤️", "Community pulses add up to 5 bonus points"],
          ["🔒", community.member_stake > 0
            ? `Stake to join: ${community.member_stake} USDC (Sybil resistance active)`
            : "Stake to join: free entry"],
        ].map(([icon, text]) => (
          <div key={String(text)} style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
            <span style={{ flexShrink: 0, fontSize: "15px" }}>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      {/* ── V2: FOUNDER — Member list with slash ── */}
      {isFounder && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div className="section-label">Members</div>

          {membersLoading ? (
            <div className="loading-state">
              <span className="spinner" />
              <span>Loading members...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="empty-state">No members yet.</div>
          ) : (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              {members.map((m, i) => {
                const isMe = m.address === playerAddress;
                return (
                  <div
                    key={m.address}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 16px",
                      borderBottom: i < members.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}
                  >
                    {/* Address */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#888899", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {formatAddress(m.address)}
                        {isMe && (
                          <span style={{ marginLeft: "8px", fontSize: "10px", color: "#00FF87", fontFamily: "Inter, sans-serif", fontWeight: 700, letterSpacing: "0.06em" }}>
                            YOU
                          </span>
                        )}
                      </div>
                      {community.member_stake > 0 && (
                        <div style={{ fontSize: "11px", color: "#555566", marginTop: "2px" }}>
                          {m.stake === null
                            ? "Loading stake..."
                            : m.stake > 0
                            ? `${m.stake} USDC staked`
                            : "No stake on record"}
                        </div>
                      )}
                    </div>

                    {/* Slash button — not on self (founder) */}
                    {!isMe && (
                      <button
                        onClick={() => handleSlashClick(m.address)}
                        disabled={isLoading}
                        style={{
                          padding: "5px 12px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#FF4D6D",
                          border: "1px solid rgba(255,77,109,0.3)",
                          borderRadius: "8px",
                          background: "rgba(255,77,109,0.06)",
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                          flexShrink: 0,
                          transition: "all 0.15s",
                        }}
                      >
                        ⚔️ Slash
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Slash confirm dialog */}
          {slashConfirm && slashTarget && (
            <div
              style={{
                padding: "16px",
                background: "rgba(255,77,109,0.08)",
                border: "1px solid rgba(255,77,109,0.3)",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#FF4D6D" }}>
                ⚔️ Slash {formatAddress(slashTarget)}?
              </div>
              <div style={{ fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
                This will remove them from the community on GenLayer and forfeit their{" "}
                {community.member_stake > 0 ? `${community.member_stake} USDC ` : ""}stake to the relay wallet.
                This cannot be undone.
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn-danger"
                  onClick={confirmSlash}
                  disabled={isLoading}
                  style={{ flex: 1, padding: "0.7rem" }}
                >
                  {isLoading ? (
                    <span className="btn-loading"><span className="spinner" />{loading}</span>
                  ) : (
                    "Confirm Slash"
                  )}
                </button>
                <button
                  className="btn-outline"
                  onClick={cancelSlash}
                  disabled={isLoading}
                  style={{ flex: 1, padding: "0.7rem" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── V2: NON-FOUNDER — Leave community ── */}
      {!isFounder && isMember && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {!leaveConfirm ? (
            <button
              className="btn-outline"
              onClick={() => setLeaveConfirm(true)}
              disabled={isLoading}
              style={{ borderColor: "rgba(255,77,109,0.3)", color: "#FF4D6D" }}
            >
              🚪 Leave Community
            </button>
          ) : (
            <div
              style={{
                padding: "16px",
                background: "rgba(255,77,109,0.05)",
                border: "1px solid rgba(255,77,109,0.2)",
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#FF4D6D" }}>
                Leave {community.name}?
              </div>
              <div style={{ fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
                {community.member_stake > 0
                  ? `Your ${myStake !== null ? myStake : community.member_stake} USDC stake will be returned to your wallet via ARC escrow.`
                  : "You will be removed from the community."}{" "}
                You will lose access to proposals and voting. This cannot be undone.
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn-danger"
                  onClick={() => { onLeaveCommunity(); setLeaveConfirm(false); }}
                  disabled={isLoading}
                  style={{ flex: 1, padding: "0.7rem" }}
                >
                  {isLoading ? (
                    <span className="btn-loading"><span className="spinner" />{loading}</span>
                  ) : (
                    community.member_stake > 0 ? "Leave & Reclaim Stake" : "Leave Community"
                  )}
                </button>
                <button
                  className="btn-outline"
                  onClick={() => setLeaveConfirm(false)}
                  disabled={isLoading}
                  style={{ flex: 1, padding: "0.7rem" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
