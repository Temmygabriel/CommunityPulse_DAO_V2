"use client";
// CommunityPulse V2 — Landing Screen
// V2 Changes: community cards show member_stake so users know cost before joining
// UI Fix: removed stat-chips section (AI Judge / 1 Address = 1 Vote / etc)

import { useState, useEffect } from "react";
import { Screen } from "../types";
import { getRecentCommunities } from "../lib/contract";

interface LandingProps {
  playerAddress: string;
  playerName: string;
  onSetName: (name: string) => void;
  onNavigate: (screen: Screen) => void;
  onJoinCommunity: (id: string, name: string) => void;
  loading: string;
  error: string;
}

interface RecentCommunity {
  id: string;
  name: string;
  description: string;
  member_count: number;
  pot_balance: number;
  funded_count: number;
  member_stake: number;
  status: string;
}

export default function LandingScreen({
  playerAddress,
  playerName,
  onSetName,
  onNavigate,
  onJoinCommunity,
  loading,
  error,
}: LandingProps) {
  const [nameInput, setNameInput] = useState(playerName);
  const [nameLocked, setNameLocked] = useState(!!playerName);
  const [joinId, setJoinId] = useState("");
  const [recentCommunities, setRecentCommunities] = useState<RecentCommunity[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  useEffect(() => {
    if (playerName) {
      setNameInput(playerName);
      setNameLocked(true);
    }
  }, [playerName]);

  useEffect(() => {
    async function loadRecent() {
      setBrowseLoading(true);
      try {
        const communities = await getRecentCommunities(6);
        setRecentCommunities(communities || []);
      } catch {
        // silent — show empty state
      } finally {
        setBrowseLoading(false);
      }
    }
    loadRecent();
  }, []);

  function lockName() {
    if (nameInput.trim()) {
      onSetName(nameInput.trim());
      setNameLocked(true);
    }
  }

  const isLoading = !!loading;
  const hasName = !!nameInput.trim();

  function copyAddress() {
    navigator.clipboard.writeText(playerAddress);
  }

  return (
    <div className="fadeIn">
      {/* ── Hero ── */}
      <div className="hero-section">
        <div className="hero-inner">
          <h1 className="hero-title">
            COMMUNITY<br />
            <span className="highlight-green">PULSE</span>
          </h1>
          <p className="hero-subtitle">
            On-chain community treasury governed by AI.<br />
            Pool funds. Write a constitution. Let the AI decide.
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="landing-body">
        <div className="landing-body-inner">

          {/* Your identity */}
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888899", marginBottom: "4px" }}>
            Your Identity
          </div>

          {/* Address chip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF87", flexShrink: 0 }} />
            <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#555566", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {playerAddress || "Generating address..."}
            </span>
            {playerAddress && (
              <button
                onClick={copyAddress}
                style={{ fontSize: "11px", color: "#888899", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "3px 8px", background: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", flexShrink: 0 }}
              >
                Copy
              </button>
            )}
          </div>

          {/* Name input */}
          <div className="name-input-row">
            <input
              type="text"
              placeholder="Your display name..."
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value); setNameLocked(false); }}
              onKeyDown={(e) => e.key === "Enter" && lockName()}
              disabled={nameLocked}
              maxLength={30}
            />
            {nameLocked ? (
              <button
                className="set-btn"
                style={{ background: "#00FF87", color: "#0A0A0F", borderColor: "#00FF87" }}
                onClick={() => setNameLocked(false)}
              >
                ✏️ Edit
              </button>
            ) : (
              <button className="set-btn" onClick={lockName} disabled={!hasName}>
                Set →
              </button>
            )}
          </div>
          {nameLocked && (
            <div className="name-set-confirm">✓ Playing as <strong>{nameInput}</strong></div>
          )}

          {/* Primary actions */}
          <button
            className="btn-primary"
            onClick={() => onNavigate("create_community")}
            disabled={isLoading || !hasName}
            style={{ marginTop: "0.5rem" }}
          >
            🏛️ CREATE A COMMUNITY
          </button>

          {/* Join by ID */}
          <div className="join-row">
            <input
              type="text"
              placeholder="Community ID (e.g. COM000001)..."
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinId.trim() && hasName && onNavigate("join_community")}
              maxLength={9}
              style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: "18px", letterSpacing: "0.08em" }}
            />
            <button
              className="join-btn"
              onClick={() => onNavigate("join_community")}
              disabled={isLoading || !hasName}
            >
              {loading === "Joining community..." ? "..." : "JOIN"}
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}

          {/* ── Browse communities ── */}
          <div style={{ marginTop: "0.5rem" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888899", marginBottom: "10px" }}>
              Recent Communities
            </div>

            {browseLoading ? (
              <div className="loading-state">
                <span className="spinner" />
                <span>Loading communities...</span>
              </div>
            ) : recentCommunities.length === 0 ? (
              <div
                style={{
                  padding: "24px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "14px",
                  textAlign: "center",
                  color: "#555566",
                  fontSize: "14px",
                }}
              >
                No communities yet. Be the first to create one.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {recentCommunities.map((c) => (
                  <div
                    key={c.id}
                    className="community-card"
                    onClick={() => hasName && onNavigate("join_community")}
                    style={{ opacity: hasName ? 1 : 0.6, cursor: hasName ? "pointer" : "default" }}
                  >
                    <div className="community-card-header">
                      <div>
                        <div className="community-card-name">{c.name}</div>
                        <div className="community-card-desc">{c.description}</div>
                      </div>
                      <span className={`status-badge status-badge--${c.status}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="community-card-meta">
                      <span>👥 {c.member_count} members</span>
                      <span>💰 {c.pot_balance} pot</span>
                      <span>✅ {c.funded_count} funded</span>
                      <span style={{ color: c.member_stake > 0 ? "#A78BFA" : "#555566" }}>
                        {c.member_stake > 0 ? `🔒 ${c.member_stake} USDC to join` : "🔓 Free to join"}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#555566", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.08em" }}>
                      {c.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── How it works ── */}
          <div
            style={{
              marginTop: "0.5rem",
              padding: "18px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888899" }}>
              How it works
            </div>
            {[
              ["🏛️", "Found a community with a 5-sentence constitution"],
              ["🔒", "Members stake USDC on ARC to join — Sybil resistance"],
              ["💰", "Members pool funds into the simulated treasury pot"],
              ["📝", "Anyone proposes how to spend the pot"],
              ["⚖️", "AI scores every proposal against the constitution"],
              ["✅", "Score ≥ threshold gets funded automatically"],
            ].map(([emoji, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
                <span style={{ fontSize: "16px", flexShrink: 0 }}>{emoji}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}