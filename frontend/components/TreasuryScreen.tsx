"use client";
// CommunityPulse V2 — Treasury Screen
// V2 Changes: Staked Funds section showing real ARC escrow totals

import { useState, useEffect } from "react";
import { Community, Proposal } from "../types";
import { getCommunityMembers, getFundedProposals } from "../lib/contract";
import { getStakeBalance } from "../lib/arcContract";

interface TreasuryProps {
  community: Community;
  playerAddress: string;
  onDeposit: (amount: number) => void;
  onBack: () => void;
  loading: string;
  error: string;
}

export default function TreasuryScreen({
  community,
  playerAddress,
  onDeposit,
  onBack,
  loading,
  error,
}: TreasuryProps) {
  const [depositAmount, setDepositAmount] = useState("");
  const [fundedProposals, setFundedProposals] = useState<Proposal[]>([]);
  const [fundedLoading, setFundedLoading] = useState(true);

  // V2: staked funds on ARC
  const [totalStaked, setTotalStaked] = useState<number | null>(null);
  const [stakesLoading, setStakesLoading] = useState(false);
  const [memberCount, setMemberCount] = useState<number>(community.member_count);

  const isLoading = !!loading;
  const depositNum = parseInt(depositAmount) || 0;
  const canDeposit = depositNum > 0 && !isLoading;

  // Load funded proposals
  useEffect(() => {
    async function load() {
      setFundedLoading(true);
      try {
        const data = await getFundedProposals(community.id);
        setFundedProposals(data || []);
      } catch {
        // silent
      } finally {
        setFundedLoading(false);
      }
    }
    load();
  }, [community.id]);

  // V2: Load total staked from ARC escrow
  useEffect(() => {
    if (community.member_stake === 0) {
      setTotalStaked(0);
      return;
    }

    async function loadStakes() {
      setStakesLoading(true);
      try {
        const members: string[] = await getCommunityMembers(community.id);
        setMemberCount(members.length);

        let total = 0;
        const results = await Promise.allSettled(
          members.map((addr) => getStakeBalance(community.id, addr))
        );
        for (const r of results) {
          if (r.status === "fulfilled") total += r.value;
        }
        setTotalStaked(total);
      } catch {
        setTotalStaked(null);
      } finally {
        setStakesLoading(false);
      }
    }

    loadStakes();
  }, [community.id, community.member_count, community.member_stake]);

  function handleDeposit() {
    if (!canDeposit) return;
    onDeposit(depositNum);
    setDepositAmount("");
  }

  // Pot utilisation
  const totalEverInPot = community.pot_balance + community.total_funded;
  const utilisationPct = totalEverInPot > 0
    ? Math.round((community.total_funded / totalEverInPot) * 100)
    : 0;

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Dashboard</button>

      <div>
        <h2 className="screen-title">Treasury</h2>
        <p className="screen-sub" style={{ marginTop: "4px" }}>{community.name}</p>
      </div>

      {/* ── Pot display ── */}
      <div className="treasury-pot">
        <div className="treasury-pot-label">Current Pot Balance</div>
        <div className="treasury-pot-amount">{community.pot_balance.toLocaleString()}</div>
        <div className="treasury-pot-sub">
          {community.status === "depleted"
            ? "⚠️ Pot depleted — deposit funds to re-activate"
            : `Max proposal: ${Math.floor(community.pot_balance * community.max_proposal_pct / 100).toLocaleString()} (${community.max_proposal_pct}% of pot)`}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="treasury-stats">
        <div className="treasury-stat-card">
          <div className="treasury-stat-val">{community.funded_count}</div>
          <div className="treasury-stat-lbl">Funded</div>
        </div>
        <div className="treasury-stat-card">
          <div className="treasury-stat-val">{community.total_funded.toLocaleString()}</div>
          <div className="treasury-stat-lbl">Total Paid Out</div>
        </div>
        <div className="treasury-stat-card">
          <div className="treasury-stat-val">{utilisationPct}%</div>
          <div className="treasury-stat-lbl">Utilisation</div>
        </div>
      </div>

      {/* ── Utilisation bar ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#555566" }}>
          <span>Funded out</span>
          <span>Remaining</span>
        </div>
        <div style={{ height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "100px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${utilisationPct}%`,
              background: "linear-gradient(90deg, #00FF87, #00D4FF)",
              borderRadius: "100px",
              transition: "width 0.6s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#888899" }}>
          <span style={{ color: "#00FF87", fontWeight: 600 }}>{community.total_funded.toLocaleString()}</span>
          <span style={{ fontWeight: 600 }}>{community.pot_balance.toLocaleString()}</span>
        </div>
      </div>

      {/* ── V2: Staked Funds on ARC ── */}
      {community.member_stake > 0 && (
        <div
          style={{
            padding: "16px",
            background: "rgba(167,139,250,0.04)",
            border: "1px solid rgba(167,139,250,0.2)",
            borderRadius: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Staked Funds on ARC</div>
            {stakesLoading && <span className="spinner" style={{ opacity: 0.5 }} />}
          </div>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.6rem", color: "#A78BFA", letterSpacing: "0.04em", lineHeight: 1 }}>
                {totalStaked === null ? "—" : `${totalStaked.toFixed(2)} USDC`}
              </div>
              <div style={{ fontSize: "11px", color: "#555566", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "2px" }}>
                Locked in escrow
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.6rem", color: "#888899", letterSpacing: "0.04em", lineHeight: 1 }}>
                {memberCount}
              </div>
              <div style={{ fontSize: "11px", color: "#555566", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "2px" }}>
                Members
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.6rem", color: "#888899", letterSpacing: "0.04em", lineHeight: 1 }}>
                {community.member_stake} USDC
              </div>
              <div style={{ fontSize: "11px", color: "#555566", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "2px" }}>
                Per member
              </div>
            </div>
          </div>

          {/* Separator note */}
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#555566",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "#888899" }}>Note:</strong> Pot Balance is the simulated treasury on GenLayer.
            Staked Funds are real testnet USDC locked on ARC as member bonds. These are two separate systems.
            Staked funds are released on clean exit or sent to the relay wallet on slash.
          </div>
        </div>
      )}

      {/* ── Deposit form ── */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="section-label">Deposit Funds</div>

        <div style={{ fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
          Add funds to the community pot. Anyone can deposit. Deposits are permanent — funds go directly into the treasury.
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "stretch" }}>
          <input
            type="number"
            min={1}
            placeholder="Amount to deposit..."
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDeposit()}
            style={{ flex: 1 }}
          />
          <button
            className="btn-primary"
            onClick={handleDeposit}
            disabled={!canDeposit}
            style={{ width: "auto", padding: "0 1.5rem", flexShrink: 0 }}
          >
            {isLoading && loading === "Depositing funds..." ? (
              <span className="btn-loading"><span className="spinner" />Depositing...</span>
            ) : (
              "Deposit →"
            )}
          </button>
        </div>

        {depositNum > 0 && (
          <div style={{ fontSize: "13px", color: "#888899" }}>
            After deposit: pot will be{" "}
            <strong style={{ color: "#00FF87" }}>
              {(community.pot_balance + depositNum).toLocaleString()}
            </strong>
            {" · "}max proposal{" "}
            <strong style={{ color: "#F0F0F0" }}>
              {Math.floor((community.pot_balance + depositNum) * community.max_proposal_pct / 100).toLocaleString()}
            </strong>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
      </div>

      {/* ── Governance settings ── */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div className="section-label">Governance Parameters</div>
        {[
          ["🎯", "Funding threshold",       `${community.funding_threshold}/100`],
          ["📏", "Max proposal size",        `${community.max_proposal_pct}% of pot`],
          ["🎟️", "Proposal submission fee",  String(community.proposal_fee)],
          ["❤️", "Pulse bonus",              "Up to +5 points"],
          ["🔄", "Revision rounds",          "1 per proposal"],
          ["🔒", "Member stake (ARC USDC)",
            community.member_stake > 0 ? `${community.member_stake} USDC` : "Free entry"],
        ].map(([icon, label, value]) => (
          <div key={String(label)} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
            <span style={{ flexShrink: 0, fontSize: "15px" }}>{icon}</span>
            <span style={{ flex: 1, color: "#888899" }}>{label}</span>
            <span style={{ fontWeight: 700, color: "#F0F0F0" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Funded proposals ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div className="section-label">Funded Proposals ({community.funded_count})</div>

        {fundedLoading ? (
          <div className="loading-state">
            <span className="spinner" />
            <span>Loading funded proposals...</span>
          </div>
        ) : fundedProposals.length === 0 ? (
          <div className="empty-state">No funded proposals yet.</div>
        ) : (
          fundedProposals.map((p) => (
            <div
              key={p.id}
              className="card card--green"
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "#F0F0F0", lineHeight: 1.3 }}>
                    ✅ {p.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#555566", marginTop: "2px" }}>
                    by {p.proposer_name} · {p.id}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem", color: "#00FF87", letterSpacing: "0.04em" }}>
                    {p.amount.toLocaleString()}
                  </div>
                  {p.total_score !== null && (
                    <div style={{ fontSize: "11px", color: "#888899" }}>
                      Score: {p.total_score}/100
                    </div>
                  )}
                </div>
              </div>
              {p.reasoning && (
                <div style={{ fontSize: "13px", color: "#888899", fontStyle: "italic", lineHeight: 1.5, borderTop: "1px solid rgba(0,255,135,0.1)", paddingTop: "8px" }}>
                  {p.reasoning}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
