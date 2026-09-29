// backend/src/services/learners-import.service.ts
import { prisma } from '../db/prisma.js';
import {
  PiiService,
  LEARNER_IDENTITY_FIELDS,
  LEARNER_CONTACT_FIELDS,
} from './pii.service.js';
import { logger } from '../config/logger.js';
import type { AuthUser } from '../middleware/auth.js';

export interface LearnerImportRow {
  lastName: string;
  firstName: string;
  middleName?: string | null;
  phone?: string | null;
  email?: string | null;
  snils?: string | null;
  passportSeries?: string | null;
  passportNumber?: string | null;
  passportIssuedBy?: string | null;
  passportIssuedAt?: string | null;
  passportDeptCode?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  regRegion?: string | null;
  regCity?: string | null;
  regStreet?: string | null;
  regHouse?: string | null;
  regFlat?: string | null;
  regIndex?: string | null;
  educationLevel?: string | null;
  diplomaProfession?: string | null;
  diplomaInstitution?: string | null;
  diplomaLastName?: string | null;
  diplomaNumber?: string | null;
  diplomaSeries?: string | null;
  diplomaRegNumber?: string | null;
  diplomaIssuedAt?: string | null;
}

export interface LearnerImportResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: { rowIndex: number; message: string }[];
}

export class LearnersImportService {
  static async importBatch(
    rows: LearnerImportRow[],
    auth: AuthUser,
    opts: { createOnly?: boolean } = {},
  ): Promise<LearnerImportResult> {
    let inserted = 0, updated = 0, failed = 0;
    const errors: LearnerImportResult['errors'] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const emailHash = PiiService.hashEmail(r.email);
        const phoneHash = PiiService.hashPhone(r.phone);

        const data = {
          lastName: r.lastName.trim(),
          firstName: r.firstName.trim(),
          middleName: r.middleName ?? null,

          phone: PiiService.encrypt(r.phone),
          email: PiiService.encrypt(r.email),
          phoneHash,
          emailHash,

          snils: PiiService.encrypt(r.snils),
          passportSeries: PiiService.encrypt(r.passportSeries),
          passportNumber: PiiService.encrypt(r.passportNumber),
          passportIssuedBy: PiiService.encrypt(r.passportIssuedBy),
          passportDeptCode: PiiService.encrypt(r.passportDeptCode),
          passportIssuedAt: r.passportIssuedAt
            ? new Date(r.passportIssuedAt)
            : null,
          birthDate: r.birthDate ? new Date(r.birthDate) : null,
          gender: r.gender ?? null,

          regRegion: r.regRegion ?? null,
          regCity: r.regCity ?? null,
          regStreet: r.regStreet ?? null,
          regHouse: r.regHouse ?? null,
          regFlat: r.regFlat ?? null,
          regIndex: PiiService.encrypt(r.regIndex),

          educationLevel: r.educationLevel ?? null,
          diplomaProfession: r.diplomaProfession ?? null,
          diplomaInstitution: r.diplomaInstitution ?? null,
          diplomaLastName: r.diplomaLastName ?? null,
          diplomaNumber: PiiService.encrypt(r.diplomaNumber),
          diplomaSeries: PiiService.encrypt(r.diplomaSeries),
          diplomaRegNumber: PiiService.encrypt(r.diplomaRegNumber),
          diplomaIssuedAt: r.diplomaIssuedAt
            ? new Date(r.diplomaIssuedAt)
            : null,
        };

        const existing =
          !opts.createOnly && (emailHash || phoneHash)
            ? await prisma.learner.findFirst({
                where: {
                  OR: [
                    ...(emailHash ? [{ emailHash }] : []),
                    ...(phoneHash ? [{ phoneHash }] : []),
                  ],
                },
                select: { id: true },
              })
            : null;

        if (existing) {
          await prisma.learner.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await prisma.learner.create({ data });
          inserted++;
        }

        void PiiService.logAccess({
          userId: auth.profileId,
          userEmail: auth.email,
          subjectId: null,
          entity: 'learners',
          fields: [...LEARNER_CONTACT_FIELDS, ...LEARNER_IDENTITY_FIELDS],
          purpose: 'edit',
          piiCategory: 'identity',
        });
      } catch (e) {
        failed++;
        errors.push({
          rowIndex: i,
          message: e instanceof Error ? e.message : 'unknown',
        });
      }
    }

    logger.info(
      { inserted, updated, failed, actor: auth.email },
      '[learners-import] done',
    );

    return { inserted, updated, failed, errors };
  }
}