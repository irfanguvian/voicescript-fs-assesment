import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

// App loads dashboard data on mount; stub fetch so the smoke test stays offline
// and the state update is awaited (no act() warnings). List endpoints return an
// empty array; the payments summary returns its object shape.
function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const body = url.endsWith('/payments/summary')
        ? { total_payout: 0, reporters: [], editors: [] }
        : [];
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App (smoke)', () => {
  it('renders the dashboard heading', async () => {
    stubFetch();
    render(<App />);
    expect(
      await screen.findByRole('heading', {
        name: /court reporting workflow manager/i,
      }),
    ).toBeInTheDocument();
  });
});
