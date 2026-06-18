/**
 * Arc Testnet configuration — values from official docs:
 * https://docs.arc.io/arc/references/contract-addresses.md
 * https://docs.arc.network/integrate/connect-to-arc
 */

import { defineChain } from "viem";

// Arc Testnet — Chain ID 5042002, USDC as native gas token
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 18, // Native gas token uses 18 decimals
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

// CAIP-2 network identifier for x402 v2
export const ARC_NETWORK_ID = "eip155:5042002";

// Contract addresses — Arc Testnet only
export const CONTRACTS = {
  // USDC ERC-20 interface (6 decimals for amounts; native uses 18)
  USDC: "0x3600000000000000000000000000000000000000" as `0x${string}`,
  // Circle Gateway Wallet — enables gasless nanopayments
  GATEWAY_WALLET: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`,
  // Gateway Minter
  GATEWAY_MINTER: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" as `0x${string}`,
} as const;

// USDC amount helpers (ERC-20 interface = 6 decimals)
export const USDC_DECIMALS = 6;

export function usdcToRaw(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

export function rawToUsdc(raw: bigint): number {
  return Number(raw) / 10 ** USDC_DECIMALS;
}

export function formatUsdc(amount: number): string {
  return `$${amount.toFixed(amount < 0.01 ? 6 : 4)}`;
}
