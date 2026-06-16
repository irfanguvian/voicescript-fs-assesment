import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyCors from '@fastify/cors';
// Side-effect import: augments FastifyReply with `sendFile` (used in the SPA
// fallback below). @nestjs/platform-fastify registers the plugin at runtime.
import '@fastify/static';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';

// Built frontend bundle, copied next to dist/ in the production image.
// __dirname is .../dist at runtime → ../public resolves to /app/public.
// Absent in local dev (frontend runs under Vite), so serving is opt-in.
const FRONTEND_DIR = join(__dirname, '..', 'public');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyCors, { origin: true });
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Serve the SPA from the same origin as the API (Option B: one service).
  if (existsSync(FRONTEND_DIR)) {
    app.useStaticAssets({ root: FRONTEND_DIR });

    // Client-side routing fallback: any non-/api, non-file path returns the
    // app shell. Unknown /api paths keep returning a JSON 404.
    app
      .getHttpAdapter()
      .getInstance()
      .setNotFoundHandler((request, reply) => {
        if (request.raw.url?.startsWith('/api')) {
          reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: `Cannot ${request.method} ${request.raw.url}`,
            path: request.raw.url,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        reply.type('text/html').sendFile('index.html');
      });
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });

  console.log(`Backend (Fastify) listening on :${port}`);
}

void bootstrap();
