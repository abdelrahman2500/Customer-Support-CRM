import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import type { EnvConfig } from "../config/env.validation";
import { JwtStrategy } from "./jwt.strategy";

/**
 * Cross-cutting auth infrastructure: the Passport module, a `JwtService`
 * configured for **access** tokens (signing them is the only thing
 * `IdentityModule` needs from here — refresh tokens are signed with a
 * separate secret/TTL directly in `IdentityService`, since `@nestjs/jwt`'s
 * module-level config only holds one secret at a time).
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true }),
        signOptions: { expiresIn: config.get("JWT_ACCESS_TTL", { infer: true }) },
      }),
    }),
  ],
  providers: [JwtStrategy],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
