// CommunityPulse V2 — ARC Contract Utils
// All ARC interaction goes through this file.
// Uses ethers.js v6.
// Fix: normaliseKey() added to handle genlayer-js returning non-hex private keys

import { ethers } from "ethers";

// ── Env ─────────────────────────────────────────────────────────────────────

const ARC_RPC         = process.env.NEXT_PUBLIC_ARC_RPC as string;
const ESCROW_ADDRESS  = process.env.NEXT_PUBLIC_ARC_ESCROW_ADDRESS as `0x${string}`;
const USDC_ADDRESS    = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const RELAY_KEY       = process.env.NEXT_PUBLIC_RELAY_PRIVATE_KEY as string;

// ── ABIs ─────────────────────────────────────────────────────────────────────

const ESCROW_ABI = [
  "function depositStake(string communityId, address member, uint256 amount) external",
  "function releaseStake(string communityId, address member) external",
  "function slashStake(string communityId, address member) external",
  "function registerCommunity(string communityId, address potAddress) external",
  "function getStake(string communityId, address member) external view returns (uint256)",
  "function getPotAddress(string communityId) external view returns (address)",
  "function relay() external view returns (address)",
  "function owner() external view returns (address)",
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

const USDC_DECIMALS = 6;

// ── Key normalisation ─────────────────────────────────────────────────────────
// genlayer-js v0.23.0 may return privateKey as Uint8Array, array-like, or a
// plain hex string. ethers.js v6 requires a 0x-prefixed 32-byte hex string.
// This converts any of those formats into what ethers.js expects.

function normaliseKey(key: string | Uint8Array | number[] | any): string {
  // Already a clean 0x hex string
  if (typeof key === "string" && key.startsWith("0x") && key.length === 66) {
    return key;
  }

  // String without 0x prefix (64 hex chars)
  if (typeof key === "string" && key.length === 64) {
    return "0x" + key;
  }

  // String that is JSON-serialised array e.g. "[1,2,3,...]"
  if (typeof key === "string" && key.startsWith("[")) {
    try {
      const arr = JSON.parse(key);
      const bytes = new Uint8Array(arr);
      return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // fall through
    }
  }

  // Uint8Array or plain number array
  if (key instanceof Uint8Array || Array.isArray(key)) {
    const bytes = new Uint8Array(key);
    return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Last resort
  return typeof key === "string" && key.startsWith("0x") ? key : "0x" + key;
}

// ── Provider / Signer factories ───────────────────────────────────────────────

export function makeArcProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(ARC_RPC);
}

export function makeRelaySigner(): ethers.Wallet {
  const provider = makeArcProvider();
  return new ethers.Wallet(normaliseKey(RELAY_KEY), provider);
}

export function makeMemberSigner(privateKey: string): ethers.Wallet {
  const provider = makeArcProvider();
  return new ethers.Wallet(normaliseKey(privateKey), provider);
}

export function getRelayAddress(): string {
  return new ethers.Wallet(normaliseKey(RELAY_KEY)).address;
}

// ── Balance checks ────────────────────────────────────────────────────────────

export async function getUsdcBalance(address: string): Promise<number> {
  const provider = makeArcProvider();
  const usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const raw: bigint = await usdc.balanceOf(address);
  return Number(ethers.formatUnits(raw, USDC_DECIMALS));
}

export async function getRelayBalance(): Promise<number> {
  return getUsdcBalance(getRelayAddress());
}

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