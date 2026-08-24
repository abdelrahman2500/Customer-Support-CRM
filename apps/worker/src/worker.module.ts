import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { validateEnv, type EnvConfig } from "./env.validation";
import { HealthProcessor, HEALTH_CHECK_QUEUE } from "./queues/health.processor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        connection: { url: config.get("REDIS_URL", { infer: true }) },
      }),
    }),
    BullModule.registerQueue({ name: HEALTH_CHECK_QUEUE }),
  ],
  providers: [HealthProcessor],
})
export class WorkerModule {}
