import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

interface SwReadyDetail {
  registration: ServiceWorkerRegistration;
}

export function SwUpdateBanner() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SwReadyDetail>).detail;
      if (detail?.registration) setRegistration(detail.registration);
    };
    window.addEventListener('crm:sw-update-ready', handler);
    return () => window.removeEventListener('crm:sw-update-ready', handler);
  }, []);

  if (!registration || dismissed) return null;

  const applyUpdate = () => {
    const newWorker =
      registration.waiting ?? registration.active ?? registration.installing;
    if (newWorker) {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => window.location.reload(), 100);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-atmr-3xl bg-atmr-accent text-atmr-accent-on rounded-atmr-xl shadow-atmr-xl p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-atmr-l bg-white/15 flex items-center justify-center flex-shrink-0">
          <RefreshCw size={18} />
        </div>
        <div className="flex-1">
          <p className="atmr-body-s-strong">Доступна новая версия</p>
          <p className="atmr-desc-l opacity-90 mt-0.5 mb-3">
            Обновите страницу, чтобы получить последние изменения.
          </p>
          <div className="flex gap-2">
            <button
              onClick={applyUpdate}
              className="px-3 py-1.5 rounded-atmr-m bg-atmr-bg-surface1 text-atmr-accent atmr-desc-l-strong hover:opacity-90 transition-opacity duration-atmr-fast"
            >
              Обновить
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 rounded-atmr-m atmr-desc-l opacity-80 hover:opacity-100 transition-opacity duration-atmr-fast"
            >
              Позже
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-atmr-s opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Закрыть"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}