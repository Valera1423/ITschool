// frontend/src/lib/learnersExcel.ts
import * as XLSX from 'xlsx';
import { importLearners, type LearnerImportResult } from './learners';

interface ParsedRow {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: string[];
}

/**
 * Карта заголовков файла «Загрузка пользователей.xlsx» (A–AD).
 * Ключ — нормализованный заголовок (lower, без скобок, без лишних пробелов).
 */
const COLUMN_MAP: Record<string, string> = {
  'фамилия': 'lastName',
  'имя': 'firstName',
  'отчество': 'middleName',
  'номер телефона': 'phone',
  'email': 'email',
  'снилс': 'snils',
  'серия паспорта': 'passportSeries',
  'номер паспорта': 'passportNumber',
  'кем выдан паспорт': 'passportIssuedBy',
  'дата выдачи паспорта': 'passportIssuedAt',
  'код подразделения': 'passportDeptCode',
  'пол': 'gender',
  'дата рождения': 'birthDate',
  'регион регистрации': 'regRegion',
  'населенный пункт регистрации': 'regCity',
  'улица регистрации': 'regStreet',
  'дом регистрации': 'regHouse',
  'квартира регистрации': 'regFlat',
  'индекс регистрации': 'regIndex',
  'образование': 'educationLevel',
  'профессия по диплому': 'diplomaProfession',
  'учебное заведение по диплому': 'diplomaInstitution',
  'фамилия, указанная в дипломе': 'diplomaLastName',
  'номер диплома': 'diplomaNumber',
  'серия диплома': 'diplomaSeries',
  'регистрационный номер диплома': 'diplomaRegNumber',
  'дата выдачи диплома': 'diplomaIssuedAt',
};

function normalizeHeader(h: string): string {
  return String(h ?? '')
    .toLowerCase()
    .replace(/\s*\(при наличии\)\s*/gi, '')
    .replace(/\s*\(в дательном падеже\)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(raw: string): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits || null;
}

function normalizeDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number') {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (!parsed) return null;
    const y = parsed.y;
    const m = String(parsed.m).padStart(2, '0');
    const d = String(parsed.d).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(raw).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export async function parseLearnersExcel(file: File): Promise<{
  rows: ParsedRow[];
  unknownHeaders: string[];
}> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { rows: [], unknownHeaders: [] };

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  });

  if (aoa.length < 2) return { rows: [], unknownHeaders: [] };

  const [headers, ...body] = aoa;
  const idx: Record<string, number> = {};
  const unknownHeaders: string[] = [];

  (headers as unknown[]).forEach((h, i) => {
    const norm = normalizeHeader(String(h));
    const target = COLUMN_MAP[norm];
    if (target) idx[target] = i;
    else if (norm) unknownHeaders.push(String(h));
  });

  const rows: ParsedRow[] = [];
  for (let r = 0; r < body.length; r++) {
    const raw = body[r] as unknown[];
    if (!raw || raw.every((c) => String(c ?? '').trim() === '')) continue;

    const get = (key: string): string => {
      const i = idx[key];
      return i !== undefined ? String(raw[i] ?? '').trim() : '';
    };

    const lastName = get('lastName');
    const firstName = get('firstName');
    const errors: string[] = [];
    if (!lastName) errors.push('Не указана фамилия');
    if (!firstName) errors.push('Не указано имя');

    rows.push({
      rowIndex: r + 2,
      data: {
        lastName,
        firstName,
        middleName: get('middleName') || null,
        phone: normalizePhone(get('phone')),
        email: get('email') || null,
        snils: get('snils') || null,
        passportSeries: get('passportSeries') || null,
        passportNumber: get('passportNumber') || null,
        passportIssuedBy: get('passportIssuedBy') || null,
        passportIssuedAt: normalizeDate(get('passportIssuedAt')),
        passportDeptCode: get('passportDeptCode') || null,
        gender: get('gender') || null,
        birthDate: normalizeDate(get('birthDate')),
        regRegion: get('regRegion') || null,
        regCity: get('regCity') || null,
        regStreet: get('regStreet') || null,
        regHouse: get('regHouse') || null,
        regFlat: get('regFlat') || null,
        regIndex: get('regIndex') || null,
        educationLevel: get('educationLevel') || null,
        diplomaProfession: get('diplomaProfession') || null,
        diplomaInstitution: get('diplomaInstitution') || null,
        diplomaLastName: get('diplomaLastName') || null,
        diplomaNumber: get('diplomaNumber') || null,
        diplomaSeries: get('diplomaSeries') || null,
        diplomaRegNumber: get('diplomaRegNumber') || null,
        diplomaIssuedAt: normalizeDate(get('diplomaIssuedAt')),
      },
      errors,
    });
  }

  return { rows, unknownHeaders };
}

export async function importParsedLearners(
  parsed: ParsedRow[],
  mode: 'upsert' | 'create-only' = 'upsert',
): Promise<LearnerImportResult> {
  const valid = parsed.filter((p) => p.errors.length === 0).map((p) => p.data);
  const result = await importLearners(valid, mode);
  const invalid = parsed.filter((p) => p.errors.length > 0);
  return {
    ...result,
    failed: result.failed + invalid.length,
    errors: [
      ...result.errors,
      ...invalid.map((p) => ({
        rowIndex: p.rowIndex,
        message: p.errors.join('; '),
      })),
    ],
  };
}

export type { ParsedRow };