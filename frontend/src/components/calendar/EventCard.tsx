import { Video, MapPin, Users } from 'lucide-react';
import type { Interaction } from '@/types';
import { eventColor, formatTimeRange } from '@/lib/calendar';

interface Props {
  event: Interaction;
  compact?: boolean;
  onClick?: (e: Interaction) => void;
}

export function EventCard({ event, compact = false, onClick }: Props) {
  const c = eventColor(event.color);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(event);
      }}
      className={`w-full text-left rounded-atmr-m px-2 py-1.5 border transition-all duration-atmr-fast hover:shadow-atmr-s ${c.bg} ${c.border}`}
    >
      <div className="flex items-start gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${c.dot}`} />
        <div className="flex-1 min-w-0">
          {!event.all_day && event.start_time && (
            <p className={`atmr-desc-s-strong ${c.text}`}>
              {formatTimeRange(event.start_time, event.end_time)}
            </p>
          )}
          <p className={`atmr-body-s-strong truncate ${c.text}`}>{event.title}</p>

          {!compact && (
            <div className="flex items-center gap-2 mt-1 atmr-desc-s opacity-70">
              {event.meeting_url && (
                <span className="flex items-center gap-0.5">
                  <Video size={9} />Zoom
                </span>
              )}
              {event.location && (
                <span className="flex items-center gap-0.5 truncate">
                  <MapPin size={9} />
                  {event.location}
                </span>
              )}
              {event.attendees.length > 0 && (
                <span className="flex items-center gap-0.5">
                  <Users size={9} />
                  {event.attendees.length}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}