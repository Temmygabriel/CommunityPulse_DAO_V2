// CommunityPulse V2 — ARC Contract Utils
// All ARC interaction goes through this file.
// Uses ethers.js v6.

import { ethers } from "ethers";

// ── Env ─────────────────────────────────────────────────────────────────────

const ARC_RPC         = process.env.NEXT_PUBLIC_ARC_RPC as string;
const ESCROW_ADDRESS  = process.env.NEXT_PUBLIC_ARC_ESCROW_ADDRESS as `0x${string}`;
const USDC_ADDRESS    = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const RELAY_KEY       = process.env.NEXT_PUBLIC_RELAY_PRIVATE_KEY as string;

// ── ABIs ─────────────────────────────────────────────────────────────────────

const ESCROW_ABI = [
  // Write — member-initiated
  "function depositStake(string communityId, address member, uint256 amount) external",
  // Write — relay-only
  "function releaseStake(string communityId, address member) external",
  "function slashStake(string communityId, address member) external",
  "function registerCommunity(string communityId, address potAddress) external",
  // View
  "function getStake(string communityId, address member) external view returns (uint256)",
  "function getPotAddress(string communityId) external view returns (address)",
  "function relay() external view returns (address)",
  "function owner() external view returns (address)",
  // Events
  "event StakeDeposited(string communityId, address indexed member, uint256 amount)",
  "event StakeReleased(string communityId, address indexed member, uint256 amount)",
  "event StakeSlashed(string communityId, address indexed member, uint256 amount, address indexed pot)",
  "event CommunityRegistered(string communityId, address indexed potAddress)",
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

// ── USDC decimal constant (ARC USDC = 6 decimals, same as mainnet) ────────────

const USDC_DECIMALS = 6;

// ── Provider / Signer factories ───────────────────────────────────────────────

export function makeArcProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(ARC_RPC);
}

/// Relay signer — used for releaseStake, slashStake, registerCommunity
/// WARNING: RELAY_KEY is in env — acceptable for testnet browser usage.
/// Never expose in production.
export function makeRelaySigner(): ethers.Wallet {
  const provider = makeArcProvider();
  return new ethers.Wallet(RELAY_KEY, provider);
}

/// Member signer — used for approve + depositStake.
/// @param privateKey  The member's wallet private key (from localStorage cp_private_key).
export function makeMemberSigner(privateKey: string): ethers.Wallet {
  const provider = makeArcProvider();
  return new ethers.Wallet(privateKey, provider);
}

/// Derive the relay wallet address from RELAY_KEY (used to set potAddress on create).
export function getRelayAddress(): string {
  return new ethers.Wallet(RELAY_KEY).address;
}

// ── Balance checks ────────────────────────────────────────────────────────────

/// USDC balance in whole units (e.g. 2.5 USDC returns 2.5).
export async function getUsdcBalance(address: string): Promise<number> {
  const provider = makeArcProvider();
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const raw: bigint = await usdc.balanceOf(address);
  return Number(ethers.formatUnits(raw, USDC_DECIMALS));
}

/// Relay wallet USDC balance — used for health check on dashboard.
/// Displays a warning if below 1 USDC so demo doesn't stall.
export async function getRelayBalance(): Promise<number> {
  return getUsdcBalance(getRelayAddress());
}

/// Read current escrow stake for a member (in whole USDC units).
export async function getStakeBalance(
  communityId: string,
  memberAddress: string
): Promise<number> {
  const provider = makeArcProvider();
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
  const raw: bigint = await escrow.getStake(communityId, memberAddress);
  return Number(ethers.formatUnits(raw, USDC_DECIMALS));
}

// ── Member-initiated calls ─────────────────────────────────────────────────────

/// Step 1a of the join flow: member approves the escrow contract to spend USDC.
/// @param memberPrivateKey  From localStorage cp_private_key
/// @param amountUsdc        Whole USDC (e.g. 2 for 2 USDC)
/// @returns approve tx hash
export async function approveUsdc(
  memberPrivateKey: string,
  amountUsdc: number
): Promise<string> {
  const signer = makeMemberSigner(memberPrivateKey);
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
  const amount = ethers.parseUnits(String(amountUsdc), USDC_DECIMALS);
  const tx = await usdc.approve(ESCROW_ADDRESS, amount);
  await tx.wait();
  return tx.hash as string;
}

/// Step 1b of the join flow: member deposits stake.
/// Must have called approveUsdc first.
/// @param memberPrivateKey  From localStorage cp_private_key
/// @param communityId       GenLayer community ID e.g. "COM000001"
/// @param memberAddress     Member's wallet address
/// @param amountUsdc        Whole USDC (must match community member_stake)
/// @returns deposit tx hash — STORE IN LOCALSTORAGE IMMEDIATELY as proof for GenLayer
export async function depositStake(
  memberPrivateKey: string,
  communityId: string,
  memberAddress: string,
  amountUsdc: number
): Promise<string> {
  const signer = makeMemberSigner(memberPrivateKey);
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
  const amount = ethers.parseUnits(String(amountUsdc), USDC_DECIMALS);
  const tx = await escrow.depositStake(communityId, memberAddress, amount);
  await tx.wait();
  return tx.hash as string;
}

// ── Relay-only calls ──────────────────────────────────────────────────────────

/// Called after GenLayer create_community succeeds.
/// Registers relay wallet as the community's slash destination.
/// @param communityId  GenLayer community ID e.g. "COM000001"
/// @param potAddress   Address to receive slashed stakes (use relay wallet on testnet)
/// @returns registerCommunity tx hash
export async function registerCommunity(
  communityId: string,
  potAddress: string
): Promise<string> {
  const relay = makeRelaySigner();
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, relay);
  const tx = await escrow.registerCommunity(communityId, potAddress);
  await tx.wait();
  return tx.hash as string;
}

/// Called after GenLayer leave_community returns true.
/// Returns staked USDC to the member's wallet.
/// @param communityId    GenLayer community ID
/// @param memberAddress  Member wallet address
/// @returns releaseStake tx hash
export async function releaseStake(
  communityId: string,
  memberAddress: string
): Promise<string> {
  const relay = makeRelaySigner();
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, relay);
  const tx = await escrow.releaseStake(communityId, memberAddress);
  await tx.wait();
  return tx.hash as string;
}

/// Called after GenLayer slash_member returns true.
/// Sends staked USDC to the community pot address (relay wallet on testnet).
/// @param communityId    GenLayer community ID
/// @param memberAddress  Address of slashed member
/// @returns slashStake tx hash
export async function slashStake(
  communityId: string,
  memberAddress: string
): Promise<string> {
  const relay = makeRelaySigner();
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, relay);
  const tx = await escrow.slashStake(communityId, memberAddress);
  await tx.wait();
  return tx.hash as string;
}
