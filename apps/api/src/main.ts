import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CORRELATION_ID_HEADER, readCorrelationId } from './common/correlation-id';
import { validationExceptionFactory } from './common/validation-exception-factory';
import { MAX_IMPORT_FILE_SIZE_BYTES } from './modules/portfolio/imports/imports.constants';
import type { Env } from './common/config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  const config = app.get(ConfigService<Env, true>);

  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES, files: 1 },
  });

  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      const correlationId =
        readCorrelationId(request.headers[CORRELATION_ID_HEADER]) ?? randomUUID();
      request.headers[CORRELATION_ID_HEADER] = correlationId;
      reply.header(CORRELATION_ID_HEADER, correlationId);
      done();
    });

  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
    // @fastify/cors defaults to GET,HEAD,POST only — every PATCH/DELETE
    // route (tenant settings, member/role updates, revoking an invitation)
    // would otherwise fail CORS preflight from a browser while working fine
    // from curl, which never enforces CORS at all. Caught by live browser
    // QA, not by any automated test — see docs/DECISIONS.md.
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Reven API')
    .setDescription('Reven — Partnership Operations & Intelligence. Internal API reference.')
    .setVersion('0.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Reven API listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
