/**
 * Budget guard — enforces daily and per-article spending limits.
 * All state persisted in chrome.storage.local.
 */

export interface BudgetConfig {
  dailyLimitUsdc: number;      // e.g. 2.00
  perArticleMaxUsdc: number;   // e.g. 0.10
  autoPay: boolean;            // true = no confirmation prompt
}

const BUDGET_CONFIG_KEY = "readpay_budget_config";
const DAILY_SPENT_KEY = "readpay_daily_spent";
const DAILY_DATE_KEY = "readpay_daily_date";

const DEFAULT_CONFIG: BudgetConfig = {
  dailyLimitUsdc: 2.0,
  perArticleMaxUsdc: 0.10,
  autoPay: true,
};

export async function getBudgetConfig(): Promise<BudgetConfig> {
  const result = await chrome.storage.local.get([BUDGET_CONFIG_KEY]);
  return { ...DEFAULT_CONFIG, ...(result[BUDGET_CONFIG_KEY] ?? {}) };
}

export async function saveBudgetConfig(config: Partial<BudgetConfig>): Promise<void> {
  const current = await getBudgetConfig();
  await chrome.storage.local.set({ [BUDGET_CONFIG_KEY]: { ...current, ...config } });
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10); // "2026-06-18"
}

export async function getDailySpent(): Promise<number> {
  const result = await chrome.storage.local.get([DAILY_SPENT_KEY, DAILY_DATE_KEY]);
  const storedDate = result[DAILY_DATE_KEY];
  // Reset if it's a new day
  if (storedDate !== todayDateString()) {
    await chrome.storage.local.set({
      [DAILY_SPENT_KEY]: 0,
      [DAILY_DATE_KEY]: todayDateString(),
    });
    return 0;
  }
  return result[DAILY_SPENT_KEY] ?? 0;
}

export async function recordSpend(amountUsdc: number): Promise<void> {
  const current = await getDailySpent();
  await chrome.storage.local.set({
    [DAILY_SPENT_KEY]: current + amountUsdc,
    [DAILY_DATE_KEY]: todayDateString(),
  });
}

/**
 * Returns null if payment is allowed, or an error message if blocked.
 */
export async function checkBudget(amountUsdc: number): Promise<string | null> {
  const config = await getBudgetConfig();
  const dailySpent = await getDailySpent();

  if (amountUsdc > config.perArticleMaxUsdc) {
    return `Article costs $${amountUsdc.toFixed(6)} which exceeds your per-article limit of $${config.perArticleMaxUsdc.toFixed(2)}.`;
  }

  if (dailySpent + amountUsdc > config.dailyLimitUsdc) {
    return `Daily limit of $${config.dailyLimitUsdc.toFixed(2)} reached ($${dailySpent.toFixed(4)} spent today).`;
  }

  return null;
}
