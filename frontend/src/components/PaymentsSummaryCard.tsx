import type { PaymentsSummary } from '../api/types';
import { formatIdr } from '../format';

export function PaymentsSummaryCard({
  summary,
}: { summary: PaymentsSummary | null }) {
  if (!summary) {
    return null;
  }

  return (
    <div className="card">
      <h2>Payments</h2>
      <p className="total-payout">
        Total payout: <strong>{formatIdr(summary.total_payout)}</strong>
      </p>
      <div className="summary-grid">
        <div>
          <h3>Reporters</h3>
          <ul className="worker-list">
            {summary.reporters.map((reporter) => (
              <li key={reporter.reporter_id}>
                <span>{reporter.name}</span>
                <span className="balance">
                  {formatIdr(reporter.current_balance)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Editors</h3>
          <ul className="worker-list">
            {summary.editors.map((editor) => (
              <li key={editor.editor_id}>
                <span>{editor.name}</span>
                <span className="balance">
                  {formatIdr(editor.current_balance)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
