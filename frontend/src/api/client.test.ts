import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './client';

// Stub the global fetch with a minimal Response-like object — the client only
// reads .ok, .status, and .text(). This covers the error-envelope decoding that
// every UI failure message depends on.
function stubFetch(status: number, body?: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client request', () => {
  it('returns the parsed body on a 2xx response', async () => {
    stubFetch(200, [{ job_id: 'J1' }]);
    await expect(api.listJobs()).resolves.toEqual([{ job_id: 'J1' }]);
  });

  it('throws ApiError carrying status and the envelope string message', async () => {
    stubFetch(409, { message: 'Job is NEW, expected REVIEWED' });
    await expect(api.completeJob('J1')).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 409,
      message: 'Job is NEW, expected REVIEWED',
    });
  });

  it('joins an array message with commas', async () => {
    stubFetch(400, { message: ['name must not be empty', 'city is required'] });
    await expect(
      api.createReporter({ name: '', city: '' }),
    ).rejects.toMatchObject({
      message: 'name must not be empty, city is required',
    });
  });

  it('falls back to a generic message when the envelope has none', async () => {
    stubFetch(500, {});
    const error = await api.getPaymentsSummary().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Request failed (500)');
  });
});

describe('api client Content-Type handling', () => {
  // Returns the Headers passed to fetch for the most recent call.
  function lastHeaders(fetchMock: ReturnType<typeof vi.fn>): Headers {
    const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    return new Headers(init.headers);
  }

  it('omits Content-Type on a bodyless POST so Fastify accepts it', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{}',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await api.assignReporter('J1');

    expect(lastHeaders(fetchMock).has('Content-Type')).toBe(false);
  });

  it('sets Content-Type: application/json when a payload is sent', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '{}',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await api.createJob({
      case_name: 'C',
      duration_minutes: 1,
      location_type: 'REMOTE',
    } as Parameters<typeof api.createJob>[0]);

    expect(lastHeaders(fetchMock).get('Content-Type')).toBe('application/json');
  });
});
