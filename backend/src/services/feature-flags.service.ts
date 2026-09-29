import { createHash } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { cached, invalidate } from '../db/redis.js';

interface FlagRecord {
  key: string;
  enabled: boolean;
  rollout: number | null;
  config: unknown;
  allowedRoles: string[];
}

export class FeatureFlagsService {
  static async isEnabled(
    key: string,
    userId: string | null,
    role: string | null,
  ): Promise<boolean> {
    const flags = await this.getAll();
    const flag = flags[key];
    if (!flag) return false;

    // Один раз собираем объект-«оценщик»
    return this.evaluate(flag, userId, role);
  }

  static async getForUser(
    userId: string | null,
    role: string | null,
  ): Promise<Record<string, { enabled: boolean; config: unknown }>> {
    const flags = await this.getAll();
    const result: Record<string, { enabled: boolean; config: unknown }> = {};
    for (const [key, flag] of Object.entries(flags)) {
      result[key] = { enabled: this.evaluate(flag, userId, role), config: flag.config };
    }
    return result;
  }

  /** Чистая функция оценки — не делает I/O */
  private static evaluate(
    flag: FlagRecord,
    userId: string | null,
    role: string | null,
  ): boolean {
    if (flag.allowedRoles.length > 0) {
      if (!role || !flag.allowedRoles.includes(role)) return false;
    }

    if (!flag.enabled) return false;

    if (flag.rollout !== null) {
      // rollout без userId → используем "anonymous" стабильно
      const seed = userId ?? 'anonymous';
      const hash = createHash('md5').update(`${flag.key}:${seed}`).digest('hex');
      const bucket = parseInt(hash.slice(0, 8), 16) % 100;
      return bucket < flag.rollout;
    }

    return true;
  }

  static async getAll(): Promise<Record<string, FlagRecord>> {
    return cached(
      'feature-flags:all',
      async () => {
        const list = await prisma.featureFlag.findMany();
        return Object.fromEntries(
          list.map((f) => [
            f.key,
            {
              key: f.key,
              enabled: f.enabled,
              rollout: f.rollout,
              config: f.config,
              allowedRoles: f.allowedRoles,
            } satisfies FlagRecord,
          ]),
        );
      },
      60,
    );
  }

  static async invalidate(): Promise<void> {
    await invalidate('feature-flags:*');
  }
}