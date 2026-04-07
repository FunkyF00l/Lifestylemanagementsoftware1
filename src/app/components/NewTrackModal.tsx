import { useState, useRef, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { TrackData, TrackEvent, EventKind } from '../data';
import { cn } from '../utils/cn';

// Inline infinity icon to avoid bundler issues with 'Infinity' name
function InfinityIcon({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
    </svg>
  );
}

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Gradient color stops: red→orange→yellow→green→blue (max saturation)
const GRADIENT_STOPS = [
  { pos: 0, h: 0, s: 100, l: 50 },       // red
  { pos: 0.25, h: 30, s: 100, l: 50 },    // orange
  { pos: 0.5, h: 60, s: 100, l: 50 },     // yellow
  { pos: 0.75, h: 120, s: 100, l: 40 },   // green
  { pos: 1, h: 220, s: 100, l: 50 },      // blue
];

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function lerpColor(t: number): string {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  for (let j = 1; j < GRADIENT_STOPS.length; j++) {
    if (t <= GRADIENT_STOPS[j].pos) { i = j - 1; break; }
  }
  const a = GRADIENT_STOPS[i];
  const b = GRADIENT_STOPS[Math.min(i + 1, GRADIENT_STOPS.length - 1)];
  const localT = b.pos === a.pos ? 0 : (t - a.pos) / (b.pos - a.pos);

  // Interpolate hue via shortest path
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = a.h + dh * localT;
  const s = a.s + (b.s - a.s) * localT;
  const l = a.l + (b.l - a.l) * localT;
  return hslToHex(h, s, l);
}

// ── Color refinement ──────────────────────────────────────────────────
// The sample track colors (blue #0052C2, red #E01A22, yellow #F9D115,
// green #008A27, purple #7000FF) share a signature look: deep saturation
// (80-100 %) with moderate lightness (27-50 %).  The raw slider produces
// S=100 / L=40-50 which is close but often too "loud" or too bright.
//
// `refineColor` converts the picker hex → HSL, then nudges S & L into the
// sweet-spot range that matches the hand-crafted palette, while keeping the
// user's chosen hue intact.

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function refineColor(rawHex: string): string {
  const { h, s } = hexToHSL(rawHex);

  // Keep the hue. Adjust saturation & lightness per hue region so every
  // color feels like it belongs next to the sample tracks.
  //
  // Hue-specific tuning (matching the sample palette):
  //   Red   (h ≈ 0/357):   S 82, L 49  → deep cherry
  //   Orange (h ≈ 30):      S 90, L 42  → rich amber
  //   Yellow (h ≈ 50-60):   S 92, L 46  → warm gold (not neon)
  //   Green (h ≈ 120-140):  S 100, L 27 → forest green
  //   Blue  (h ≈ 210-230):  S 100, L 38 → royal blue
  //   Purple (h ≈ 260-280): S 100, L 40 → vivid violet

  let targetS: number;
  let targetL: number;

  const hNorm = ((h % 360) + 360) % 360;

  if (hNorm <= 15 || hNorm >= 345) {
    // Red zone
    targetS = 82; targetL = 46;
  } else if (hNorm <= 45) {
    // Orange zone
    targetS = 90; targetL = 40;
  } else if (hNorm <= 75) {
    // Yellow zone
    targetS = 92; targetL = 44;
  } else if (hNorm <= 160) {
    // Green zone
    targetS = 100; targetL = 28;
  } else if (hNorm <= 250) {
    // Blue zone
    targetS = 100; targetL = 38;
  } else {
    // Purple zone
    targetS = 100; targetL = 40;
  }

  // Blend: 70 % toward the target, 30 % keep the raw value so the slider
  // still feels responsive and each notch looks distinct.
  const finalS = s * 0.3 + targetS * 0.7;
  const finalL = ((s > 0 ? hexToHSL(rawHex).l : 50)) * 0.3 + targetL * 0.7;

  return hslToHex(h, finalS, finalL);
}

function lightenHex(hex: string, factor: number = 0.65): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

interface NewTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTrack: (track: TrackData, events: TrackEvent[]) => void;
  existingEvents: TrackEvent[];
}

// Represents a selected cell in the weekly schedule
interface ScheduleCell {
  day: number; // 0-6
  hour: number; // 0-23
}

export function NewTrackModal({ isOpen, onClose, onCreateTrack, existingEvents }: NewTrackModalProps) {
  const [trackName, setTrackName] = useState('');
  const [eventKind, setEventKind] = useState<EventKind | null>(null);

  // Importance slider (0=red/important, 1=blue/not important)
  const [importance, setImportance] = useState(0.5);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

  // Cutoff
  const [cutoffDate, setCutoffDate] = useState('');
  const [cutoffTime, setCutoffTime] = useState('23:59');
  const [indefinite, setIndefinite] = useState(false);

  // Weekly schedule selections
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const dragState = useRef<{ active: boolean; adding: boolean }>({ active: false, adding: true });

  const trackColor = lerpColor(importance);
  const refinedColor = refineColor(trackColor);

  // Compute occupied cells from existing events
  const occupiedCells = useMemo(() => {
    const occ = new Set<string>();
    existingEvents.forEach(ev => {
      const startH = parseInt(ev.startTime.split(':')[0]);
      const startM = parseInt(ev.startTime.split(':')[1]);
      let endH = startH + 1, endM = 0;
      if (ev.endTime) {
        endH = parseInt(ev.endTime.split(':')[0]);
        endM = parseInt(ev.endTime.split(':')[1]);
      }

      const day = ev.dayOfWeek;
      // Fill each hour slot that this event touches
      for (let h = startH; h < endH || (h === endH && endM > 0 && h === startH); h++) {
        if (h < 24) occ.add(`${day}-${h}`);
      }
      // If endTime extends past startH
      if (endH > startH) {
        for (let h = startH; h < Math.min(endH + (endM > 0 ? 1 : 0), 24); h++) {
          occ.add(`${day}-${h}`);
        }
      }
    });
    return occ;
  }, [existingEvents]);

  const handleSliderInteraction = useCallback((clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setImportance(t);
  }, []);

  const toggleCell = useCallback((day: number, hour: number) => {
    const key = `${day}-${hour}`;
    if (occupiedCells.has(key)) return;
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [occupiedCells]);

  const handleCellPointerDown = useCallback((day: number, hour: number) => {
    const key = `${day}-${hour}`;
    if (occupiedCells.has(key)) return;
    const adding = !selectedCells.has(key);
    dragState.current = { active: true, adding };
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (adding) next.add(key);
      else next.delete(key);
      return next;
    });
  }, [occupiedCells, selectedCells]);

  const handleCellPointerEnter = useCallback((day: number, hour: number) => {
    if (!dragState.current.active) return;
    const key = `${day}-${hour}`;
    if (occupiedCells.has(key)) return;
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (dragState.current.adding) next.add(key);
      else next.delete(key);
      return next;
    });
  }, [occupiedCells]);

  const handlePointerUp = useCallback(() => {
    dragState.current.active = false;
  }, []);

  const handleCreate = () => {
    if (!trackName || !eventKind) return;
    if (eventKind === 'cycle') return; // Not implemented

    const trackId = `t${Date.now()}`;
    const now = new Date();

    const newTrack: TrackData = {
      id: trackId,
      name: trackName,
      theme: 'blue', // fallback, customColor is used
      customColor: refinedColor,
      eventKind: 'cutoff',
      startDay: now.getDay(),
      startTime: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      startDate: now.toISOString(),
      cutoffDay: 0,
      cutoffTime: indefinite ? '23:59' : cutoffTime,
      cutoffDate: indefinite ? undefined : (cutoffDate ? `${cutoffDate}T${cutoffTime}` : undefined),
      indefinite,
    };

    // Convert selected cells to TrackEvents
    // Group consecutive hours on same day into single events
    const newEvents: TrackEvent[] = [];
    const cellsByDay: Record<number, number[]> = {};
    selectedCells.forEach(key => {
      const [d, h] = key.split('-').map(Number);
      if (!cellsByDay[d]) cellsByDay[d] = [];
      cellsByDay[d].push(h);
    });

    Object.entries(cellsByDay).forEach(([dayStr, hours]) => {
      hours.sort((a, b) => a - b);
      // Group consecutive hours
      let start = hours[0];
      let end = hours[0];
      for (let i = 1; i <= hours.length; i++) {
        if (i < hours.length && hours[i] === end + 1) {
          end = hours[i];
        } else {
          // Emit event from start to end+1
          newEvents.push({
            id: `e${Date.now()}-${dayStr}-${start}`,
            trackId,
            title: trackName,
            type: 'regular',
            dayOfWeek: Number(dayStr),
            startTime: `${start.toString().padStart(2, '0')}:00`,
            endTime: `${(end + 1 === 24 ? 23 : end + 1).toString().padStart(2, '0')}:${end + 1 === 24 ? '59' : '00'}`,
          });
          if (i < hours.length) {
            start = hours[i];
            end = hours[i];
          }
        }
      }
    });

    onCreateTrack(newTrack, newEvents);
    // Reset
    setTrackName('');
    setEventKind(null);
    setImportance(0.5);
    setCutoffDate('');
    setCutoffTime('23:59');
    setIndefinite(false);
    setSelectedCells(new Set());
  };

  if (!isOpen) return null;

  // Min date for cutoff picker = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-[100] bg-[#333]/50 flex items-center justify-center p-4">
      <div className="bg-[#D8D8D8] rounded-lg w-full max-w-sm border-2 border-[#A0A0A0] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-5 pb-3 shrink-0">
          <h2 className="text-base uppercase tracking-widest" style={{ color: '#555', fontWeight: 800 }}>New Track</h2>
          <button onClick={onClose} className="p-1">
            <X size={20} className="text-[#666]" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 pb-5">
          <div className="space-y-4">
            {/* Track Name */}
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: '#666', fontWeight: 700 }}>Track Name</label>
              <input
                type="text"
                value={trackName}
                onChange={e => setTrackName(e.target.value)}
                className="w-full bg-[#C0C0C0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[#888] placeholder-[#999]"
                style={{ color: '#444', fontWeight: 600 }}
                placeholder="e.g., COMPLETE REPORT"
              />
            </div>

            {/* Event Type */}
            <div>
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: '#666', fontWeight: 700 }}>Event Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEventKind('cycle')}
                  className={cn(
                    'flex-1 py-2.5 rounded text-sm uppercase tracking-wider transition-colors',
                    eventKind === 'cycle'
                      ? 'bg-[#7000FF] text-[#E8E8E8]'
                      : 'bg-[#C0C0C0] text-[#666] hover:bg-[#B0B0B0]'
                  )}
                  style={{ fontWeight: 700 }}
                >
                  Cycle
                </button>
                <button
                  onClick={() => setEventKind('cutoff')}
                  className={cn(
                    'flex-1 py-2.5 rounded text-sm uppercase tracking-wider transition-colors',
                    eventKind === 'cutoff'
                      ? 'text-[#E8E8E8]'
                      : 'bg-[#C0C0C0] text-[#666] hover:bg-[#B0B0B0]'
                  )}
                  style={{
                    fontWeight: 700,
                    ...(eventKind === 'cutoff' ? { backgroundColor: refinedColor } : {}),
                  }}
                >
                  Cutoff
                </button>
              </div>
            </div>

            {/* Cycle selected — nothing more */}
            {eventKind === 'cycle' && (
              <div className="text-center py-6 text-sm tracking-wider" style={{ color: '#999', fontWeight: 600 }}>
                Cycle events coming soon...
              </div>
            )}

            {/* Cutoff event options */}
            {eventKind === 'cutoff' && (
              <>
                {/* Importance Slider */}
                <div>
                  <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: '#666', fontWeight: 700 }}>Importance</label>
                  <div className="relative">
                    <div
                      ref={sliderRef}
                      className="h-8 rounded-full cursor-pointer relative select-none"
                      style={{
                        background: 'linear-gradient(to right, hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%), hsl(120,100%,40%), hsl(220,100%,50%))',
                      }}
                      onMouseDown={(e) => {
                        isDraggingSlider.current = true;
                        handleSliderInteraction(e.clientX);
                        const onMove = (ev: MouseEvent) => {
                          if (isDraggingSlider.current) handleSliderInteraction(ev.clientX);
                        };
                        const onUp = () => {
                          isDraggingSlider.current = false;
                          window.removeEventListener('mousemove', onMove);
                          window.removeEventListener('mouseup', onUp);
                        };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                      }}
                      onTouchStart={(e) => {
                        isDraggingSlider.current = true;
                        handleSliderInteraction(e.touches[0].clientX);
                      }}
                      onTouchMove={(e) => {
                        if (isDraggingSlider.current) handleSliderInteraction(e.touches[0].clientX);
                      }}
                      onTouchEnd={() => { isDraggingSlider.current = false; }}
                    >
                      {/* Slider thumb */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-[3px] border-[#E8E8E8] shadow-md pointer-events-none"
                        style={{
                          left: `calc(${importance * 100}% - 12px)`,
                          backgroundColor: trackColor,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] uppercase tracking-wider" style={{ color: '#E01A22', fontWeight: 800 }}>Important</span>
                      <span className="text-[9px] uppercase tracking-wider" style={{ color: '#0052C2', fontWeight: 800 }}>Not Important</span>
                    </div>
                  </div>


                </div>

                {/* Cutoff Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs uppercase tracking-wider" style={{ color: indefinite ? '#AAA' : '#666', fontWeight: 700 }}>Cutoff Day</label>
                    <button
                      onClick={() => setIndefinite(!indefinite)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded text-[9px] uppercase tracking-wider transition-colors',
                        indefinite ? 'bg-[#888] text-[#E8E8E8]' : 'bg-[#C0C0C0] text-[#777] hover:bg-[#B0B0B0]'
                      )}
                      style={{ fontWeight: 700 }}
                    >
                      <InfinityIcon size={12} />
                      Until I delete
                    </button>
                  </div>
                  <input
                    type="date"
                    value={cutoffDate}
                    min={minDate}
                    onChange={e => setCutoffDate(e.target.value)}
                    disabled={indefinite}
                    className={cn(
                      'w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[#888]',
                      indefinite ? 'bg-[#D0D0D0] text-[#AAA] cursor-not-allowed' : 'bg-[#C0C0C0] text-[#444]'
                    )}
                    style={{ fontWeight: 600 }}
                  />
                </div>

                {/* Cutoff Time */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs uppercase tracking-wider" style={{ color: indefinite ? '#AAA' : '#666', fontWeight: 700 }}>Cutoff Time</label>
                  </div>
                  <input
                    type="time"
                    value={cutoffTime}
                    onChange={e => setCutoffTime(e.target.value)}
                    disabled={indefinite}
                    className={cn(
                      'w-full rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[#888]',
                      indefinite ? 'bg-[#D0D0D0] text-[#AAA] cursor-not-allowed' : 'bg-[#C0C0C0] text-[#444]'
                    )}
                    style={{ fontWeight: 600 }}
                  />
                </div>

                {/* Weekly Schedule Grid */}
                <div>
                  <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: '#666', fontWeight: 700 }}>Event Block Schedule</label>
                  <div
                    className="border border-[#A0A0A0] rounded overflow-hidden select-none"
                    onMouseUp={handlePointerUp}
                    onMouseLeave={handlePointerUp}
                    onTouchEnd={handlePointerUp}
                  >
                    {/* Day headers */}
                    <div className="grid grid-cols-[32px_repeat(7,1fr)] bg-[#B8B8B8]">
                      <div className="text-[7px] text-center py-1" style={{ color: '#888' }}></div>
                      {DAYS_OF_WEEK.map((d, i) => (
                        <div key={i} className="text-[8px] text-center py-1 uppercase tracking-wider" style={{ color: '#555', fontWeight: 800 }}>
                          {d.slice(0, 2)}
                        </div>
                      ))}
                    </div>
                    {/* Hour rows */}
                    <div>
                      {HOURS.map(hour => (
                        <div key={hour} className="grid grid-cols-[32px_repeat(7,1fr)] border-t border-[#C8C8C8]">
                          <div className="text-[7px] text-center py-0.5 flex items-center justify-center" style={{ color: '#999', fontWeight: 700 }}>
                            {(hour + 1).toString()}
                          </div>
                          {DAYS_OF_WEEK.map((_, dayIdx) => {
                            const key = `${dayIdx}-${hour}`;
                            const isOccupied = occupiedCells.has(key);
                            const isSelected = selectedCells.has(key);

                            return (
                              <div
                                key={key}
                                className={cn(
                                  'h-[14px] border-l border-[#D0D0D0] cursor-pointer transition-colors',
                                  isOccupied && 'cursor-not-allowed'
                                )}
                                style={{
                                  backgroundColor: isOccupied
                                    ? '#A0A0A0'
                                    : isSelected
                                      ? refinedColor
                                      : '#DCDCDC',
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleCellPointerDown(dayIdx, hour);
                                }}
                                onMouseEnter={() => handleCellPointerEnter(dayIdx, hour)}
                                onTouchStart={(e) => {
                                  e.preventDefault();
                                  handleCellPointerDown(dayIdx, hour);
                                }}
                                onTouchMove={(e) => {
                                  const touch = e.touches[0];
                                  const el = document.elementFromPoint(touch.clientX, touch.clientY);
                                  if (el) {
                                    const cellKey = el.getAttribute('data-cell');
                                    if (cellKey) {
                                      const [d, h] = cellKey.split('-').map(Number);
                                      handleCellPointerEnter(d, h);
                                    }
                                  }
                                }}
                                data-cell={key}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: refinedColor }} />
                      <span className="text-[8px] uppercase tracking-wider" style={{ color: '#777', fontWeight: 700 }}>Selected</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm bg-[#A0A0A0]" />
                      <span className="text-[8px] uppercase tracking-wider" style={{ color: '#777', fontWeight: 700 }}>Occupied</span>
                    </div>
                  </div>
                </div>

                {/* Create Button */}
                <button
                  onClick={handleCreate}
                  disabled={!trackName || (selectedCells.size === 0)}
                  className={cn(
                    'w-full py-2.5 rounded text-sm uppercase tracking-wider transition-colors',
                    trackName && selectedCells.size > 0
                      ? 'text-[#E8E8E8] hover:opacity-90'
                      : 'bg-[#C0C0C0] text-[#999] cursor-not-allowed'
                  )}
                  style={{
                    fontWeight: 700,
                    ...(trackName && selectedCells.size > 0 ? { backgroundColor: refinedColor } : {}),
                  }}
                >
                  Start Track Event
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}