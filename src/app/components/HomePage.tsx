import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router';
import { THEME_STYLES, TrackEvent, TrackData, ThemeType } from '../data';
import { useTracks } from '../TracksContext';
import { EventBlock } from './EventBlock';
import { PieChart } from './PieChart';
import { TodaysAffairs, TodoItem } from './TodaysAffairs';
import { NewTrackModal } from './NewTrackModal';
import { Plus, Menu, Search, Moon, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';

// ── Constants ──────────────────────────────────────────────────────────
const HEADER_OFFSET = 48;
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const PIE_OFFSET_BELOW_RED_LINE = 12;
const PANEL_HANDLE_HEIGHT = 56;
const DEFAULT_PPH = 15;
const DEFAULT_TW = 70;

// ── 100-year epoch ────────────────────────────────────────────────────
const _REF = new Date();
const EPOCH_YEAR = _REF.getFullYear() - 50;
const EPOCH_START = new Date(EPOCH_YEAR, 0, 1, 0, 0, 0, 0);
const EPOCH_END = new Date(EPOCH_YEAR + 100, 0, 1, 0, 0, 0, 0);
const TOTAL_HOURS = (EPOCH_END.getTime() - EPOCH_START.getTime()) / 3600000;

function hoursFromEpoch(date: Date): number {
  return (date.getTime() - EPOCH_START.getTime()) / 3600000;
}

/** Content-top for a given hfe (inverted: future on top) */
function contentTop(hfe: number, pph: number): number {
  return (TOTAL_HOURS - hfe) * pph + HEADER_OFFSET;
}

// Week start (Sunday 00:00) of the current week
function getWeekStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}
const WEEK_START = getWeekStart();
const WEEK_START_HFE = hoursFromEpoch(WEEK_START);

/** Convert a dayOfWeek (0-6) + time string to absolute hfe */
function weekHfe(dayOfWeek: number, time: string): number {
  const [h, m] = time.split(':').map(Number);
  return WEEK_START_HFE + dayOfWeek * 24 + h + m / 60;
}

// Max PPH to stay under browser max height (~15M px)
const MAX_PPH = Math.min(300, 15_000_000 / TOTAL_HOURS);

function lightenHex(hex: string, factor: number = 0.65): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

const THEME_HEX: Record<ThemeType, string> = {
  blue: '#0052C2',
  red: '#E01A22',
  yellow: '#D4A900',
  green: '#008A27',
  purple: '#7000FF',
};

// ── Red line helpers ──────────────────────────────────────────────────
function getRedLineContentTop(pph: number) {
  return contentTop(hoursFromEpoch(new Date()), pph);
}

function calcScrollTopForRedLine(pph: number, targetVisualY: number) {
  return getRedLineContentTop(pph) - targetVisualY;
}

// ── CurrentTimeLine ───────────────────────────────────────────────────
function CurrentTimeLine({ pixelsPerHour }: { pixelsPerHour: number }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const top = contentTop(hoursFromEpoch(now), pixelsPerHour);
  const isNight = now.getHours() >= 23 || now.getHours() < 7;

  return (
    <div
      className="absolute left-[-80px] right-[-20px] z-30 pointer-events-none flex items-center"
      style={{ top, transform: 'translateY(-50%)' }}
    >
      <div className="h-[3px] w-full bg-[#E01A22]" />
      {isNight && (
        <div className="absolute left-[28px] top-[18px]">
          <Moon size={32} fill="#F5C518" stroke="#F5C518" strokeWidth={1.5} className="drop-shadow-md" />
        </div>
      )}
    </div>
  );
}

// ── HomePage ──────────────────────────────────────────────────────────
export function HomePage() {
  const { onOpenSidebar } = useOutletContext<{ onOpenSidebar: () => void }>();

  const scrollRef = useRef<HTMLDivElement>(null);
  const gestureContainerRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const [currentDate] = useState(new Date());

  const { tracks, setTracks, events, setEvents } = useTracks();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isNewTrackModalOpen, setIsNewTrackModalOpen] = useState(false);

  // Temporary todos
  const [tempTodos, setTempTodos] = useState<TodoItem[]>([]);

  // Long-press delete
  const [deleteTrackId, setDeleteTrackId] = useState<string | null>(null);
  const [deletePopupPos, setDeletePopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTrackLongPressStart = useCallback((trackId: string, clientX: number, clientY: number) => {
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      const x = clientX - (containerRect?.left || 0);
      const y = clientY - (containerRect?.top || 0);
      setDeleteTrackId(trackId);
      setDeletePopupPos({ x, y });
    }, 600);
  }, [clearLongPress]);

  const handleDeleteTrack = useCallback((trackId: string) => {
    setTracks(prev => prev.filter(t => t.id !== trackId));
    setEvents(prev => prev.filter(e => e.trackId !== trackId));
    setDeleteTrackId(null);
  }, []);

  const handleCreateTrack = useCallback((newTrack: TrackData, newEvents: TrackEvent[]) => {
    setTracks(prev => [...prev, newTrack]);
    setEvents(prev => [...prev, ...newEvents]);
    setIsNewTrackModalOpen(false);
  }, []);

  // Scale
  const [pixelsPerHour, setPixelsPerHour] = useState(DEFAULT_PPH);
  const [trackWidth, setTrackWidth] = useState(DEFAULT_TW);
  const scaleRef = useRef({ pph: DEFAULT_PPH, tw: DEFAULT_TW });
  useEffect(() => {
    scaleRef.current = { pph: pixelsPerHour, tw: trackWidth };
  }, [pixelsPerHour, trackWidth]);

  // Scroll position tracking for virtualization
  const [scrollY, setScrollY] = useState(0);
  const scrollRAFRef = useRef(0);

  // --- Draggable Today's Affairs panel ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelTop, setPanelTop] = useState<number | null>(null);
  const panelDragRef = useRef({ isDragging: false, startY: 0, startTop: 0 });
  const [isPanelDismissed, setIsPanelDismissed] = useState(false);
  const prevDismissedRef = useRef(false);

  const getTopBarHeight = useCallback(() => {
    return topBarRef.current?.offsetHeight || 48;
  }, []);

  const getDefaultPanelTop = useCallback(() => {
    if (!containerRef.current) return 300;
    return containerRef.current.clientHeight * 0.75;
  }, []);

  const effectivePanelTop = panelTop !== null ? panelTop : getDefaultPanelTop();

  const getRedLineTargetY = useCallback(() => {
    const topBarH = getTopBarHeight();
    const panelInScroll = effectivePanelTop - topBarH;
    const pieSize = Math.max(24, Math.min(trackWidth * 0.6, 48));
    const gap = PIE_OFFSET_BELOW_RED_LINE + pieSize + 12;
    return panelInScroll - gap;
  }, [effectivePanelTop, getTopBarHeight, trackWidth]);

  const pinRedLineToPanel = useCallback((pph?: number) => {
    if (!scrollRef.current) return;
    const usePPH = pph ?? pixelsPerHour;
    const targetY = getRedLineTargetY();
    const st = calcScrollTopForRedLine(usePPH, targetY);
    scrollRef.current.scrollTop = Math.max(0, st);
  }, [pixelsPerHour, getRedLineTargetY]);

  // When not dismissed, continuously pin red line to panel edge
  useEffect(() => {
    if (!isPanelDismissed && !panelDragRef.current.isDragging) {
      pinRedLineToPanel();
    }
  }, [isPanelDismissed, effectivePanelTop, pixelsPerHour, pinRedLineToPanel]);

  // When transitioning from dismissed to non-dismissed, reset scale
  useEffect(() => {
    if (prevDismissedRef.current && !isPanelDismissed) {
      setPixelsPerHour(DEFAULT_PPH);
      setTrackWidth(DEFAULT_TW);
    }
    prevDismissedRef.current = isPanelDismissed;
  }, [isPanelDismissed]);

  // Initial scroll
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (!initialScrollDone.current && scrollRef.current) {
      pinRedLineToPanel();
      // Sync scrollY state for virtualization on mount
      setScrollY(scrollRef.current.scrollTop);
      initialScrollDone.current = true;
    }
  }, [pinRedLineToPanel]);

  // Scroll listener: block vertical scroll in locked mode + track scrollY
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      // Track scroll position for virtualized labels
      cancelAnimationFrame(scrollRAFRef.current);
      scrollRAFRef.current = requestAnimationFrame(() => {
        setScrollY(el.scrollTop);
      });

      if (!isPanelDismissed && !panelDragRef.current.isDragging) {
        const targetY = getRedLineTargetY();
        const expectedTop = Math.max(0, calcScrollTopForRedLine(pixelsPerHour, targetY));
        if (Math.abs(el.scrollTop - expectedTop) > 1) {
          el.scrollTop = expectedTop;
        }
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(scrollRAFRef.current);
    };
  }, [isPanelDismissed, pixelsPerHour, getRedLineTargetY]);

  // Pinch-to-zoom anchored at finger midpoint
  useEffect(() => {
    const container = gestureContainerRef.current;
    if (!container) return;
    let isPinching = false;
    let initialDistX = 0;
    let initialDistY = 0;
    let startPPH = DEFAULT_PPH;
    let startTW = DEFAULT_TW;
    // The hfe (hours-from-epoch) at the midpoint Y at pinch start
    let anchorHfe = 0;
    // The midpoint Y position relative to the scroll container viewport at pinch start
    let anchorScreenY = 0;
    // The horizontal scroll offset and midpoint X at pinch start
    let startScrollLeft = 0;
    let anchorScreenX = 0;
    let startScrollTop = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true;
        initialDistX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
        initialDistY = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
        startPPH = scaleRef.current.pph;
        startTW = scaleRef.current.tw;

        const el = scrollRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          // Midpoint in screen coords
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          anchorScreenY = midY - rect.top;
          anchorScreenX = midX - rect.left;
          startScrollTop = el.scrollTop;
          startScrollLeft = el.scrollLeft;

          // Compute the hfe at the midpoint: content position = scrollTop + screenY offset
          const contentY = el.scrollTop + anchorScreenY;
          // contentTop = (TOTAL_HOURS - hfe) * pph + HEADER_OFFSET  =>  hfe = TOTAL_HOURS - (contentY - HEADER_OFFSET) / pph
          anchorHfe = TOTAL_HOURS - (contentY - HEADER_OFFSET) / startPPH;
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const currentDistX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
        const currentDistY = Math.abs(e.touches[0].clientY - e.touches[1].clientY);

        const el = scrollRef.current;

        // Compute new PPH
        let newPPH = startPPH;
        if (initialDistY > 20) {
          newPPH = Math.max(0.005, Math.min(startPPH * (currentDistY / initialDistY), MAX_PPH));
          setPixelsPerHour(newPPH);
        }

        // Compute new TW
        let newTW = startTW;
        if (initialDistX > 20) {
          newTW = Math.max(60, Math.min(startTW * (currentDistX / initialDistX), 300));
          setTrackWidth(newTW);
        }

        // Adjust scroll so the anchor point stays under the finger midpoint
        if (el) {
          // Vertical: the content Y of the anchor hfe at the new PPH
          const newContentY = (TOTAL_HOURS - anchorHfe) * newPPH + HEADER_OFFSET;
          // We want newContentY to be at anchorScreenY in the viewport => scrollTop = newContentY - anchorScreenY
          el.scrollTop = Math.max(0, newContentY - anchorScreenY);

          // Horizontal: scale the content position proportionally
          // Content X at anchor = startScrollLeft + anchorScreenX (at old TW)
          // At new TW, content scales by newTW/startTW
          if (initialDistX > 20 && startTW > 0) {
            const contentX = startScrollLeft + anchorScreenX;
            const newContentX = contentX * (newTW / startTW);
            el.scrollLeft = Math.max(0, newContentX - anchorScreenX);
          }
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) isPinching = false;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  // ── Visible range (for virtualization) ──────────────────────────────
  const viewportHeight = scrollRef.current?.clientHeight || 700;
  const bufferPx = viewportHeight;
  // hfe at the top of viewport (most future)
  const hfeAtTop = TOTAL_HOURS - Math.max(0, scrollY - HEADER_OFFSET) / pixelsPerHour;
  // hfe at the bottom of viewport (most past)
  const hfeAtBot = TOTAL_HOURS - (scrollY + viewportHeight - HEADER_OFFSET) / pixelsPerHour;
  const bufferHfe = bufferPx / pixelsPerHour;
  const visHfeMin = Math.max(0, hfeAtBot - bufferHfe);
  const visHfeMax = Math.min(TOTAL_HOURS, hfeAtTop + bufferHfe);
  // Quantize to reduce memo recomputations
  const qVisMin = Math.floor(visHfeMin / 24) * 24;
  const qVisMax = Math.ceil(visHfeMax / 24) * 24;

  // ── Time axis labels (virtualized) ─────────────────────────────────
  const timeAxisLabels = useMemo(() => {
    const labels: { hfe: number; text: string; type: 'year' | 'month' | 'day' | 'hour' }[] = [];

    // Year labels — always rendered (100 items max)
    for (let y = EPOCH_YEAR; y <= EPOCH_YEAR + 100; y++) {
      const d = new Date(y, 0, 1);
      const hfe = hoursFromEpoch(d);
      if (hfe >= qVisMin - 24 * 366 && hfe <= qVisMax + 24 * 366) {
        labels.push({ hfe, text: `${y}`, type: 'year' });
      }
    }

    // Month labels — show when zoomed enough
    if (pixelsPerHour >= 0.03) {
      const startY = Math.max(EPOCH_YEAR, EPOCH_YEAR + Math.floor((qVisMin - 24 * 60) / (24 * 365.25)));
      const endY = Math.min(EPOCH_YEAR + 100, EPOCH_YEAR + Math.ceil((qVisMax + 24 * 60) / (24 * 365.25)));
      for (let y = startY; y <= endY; y++) {
        for (let m = 0; m < 12; m++) {
          const d = new Date(y, m, 1);
          const hfe = hoursFromEpoch(d);
          if (hfe < qVisMin - 24 * 31 || hfe > qVisMax + 24 * 31) continue;
          if (m === 0) continue; // Jan 1 covered by year label
          // At very low zoom, only show every 3rd month
          if (pixelsPerHour < 0.1 && m % 3 !== 0) continue;
          labels.push({ hfe, text: MONTHS_SHORT[m], type: 'month' });
        }
      }
    }

    // Day labels — only in visible range
    if (pixelsPerHour >= 1) {
      const rangeStartMs = EPOCH_START.getTime() + Math.max(0, qVisMin) * 3600000;
      const rangeEndMs = EPOCH_START.getTime() + Math.min(TOTAL_HOURS, qVisMax) * 3600000;
      const step = pixelsPerHour >= 5 ? 1 : pixelsPerHour >= 2 ? 3 : 7;
      const d = new Date(rangeStartMs);
      d.setHours(0, 0, 0, 0);
      const endDate = new Date(rangeEndMs);
      while (d <= endDate) {
        if (d.getDate() !== 1) { // skip 1st (covered by month)
          if (step === 1 || d.getDate() % step === 1) {
            const hfe = hoursFromEpoch(d);
            labels.push({ hfe, text: `${DAYS_OF_WEEK[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}`, type: 'day' });
          }
        }
        d.setDate(d.getDate() + 1);
      }
    }

    // Hour labels — only in visible range
    if (pixelsPerHour >= 10) {
      const rangeStartMs = EPOCH_START.getTime() + Math.max(0, qVisMin) * 3600000;
      const rangeEndMs = EPOCH_START.getTime() + Math.min(TOTAL_HOURS, qVisMax) * 3600000;
      const step = pixelsPerHour >= 16 ? 1 : pixelsPerHour >= 14 ? 2 : pixelsPerHour >= 12 ? 3 : pixelsPerHour >= 11 ? 6 : 12;
      const d = new Date(rangeStartMs);
      d.setMinutes(0, 0, 0);
      const endDate = new Date(rangeEndMs);
      while (d <= endDate) {
        const h = d.getHours();
        if (h !== 0 && h % step === 0) {
          labels.push({ hfe: hoursFromEpoch(d), text: `${h.toString().padStart(2, '0')}:00`, type: 'hour' });
        }
        d.setTime(d.getTime() + step * 3600000);
      }
    }

    return labels;
  }, [pixelsPerHour, qVisMin, qVisMax]);

  // ── Bedtime overlays (virtualized) ─────────────────────────────────
  const bedtimeOverlays = useMemo(() => {
    const overlays: { topPx: number; heightPx: number; key: string }[] = [];
    const dayMin = Math.max(0, Math.floor(qVisMin / 24) - 1);
    const dayMax = Math.min(Math.floor(TOTAL_HOURS / 24), Math.ceil(qVisMax / 24) + 1);

    for (let dayIdx = dayMin; dayIdx <= dayMax; dayIdx++) {
      // 0:00 - 7:00 AM block (7 hours)
      const amStartHfe = dayIdx * 24;
      const amEndHfe = dayIdx * 24 + 7;
      const amTop = contentTop(amEndHfe, pixelsPerHour);
      const amHeight = 7 * pixelsPerHour;
      overlays.push({ topPx: amTop, heightPx: amHeight, key: `bed-am-${dayIdx}` });

      // 23:00 - 24:00 PM block (1 hour)
      const pmStartHfe = dayIdx * 24 + 23;
      const pmEndHfe = dayIdx * 24 + 24;
      const pmTop = contentTop(pmEndHfe, pixelsPerHour);
      const pmHeight = 1 * pixelsPerHour;
      overlays.push({ topPx: pmTop, heightPx: pmHeight, key: `bed-pm-${dayIdx}` });
    }
    return overlays;
  }, [pixelsPerHour, qVisMin, qVisMax]);

  // ── Track completion ────────────────────────────────────────────────
  const trackCompletion = useMemo(() => {
    const nowHfe = hoursFromEpoch(new Date());

    return tracks.map(track => {
      // Track background progress: ratio of elapsed lifespan (start to now) vs total lifespan (start to cutoff)
      let trackStartHfe: number;
      let trackEndHfe: number;

      if (track.startDate) {
        // Absolute tracks
        trackStartHfe = hoursFromEpoch(new Date(track.startDate));
        if (track.indefinite) {
          trackEndHfe = TOTAL_HOURS;
        } else if (track.cutoffDate) {
          trackEndHfe = hoursFromEpoch(new Date(track.cutoffDate));
        } else {
          trackEndHfe = trackStartHfe + 7 * 24;
        }
      } else {
        // Legacy weekly tracks: use week-relative start/cutoff
        trackStartHfe = weekHfe(track.startDay, track.startTime);
        trackEndHfe = weekHfe(track.cutoffDay, track.cutoffTime);
        if (trackEndHfe <= trackStartHfe) trackEndHfe += 7 * 24;
      }

      const totalSpan = trackEndHfe - trackStartHfe;
      if (totalSpan <= 0) return { trackId: track.id, pct: 0 };

      const elapsed = Math.max(0, Math.min(totalSpan, nowHfe - trackStartHfe));
      return { trackId: track.id, pct: Math.round((elapsed / totalSpan) * 100) };
    });
  }, [tracks, events]);

  // ── Today's todos ───────────────────────────────────────────────────
  const todaysTodos = useMemo(() => {
    const today = currentDate.getDay();
    const todayNowHfe = hoursFromEpoch(new Date());
    const fromEvents: TodoItem[] = events
      .filter(e => {
        if (e.dayOfWeek === today) return true;
        if (e.endDayOfWeek !== undefined && e.endDayOfWeek !== e.dayOfWeek) {
          let startD = e.dayOfWeek;
          let endD = e.endDayOfWeek;
          if (endD < startD) endD += 7;
          const todayN = today < startD ? today + 7 : today;
          return todayN >= startD && todayN <= endD;
        }
        return false;
      })
      .map(e => {
        const track = tracks.find(t => t.id === e.trackId);

        // Event block progress: how much of this specific event block has elapsed
        const evStartHfe = weekHfe(e.dayOfWeek, e.startTime);
        let evEndHfe = evStartHfe + 0.5;
        if (e.endTime) {
          let endDay = e.endDayOfWeek !== undefined ? e.endDayOfWeek : e.dayOfWeek;
          if (endDay < e.dayOfWeek) endDay += 7;
          evEndHfe = weekHfe(endDay, e.endTime);
          if (evEndHfe <= evStartHfe) evEndHfe += 24;
        }
        const evDuration = evEndHfe - evStartHfe;
        const evElapsed = Math.max(0, Math.min(evDuration, todayNowHfe - evStartHfe));
        const evPct = evDuration > 0 ? Math.round((evElapsed / evDuration) * 100) : 0;

        return {
          id: `ev-${e.id}`,
          title: e.title,
          description: `${e.startTime}${e.endTime ? ' - ' + e.endTime : ''} · ${track?.name || ''}`,
          percentage: evPct,
          isTemporary: false,
          completed: evPct >= 100,
          sourceTrackId: e.trackId,
          _startHfe: evStartHfe,
          color: track ? (track.customColor || THEME_HEX[track.theme]) : undefined,
        };
      });

    // Sort: in-progress first, then upcoming (soonest first), then completed last
    const sorted = [...fromEvents].sort((a, b) => {
      // Category: 0 = in-progress, 1 = upcoming (not started), 2 = completed
      const cat = (item: typeof a) => {
        if (item.completed) return 2;
        if (item.percentage > 0) return 0; // in-progress
        return 1; // upcoming (not started yet)
      };
      const catA = cat(a);
      const catB = cat(b);
      if (catA !== catB) return catA - catB;
      // Within same category: sort by start time proximity to now
      const distA = a._startHfe - todayNowHfe;
      const distB = b._startHfe - todayNowHfe;
      if (catA === 1) return distA - distB; // upcoming: soonest first
      return distB - distA; // in-progress/completed: most recent first
    });

    return [...sorted, ...tempTodos];
  }, [events, tracks, tempTodos, currentDate]);

  const handleAddTempTodo = (title: string, description: string) => {
    setTempTodos(prev => [
      ...prev,
      { id: `temp-${Date.now()}`, title, description: description || undefined, percentage: 0, isTemporary: true, completed: false },
    ]);
  };

  const handleToggleTodo = (id: string) => {
    setTempTodos(prev => prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const handleDismissTodo = (id: string, action: 'complete' | 'delete') => {
    // Remove temp todos; event-based todos are just visually dismissed
    setTempTodos(prev => prev.filter(t => t.id !== id));
    // Future: track counts of completed vs deleted vs expired items
  };

  // Filter tracks by search
  const filteredTracks = searchQuery
    ? tracks.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tracks;

  // ── Panel drag handlers ─────────────────────────────────────────────
  const onPanelTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const currentTop = panelTop !== null ? panelTop : getDefaultPanelTop();
    panelDragRef.current = { isDragging: true, startY: e.touches[0].clientY, startTop: currentTop };
  }, [panelTop, getDefaultPanelTop]);

  const onPanelTouchMove = useCallback((e: React.TouchEvent) => {
    if (!panelDragRef.current.isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const deltaY = e.touches[0].clientY - panelDragRef.current.startY;
    const newTop = panelDragRef.current.startTop + deltaY;
    const containerHeight = containerRef.current?.clientHeight || 600;
    const clamped = Math.max(60, Math.min(newTop, containerHeight - PANEL_HANDLE_HEIGHT));
    setPanelTop(clamped);
    setIsPanelDismissed(clamped >= containerHeight - PANEL_HANDLE_HEIGHT - 10);
  }, []);

  const onPanelTouchEnd = useCallback(() => {
    panelDragRef.current.isDragging = false;
    const containerHeight = containerRef.current?.clientHeight || 600;
    const currentTop = panelTop ?? getDefaultPanelTop();
    const dismissPos = containerHeight - PANEL_HANDLE_HEIGHT;
    if (currentTop >= dismissPos - 10) {
      setPanelTop(dismissPos);
      setIsPanelDismissed(true);
    } else {
      pinRedLineToPanel();
    }
  }, [panelTop, getDefaultPanelTop, pinRedLineToPanel]);

  const onTrackAreaDoubleClick = useCallback(() => {
    if (isPanelDismissed) {
      setPanelTop(null);
      setIsPanelDismissed(false);
    }
  }, [isPanelDismissed]);

  const onPanelMouseDown = useCallback((e: React.MouseEvent) => {
    const currentTop = panelTop !== null ? panelTop : getDefaultPanelTop();
    panelDragRef.current = { isDragging: true, startY: e.clientY, startTop: currentTop };
    const onMouseMove = (ev: MouseEvent) => {
      if (!panelDragRef.current.isDragging) return;
      const deltaY = ev.clientY - panelDragRef.current.startY;
      const newTop = panelDragRef.current.startTop + deltaY;
      const containerHeight = containerRef.current?.clientHeight || 600;
      const clamped = Math.max(60, Math.min(newTop, containerHeight - PANEL_HANDLE_HEIGHT));
      setPanelTop(clamped);
      setIsPanelDismissed(clamped >= containerHeight - PANEL_HANDLE_HEIGHT - 10);
    };
    const onMouseUp = () => {
      panelDragRef.current.isDragging = false;
      const containerHeight = containerRef.current?.clientHeight || 600;
      const ct = panelTop ?? getDefaultPanelTop();
      const dismissPos = containerHeight - PANEL_HANDLE_HEIGHT;
      if (ct >= dismissPos - 10) {
        setPanelTop(dismissPos);
        setIsPanelDismissed(true);
      } else {
        pinRedLineToPanel();
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelTop, getDefaultPanelTop, pinRedLineToPanel]);

  // ── Compute now-related positions ───────────────────────────────────
  const nowHfe = hoursFromEpoch(new Date());
  const redLineTopInContent = contentTop(nowHfe, pixelsPerHour) - HEADER_OFFSET; // relative to tracks container

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden relative">
      {/* Top Bar */}
      <div ref={topBarRef} className="shrink-0 flex items-center gap-2 px-3 py-2 bg-[#D0D0D0] z-50">
        <button onClick={onOpenSidebar} className="p-1.5 hover:bg-[#C0C0C0] rounded">
          <Menu size={20} strokeWidth={3} className="text-[#666]" />
        </button>

        <div className="flex-1 flex items-center bg-[#999] rounded-full px-3 py-1.5">
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#E8E8E8] placeholder-[#C0C0C0] focus:outline-none"
          />
          <Search size={14} className="text-[#C0C0C0]" />
        </div>

        <button onClick={() => setIsNewTrackModalOpen(true)} className="p-1.5 hover:bg-[#C0C0C0] rounded">
          <Plus size={20} strokeWidth={3} className="text-[#666]" />
        </button>
      </div>

      {/* Event Track Panel */}
      <div
        ref={gestureContainerRef}
        className="flex-1 min-h-0 overflow-hidden relative"
        onDoubleClick={onTrackAreaDoubleClick}
      >
        <div
          ref={scrollRef}
          className="h-full p-1"
          style={{
            overflowX: 'auto',
            overflowY: isPanelDismissed ? 'auto' : 'hidden',
          }}
        >
          <div
            className="flex min-w-max relative gap-1"
            style={{ height: TOTAL_HOURS * pixelsPerHour + HEADER_OFFSET }}
          >
            {/* Time Axis */}
            <div className="w-20 flex-shrink-0 flex flex-col relative z-20">
              <div className="h-[48px] sticky top-0 z-40 pointer-events-none" />
              <div className="relative flex-1">
                <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-[#B0B0B0]" />
                {timeAxisLabels.map((label, i) => {
                  const topPos = (TOTAL_HOURS - label.hfe) * pixelsPerHour;
                  const isYear = label.type === 'year';
                  const isMonth = label.type === 'month';
                  const isDay = label.type === 'day';

                  return (
                    <div
                      key={`${label.type}-${i}`}
                      className={cn(
                        'absolute right-0 flex items-center justify-end w-full',
                        isYear ? 'z-30' : isMonth ? 'z-25' : isDay ? 'z-20' : 'z-10'
                      )}
                      style={{ top: topPos, transform: 'translateY(-50%)' }}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            'tracking-widest whitespace-nowrap',
                            isYear ? 'text-[10px]' : isMonth ? 'text-[9px]' : 'text-[8px]'
                          )}
                          style={{
                            color: isYear ? '#555' : isMonth ? '#777' : '#999',
                            fontWeight: isYear ? 900 : isMonth ? 800 : 700,
                          }}
                        >
                          {label.text}
                        </span>
                        <div className={cn('bg-[#B0B0B0] h-[2px]', isYear ? 'w-3' : isMonth ? 'w-2' : 'w-1')} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tracks */}
            <div className="flex flex-1 relative gap-1 pr-2">
              {/* Bedtime overlays (virtualized) */}
              {pixelsPerHour >= 3 && bedtimeOverlays.map(o => (
                <div
                  key={o.key}
                  className="absolute left-0 right-0 pointer-events-none z-20"
                  style={{
                    top: o.topPx,
                    height: o.heightPx,
                    backgroundImage: 'radial-gradient(circle, rgba(75,0,210,1) 0.5px, transparent 0.5px)',
                    backgroundSize: '4px 4px',
                  }}
                />
              ))}

              <CurrentTimeLine pixelsPerHour={pixelsPerHour} />

              {/* Pie chart overlay layer */}
              {filteredTracks.map((track, idx) => {
                const comp = trackCompletion.find(c => c.trackId === track.id);
                const pieSize = Math.max(24, Math.min(trackWidth * 0.6, 48));
                const trackLeft = idx * (trackWidth + 4);

                return (
                  <div
                    key={`pie-${track.id}`}
                    className="absolute z-[25] flex items-center justify-center pointer-events-none"
                    style={{
                      top: redLineTopInContent + HEADER_OFFSET + PIE_OFFSET_BELOW_RED_LINE,
                      left: trackLeft,
                      width: trackWidth,
                    }}
                  >
                    <div className="pointer-events-auto bg-[#E8E8E8]/80 rounded-full p-[2px]">
                      <PieChart percentage={comp?.pct || 0} color={track.customColor || THEME_HEX[track.theme]} size={pieSize} indefinite={!!track.indefinite} />
                    </div>
                  </div>
                );
              })}

              {filteredTracks.map(track => {
                const themeLightBg = THEME_STYLES[track.theme].lightBg;
                const isAbsolute = !!track.startDate;

                // ── Track lifespan (light background) ──
                let lifespanStartHfe: number;
                let lifespanEndHfe: number;

                if (isAbsolute) {
                  // Absolute tracks: use real dates
                  lifespanStartHfe = hoursFromEpoch(new Date(track.startDate!));
                  if (track.indefinite) {
                    lifespanEndHfe = TOTAL_HOURS;
                  } else if (track.cutoffDate) {
                    lifespanEndHfe = hoursFromEpoch(new Date(track.cutoffDate));
                  } else {
                    // Fallback: 1 week from start
                    lifespanEndHfe = lifespanStartHfe + 7 * 24;
                  }
                } else {
                  // Legacy weekly tracks
                  lifespanStartHfe = weekHfe(track.startDay, track.startTime);
                  lifespanEndHfe = weekHfe(track.cutoffDay, track.cutoffTime);
                  if (lifespanEndHfe <= lifespanStartHfe) lifespanEndHfe += 7 * 24;
                }

                const lifespanTopPx = contentTop(lifespanEndHfe, pixelsPerHour) - HEADER_OFFSET;
                const lifespanHeightPx = (lifespanEndHfe - lifespanStartHfe) * pixelsPerHour;

                // ── Compute event block instances (cyclic replication) ──
                const trackEvents = events.filter(e => e.trackId === track.id);
                const eventInstances: { event: TrackEvent; topPx: number; heightPx: number; isPast: boolean; instanceKey: string }[] = [];

                if (isAbsolute) {
                  // For absolute tracks, replicate weekly events across all visible weeks
                  // Find which weeks overlap with both the visible range and the lifespan
                  const weekMs = 7 * 24 * 3600000;
                  const lifespanStartMs = EPOCH_START.getTime() + lifespanStartHfe * 3600000;
                  const lifespanEndMs = EPOCH_START.getTime() + lifespanEndHfe * 3600000;
                  const visStartMs = EPOCH_START.getTime() + visHfeMin * 3600000;
                  const visEndMs = EPOCH_START.getTime() + visHfeMax * 3600000;

                  // Clamp to lifespan
                  const rangeStartMs = Math.max(lifespanStartMs, visStartMs);
                  const rangeEndMs = Math.min(lifespanEndMs, visEndMs);

                  if (rangeStartMs < rangeEndMs) {
                    // Find the Sunday 00:00 of the first week in range
                    const firstDate = new Date(rangeStartMs);
                    firstDate.setDate(firstDate.getDate() - firstDate.getDay());
                    firstDate.setHours(0, 0, 0, 0);
                    let weekStartMs = firstDate.getTime();

                    // Iterate weeks
                    while (weekStartMs < rangeEndMs + weekMs) {
                      const weekStartHfe = (weekStartMs - EPOCH_START.getTime()) / 3600000;

                      for (const event of trackEvents) {
                        const [sh, sm] = event.startTime.split(':').map(Number);
                        const evStartHfe = weekStartHfe + event.dayOfWeek * 24 + sh + sm / 60;

                        let evEndHfe = evStartHfe + 0.5;
                        if (event.endTime) {
                          const [eh, em] = event.endTime.split(':').map(Number);
                          let endDay = event.endDayOfWeek !== undefined ? event.endDayOfWeek : event.dayOfWeek;
                          if (endDay < event.dayOfWeek) endDay += 7;
                          evEndHfe = weekStartHfe + endDay * 24 + eh + em / 60;
                          if (evEndHfe <= evStartHfe) evEndHfe += 24;
                        }

                        // Skip if outside lifespan or visible range
                        if (evEndHfe < visHfeMin || evStartHfe > visHfeMax) continue;
                        if (evEndHfe < lifespanStartHfe || evStartHfe > lifespanEndHfe) continue;

                        // Clamp to lifespan boundaries
                        const clampedStart = Math.max(evStartHfe, lifespanStartHfe);
                        const clampedEnd = Math.min(evEndHfe, lifespanEndHfe);

                        const topPx = contentTop(clampedEnd, pixelsPerHour) - HEADER_OFFSET;
                        const heightPx = (clampedEnd - clampedStart) * pixelsPerHour;
                        const isPast = topPx >= redLineTopInContent;

                        eventInstances.push({
                          event,
                          topPx,
                          heightPx,
                          isPast,
                          instanceKey: `${event.id}-w${Math.round(weekStartHfe)}`,
                        });
                      }

                      weekStartMs += weekMs;
                    }
                  }
                } else {
                  // Legacy: single week positioning
                  for (const event of trackEvents) {
                    const evStartHfe = weekHfe(event.dayOfWeek, event.startTime);
                    let evEndHfe = evStartHfe + 0.5;
                    if (event.endTime) {
                      let endDay = event.endDayOfWeek !== undefined ? event.endDayOfWeek : event.dayOfWeek;
                      if (endDay < event.dayOfWeek) endDay += 7;
                      evEndHfe = weekHfe(endDay, event.endTime);
                      if (endDay === event.dayOfWeek && evEndHfe <= evStartHfe) evEndHfe += 24;
                    }
                    const topPx = contentTop(evEndHfe, pixelsPerHour) - HEADER_OFFSET;
                    const heightPx = (evEndHfe - evStartHfe) * pixelsPerHour;
                    const isPast = topPx >= redLineTopInContent;
                    eventInstances.push({ event, topPx, heightPx, isPast, instanceKey: event.id });
                  }
                }

                return (
                  <div key={track.id} className="relative flex flex-col z-10 shrink-0 bg-[#E0E0E0]" style={{ width: trackWidth }}
                    onTouchStart={(e) => {
                      if (e.touches.length === 1) {
                        handleTrackLongPressStart(track.id, e.touches[0].clientX, e.touches[0].clientY);
                      }
                    }}
                    onTouchEnd={clearLongPress}
                    onTouchMove={clearLongPress}
                    onMouseDown={(e) => handleTrackLongPressStart(track.id, e.clientX, e.clientY)}
                    onMouseUp={clearLongPress}
                    onMouseLeave={clearLongPress}
                  >
                    <div className="h-[48px] sticky top-0 border-b-2 border-[#A0A0A0] z-40 flex items-center justify-center overflow-hidden bg-transparent px-1">
                      <div className="text-[10px] uppercase tracking-wider truncate w-full text-center" style={{ fontWeight: 800 }}>
                        {track.name}
                      </div>
                    </div>
                    <div className="relative flex-1">
                      {/* Light track background (lifespan) */}
                      <div
                        className={cn('absolute left-0 right-0 z-[1] pointer-events-none', track.customColor ? '' : themeLightBg)}
                        style={{ top: lifespanTopPx, height: lifespanHeightPx, ...(track.customColor ? { backgroundColor: lightenHex(track.customColor, 0.65) } : {}) }}
                      />
                      {/* Event blocks */}
                      {eventInstances.map(({ event, topPx, heightPx, isPast, instanceKey }) => (
                        <EventBlock
                          key={instanceKey}
                          event={event}
                          track={track}
                          topPx={topPx}
                          heightPx={heightPx}
                          isPast={isPast}
                          pixelsPerHour={pixelsPerHour}
                        />
                      ))}
                      {/* Past overlay */}
                      <div
                        className="absolute left-0 right-0 bottom-0 z-[5] pointer-events-none"
                        style={{
                          top: redLineTopInContent,
                          background: 'linear-gradient(to bottom, rgba(200,200,200,0.7) 0%, rgba(190,190,190,0.85) 100%)',
                        }}
                      />
                      <div
                        className="absolute z-[100] flex items-center justify-center pointer-events-none"
                        style={{
                          top: redLineTopInContent + PIE_OFFSET_BELOW_RED_LINE,
                          left: '50%',
                          transform: 'translateX(-50%)',
                        }}
                      >
                        {/* Pie chart rendered in separate overlay layer */}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Affairs Overlay Panel */}
      <div
        className="absolute left-0 right-0 z-40 flex flex-col"
        style={{
          top: effectivePanelTop,
          bottom: 0,
          transition: panelDragRef.current.isDragging ? 'none' : 'top 0.3s ease-out',
        }}
      >
        <div
          className="cursor-grab active:cursor-grabbing touch-none select-none"
          onTouchStart={onPanelTouchStart}
          onTouchMove={onPanelTouchMove}
          onTouchEnd={onPanelTouchEnd}
          onMouseDown={onPanelMouseDown}
        >
          <div className="bg-[#D0D0D0]/85 backdrop-blur-sm rounded-t-2xl">
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 bg-[#999] rounded-full" />
            </div>
            <div className="text-center py-1">
              <span className="text-sm tracking-wider" style={{ color: '#666', fontWeight: 600 }}>Today</span>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-[#D0D0D0]/85 backdrop-blur-sm">
          <TodaysAffairs todos={todaysTodos} onAddTodo={handleAddTempTodo} onToggleTodo={handleToggleTodo} onDismissTodo={handleDismissTodo} />
        </div>
      </div>

      {/* New Track Modal */}
      {isNewTrackModalOpen && (
        <NewTrackModal
          isOpen={isNewTrackModalOpen}
          onClose={() => setIsNewTrackModalOpen(false)}
          onCreateTrack={handleCreateTrack}
          existingEvents={events}
        />
      )}

      {/* Long-press delete popup */}
      {deleteTrackId && (
        <div
          className="absolute inset-0 z-[200]"
          onClick={() => setDeleteTrackId(null)}
          onTouchEnd={() => setDeleteTrackId(null)}
        >
          <div
            className="absolute"
            style={{
              left: deletePopupPos.x,
              top: deletePopupPos.y,
              transform: 'translate(-50%, -50%)',
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <button
              className="flex items-center justify-center w-11 h-11 rounded-full bg-[#E01A22] shadow-lg active:scale-90 transition-transform"
              onClick={() => handleDeleteTrack(deleteTrackId)}
            >
              <Trash2 size={20} className="text-[#E8E8E8]" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}