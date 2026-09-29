// backend/src/services/pii.service.ts
import crypto from 'node:crypto';
import { logger } from '../config/logger.js';

const VERSION = 'v1';
const IV_LEN = 12;
const TAG_LEN = 16;

export class PiiService {
  private static keyCache: Buffer | null = null;

  private static getKey(): Buffer | null {
    if (this.keyCache) return this.keyCache;

    const raw = process.env.PII_KEY;
    if (!raw || raw.length < 32) {
      logger.warn(
        '[PII] PII_KEY не задан или короче 32 символов — шифрование ПД выключено',
      );
      return null;
    }

    const derived = crypto.hkdfSync(
      'sha256',
      Buffer.from(raw, 'utf8'),
      Buffer.alloc(0),
      Buffer.from('crm:pii:v1', 'utf8'),
      32,
    );
    this.keyCache = Buffer.from(derived);
    return this.keyCache;
  }

  static isEnabled(): boolean {
    return this.getKey() !== null;
  }

  static encrypt(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const s = String(value);
    if (s.length === 0) return null;

    const key = this.getKey();
    if (!key) return s;

    try {
      const iv = crypto.randomBytes(IV_LEN);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(s, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();

      return [
        VERSION,
        iv.toString('base64'),
        tag.toString('base64'),
        enc.toString('base64'),
      ].join(':');
    } catch (e) {
      logger.error({ err: e }, '[PII] encrypt failed — сохраняем в открытом виде');
      return s;
    }
  }

  static decrypt(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const s = String(value);
    if (s.length === 0) return null;
    if (!s.startsWith(`${VERSION}:`)) return s;

    const key = this.getKey();
    if (!key) return s;

    try {
      const parts = s.split(':');
      if (parts.length !== 4) return s;
      const [, ivB64, tagB64, cipherB64] = parts;
      const iv = Buffer.from(ivB64, 'base64');
      const tag = Buffer.from(tagB64, 'base64');
      const ciphertext = Buffer.from(cipherB64, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return dec.toString('utf8');
    } catch (e) {
      logger.warn({ err: e }, '[PII] decrypt failed — возвращаем шифротекст');
      return s;
    }
  }

  static encryptFields<T extends Record<string, unknown>>(
    obj: T,
    fields: (keyof T)[],
  ): T {
    const out = { ...obj };
    for (const f of fields) {
      const v = out[f];
      if (typeof v === 'string' || v === null || v === undefined) {
        (out as Record<string, unknown>)[f as string] = this.encrypt(
          v as string | null | undefined,
        );
      }
    }
    return out;
  }

  static decryptFields<T extends Record<string, unknown>>(
    obj: T,
    fields: (keyof T)[],
  ): T {
    const out = { ...obj };
    for (const f of fields) {
      const v = out[f];
      if (typeof v === 'string' || v === null || v === undefined) {
        (out as Record<string, unknown>)[f as string] = this.decrypt(
          v as string | null | undefined,
        );
      }
    }
    return out;
  }

  // ── Хэши для поиска

  static hashForSearch(value: string | null | undefined): string | null {
    if (!value) return null;
    const s = String(value).trim().toLowerCase();
    if (!s) return null;
    return crypto.createHash('sha256').update(s).digest('hex');
  }

  static normalizePhone(value: string | null | undefined): string | null {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 11 && digits.startsWith('8')) return '7' + digits.slice(1);
    if (digits.length === 10) return '7' + digits;
    return digits;
  }

  static hashPhone(value: string | null | undefined): string | null {
    const norm = this.normalizePhone(value);
    return norm ? this.hashForSearch(norm) : null;
  }

  static hashEmail(value: string | null | undefined): string | null {
    return this.hashForSearch(value);
  }

  // ── Лог доступа

  static async logAccess(input: {
    userId: string | null;
    userEmail: string | null;
    subjectId: string | null;
    entity?: string;
    fields: string[];
    purpose: 'view' | 'export' | 'edit';
    piiCategory?: 'contact' | 'identity' | 'vendor';
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    try {
      const { prisma } = await import('../db/prisma.js');
      await prisma.piiAccessLog.create({
        data: {
          userId: input.userId,
          userEmail: input.userEmail,
          subjectId: input.subjectId,
          entity: input.entity ?? 'universities',
          fields: input.fields,
          purpose: input.purpose,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (e) {
      logger.warn({ err: e }, '[PII] logAccess failed');
    }
  }
}

export const UNIVERSITY_PII_FIELDS = [
  'contactEmail',
  'contactPhone',
  'telegram',
  'whatsapp',
  'maxMessenger',
] as const;

export const CONTACT_PII_FIELDS = [
  'email',
  'phone',
  'telegram',
  'whatsapp',
] as const;

export const VENDOR_PII_FIELDS = ['contactPhone', 'contactEmail'] as const;

export const LEARNER_IDENTITY_FIELDS = [
  'snils',
  'passportSeries',
  'passportNumber',
  'passportIssuedBy',
  'passportDeptCode',
  'diplomaNumber',
  'diplomaSeries',
  'diplomaRegNumber',
  'regIndex',
] as const;

export const LEARNER_CONTACT_FIELDS = ['phone', 'email'] as const;