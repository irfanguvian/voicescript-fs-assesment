import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { buildHarness, resetDb } from './helpers/e2e';

// City must be one of the fixed operating cities (backend/src/config/cities.ts).
// One highest-return test per concern: an off-list city is rejected at the DTO
// boundary for both job and reporter create, while a listed city is accepted.
describe('city validation (integration, real Postgres)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await buildHarness());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  it('rejects a PHYSICAL job with an off-list city (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        case_name: 'Bad City Co',
        duration_minutes: 60,
        location_type: 'PHYSICAL',
        city: 'Atlantis',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts a PHYSICAL job with a listed city (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      payload: {
        case_name: 'Good City Co',
        duration_minutes: 60,
        location_type: 'PHYSICAL',
        city: 'Surabaya',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ city: 'Surabaya', status: 'NEW' });
  });

  it('rejects a reporter with an off-list city (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reporters',
      payload: { name: 'Nowhere Person', city: 'Gotham' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts a reporter with a listed city (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reporters',
      payload: { name: 'Local Person', city: 'Jakarta' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ city: 'Jakarta' });
  });
});
