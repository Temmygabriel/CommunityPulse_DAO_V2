"use client";
// CommunityPulse V2 — Main Orchestrator
// Fix: normalisePrivateKey() ensures genlayer-js key is always stored as clean 0x hex string

import { useState, useEffect, useRef, useCallback } from "react";
import { Screen, Community, Proposal } from "../types";
import {
  makeAccount,
  createCommunity,
  joinCommunity,
  depositFunds,
  submitProposal,
  addPulse,
  evaluateProposal,
  reviseProposal,
  leaveCommunity,
  slashMember,
  getCommunity,
  getProposal,
  getCommunityProposals,
  getRecentCommunities,
} from "../lib/contract";
import {
  registerCommunity,
  releaseStake,
  slashStake,
  getRelayAddress,
} from "../lib/arcContract";

import LandingScreen from "../components/LandingScreen";
import CreateCommunityScreen from "../components/CreateCommunityScreen";
import JoinCommunityScreen from "../components/JoinCommunityScreen";
import CommunityDashboard from "../components/CommunityDashboard";
import ProposalFeedScreen from "../components/ProposalFeedScreen";
import SubmitProposalScreen from "../components/SubmitProposalScreen";
import ProposalDetailScreen from "../components/ProposalDetailScreen";
import JudgingScreen from "../components/JudgingScreen";
import ConstitutionScreen from "../components/ConstitutionScreen";
import TreasuryScreen from "../components/TreasuryScreen";

const POLL_INTERVAL  = 3000;
const CALC_FALLBACK  = 30_000;

// ── Key normalisation ─────────────────────────────────────────────────────────
// genlayer-js may return privateKey as Uint8Array, array-like, or string.
// Always store and use a clean 0x hex string so ethers.js never chokes.
function normalisePrivateKey(key: any): string {
  if (!key) return "";

  // Already a clean 0x hex string
  if (typeof key === "string" && key.startsWith("0x") && key.length === 66) {
    return key;
  }

  // Plain hex string without 0x
  if (typeof key === "string" && key.length === 64) {
    return "0x" + key;
  }

  // JSON-serialised array e.g. "[1,2,3,...]"
  if (typeof key === "string" && key.startsWith("[")) {
    try {
      const arr = JSON.parse(key);
      const bytes = new Uint8Array(arr);
      return "0x" + Array.from(bytes).map((b: number) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // fall through
    }
  }

  // Uint8Array or number array
  if (key instanceof Uint8Array || Array.isArray(key)) {
    const bytes = new Uint8Array(key);
    return "0x" + Array.from(bytes).map((b: number) => b.toString(16).padStart(2, "0")).join("");
  }

  return typeof key === "string" && key.startsWith("0x") ? key : "0x" + String(key);
}

export default function App() {
  const [screen, setScreen]                   = useState<Screen>("landing");
  const [playerAddress, setPlayerAddress]     = useState("");
  const [playerPrivateKey, setPlayerPrivateKey] = useState("");
  const [playerName, setPlayerName]           = useState("");
  const [activeCommunityId, setActiveCommunityId] = useState("");
  const [activeProposalId, setActiveProposalId]   = useState("");
  const [community, setCommunity]             = useState<Community | null>(null);
  const [proposal, setProposal]               = useState<Proposal | null>(null);
  const [error, setError]                     = useState("");
  const [loading, setLoading]                 = useState("");

  const accountRef          = useRef<ReturnType<typeof makeAccount> | null>(null);
  const screenRef           = useRef<Screen>("landing");
  const pollTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollProposalIdRef   = useRef<string>("");
  const calculatingRef      = useRef(false);
  const calcStartedAtRef    = useRef<number>(0);

  // ── Account initialisation ─────────────────────────────────────────────────
  useEffect(() => {
    const savedName = localStorage.getItem("cp_name");
    let acc: ReturnType<typeof makeAccount>;
    const savedKey = localStorage.getItem("cp_private_key");

    try {
      if (
        savedKey &&
        savedKey !== "undefined" &&
        savedKey !== "null" &&
        savedKey.startsWith("0x")
      ) {
        acc = makeAccount(savedKey as `0x${string}`);
      } else {
        if (savedKey !== null) {
          localStorage.removeItem("cp_private_key");
          localStorage.removeItem("cp_address");
        }
        acc = makeAccount();
        // FIXED: normalise before storing
        const cleanKey = normalisePrivateKey(acc.privateKey);
        localStorage.setItem("cp_private_key", cleanKey);
      }
    } catch {
      localStorage.removeItem("cp_private_key");
      localStorage.removeItem("cp_address");
      localStorage.removeItem("cp_name");
      acc = makeAccount();
      const cleanKey = normalisePrivateKey(acc.privateKey);
      localStorage.setItem("cp_private_key", cleanKey);
    }

    accountRef.current = acc;
    localStorage.setItem("cp_address", acc.address);
    setPlayerAddress(acc.address);
    // FIXED: normalise before setting state
    setPlayerPrivateKey(normalisePrivateKey(acc.privateKey));
    if (savedName) setPlayerName(savedName);
  }, []);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // ── Polling ────────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startProposalPolling = useCallback(
    (proposalId: string) => {
      stopPolling();
      pollProposalIdRef.current = proposalId;

      const poll = async () => {
        if (!pollProposalIdRef.current) return;
        if (!["judging"].includes(screenRef.current)) return;

        try {
          const data: Proposal = await getProposal(pollProposalIdRef.current);
          if (!data || data.error) return;

          setProposal(data);

          if (data.status !== "pending" && data.status !== "scoring") {
            stopPolling();
            calculatingRef.current = false;
            setScreen("proposal_detail");
          }
        } catch {
          /* network blip — keep polling */
        }
      };

      poll();
      pollTimerRef.current = setInterval(poll, POLL_INTERVAL);
    },
    [stopPolling]
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Account helper ─────────────────────────────────────────────────────────
  function getAccount() {
    if (!accountRef.current) {
      const savedKey = localStorage.getItem("cp_private_key");
      try {
        if (
          savedKey &&
          savedKey !== "undefined" &&
          savedKey !== "null" &&
          savedKey.startsWith("0x")
        ) {
          accountRef.current = makeAccount(savedKey as `0x${string}`);
        } else {
          accountRef.current = makeAccount();
          const cleanKey = normalisePrivateKey(accountRef.current.privateKey);
          localStorage.setItem("cp_private_key", cleanKey);
        }
      } catch {
        localStorage.removeItem("cp_private_key");
        accountRef.current = makeAccount();
        const cleanKey = normalisePrivateKey(accountRef.current.privateKey);
        localStorage.setItem("cp_private_key", cleanKey);
      }
      localStorage.setItem("cp_address", accountRef.current.address);
      setPlayerAddress(accountRef.current.address);
      setPlayerPrivateKey(normalisePrivateKey(accountRef.current.privateKey));
    }
    return accountRef.current;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSetName(name: string) {
    setPlayerName(name);
    localStorage.setItem("cp_name", name);
  }

  async function handleCreateCommunity(params: {
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
    memberStake: number;
  }) {
    setLoading("Creating community...");
    setError("");
    const acc = getAccount();

    if (params.founderName.trim()) {
      handleSetName(params.founderName.trim());
    }

    setScreen("judging");

    try {
      const communityId = await createCommunity(
        acc,
        acc.address,
        params.founderName,
        params.communityName,
        params.description,
        params.constitutionPurpose,
        params.constitutionAlwaysFund,
        params.constitutionNeverFund,
        params.constitutionWhoBenefits,
        params.constitutionSuccess,
        params.initialPot,
        params.fundingThreshold,
        params.maxProposalPct,
        params.proposalFee,
        params.memberStake
      );

      if (!communityId) {
        throw new Error("No community ID returned");
      }

      setActiveCommunityId(communityId);

      if (params.memberStake > 0) {
        try {
          const relayAddr = getRelayAddress();
          await registerCommunity(communityId, relayAddr);
          console.log(`ARC community registered: ${communityId} → pot: ${relayAddr}`);
        } catch (arcErr: any) {
          console.error("ARC registerCommunity failed — slash will not work:", arcErr?.message);
        }
      }

      const communityData = await getCommunity(communityId);
      setCommunity(communityData);

      setScreen("community_dashboard");
    } catch (e: any) {
      console.error(e);
      setError("Failed to create community. Please try again.");
      setScreen("create_community");
    } finally {
      setLoading("");
    }
  }

  async function handleJoinCommunity(
    communityId: string,
    name: string,
    arcTxHash: string
  ) {
    setLoading("Joining community...");
    setError("");
    const acc = getAccount();

    const stakeKey = `cp_pending_stake_${communityId.trim().toUpperCase()}_${acc.address}`;

    if (name.trim()) {
      handleSetName(name.trim());
    }

    try {
      const communityData = await getCommunity(communityId.trim().toUpperCase());
      if (communityData.error) {
        throw new Error("Community not found");
      }

      await joinCommunity(
        acc,
        communityId.trim().toUpperCase(),
        acc.address,
        name,
        arcTxHash
      );

      localStorage.removeItem(stakeKey);

      const updated = await getCommunity(communityId.trim().toUpperCase());
      setCommunity(updated);
      setActiveCommunityId(communityId.trim().toUpperCase());
      setScreen("community_dashboard");
    } catch (e: any) {
      console.error(e);
      setError(
        e.message === "Community not found"
          ? "Community not found. Check the ID and try again."
          : "Failed to join community on GenLayer. Your stake is safe — use Retry Join."
      );
    } finally {
      setLoading("");
    }
  }

  async function handleLeaveCommunity() {
    if (!activeCommunityId) return;
    setLoading("Leaving community...");
    setError("");
    const acc = getAccount();

    try {
      const success = await leaveCommunity(acc, activeCommunityId, acc.address);
      if (!success) {
        throw new Error("Leave failed on GenLayer — you may be the founder, or already not a member.");
      }

      try {
        await releaseStake(activeCommunityId, acc.address);
        console.log(`ARC stake released for ${acc.address} in ${activeCommunityId}`);
      } catch (arcErr: any) {
        console.error("ARC releaseStake failed:", arcErr?.message);
        throw new Error(
          "Left the community on GenLayer but stake release on ARC failed. " +
          "The relay wallet may be low on USDC. Contact the community founder."
        );
      }

      handleNavigateToLanding();
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to leave community.");
    } finally {
      setLoading("");
    }
  }

  async function handleSlashMember(targetAddress: string) {
    if (!activeCommunityId) return;
    setLoading("Slashing member...");
    setError("");
    const acc = getAccount();

    try {
      const success = await slashMember(
        acc,
        activeCommunityId,
        acc.address,
        targetAddress
      );
      if (!success) {
        throw new Error("Slash failed on GenLayer — check you are the founder.");
      }

      try {
        await slashStake(activeCommunityId, targetAddress);
        console.log(`ARC stake slashed for ${targetAddress} in ${activeCommunityId}`);
      } catch (arcErr: any) {
        console.error("ARC slashStake failed:", arcErr?.message);
        throw new Error(
          "Member removed from GenLayer but ARC stake slash failed. " +
          "Check that the community is registered on ARC and the relay wallet has USDC."
        );
      }

      const updated = await getCommunity(activeCommunityId);
      setCommunity(updated);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to slash member.");
    } finally {
      setLoading("");
    }
  }

  async function handleDepositFunds(amount: number) {
    if (!activeCommunityId) return;
    setLoading("Depositing funds...");
    setError("");
    const acc = getAccount();

    try {
      await depositFunds(acc, activeCommunityId, acc.address, amount);
      const updated = await getCommunity(activeCommunityId);
      setCommunity(updated);
    } catch (e: any) {
      console.error(e);
      setError("Failed to deposit funds. Try again.");
    } finally {
      setLoading("");
    }
  }

  async function handleSubmitProposal(params: {
    title: string;
    amount: number;
    whatItDoes: string;
    whoItHelps: string;
    successMetric: string;
    timeline: string;
  }) {
    if (!activeCommunityId) return;
    setLoading("Submitting proposal...");
    setError("");
    const acc = getAccount();

    try {
      const proposalId = await submitProposal(
        acc,
        activeCommunityId,
        acc.address,
        playerName,
        params.title,
        params.amount,
        params.whatItDoes,
        params.whoItHelps,
        params.successMetric,
        params.timeline
      );

      if (!proposalId) {
        throw new Error("No proposal ID returned — check membership and pot balance");
      }

      setActiveProposalId(proposalId);

      const proposalData = await getProposal(proposalId);
      setProposal(proposalData);

      setScreen("judging");
      setLoading("");

      if (!calculatingRef.current) {
        calculatingRef.current = true;
        calcStartedAtRef.current = Date.now();
        try {
          await evaluateProposal(acc, proposalId);
        } catch {
          calculatingRef.current = false;
        }
      }

      startProposalPolling(proposalId);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to submit proposal. Try again.");
      setScreen("submit_proposal");
      setLoading("");
    }
  }

  async function handleReviseProposal(params: {
    title: string;
    amount: number;
    whatItDoes: string;
    whoItHelps: string;
    successMetric: string;
    timeline: string;
  }) {
    if (!activeProposalId) return;
    setLoading("Submitting revision...");
    setError("");
    const acc = getAccount();

    try {
      const newProposalId = await reviseProposal(
        acc,
        activeProposalId,
        acc.address,
        params.title,
        params.amount,
        params.whatItDoes,
        params.whoItHelps,
        params.successMetric,
        params.timeline
      );

      if (!newProposalId) {
        throw new Error("No proposal ID returned from revision");
      }

      setActiveProposalId(newProposalId);

      const proposalData = await getProposal(newProposalId);
      setProposal(proposalData);

      setScreen("judging");
      setLoading("");

      if (!calculatingRef.current) {
        calculatingRef.current = true;
        calcStartedAtRef.current = Date.now();
        try {
          await evaluateProposal(acc, newProposalId);
        } catch {
          calculatingRef.current = false;
        }
      }

      startProposalPolling(newProposalId);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to submit revision. Try again.");
      setScreen("proposal_detail");
      setLoading("");
    }
  }

  async function handleAddPulse(proposalId: string) {
    setLoading("Adding pulse...");
    setError("");
    const acc = getAccount();

    try {
      await addPulse(acc, proposalId, acc.address);
      const updated = await getProposal(proposalId);
      setProposal(updated);
    } catch (e: any) {
      console.error(e);
      setError("Failed to add pulse. Try again.");
    } finally {
      setLoading("");
    }
  }

  async function handleLoadCommunity(communityId: string) {
    setLoading("Loading community...");
    setError("");
    try {
      const data = await getCommunity(communityId);
      if (data.error) throw new Error("Not found");
      setCommunity(data);
      setActiveCommunityId(communityId);
    } catch {
      setError("Failed to load community.");
    } finally {
      setLoading("");
    }
  }

  async function handleLoadProposal(proposalId: string) {
    setLoading("Loading proposal...");
    setError("");
    try {
      const data = await getProposal(proposalId);
      if (data.error) throw new Error("Not found");
      setProposal(data);
      setActiveProposalId(proposalId);
      setScreen("proposal_detail");
    } catch {
      setError("Failed to load proposal.");
    } finally {
      setLoading("");
    }
  }

  function handleNavigateToDashboard() {
    stopPolling();
    calculatingRef.current = false;
    setError("");
    setScreen("community_dashboard");
  }

  function handleNavigateToLanding() {
    stopPolling();
    calculatingRef.current = false;
    setCommunity(null);
    setProposal(null);
    setActiveCommunityId("");
    setActiveProposalId("");
    setError("");
    setScreen("landing");
  }

  // ── Screen renderer ────────────────────────────────────────────────────────
  const renderScreen = () => {
    switch (screen) {
      case "landing":
        return (
          <LandingScreen
            playerAddress={playerAddress}
            playerName={playerName}
            onSetName={handleSetName}
            onNavigate={setScreen}
            onJoinCommunity={(id, name) => handleJoinCommunity(id, name, "FREE_JOIN")}
            loading={loading}
            error={error}
          />
        );

      case "create_community":
        return (
          <CreateCommunityScreen
            playerAddress={playerAddress}
            playerName={playerName}
            onSubmit={handleCreateCommunity}
            onBack={() => setScreen("landing")}
            loading={loading}
            error={error}
          />
        );

      case "join_community":
        return (
          <JoinCommunityScreen
            playerAddress={playerAddress}
            playerPrivateKey={playerPrivateKey}
            playerName={playerName}
            onJoin={handleJoinCommunity}
            onBack={() => setScreen("landing")}
            loading={loading}
            error={error}
          />
        );

      case "community_dashboard":
        if (!community) return null;
        return (
          <CommunityDashboard
            community={community}
            playerAddress={playerAddress}
            onNavigate={setScreen}
            onBack={handleNavigateToLanding}
            onSlashMember={handleSlashMember}
            onLeaveCommunity={handleLeaveCommunity}
            loading={loading}
            error={error}
          />
        );

      case "proposal_feed":
        if (!community) return null;
        return (
          <ProposalFeedScreen
            community={community}
            playerAddress={playerAddress}
            onSelectProposal={(p) => {
              setProposal(p);
              setActiveProposalId(p.id);
              setScreen("proposal_detail");
            }}
            onBack={() => setScreen("community_dashboard")}
            loading={loading}
          />
        );

      case "submit_proposal":
        if (!community) return null;
        return (
          <SubmitProposalScreen
            community={community}
            playerAddress={playerAddress}
            onSubmit={handleSubmitProposal}
            onBack={() => setScreen("community_dashboard")}
            loading={loading}
            error={error}
          />
        );

      case "proposal_detail":
        if (!proposal) return null;
        return (
          <ProposalDetailScreen
            proposal={proposal}
            community={community}
            playerAddress={playerAddress}
            onAddPulse={() => handleAddPulse(proposal.id)}
            onRevise={() => {
              setActiveProposalId(proposal.id);
              setScreen("submit_proposal");
            }}
            onBack={() => setScreen("proposal_feed")}
            loading={loading}
            error={error}
          />
        );

      case "judging":
        return (
          <JudgingScreen
            context={activeProposalId && proposal ? "proposal" : "community"}
            communityName={community?.name ?? ""}
            proposalId={activeProposalId}
            proposalTitle={proposal?.title ?? ""}
            onGoHome={handleNavigateToLanding}
            onViewProposals={() => {
              stopPolling();
              calculatingRef.current = false;
              setScreen("proposal_feed");
            }}
          />
        );

      case "constitution":
        if (!community) return null;
        return (
          <ConstitutionScreen
            community={community}
            onBack={() => setScreen("community_dashboard")}
          />
        );

      case "treasury":
        if (!community) return null;
        return (
          <TreasuryScreen
            community={community}
            playerAddress={playerAddress}
            onDeposit={handleDepositFunds}
            onBack={() => setScreen("community_dashboard")}
            loading={loading}
            error={error}
          />
        );

      default:
        return null;
    }
  };

  return (
    <main className="app-root">
      <div className="app-container">{renderScreen()}</div>
    </main>
  );
}