import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { validateEnv } from "./common/config/env.validation";
import { AuthModule } from "./common/auth/auth.module";
import { AuthGuard } from "./common/auth/auth.guard";
import { AudienceGuard } from "./common/auth/audience.guard";
import { PermissionsGuard } from "./common/auth/permissions.guard";
import { AuditInterceptor } from "./common/audit/audit.interceptor";
import { TenantMiddleware } from "./common/tenant/tenant.middleware";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { QueuesModule } from "./queues/queues.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { AdminModule } from "./modules/admin/admin.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { SlaPoliciesModule } from "./modules/sla-policies/sla-policies.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { KnowledgeBaseModule } from "./modules/knowledge-base/knowledge-base.module";
import { PortalModule } from "./modules/portal/portal.module";
import { ReportingModule } from "./modules/reporting/reporting.module";
import { AttachmentsModule } from "./modules/attachments/attachments.module";
import { AiModule } from "./modules/ai/ai.module";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    EventEmitterModule.forRoot(),
    // Public-facing endpoints only (auth, portal, webhooks) sit behind this —
    // see docs/architecture/05-auth-and-security.md ("Rate limiting").
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    HealthModule,
    QueuesModule,
    IdentityModule,
    AdminModule,
    CustomersModule,
    TicketsModule,
    SlaPoliciesModule,
    NotificationsModule,
    KnowledgeBaseModule,
    PortalModule,
    ReportingModule,
    AttachmentsModule,
    AiModule,
    RealtimeModule,
  ],
  providers: [
    // Registration order matters: AuthGuard must resolve `request.user`
    // before AudienceGuard/PermissionsGuard read it. AudienceGuard (Story
    // 52) runs next — which surface a token may be used on is orthogonal to,
    // and checked before, which permissions its role grants.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AudienceGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes("*");
  }
}
