import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ВАЖНО: путь ./locales/ru.json означает src/lib/locales/ru.json.
// Если файлы лежат в другом месте — поправь импорты.
import ru from './locales/ru.json';
import en from './locales/en.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
    },
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'crm:locale',
    },
    returnObjects: true,
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[i18n] инициализация провалилась', e);
  });

export default i18n;