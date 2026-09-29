import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem('crm:install-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt || dismissed) return null;

  const install = async () => {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  };

  const dismiss = () => {
    localStorage.setItem('crm:install-dismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-atmr-3xl bg-atmr-bg-elevated-xl rounded-atmr-xl shadow-atmr-xl border border-atmr-border-soft p-4 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-atmr-l bg-atmr-accent-soft text-atmr-accent flex items-center justify-center flex-shrink-0">
          <Download size={18} />
        </div>
        <div className="flex-1">
          <p className="atmr-body-s-strong text-atmr-fg">
            Установить приложение
          </p>
          <p className="atmr-desc-l text-atmr-fg-soft mt-0.5 mb-3">
            Быстрый доступ с рабочего стола, работа offline.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void install()}
              className="px-3 py-1.5 rounded-atmr-m bg-atmr-accent text-atmr-accent-on atmr-desc-l-strong hover:bg-atmr-accent-hover transition-colors duration-atmr-fast"
            >
              Установить
            </button>
            <button
              onClick={dismiss}
              className="px-3 py-1.5 rounded-atmr-m text-atmr-fg-soft atmr-desc-l hover:bg-atmr-bg-surface2 transition-colors duration-atmr-fast"
            >
              Позже
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="p-1 rounded-atmr-s text-atmr-fg-muted hover:bg-atmr-bg-surface2 transition-colors"
          aria-label="Закрыть"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}