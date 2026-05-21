"use client";
// CommunityPulse V2 — Main Orchestrator
// V2 Changes:
//   - handleCreateCommunity: memberStake param + registerCommunity on ARC after GenLayer success
//   - handleJoinCommunity: receives arcTxHash from JoinCommunityScreen, clears localStorage on success
//   - handleLeaveCommunity: GenLayer leave → ARC releaseStake (only if GenLayer returns true)
//   - handleSlashMember:    GenLayer slash → ARC slashStake  (only if GenLayer returns true)
//   - playerPrivateKey state passed to JoinCommunityScreen for ARC signing
//   - All V1 handlers preserved exactly

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

export default function App() {
  const [screen, setScreen]                   = useState<Screen>("landing");
  const [playerAddress, setPlayerAddress]     = useState("");
  const [playerPrivateKey, setPlayerPrivateKey] = useState(""); // V2 — for ARC signing
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
        localStorage.setItem("cp_private_key", acc.privateKey);
      }
    } catch {
      localStorage.removeItem("cp_private_key");
      localStorage.removeItem("cp_address");
      localStorage.removeItem("cp_name");
      acc = makeAccount();
      localStorage.setItem("cp_private_key", acc.privateKey);
    }

    accountRef.current = acc;
    localStorage.setItem("cp_address", acc.address);
    setPlayerAddress(acc.address);
    setPlayerPrivateKey(acc.privateKey); // V2 — expose for ARC signing
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
          localStorage.setItem("cp_private_key", accountRef.current.privateKey);
        }
      } catch {
        localStorage.removeItem("cp_private_key");
        accountRef.current = makeAccount();
        localStorage.setItem("cp_private_key", accountRef.current.privateKey);
      }
      localStorage.setItem("cp_address", accountRef.current.address);
      setPlayerAddress(accountRef.current.address);
      setPlayerPrivateKey(accountRef.current.privateKey);
    }
    return accountRef.current;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSetName(name: string) {
    setPlayerName(name);
    localStorage.setItem("cp_name", name);
  }

  // V2: memberStake param added; registerCommunity on ARC after GenLayer success
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
    memberStake: number;  // V2 NEW
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
        params.memberStake  // V2 NEW
      );

      if (!communityId) {
        throw new Error("No community ID returned");
      }

      setActiveCommunityId(communityId);

      // V2: Register community on ARC escrow (relay wallet = pot address on testnet)
      // Fire and forget — non-blocking. If this fails, slash won't work but
      // release still works. Log the error so developer can retry manually.
      if (params.memberStake > 0) {
        try {
          const relayAddr = getRelayAddress();
          await registerCommunity(communityId, relayAddr);
          console.log(`ARC community registered: ${communityId} → pot: ${relayAddr}`);
        } catch (arcErr: any) {
          console.error("ARC registerCommunity failed — slash will not work:", arcErr?.message);
          // Do not throw — community is created on GenLayer, ARC registration
          // can be retried manually by calling registerCommunity(communityId, relayAddr)
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

  // V2: receives arcTxHash from JoinCommunityScreen; clears localStorage on success
  async function handleJoinCommunity(
    communityId: string,
    name: string,
    arcTxHash: string  // V2 NEW — ARC deposit proof
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

      // V2: pass arcTxHash — GenLayer gate requires non-empty string
      await joinCommunity(
        acc,
        communityId.trim().toUpperCase(),
        acc.address,
        name,
        arcTxHash
      );

      // V2: GenLayer confirmed — safe to clear the stored stake hash
      localStorage.removeItem(stakeKey);

      const updated = await getCommunity(communityId.trim().toUpperCase());
      setCommunity(updated);
      setActiveCommunityId(communityId.trim().toUpperCase());
      setScreen("community_dashboard");
    } catch (e: any) {
      console.error(e);
      // Do NOT clear stakeKey here — the user may need to retry the GenLayer step
      setError(
        e.message === "Community not found"
          ? "Community not found. Check the ID and try again."
          : "Failed to join community on GenLayer. Your stake is safe — use Retry Join."
      );
    } finally {
      setLoading("");
    }
  }

  // V2 NEW: leave community → release stake on ARC
  async function handleLeaveCommunity() {
    if (!activeCommunityId) return;
    setLoading("Leaving community...");
    setError("");
    const acc = getAccount();

    try {
      // Step 1: GenLayer — remove from member list
      const success = await leaveCommunity(acc, activeCommunityId, acc.address);
      if (!success) {
        throw new Error("Leave failed on GenLayer — you may be the founder, or already not a member.");
      }

      // Step 2: ARC — release stake back to member
      // Only fires after GenLayer confirms. Never fires on GenLayer failure.
      try {
        await releaseStake(activeCommunityId, acc.address);
        console.log(`ARC stake released for ${acc.address} in ${activeCommunityId}`);
      } catch (arcErr: any) {
        console.error("ARC releaseStake failed:", arcErr?.message);
        // Member is removed from GenLayer but stake not released.
        // This means the relay wallet may be dry. Show a specific error.
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

  // V2 NEW: slash member → slash stake on ARC
  async function handleSlashMember(targetAddress: string) {
    if (!activeCommunityId) return;
    setLoading("Slashing member...");
    setError("");
    const acc = getAccount();

    try {
      // Step 1: GenLayer — remove member, record slash
      const success = await slashMember(
        acc,
        activeCommunityId,
        acc.address,
        targetAddress
      );
      if (!success) {
        throw new Error("Slash failed on GenLayer — check you are the founder.");
      }

      // Step 2: ARC — send stake to community pot (relay wallet)
      // Only fires after GenLayer confirms.
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

      // Refresh community to reflect new member count
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
            playerPrivateKey={playerPrivateKey}  // V2 NEW
            playerName={playerName}
            onJoin={handleJoinCommunity}          // V2: now (id, name, arcTxHash) => void
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
            onSlashMember={handleSlashMember}       // V2 NEW
            onLeaveCommunity={handleLeaveCommunity} // V2 NEW
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
