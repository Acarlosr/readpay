/**
 * ReadPay Demo Publisher Server — x402 v2 API
 *
 * Express server that exposes x402-protected endpoints for testing ReadPay.
 * Run with: npm run demo-server
 *
 * API verified against @x402/express@2.15.0 README and source.
 * Chain: Arc Testnet (eip155:5042002), USDC ERC-20 at 0x3600...
 */

import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { privateKeyToAccount } from "viem/accounts";
import * as url from "url";
import * as path from "path";
import process from "node:process";

process.loadEnvFile(path.resolve(url.fileURLToPath(import.meta.url), "../../.env"));

// ---- Config ----

const PORT = Number(process.env.DEMO_SERVER_PORT ?? 3001);
const PUBLISHER_ADDRESS = process.env.PUBLISHER_ADDRESS as `0x${string}` | undefined;
const PUBLISHER_PRIVATE_KEY = process.env.PUBLISHER_PRIVATE_KEY as `0x${string}` | undefined;

if (!PUBLISHER_ADDRESS || !PUBLISHER_PRIVATE_KEY) {
  console.error(`
❌ Missing PUBLISHER_ADDRESS or PUBLISHER_PRIVATE_KEY in .env

  Generate wallets with:
    node -e "
      const {generatePrivateKey, privateKeyToAccount} = require('viem/accounts');
      const k = generatePrivateKey();
      console.log('PUBLISHER_PRIVATE_KEY=' + k);
      console.log('PUBLISHER_ADDRESS=' + privateKeyToAccount(k).address);
    "

  Then get testnet USDC at: https://faucet.circle.com (select Arc Testnet)
`);
  process.exit(1);
}

const publisherAccount = privateKeyToAccount(PUBLISHER_PRIVATE_KEY);
console.log(`📨 Publisher: ${publisherAccount.address}`);

// Arc Testnet CAIP-2 identifier
const ARC_NETWORK = "eip155:5042002";
const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;

/** USDC has 6 decimals on Arc */
const usdc = (dollars: number) => ({
  amount: String(Math.round(dollars * 1_000_000)),
  asset: ARC_USDC,
});

// ---- x402 Server setup (v2 API) ----

const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ??
  "https://arc-testnet-x402-facilitator.onrender.com";

const facilitatorClient = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
});

const resourceServer = new x402ResourceServer(facilitatorClient).register(
  ARC_NETWORK,
  new ExactEvmScheme()
);

// ---- Express app ----

const app = express();
app.use(express.json());
app.use(express.text());

// CORS for local extension dev
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, PAYMENT-SIGNATURE, X-PAYMENT, PAYMENT-REQUIRED"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE"
  );
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// x402 middleware — protects all defined routes
app.use(
  paymentMiddleware(
    {
      "GET /api/article": {
        accepts: {
          scheme: "exact",
          price: usdc(0.01),
          network: ARC_NETWORK,
          payTo: publisherAccount.address,
        },
        description: "ReadPay demo article",
      },
      "GET /api/summary": {
        accepts: {
          scheme: "exact",
          price: usdc(0.001),
          network: ARC_NETWORK,
          payTo: publisherAccount.address,
        },
        description: "Article summary (sub-cent tier)",
      },
      "GET /api/premium": {
        accepts: {
          scheme: "exact",
          price: usdc(0.05),
          network: ARC_NETWORK,
          payTo: publisherAccount.address,
        },
        description: "Premium in-depth analysis",
      },
    },
    resourceServer
  )
);

// ---- Protected endpoints ----

app.get("/api/article", (_req, res) => {
  res.json({
    id: 1,
    title: "The End of Subscriptions: How Nanopayments Change Everything",
    author: "ReadPay Demo",
    content: `
# The End of Subscriptions

For decades, the web has been trapped in a binary choice: give it away for free,
or lock it behind a monthly paywall. Both models are broken.

**Free** means ad-supported. Attention is the currency.
**Subscription** means bundling. You pay for 100 articles to read 3.

The problem was infrastructure. Payments below ~$1.50 were economically impossible.

## Nanopayments flip the math

On Arc Testnet with Circle Gateway, per-payment overhead drops to **zero**.
Batched settlement makes $0.001 articles economically viable.

You just paid **$0.01** to read this. No account. No subscription.

---
*Unlocked via x402 · Arc Testnet (5042002) · Circle Gateway nanopayments*
    `.trim(),
    paid: true,
    network: ARC_NETWORK,
  });
});

app.get("/api/summary", (_req, res) => {
  res.json({
    summary:
      "Nanopayments on Arc enable sub-cent transactions with Circle Gateway batched settlement. ReadPay is the reader-side wallet for this new model.",
    paid: true,
    cost: "$0.001",
  });
});

app.get("/api/premium", (_req, res) => {
  res.json({
    title: "Deep Dive: Arc's Stablecoin-Native Architecture",
    content:
      "Arc (chainId 5042002) uses USDC as native gas. GatewayWallet (0x0077...) aggregates EIP-3009 authorizations and settles in batch — making each nanopayment effectively free per-transaction.",
    paid: true,
    cost: "$0.05",
  });
});

// ---- Health check (free) ----

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    publisher: publisherAccount.address,
    network: ARC_NETWORK,
    chainId: 5042002,
    rpc: "https://rpc.testnet.arc.network",
    usdc: "0x3600000000000000000000000000000000000000",
    gateway: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
    endpoints: ["/api/article ($0.01)", "/api/summary ($0.001)", "/api/premium ($0.05)"],
    faucet: "https://faucet.circle.com",
    explorer: "https://testnet.arcscan.app",
  });
});

// ---- Start ----

app.listen(PORT, () => {
  console.log(`\n🚀 ReadPay Demo Publisher at http://localhost:${PORT}`);
  console.log(`\nEndpoints protegidos (x402 · Arc Testnet):`);
  console.log(`  GET /api/article    $0.01  — artigo completo`);
  console.log(`  GET /api/summary    $0.001 — resumo sub-cent`);
  console.log(`  GET /api/premium    $0.05  — análise premium`);
  console.log(`  GET /health         free   — status`);
  console.log(`\n💧 Faucet: https://faucet.circle.com`);
  console.log(`🔭 Explorer: https://testnet.arcscan.app/address/${publisherAccount.address}`);
  console.log(`\n📌 Teste com curl:`);
  console.log(`   curl http://localhost:${PORT}/health`);
  console.log(`   curl http://localhost:${PORT}/api/article  # retorna 402`);
});
