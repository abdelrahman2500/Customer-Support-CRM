import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { EnvConfig } from "../../common/config/env.validation";

const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

/**
 * Story 66 — thin wrapper around the AWS SDK v3 S3 client, pointed at the
 * MinIO endpoint locally (`S3_ENDPOINT`) — the same S3 API works unchanged
 * against a real AWS S3/Azure Blob-S3-compatible endpoint in production,
 * per docs/architecture/01-technology-stack.md's own stated rationale for
 * choosing S3 ("keeps the hosting provider undecided until deployment
 * time"). `ensureBucketExists` runs once on module init — idempotent, so
 * safe in any freshly-provisioned environment, mirroring this codebase's
 * own "`prisma:seed` is safe and idempotent" precedent — rather than
 * relying on a manual one-time `mc mb` step every environment must
 * remember.
 */
@Injectable()
export class S3StorageService implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {
    this.bucket = this.configService.get("S3_BUCKET", { infer: true });
    this.client = new S3Client({
      endpoint: this.configService.get("S3_ENDPOINT", { infer: true }),
      region: "us-east-1", // MinIO ignores region; a fixed value keeps the SDK client happy.
      forcePathStyle: true, // required for MinIO/path-style S3-compatible endpoints.
      credentials: {
        accessKeyId: this.configService.get("S3_ACCESS_KEY", { infer: true }),
        secretAccessKey: this.configService.get("S3_SECRET_KEY", { infer: true }),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      this.logger.log(`Bucket "${this.bucket}" not found — creating it.`);
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async uploadObject(key: string, body: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: mimeType }),
    );
  }

  /** A short-lived (15-minute), single-object-scoped presigned GET URL —
   * never a long-lived or bucket-wide credential exposed to the browser
   * (plan Security risks/mitigations). */
  async getPresignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  }
}
