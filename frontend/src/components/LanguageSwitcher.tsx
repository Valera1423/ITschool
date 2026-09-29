// frontend/src/components/LanguageSwitcher.tsx
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'ru', label: 'RU', fullLabel: 'Русский' },
  { code: 'en', label: 'EN', fullLabel: 'English' },
] as const;

type LangCode = (typeof LANGUAGES)[number]['code'];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const current: LangCode = i18n.language?.startsWith('en') ? 'en' : 'ru';

  const toggle = () => {
    const next: LangCode = current === 'ru' ? 'en' : 'ru';

    // i18next сам сохранит в localStorage (detection.caches: ['localStorage']),
    // но на всякий случай пишем и здесь — иногда LanguageDetector не
    // успевает прокинуть кеш, если объект создан раньше init().
    try {
      localStorage.setItem('crm:locale', next);
    } catch {
      /* приватный режим */
    }

    void i18n.changeLanguage(next);

    // Обновить <html lang="…"> — важно для скринридеров и SEO
    document.documentElement.setAttribute('lang', next);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-medium"
      title={
        current === 'ru'
          ? 'Switch to English'
          : 'Переключить на русский'
      }
      aria-label="Сменить язык"
    >
      <Globe size={14} />
      {current.toUpperCase()}
    </button>
  );
}

export { LANGUAGES };