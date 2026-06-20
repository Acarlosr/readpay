/**
 * ReadPay payment client — the core x402 payment logic.
 *
 * Uses @x402/fetch v2 + @x402/evm v2 + viem.
 * Network: Arc Testnet (eip155:5042002)
 *
 * Karpathy note: This is the "forward pass" — understand every step
 * before touching it. The x402 v2 API is different from v1 (deprecated).
 */

import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { createWalletClient, http, createPublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_NETWORK_ID, CONTRACTS, rawToUsdc } from "../lib/arc";
import { checkBudget, recordSpend } from "./budget";
import { addPaymentRecord } from "./history";

export interface PaymentResult {
  success: boolean;
  amountUsdc: number;
  url: string;
  error?: string;
  responseBody?: string;
}

/**
 * Creates a pay-enabled fetch instance for a given private key.
 * This is called in the service worker context — NOT in content scripts.
 */
export function createPayFetch(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    transport: http("https://rpc.testnet.arc.network"),
    chain: arcTestnet,
  });

  // x402 v2: ExactEvmScheme handles EIP-3009 TransferWithAuthorization
  const scheme = new ExactEvmScheme(account);

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        // CAIP-2 wildcard — matches Arc Testnet (eip155:5042002) and any EVM chain
        network: ARC_NETWORK_ID,
        client: scheme,
      },
      {
        // Also support wildcard for flexibility
        network: "eip155:*",
        client: scheme,
      },
    ],
  });

  return { fetchWithPayment, account, walletClient };
}

/**
 * Attempts to pay for and fetch a resource protected by x402.
 * Runs budget checks before paying.
 */
export async function payAndFetch(
  url: string,
  privateKey: `0x${string}`,
  pageTitle: string
): Promise<PaymentResult> {
  // First, probe the URL to get payment requirements without paying
  let probeResponse: Response;
  try {
    probeResponse = await fetch(url, { method: "GET" });
  } catch (e) {
    return { success: false, amountUsdc: 0, url, error: `Network error: ${e}` };
  }

  // Not a 402 — no payment needed
  if (probeResponse.status !== 402) {
    const body = await probeResponse.text();
    return { success: true, amountUsdc: 0, url, responseBody: body };
  }

  // Parse payment requirements from 402 response
  const paymentRequiredHeader = probeResponse.headers.get("PAYMENT-REQUIRED");
  if (!paymentRequiredHeader) {
    return { success: false, amountUsdc: 0, url, error: "402 response missing PAYMENT-REQUIRED header" };
  }

  // Decode to extract the amount
  // x402 v2 header: base64(JSON) → { x402Version, accepts: [{network, amount, ...}] }
  // The field is "amount" in v2 (not "value" which was v1)
  let amountUsdc = 0;
  try {
    const decoded = JSON.parse(atob(paymentRequiredHeader));
    const accepts = decoded?.accepts ?? [];
    const arcOption = accepts.find(
      (a: { network: string; amount?: string }) =>
        a.network === ARC_NETWORK_ID || a.network === "eip155:5042002"
    ) ?? accepts[0];

    if (arcOption?.amount) {
      // amount is in USDC base units (6 decimals)
      amountUsdc = rawToUsdc(BigInt(arcOption.amount));
    }
  } catch {
    // Can't parse amount — continue with 0 (budget check will be lenient)
  }

  // Budget check
  const budgetError = await checkBudget(amountUsdc);
  if (budgetError) {
    return { success: false, amountUsdc, url, error: budgetError };
  }

  // Pay and retry
  const { fetchWithPayment } = createPayFetch(privateKey);

  try {
    const paidResponse = await fetchWithPayment(url);

    if (!paidResponse.ok) {
      return {
        success: false,
        amountUsdc,
        url,
        error: `Payment failed or rejected: HTTP ${paidResponse.status}`,
      };
    }

    // Extract payment details from response header
    const paymentResponseHeader = paidResponse.headers.get("PAYMENT-RESPONSE");
    let txHash: string | undefined;
    if (paymentResponseHeader) {
      try {
        const paymentDetails = decodePaymentResponseHeader(paymentResponseHeader);
        txHash = (paymentDetails as { txHash?: string }).txHash;
      } catch {
        // Non-critical — response header is optional
      }
    }

    const responseBody = await paidResponse.text();

    // Record spend and add to history
    await recordSpend(amountUsdc);
    await addPaymentRecord({
      url,
      title: pageTitle,
      amountUsdc,
      timestamp: Date.now(),
      txHash,
      domain: new URL(url).hostname,
    });

    return { success: true, amountUsdc, url, responseBody };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, amountUsdc, url, error: `Payment error: ${msg}` };
  }
}

/**
 * Check USDC balance on Arc Testnet for an address.
 */
export async function getUsdcBalance(address: `0x${string}`): Promise<number> {
  const publicClient = createPublicClient({
    transport: http("https://rpc.testnet.arc.network"),
    chain: arcTestnet,
  });

  // USDC ERC-20 balanceOf
  const balance = await publicClient.readContract({
    address: CONTRACTS.USDC,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const,
    functionName: "balanceOf",
    args: [address],
  });

  return rawToUsdc(balance);
}
