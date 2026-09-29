// frontend/src/lib/exportServer.ts
import { getUser } from 'oidc-client-ts'; // или откуда у вас токен — см. ниже

/**
 * Скачать файл с сервера с Bearer-токеном.
 * Используется для тяжёлых экспортов (XLSX/PDF/CSV), которые бэкенд
 * генерирует сам.
 */
export async function downloadFromServer(
  url: string,
  fallbackName = 'export',
): Promise<void> {
  // ВАЖНО: подставьте свой способ получения токена.
  // Например, если у вас есть useAuth/react-oidc — вынесите в
  // отдельный модуль, доступный вне React (sessionStorage, oidc store и т.п.).
  const token =
    window.sessionStorage.getItem('access_token') ??
    window.localStorage.getItem('access_token') ??
    '';

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`Не удалось скачать файл: ${res.status}`);
  }

  // Имя из Content-Disposition, если есть
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}