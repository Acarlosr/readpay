/**
 * ReadPay Content Script
 *
 * Strategy (Karpathy: "inspect, don't guess"):
 * The cleanest way to detect x402 in a browser extension is to
 * monkey-patch window.fetch so we intercept 402 responses BEFORE
 * the page's own error handler sees them.
 *
 * Flow:
 * 1. Patch window.fetch
 * 2. On 402 response: send PAY message to service worker
 * 3. Service worker pays and returns the response body
 * 4. Return the unlocked body to the original caller
 * 5. Show "Paid $X.XX" badge
 */

import type { PaymentResult } from "../payment/client";

const log = (...args: unknown[]) => console.log("[ReadPay]", ...args);

// ---- Monkey-patch window.fetch ----

const originalFetch = window.fetch.bind(window);

window.fetch = async function readpayFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await originalFetch(input, init);

  // Only intercept 402 responses
  if (response.status !== 402) return response;

  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;

  log(`Detected 402 on ${url} — requesting payment...`);

  // Check if this looks like an x402 endpoint
  const paymentRequired = response.headers.get("PAYMENT-REQUIRED");
  if (!paymentRequired) {
    // Standard 402 (not x402) — pass through
    return response;
  }

  // Get page title for history records
  const pageTitle = document.title || url;

  // Send to service worker for payment
  let paymentResult: PaymentResult;
  try {
    paymentResult = await chrome.runtime.sendMessage({
      type: "PAY",
      url,
      pageTitle,
    });
  } catch (e) {
    log("Could not reach service worker:", e);
    return response; // Fall back to original 402
  }

  if (!paymentResult?.success) {
    log("Payment failed:", paymentResult?.error);
    // Show error badge
    showBadge({ type: "error", message: paymentResult?.error ?? "Payment failed" });
    return response; // Return original 402
  }

  // Payment succeeded — show badge and return fake 200 response
  log(`Paid $${paymentResult.amountUsdc.toFixed(6)} for ${url}`);
  showBadge({ type: "paid", amount: paymentResult.amountUsdc });

  // Construct a synthetic 200 response from the unlocked body
  return new Response(paymentResult.responseBody ?? "", {
    status: 200,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "text/html" },
  });
};

// ---- Also observe DOM for paywall elements ----
// Some sites use JS to render a paywall overlay after initial load.
// We detect common patterns and try to pay for the underlying content URL.

function detectPaywallOverlay(): boolean {
  // Common paywall indicators
  const indicators = [
    '[class*="paywall"]',
    '[class*="premium-wall"]',
    '[id*="paywall"]',
    '[data-paywall]',
    '[class*="subscription-wall"]',
  ];
  return indicators.some((sel) => document.querySelector(sel) !== null);
}

// ---- Badge UI ----

interface BadgeOptions {
  type: "paid" | "error";
  amount?: number;
  message?: string;
}

let badgeEl: HTMLElement | null = null;

function showBadge(opts: BadgeOptions) {
  // Remove existing badge
  badgeEl?.remove();

  const badge = document.createElement("div");
  badge.id = "readpay-badge";

  const isPaid = opts.type === "paid";
  const text = isPaid
    ? `ReadPay ✓ Paid $${(opts.amount ?? 0).toFixed(opts.amount && opts.amount < 0.01 ? 6 : 4)}`
    : `ReadPay ✗ ${opts.message ?? "Error"}`;

  Object.assign(badge.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: "2147483647",
    padding: "8px 14px",
    borderRadius: "20px",
    fontSize: "13px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontWeight: "500",
    color: "#fff",
    background: isPaid ? "#22c55e" : "#ef4444",
    boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    transition: "opacity 0.3s ease",
    cursor: "default",
    userSelect: "none",
    pointerEvents: "none",
  });

  badge.textContent = text;
  document.body?.appendChild(badge);
  badgeEl = badge;

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    badge.style.opacity = "0";
    setTimeout(() => badge.remove(), 400);
  }, 4000);
}

log("Content script loaded.");
