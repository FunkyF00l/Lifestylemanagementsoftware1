import { TrackData, TrackEvent, THEME_STYLES } from '../data';
import { cn } from '../utils/cn';

export function EventBlock({
  event,
  track,
  topPx,
  heightPx,
  isPast,
  pixelsPerHour,
}: {
  event: TrackEvent;
  track: TrackData;
  topPx: number;
  heightPx: number;
  isPast: boolean;
  pixelsPerHour: number;
}) {
  const theme = THEME_STYLES[track.theme];
  const isCycle = event.type === 'cycle';
  const hasCustomColor = !!track.customColor;

  // No minimum height — allow shrinking to a thin line
  const showTitle = heightPx >= 10;
  const showTime = heightPx >= 40 && pixelsPerHour >= 10;
  const isTiny = heightPx < 40 && heightPx >= 10;

  return (
    <div
      className={cn(
        "absolute left-0 right-0 overflow-hidden transition-none cursor-pointer rounded-none z-[10]",
        showTitle && "p-1 md:p-2 flex flex-col gap-0.5 shadow-sm",
        isPast ? "bg-[#B0B0B0]" : (!hasCustomColor && theme.bg),
        isPast ? "text-[#777]" : (!hasCustomColor ? theme.text : "text-[#E8E8E8]"),
        isCycle && !isPast && "bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.15)_8px,rgba(0,0,0,0.15)_16px)]"
      )}
      style={{
        top: topPx,
        height: Math.max(heightPx, 1),
        ...(hasCustomColor && !isPast ? { backgroundColor: track.customColor } : {}),
      }}
    >
      {showTitle && (
        <div className="flex items-start justify-between z-10">
          <div className={cn(
            "font-black leading-none uppercase tracking-wider pr-4",
            isTiny ? "text-[8px] md:text-[10px] truncate" : "text-xs md:text-sm"
          )}>
            {event.title}
          </div>
        </div>
      )}

      {showTime && event.endTime && (
        <div className="text-[9px] md:text-[10px] mt-auto z-10 font-bold tracking-widest opacity-80">
          {event.startTime} - {event.endTime}
        </div>
      )}
    </div>
  );
}