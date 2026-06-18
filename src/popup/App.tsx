/**
 * ReadPay Popup — main React UI
 * Views: Setup → Unlock → Dashboard
 */

import { useState, useEffect, useCallback } from "react";
import type { BudgetConfig } from "../payment/budget";
import type { PaymentRecord } from "../payment/history";
import { formatUsdc } from "../lib/arc";

// ---- Types mirroring service worker responses ----

interface Status {
  hasWallet: boolean;
  address: string | null;
  isUnlocked: boolean;
  todayStats: { count: number; totalUsdc: number };
  config: BudgetConfig;
}

// ---- Message helpers ----

async function msg<T>(payload: object): Promise<T> {
  return chrome.runtime.sendMessage(payload);
}

// ---- Views ----

function SetupView({ onSetup }: { onSetup: () => void }) {
  const [privKey, setPrivKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSetup() {
    setError("");
    if (!privKey.startsWith("0x") || privKey.length !== 66) {
      setError("Invalid private key — must be 0x + 64 hex chars");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const result = await msg<{ success: boolean; error?: string }>({
        type: "SETUP_WALLET",
        privateKey: privKey,
        password,
      });
      if (result.success) {
        onSetup();
      } else {
        setError(result.error ?? "Setup failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">💸</span>
        <div>
          <h1 className="text-lg font-bold leading-none">ReadPay</h1>
          <p className="text-xs text-gray-400">Pay per article · Arc Testnet</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        Import a testnet wallet to pay for x402-protected articles with USDC.
        Get testnet USDC at{" "}
        <a
          href="https://faucet.circle.com"
          target="_blank"
          rel="noopener"
          className="text-blue-400 hover:underline"
        >
          faucet.circle.com
        </a>
        .
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Private key (0x...)</label>
          <input
            type="password"
            value={privKey}
            onChange={(e) => setPrivKey(e.target.value)}
            placeholder="0xabc123..."
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Encryption password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={handleSetup}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg py-2.5 text-sm font-semibold transition-colors"
      >
        {loading ? "Setting up..." : "Set up wallet"}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Key encrypted with AES-256 · never leaves your device
      </p>
    </div>
  );
}

function UnlockView({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUnlock() {
    setError("");
    setLoading(true);
    try {
      const result = await msg<{ success: boolean; error?: string }>({
        type: "UNLOCK_WALLET",
        password,
      });
      if (result.success) {
        onUnlock();
      } else {
        setError(result.error ?? "Wrong password");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">🔒</span>
        <div>
          <h1 className="text-lg font-bold leading-none">ReadPay</h1>
          <p className="text-xs text-gray-400">Unlock to pay articles</p>
        </div>
      </div>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
        placeholder="Your encryption password"
        autoFocus
        className="w-full bg-gray-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
      />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={handleUnlock}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg py-2.5 text-sm font-semibold transition-colors"
      >
        {loading ? "Unlocking..." : "Unlock"}
      </button>
    </div>
  );
}

function Dashboard({
  status,
  onRefresh,
}: {
  status: Status;
  onRefresh: () => void;
}) {
  const [history, setHistory] = useState<PaymentRecord[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [view, setView] = useState<"home" | "settings">("home");
  const [config, setConfig] = useState<BudgetConfig>(status.config);

  useEffect(() => {
    msg<{ history: PaymentRecord[] }>({ type: "GET_HISTORY" }).then((r) =>
      setHistory(r.history)
    );
    msg<{ balance: number | null }>({ type: "GET_BALANCE" }).then((r) =>
      setBalance(r.balance)
    );
  }, []);

  async function saveConfig() {
    await msg({ type: "SET_CONFIG", config });
    onRefresh();
  }

  const { todayStats } = status;

  if (view === "settings") {
    return (
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Settings</h2>
          <button onClick={() => setView("home")} className="text-gray-400 hover:text-white text-sm">
            ← Back
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Daily limit (USDC)</label>
            <input
              type="number"
              value={config.dailyLimitUsdc}
              onChange={(e) => setConfig({ ...config, dailyLimitUsdc: Number(e.target.value) })}
              step="0.1"
              min="0.01"
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Max per article (USDC)</label>
            <input
              type="number"
              value={config.perArticleMaxUsdc}
              onChange={(e) => setConfig({ ...config, perArticleMaxUsdc: Number(e.target.value) })}
              step="0.01"
              min="0.001"
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
            <span className="text-sm">Auto-pay</span>
            <button
              onClick={() => setConfig({ ...config, autoPay: !config.autoPay })}
              className={`w-10 h-5 rounded-full transition-colors ${config.autoPay ? "bg-blue-600" : "bg-gray-600"}`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full mx-0.5 transition-transform ${config.autoPay ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </div>
        </div>

        <button
          onClick={saveConfig}
          className="bg-blue-600 hover:bg-blue-700 rounded-lg py-2 text-sm font-semibold transition-colors"
        >
          Save
        </button>

        <button
          onClick={async () => {
            if (confirm("Remove wallet from this device?")) {
              await msg({ type: "CLEAR_WALLET" });
              onRefresh();
            }
          }}
          className="text-red-400 hover:text-red-300 text-xs text-center"
        >
          Remove wallet
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">💸</span>
            <span className="font-bold">ReadPay</span>
          </div>
          <button
            onClick={() => setView("settings")}
            className="text-gray-400 hover:text-white text-lg leading-none"
          >
            ⚙️
          </button>
        </div>

        {/* Balance + stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="Wallet USDC"
            value={balance !== null ? formatUsdc(balance) : "—"}
            accent={balance !== null && balance < 0.5}
          />
          <Stat
            label="Today spent"
            value={formatUsdc(todayStats.totalUsdc)}
          />
          <Stat
            label="Articles today"
            value={String(todayStats.count)}
          />
        </div>
      </div>

      {/* Address */}
      {status.address && (
        <div className="px-4 py-2 border-b border-gray-800">
          <p className="text-xs text-gray-500 font-mono truncate">
            {status.address}
          </p>
          <a
            href={`https://testnet.arcscan.app/address/${status.address}`}
            target="_blank"
            rel="noopener"
            className="text-xs text-blue-400 hover:underline"
          >
            View on ArcScan →
          </a>
        </div>
      )}

      {/* History */}
      <div className="flex-1 overflow-y-auto">
        <p className="text-xs text-gray-500 px-4 py-2 uppercase tracking-wide">
          Payment history
        </p>
        {history.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-600 text-sm">
            <p className="text-3xl mb-2">📖</p>
            No articles paid yet.
            <br />
            Browse a site with x402 support.
          </div>
        ) : (
          <ul className="divide-y divide-gray-800/60">
            {history.map((record) => (
              <li key={record.id} className="px-4 py-2.5 hover:bg-gray-900/40">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm truncate">{record.title || record.domain}</p>
                    <p className="text-xs text-gray-500 truncate">{record.domain}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono text-green-400">
                      {formatUsdc(record.amountUsdc)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(record.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-800 text-center">
        <p className="text-xs text-gray-600">
          Arc Testnet · USDC · x402 v2
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-gray-900 rounded-lg px-2 py-2 text-center">
      <p className={`text-sm font-bold font-mono ${accent ? "text-yellow-400" : "text-white"}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 leading-none mt-0.5">{label}</p>
    </div>
  );
}

// ---- Types for history ----
interface PaymentRecord {
  id: string;
  url: string;
  title: string;
  amountUsdc: number;
  timestamp: number;
  txHash?: string;
  domain: string;
}

// ---- Root App ----

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await msg<Status>({ type: "GET_STATUS" });
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading || !status) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        Loading...
      </div>
    );
  }

  if (!status.hasWallet) {
    return <SetupView onSetup={refresh} />;
  }

  if (!status.isUnlocked) {
    return <UnlockView onUnlock={refresh} />;
  }

  return <Dashboard status={status} onRefresh={refresh} />;
}
