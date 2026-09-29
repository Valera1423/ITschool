import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) setWasOffline(true);
    else if (wasOffline) {
      const t = setTimeout(() => setWasOffline(false), 3000);
      return () => clearTimeout(t);
    }
  }, [online, wasOffline]);

  if (online && !wasOffline) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-atmr-3xl px-4 py-2.5 rounded-atmr-l shadow-atmr-l flex items-center gap-2 atmr-body-s-strong text-white ${
        online ? 'bg-atmr-success' : 'bg-atmr-error'
      }`}
    >
      {online ? <Wifi size={16} /> : <WifiOff size={16} />}
      {online ? 'Соединение восстановлено' : 'Нет соединения с интернетом'}
    </div>
  );
}