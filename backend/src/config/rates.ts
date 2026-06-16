// Payment rates, sourced from env with the plan defaults. Read at call time so
// tests can override process.env per case without a config-module dependency.
export interface PaymentRates {
  reporterRatePerMinute: number;
  editorFlatFee: number;
}

// Parse an env rate, falling back to the default on missing or non-numeric
// input so a typo'd env var can never write NaN into a payout.
function rate(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getRates(): PaymentRates {
  return {
    reporterRatePerMinute: rate(process.env.REPORTER_RATE_PER_MINUTE, 2000),
    editorFlatFee: rate(process.env.EDITOR_FLAT_FEE, 50000),
  };
}
