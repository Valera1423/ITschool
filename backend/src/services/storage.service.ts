import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

interface UploadInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  sizeBytes?: number;
}

export class StorageService {
  private static client: S3Client | null = null;

  private static getClient(): S3Client {
    if (!this.client) {
      const protocol = env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
      this.client = new S3Client({
        endpoint: `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
        region: 'us-east-1',
        credentials: {
          accessKeyId: env.MINIO_ACCESS_KEY,
          secretAccessKey: env.MINIO_SECRET_KEY ?? '',
        },
        forcePathStyle: true,
      });
    }
    return this.client;
  }

  static bucket(): string {
    return env.MINIO_BUCKET;
  }

  static publicUrl(key: string): string {
    const base = env.MINIO_PUBLIC_URL.replace(/\/$/, '');
    return `${base}/${key}`;
  }

  static async upload(input: UploadInput): Promise<{ key: string; url: string }> {
    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket(),
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType ?? 'application/octet-stream',
        ...(typeof input.sizeBytes === 'number' ? { ContentLength: input.sizeBytes } : {}),
      }),
    );
    logger.info({ key: input.key, size: input.sizeBytes }, 'Файл загружен в MinIO');
    return { key: input.key, url: this.publicUrl(input.key) };
  }

  static async delete(key: string): Promise<void> {
    try {
      const client = this.getClient();
      await client.send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }));
    } catch (e) {
      logger.warn({ err: e, key }, 'Не удалось удалить файл из MinIO');
    }
  }

  static async exists(key: string): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.send(new HeadObjectCommand({ Bucket: this.bucket(), Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  static async signedUrl(key: string, expiresIn = 3600): Promise<string> {
    const client = this.getClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket(), Key: key }),
      { expiresIn },
    );
  }

  /**
   * Удалить все объекты по префиксу — с пагинацией через ContinuationToken.
   * Возвращает количество удалённых.
   */
  static async deleteFolder(prefix: string): Promise<number> {
    const client = this.getClient();
    let removed = 0;
    let continuationToken: string | undefined = undefined;

    try {
      do {
        const list = await client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket(),
            Prefix: prefix,
            ContinuationToken: continuationToken,
            MaxKeys: 1000,
          }),
        );

        if (list.Contents && list.Contents.length > 0) {
          // Параллельно, но небольшими партиями
          const CHUNK = 20;
          for (let i = 0; i < list.Contents.length; i += CHUNK) {
            const chunk = list.Contents.slice(i, i + CHUNK);
            await Promise.all(
              chunk
                .filter((o) => o.Key)
                .map((o) =>
                  client
                    .send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: o.Key! }))
                    .then(() => { removed++; })
                    .catch((e) => logger.warn({ err: e, key: o.Key }, 'delete failed')),
                ),
            );
          }
        }

        continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
      } while (continuationToken);
    } catch (e) {
      logger.warn({ err: e, prefix }, 'Ошибка удаления папки');
    }

    return removed;
  }
}