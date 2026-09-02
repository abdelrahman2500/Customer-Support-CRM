import "./tracing";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import type { EnvConfig } from "./common/config/env.validation";
import { parseCorsOrigins } from "./common/config/cors-origins";
import { RedisIoAdapter } from "./realtime/redis-io.adapter";
import { PinoLoggerService } from "./common/logging/pino-logger.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  // Story 111 — docs/architecture/11-quality-and-operations.md: "Structured
  // JSON logs use pino." `bufferLogs: true` above holds Nest's own startup
  // log lines until this is wired, so they go through pino too rather than
  // the framework's default console logger.
  app.useLogger(app.get(PinoLoggerService));
  const config = app.get(ConfigService<EnvConfig, true>);

  // Story 23 — env-configured allowed origins for both the REST API (here)
  // and the Socket.IO gateway (`RedisIoAdapter`, same parsed list). Fails
  // closed: an unset `CORS_ORIGINS` allows nothing, unchanged from this
  // API's behavior before this story. `credentials: true` matches the
  // agent workspace's existing `credentials: "include"` login fetch, which
  // needs the refresh-token cookie.
  const corsOrigins = parseCorsOrigins(config.get("CORS_ORIGINS", { infer: true }));
  app.enableCors({ origin: corsOrigins, credentials: true });

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.use(cookieParser());
  app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready", "metrics"] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (config.get("NODE_ENV", { infer: true }) !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Customer Support CRM API")
      .setDescription(
        "Foundation surface (Story 02): identity/auth/tenant only. See docs/architecture/.",
      )
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  new Logger("Bootstrap").log(`apps/api listening on http://localhost:${port}`);
}

void bootstrap();
