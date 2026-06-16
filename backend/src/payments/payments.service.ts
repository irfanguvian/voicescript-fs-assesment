import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Overall payout plus a per-worker breakdown: current balance and the
  // append-only ledger rows that produced it. Total is the sum of every
  // worker's current balance (equivalently, the sum of all ledger amounts).
  async summary() {
    const [reporters, editors, ledger] = await Promise.all([
      this.prisma.reporter.findMany({
        where: { deleted_at: null },
        include: { balance: true },
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.editor.findMany({
        where: { deleted_at: null },
        include: { balance: true },
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.balanceLedger.findMany({ orderBy: { created_at: 'asc' } }),
    ]);

    const rowsFor = (payeeId: string) =>
      ledger
        .filter((row) => row.payee_id === payeeId)
        .map((row) => ({
          ledger_id: row.ledger_id,
          job_id: row.job_id,
          amount: row.amount,
          before_balance: row.before_balance,
          description: row.description,
          created_at: row.created_at,
        }));

    const reporterSummaries = reporters.map((reporter) => ({
      reporter_id: reporter.reporter_id,
      name: reporter.name,
      current_balance: reporter.balance?.current_balance ?? 0,
      jobs: rowsFor(reporter.reporter_id),
    }));
    const editorSummaries = editors.map((editor) => ({
      editor_id: editor.editor_id,
      name: editor.name,
      current_balance: editor.balance?.current_balance ?? 0,
      jobs: rowsFor(editor.editor_id),
    }));

    const total_payout = [...reporterSummaries, ...editorSummaries].reduce(
      (sum, payee) => sum + payee.current_balance,
      0,
    );

    return {
      total_payout,
      reporters: reporterSummaries,
      editors: editorSummaries,
    };
  }
}
