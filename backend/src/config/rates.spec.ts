import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRates } from './rates';

// Thin unit layer (Testing Trophy base): pure payment-rate parsing. One test per
// behaviour — default, override, bad-input fallback — no redundant variants.
describe('getRates', () => {
  let saved: NodeJS.ProcessEnv;

  beforeEach(() => {
    saved = { ...process.env };
  });

  afterEach(() => {
    process.env = saved;
  });

  it('uses plan defaults when env is unset', () => {
    const {
      REPORTER_RATE_PER_MINUTE: _r,
      EDITOR_FLAT_FEE: _e,
      ...rest
    } = process.env;
    process.env = rest;
    expect(getRates()).toEqual({
      reporterRatePerMinute: 2000,
      editorFlatFee: 50000,
    });
  });

  it('honors numeric env overrides', () => {
    process.env.REPORTER_RATE_PER_MINUTE = '3000';
    process.env.EDITOR_FLAT_FEE = '75000';
    expect(getRates()).toEqual({
      reporterRatePerMinute: 3000,
      editorFlatFee: 75000,
    });
  });

  it('falls back to defaults on non-numeric or negative input (never NaN/negative)', () => {
    process.env.REPORTER_RATE_PER_MINUTE = 'oops';
    process.env.EDITOR_FLAT_FEE = '-5';
    expect(getRates()).toEqual({
      reporterRatePerMinute: 2000,
      editorFlatFee: 50000,
    });
  });
});
