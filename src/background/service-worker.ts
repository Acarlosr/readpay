/**
 * ReadPay Service Worker (Manifest V3 background script)
 *
 * Responsibilities:
 * 1. Receives PAY requests from content scripts
 * 2. Loads the encrypted private key from storage
 * 3. Calls payAndFetch to handle x402 payment
 * 4. Returns result to content script
 * 5. Handles popup state queries
 *
 * Karpathy note: Service Workers in MV3 are ephemeral — they spin up
 * per-message and may be killed between calls. Don't store state in
 * module-level variables; always read from chrome.storage.
 */

import { payAndFetch, getUsdcBalance } from "../payment/client";
import { getTodayStats, getHistory } from "../payment/history";
import { getBudgetConfig, saveBudgetConfig } from "../payment/budget";
import { loadPrivateKey, getStoredAddress, hasWallet, saveWallet, clearWallet } from "../lib/wallet";
import { privateKeyToAccount } from "viem/accounts";

export type MessageType =
  | { type: "PAY"; url: string; pageTitle: string }
  | { type: "GET_STATUS" }
  | { type: "GET_HISTORY" }
  | { type: "GET_CONFIG" }
  | { type: "SET_CONFIG"; config: Parameters<typeof saveBudgetConfig>[0] }
  | { type: "SETUP_WALLET"; privateKey: string; password: string }
  | { type: "UNLOCK_WALLET"; password: string }
  | { type: "CLEAR_WALLET" }
  | { type: "GET_BALANCE" };

// Session-scoped unlock cache — password is NOT persisted
// (cleared when service worker is killed, which is fine for security)
let sessionPassword: string | null = null;

chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => {
    sendResponse({ success: false, error: err?.message ?? String(err) });
  });
  return true; // Keep channel open for async response
});

async function handleMessage(message: MessageType): Promise<unknown> {
  switch (message.type) {
    case "PAY": {
      if (!sessionPassword) {
        return { success: false, error: "Wallet locked. Open ReadPay popup to unlock." };
      }

      const walletFound = await hasWallet();
      if (!walletFound) {
        return { success: false, error: "No wallet configured. Set up ReadPay first." };
      }

      let privateKey: `0x${string}`;
      try {
        privateKey = await loadPrivateKey(sessionPassword);
      } catch {
        sessionPassword = null;
        return { success: false, error: "Wrong password or wallet corrupted." };
      }

      const result = await payAndFetch(message.url, privateKey, message.pageTitle);
      return result;
    }

    case "GET_STATUS": {
      const [hasWalletResult, address, stats, config] = await Promise.all([
        hasWallet(),
        getStoredAddress(),
        getTodayStats(),
        getBudgetConfig(),
      ]);
      return {
        hasWallet: hasWalletResult,
        address,
        isUnlocked: sessionPassword !== null,
        todayStats: stats,
        config,
      };
    }

    case "GET_HISTORY": {
      return { history: await getHistory() };
    }

    case "GET_CONFIG": {
      return { config: await getBudgetConfig() };
    }

    case "SET_CONFIG": {
      await saveBudgetConfig(message.config);
      return { success: true };
    }

    case "SETUP_WALLET": {
      const account = privateKeyToAccount(message.privateKey as `0x${string}`);
      await saveWallet(message.privateKey as `0x${string}`, account.address, message.password);
      sessionPassword = message.password;
      return { success: true, address: account.address };
    }

    case "UNLOCK_WALLET": {
      const walletFound = await hasWallet();
      if (!walletFound) return { success: false, error: "No wallet found." };
      try {
        await loadPrivateKey(message.password); // Validates password
        sessionPassword = message.password;
        return { success: true };
      } catch {
        return { success: false, error: "Wrong password." };
      }
    }

    case "CLEAR_WALLET": {
      await clearWallet();
      sessionPassword = null;
      return { success: true };
    }

    case "GET_BALANCE": {
      if (!sessionPassword) return { balance: null, error: "Wallet locked." };
      try {
        const privateKey = await loadPrivateKey(sessionPassword);
        const account = privateKeyToAccount(privateKey);
        const balance = await getUsdcBalance(account.address);
        return { balance };
      } catch (e) {
        return { balance: null, error: String(e) };
      }
    }

    default:
      return { success: false, error: "Unknown message type." };
  }
}

// Keep service worker alive during payment operations (MV3 workaround)
// The listener registration itself is enough for Chrome to keep it alive
// for the duration of an async message handler.
console.log("[ReadPay] Service worker started.");
