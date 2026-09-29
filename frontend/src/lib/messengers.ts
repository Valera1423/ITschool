/**
 * Deep-links на почту и мессенджеры.
 *
 * Все ссылки формата `scheme://path` открывают приложение на устройстве.
 * На десктопе откроется веб-версия.
 */

export function digitsOnly(raw: string | null | undefined): string {
  return raw ? raw.replace(/\D/g, '') : '';
}

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

/** WhatsApp: <https://wa.me/79991234567?text=...> */
export function whatsappLink(
  phone: string | null | undefined,
  text?: string,
): string | null {
  const d = digitsOnly(phone);
  if (!d) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${d}${q}`;
}

/**
 * Telegram.
 *
 * Поддерживаются:
 * - @username или буквенный username → https://t.me/username
 * - телефон → tg://resolve?phone=79991234567 (только мобильные клиенты)
 *
 * Веб-версия Telegram НЕ умеет открывать чат по телефону.
 * Для телефона используется нативный deep-link (tg://), который
 * работает на iOS/Android. Если приложения нет — пользователь
 * увидит ничего (на десктопе).
 */
export function telegramLink(
  usernameOrPhone: string | null | undefined,
): string | null {
  if (!usernameOrPhone) return null;
  const raw = usernameOrPhone.trim();
  if (!raw) return null;

  // @username или буквенный username
  if (/^@?[a-zA-Z0-9_]{4,}$/.test(raw)) {
    return `https://t.me/${raw.replace(/^@/, '')}`;
  }

  // Телефон — только через нативный deep-link
  const d = digitsOnly(raw);
  return d ? `tg://resolve?phone=${d}` : null;
}

/** MAX (VK): <https://max.ru/u/username> или <https://max.ru/+79991234567> */
export function maxLink(
  phoneOrUsername: string | null | undefined,
): string | null {
  if (!phoneOrUsername) return null;
  const raw = phoneOrUsername.trim();
  if (!raw) return null;

  if (raw.startsWith('@')) return `https://max.ru/${raw}`;

  const d = digitsOnly(raw);
  return d ? `https://max.ru/+${d}` : null;
}

/** Email: mailto. */
export function mailtoLink(
  email: string | null | undefined,
  subject?: string,
  body?: string,
): string | null {
  if (!email) return null;
  const parts: string[] = [];
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${email}${parts.length ? `?${parts.join('&')}` : ''}`;
}

/** Телефон: tel:. */
export function telLink(phone: string | null | undefined): string | null {
  const d = digitsOnly(phone);
  return d ? `tel:+${d}` : null;
}

/** Открыть ссылку в новой вкладке. */
export function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}