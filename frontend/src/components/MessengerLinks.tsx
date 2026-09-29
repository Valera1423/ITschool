import { Mail, MessageCircle, Phone, Send, Zap } from 'lucide-react';
import type { University } from '@/types';
import {
  whatsappLink,
  telegramLink,
  maxLink,
  mailtoLink,
  telLink,
  openExternal,
} from '@/lib/messengers';

interface Props {
  university: Pick<
    University,
    'contact_email' | 'contact_phone' | 'telegram' | 'whatsapp' | 'max_messenger' | 'name'
  >;
  compact?: boolean;
  onNotice?: (notice: string) => void;
}

export function MessengerLinks({ university, compact = false, onNotice }: Props) {
  const links = [
    {
      key: 'phone',
      title: 'Позвонить',
      icon: Phone,
      url: telLink(university.contact_phone),
      className: 'text-atmr-fg-soft hover:bg-atmr-bg-surface2',
    },
    {
      key: 'email',
      title: 'Email',
      icon: Mail,
      url: mailtoLink(
        university.contact_email,
        `Сотрудничество с ${university.name}`,
      ),
      className: 'text-atmr-info hover:bg-atmr-info-soft',
    },
    {
      key: 'whatsapp',
      title: 'WhatsApp',
      icon: MessageCircle,
      url: whatsappLink(university.whatsapp ?? university.contact_phone),
      className: 'text-atmr-success hover:bg-atmr-success-soft',
    },
    {
      key: 'telegram',
      title: 'Telegram',
      icon: Send,
      url: telegramLink(university.telegram),
      className: 'text-atmr-info hover:bg-atmr-info-soft',
    },
    {
      key: 'max',
      title: 'MAX',
      icon: Zap,
      url: maxLink(university.max_messenger ?? university.contact_phone),
      className: 'text-atmr-accent hover:bg-atmr-accent-soft',
    },
  ];

  const available = links.filter((l) => l.url);

  if (available.length === 0) {
    return <span className="atmr-desc-l text-atmr-fg-muted">Нет контактов для связи</span>;
  }

  return (
    <div className={`flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-2'}`}>
      {available.map(({ key, title, icon: Icon, url, className }) => (
        <button
          key={key}
          type="button"
          title={title}
          onClick={() => {
            if (url) openExternal(url);
            if (onNotice) onNotice(`${title}: открываем ${url}`);
          }}
          className={`inline-flex items-center justify-center rounded-atmr-m transition-colors duration-atmr-fast ${
            compact ? 'p-1.5' : 'p-2 gap-1.5 atmr-desc-l-strong'
          } ${className}`}
        >
          <Icon size={compact ? 15 : 14} />
          {!compact && <span>{title}</span>}
        </button>
      ))}
    </div>
  );
}