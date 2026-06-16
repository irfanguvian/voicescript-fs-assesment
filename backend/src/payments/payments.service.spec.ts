import { describe, expect, it } from 'vitest';
import { PaymentsService } from './payments.service';

// Unit layer (Testing Trophy): the payout summary is a pure transform over
// Prisma reads, so we inject a hand-rolled mock client and assert the grouping
// and total math without a database.
function serviceWith(data: {
  reporters: unknown[];
  editors: unknown[];
  ledger: unknown[];
}) {
  const prisma = {
    reporter: { findMany: async () => data.reporters },
    editor: { findMany: async () => data.editors },
    balanceLedger: { findMany: async () => data.ledger },
  };
  // biome-ignore lint/suspicious/noExplicitAny: minimal mock, only the methods summary() touches
  return new PaymentsService(prisma as any);
}

describe('PaymentsService.summary', () => {
  it('totals balances, groups ledger by payee, and defaults a missing balance to 0', async () => {
    const service = serviceWith({
      reporters: [
        { reporter_id: 'R1', name: 'Rep One', balance: { current_balance: 6000 } },
        { reporter_id: 'R2', name: 'Rep Two', balance: null },
      ],
      editors: [
        { editor_id: 'E1', name: 'Ed One', balance: { current_balance: 50000 } },
      ],
      ledger: [
        {
          ledger_id: 'L1',
          job_id: 'J1',
          payee_id: 'R1',
          amount: 6000,
          before_balance: 0,
          description: 'Reporter payout',
          created_at: new Date('2026-01-01'),
        },
        {
          ledger_id: 'L2',
          job_id: 'J1',
          payee_id: 'E1',
          amount: 50000,
          before_balance: 0,
          description: 'Editor payout',
          created_at: new Date('2026-01-01'),
        },
      ],
    });

    const result = await service.summary();

    // 6000 (R1) + 0 (R2, no balance row) + 50000 (E1)
    expect(result.total_payout).toBe(56000);
    expect(result.reporters[1].current_balance).toBe(0);

    // R1 owns L1, R2 owns nothing, E1 owns L2.
    expect(result.reporters[0].jobs).toHaveLength(1);
    expect(result.reporters[0].jobs[0].ledger_id).toBe('L1');
    expect(result.reporters[1].jobs).toHaveLength(0);
    expect(result.editors[0].jobs[0].ledger_id).toBe('L2');
  });
});
