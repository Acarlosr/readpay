/**
 * Payment history — persisted in chrome.storage.local.
 * Keeps the last 100 entries.
 */

export interface PaymentRecord {
  id: string;
  url: string;
  title: string;
  amountUsdc: number;
  timestamp: number;     // Unix ms
  txHash?: string;       // settlement tx if available
  domain: string;
}

const HISTORY_KEY = "readpay_history";
const MAX_ENTRIES = 100;

export async function addPaymentRecord(
  record: Omit<PaymentRecord, "id">
): Promise<PaymentRecord> {
  const history = await getHistory();
  const newRecord: PaymentRecord = {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const updated = [newRecord, ...history].slice(0, MAX_ENTRIES);
  await chrome.storage.local.set({ [HISTORY_KEY]: updated });
  return newRecord;
}

export async function getHistory(): Promise<PaymentRecord[]> {
  const result = await chrome.storage.local.get([HISTORY_KEY]);
  return result[HISTORY_KEY] ?? [];
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove([HISTORY_KEY]);
}

export async function getTodayStats(): Promise<{ count: number; totalUsdc: number }> {
  const history = await getHistory();
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = history.filter((r) => {
    return new Date(r.timestamp).toISOString().slice(0, 10) === today;
  });
  return {
    count: todayRecords.length,
    totalUsdc: todayRecords.reduce((sum, r) => sum + r.amountUsdc, 0),
  };
}
