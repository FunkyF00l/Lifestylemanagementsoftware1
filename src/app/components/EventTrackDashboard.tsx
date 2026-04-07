import { useEffect, useRef, useState, useMemo } from 'react';
import { TRACKS, EVENTS, THEME_STYLES, TrackEvent, ThemeType } from '../data';
import { EventBlock } from './EventBlock';
import { Plus, Calendar, Menu, X } from 'lucide-react';
import { cn } from '../utils/cn';

const HEADER_OFFSET = 60;
const TOTAL_HOURS = 24 * 7; // Full Week
const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function CurrentTimeLine({ pixelsPerHour, scrollRef }: { pixelsPerHour: number, scrollRef: React.RefObject<HTMLDivElement> }) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalHours = (day * 24) + hours + (minutes / 60);
    const top = ((TOTAL_HOURS - totalHours) * pixelsPerHour) + HEADER_OFFSET;

    useEffect(() => {
        if (scrollRef.current) {
            const containerHeight = scrollRef.current.clientHeight;
            // 75% down the container (lower quarter)
            const targetScrollTop = top - (containerHeight * 0.75);
            scrollRef.current.scrollTo({ top: targetScrollTop, behavior: 'instant' });
        }
    }, [top, scrollRef]);

    return (
        <div className="absolute left-[-20px] right-[-20px] z-30 pointer-events-none flex items-center" style={{ top, transform: 'translateY(-50%)' }}>
            <div className="h-[4px] w-full bg-[#E01A22]" />
        </div>
    );
}

export function EventTrackDashboard() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const gestureContainerRef = useRef<HTMLDivElement>(null);
    const [currentDate] = useState(new Date());

    const [tracks, setTracks] = useState(TRACKS);
    const [events, setEvents] = useState(EVENTS);

    // Modal states
    const [isNewTrackModalOpen, setIsNewTrackModalOpen] = useState(false);

    const [newTrackName, setNewTrackName] = useState('');
    const [newTrackTheme, setNewTrackTheme] = useState<ThemeType>('blue');
    const [newEventEndDay, setNewEventEndDay] = useState(currentDate.getDay());
    const [newEventEndTime, setNewEventEndTime] = useState('23:59');

    const handleCreateTrack = () => {
        if (!newTrackName) return;
        
        const trackId = `t${Date.now()}`;
        const newTrack = {
            id: trackId,
            name: newTrackName,
            theme: newTrackTheme
        };
        
        setTracks([...tracks, newTrack]);

        const now = new Date();
        const startDay = now.getDay();
        const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const newEvent: TrackEvent = {
            id: `e${Date.now()}`,
            trackId: trackId,
            title: newTrackName,
            type: 'regular',
            dayOfWeek: startDay,
            startTime: startTime,
            endTime: newEventEndTime,
            endDayOfWeek: newEventEndDay
        };
        
        setEvents([...events, newEvent]);

        setIsNewTrackModalOpen(false);
        setNewTrackName('');
    };

    // Calculate dates for the current week (Sunday to Saturday)
    const weekDates = useMemo(() => {
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d.getDate();
        });
    }, [currentDate]);

    // Scale state - zoomed out a bit more by default to see a full day easily
    const [pixelsPerHour, setPixelsPerHour] = useState(60);
    const [trackWidth, setTrackWidth] = useState(150);

    const scaleRef = useRef({ pph: 60, tw: 150 });
    useEffect(() => { 
        scaleRef.current = { pph: pixelsPerHour, tw: trackWidth }; 
    }, [pixelsPerHour, trackWidth]);

    // Pinch-to-zoom gesture handling
    useEffect(() => {
        const container = gestureContainerRef.current;
        if (!container) return;

        let isPinching = false;
        let initialDistX = 0;
        let initialDistY = 0;
        let startPPH = 60;
        let startTW = 150;

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                isPinching = true;
                initialDistX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
                initialDistY = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
                startPPH = scaleRef.current.pph;
                startTW = scaleRef.current.tw;
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (isPinching && e.touches.length === 2) {
                e.preventDefault(); 

                const currentDistX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
                const currentDistY = Math.abs(e.touches[0].clientY - e.touches[1].clientY);

                if (initialDistX > 20) {
                    const scaleX = currentDistX / initialDistX;
                    const newTw = Math.max(80, Math.min(startTW * scaleX, 400));
                    setTrackWidth(newTw);
                }

                if (initialDistY > 20) {
                    const scaleY = currentDistY / initialDistY;
                    const newPph = Math.max(5, Math.min(startPPH * scaleY, 300));
                    setPixelsPerHour(newPph);
                }
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            if (e.touches.length < 2) {
                isPinching = false;
            }
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

    const formattedDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }).format(currentDate).toUpperCase();

    return (
        <div className="flex flex-col h-screen bg-[#F4F4F4] font-sans text-black overflow-hidden selection:bg-[#F9D115]">
            <header className="flex items-center justify-between px-3 md:px-8 py-3 md:py-4 bg-white border-b-[6px] border-black z-50 shrink-0">
                <div className="flex items-center gap-2 md:gap-8">
                    <button className="md:hidden p-1 text-black hover:bg-[#F9D115] transition-none border-[4px] border-transparent hover:border-black">
                        <Menu size={20} strokeWidth={4} />
                    </button>
                    <h1 className="text-xl md:text-4xl font-black uppercase tracking-tighter">
                        Chrono<span className="text-[#E01A22]">Flow</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2 md:gap-6">
                    <div className="hidden sm:flex items-center gap-2 bg-white border-[4px] border-black px-3 py-1.5">
                        <Calendar size={16} strokeWidth={3} />
                        <span className="text-xs md:text-sm font-black tracking-widest">{formattedDate}</span>
                    </div>
                    
                    <button onClick={() => setIsNewTrackModalOpen(true)} className="flex items-center gap-1 px-3 py-1.5 md:px-6 md:py-3 bg-[#0052C2] text-white text-xs md:text-sm font-black uppercase tracking-widest border-[4px] border-black hover:bg-[#003B8C] transition-none active:translate-y-1">
                        <Plus size={16} strokeWidth={4} /> 
                        <span className="hidden sm:inline">TRACK</span>
                    </button>
                </div>
            </header>

            <div 
                ref={gestureContainerRef}
                className="flex flex-1 overflow-hidden relative touch-pan-x touch-pan-y"
            >
                <div ref={scrollRef} className="flex-1 overflow-auto scroll-smooth p-2 md:p-8">
                    <div className="flex min-w-max relative gap-2 md:gap-8" style={{ height: TOTAL_HOURS * pixelsPerHour + HEADER_OFFSET }}>
                        
                        {/* Time Axis */}
                        <div className="w-20 md:w-32 flex-shrink-0 flex flex-col relative z-20">
                            <div className="h-[60px] sticky top-0 z-40 pointer-events-none" />
                            <div className="relative flex-1">
                                {/* Vertical Axis Line */}
                                <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-gray-400" />
                                
                                {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => {
                                    const topPos = (TOTAL_HOURS - i) * pixelsPerHour;
                                    
                                    if (i === TOTAL_HOURS) {
                                        if (pixelsPerHour >= 20) {
                                            return (
                                                <div 
                                                    key={i} 
                                                    className="absolute right-0 flex items-center justify-end w-full z-10"
                                                    style={{ top: topPos, transform: 'translateY(-50%)' }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-gray-400 h-[3px] w-3 md:w-4" />
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }

                                    const dayIndex = Math.floor(i / 24);
                                    const hourIndex = i % 24;
                                    
                                    let showDay = false;
                                    let showHour = false;
                                    let isTick = false; // Always show tick if it's a day or hour

                                    if (pixelsPerHour < 20) {
                                        showDay = hourIndex === 0;
                                    } else if (pixelsPerHour < 50) {
                                        showDay = hourIndex === 0;
                                        showHour = hourIndex === 12;
                                    } else {
                                        showDay = hourIndex === 0;
                                        if (hourIndex !== 0) {
                                            if (pixelsPerHour >= 80) showHour = true;
                                            else showHour = hourIndex % 2 === 0;
                                        }
                                    }

                                    isTick = showDay || showHour;

                                    if (!isTick) return null;

                                    return (
                                        <div 
                                            key={i} 
                                            className={cn(
                                                "absolute right-0 flex items-center justify-end w-full",
                                                showDay ? "z-30" : "z-10"
                                            )} 
                                            style={{ top: topPos, transform: 'translateY(-50%)' }}
                                        >
                                            <div className="flex items-center gap-2">
                                                {showDay && (
                                                    <span className="text-xs md:text-sm font-black text-gray-700 tracking-widest whitespace-nowrap">
                                                        {DAYS_OF_WEEK[dayIndex]} {weekDates[dayIndex].toString().padStart(2, '0')}
                                                    </span>
                                                )}
                                                {showHour && (
                                                    <span className="text-[10px] md:text-xs font-bold text-gray-500 tracking-widest">
                                                        {hourIndex.toString().padStart(2, '0')}:00
                                                    </span>
                                                )}
                                                {/* Tick Mark */}
                                                <div className={cn(
                                                    "bg-gray-400 h-[3px]",
                                                    showDay ? "w-3 md:w-4" : "w-1.5 md:w-2"
                                                )} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tracks Area */}
                        <div className="flex flex-1 relative gap-2 md:gap-8 pr-4">
                            {/* Bedtime Overlay: 23:00 to 07:00 next day (Translucent Gray) */}
                            {Array.from({ length: 7 }).map((_, d) => {
                                const endTotalHoursAm = d * 24 + 7;
                                const topAm = (TOTAL_HOURS - endTotalHoursAm) * pixelsPerHour + HEADER_OFFSET;
                                return (
                                    <div 
                                        key={`bedtime-am-${d}`} 
                                        className="absolute left-0 right-0 bg-black/10 pointer-events-none z-20"
                                        style={{ top: topAm, height: 7 * pixelsPerHour }} 
                                    />
                                );
                            })}
                            {Array.from({ length: 7 }).map((_, d) => {
                                const endTotalHoursPm = d * 24 + 24;
                                const topPm = (TOTAL_HOURS - endTotalHoursPm) * pixelsPerHour + HEADER_OFFSET;
                                return (
                                    <div 
                                        key={`bedtime-pm-${d}`} 
                                        className="absolute left-0 right-0 bg-black/10 pointer-events-none z-20"
                                        style={{ top: topPm, height: 1 * pixelsPerHour }} 
                                    />
                                );
                            })}

                            <CurrentTimeLine pixelsPerHour={pixelsPerHour} scrollRef={scrollRef} />

                            {/* Individual Tracks */}
                            {tracks.map(track => {
                                const themeLightBg = THEME_STYLES[track.theme].lightBg;
                                return (
                                <div 
                                    key={track.id} 
                                    className={cn(
                                        "relative flex flex-col z-10 shrink-0",
                                        themeLightBg
                                    )}
                                    style={{ width: trackWidth }}
                                >
                                    <div className={cn(
                                        "h-[60px] sticky top-0 border-b-[4px] border-black z-40 flex items-center justify-center shadow-[0_4px_0_0_rgba(0,0,0,0.05)] overflow-hidden bg-transparent px-2"
                                    )}>
                                        <div className="text-sm md:text-base font-black uppercase tracking-widest truncate w-full text-center z-10">
                                            {track.name}
                                        </div>
                                    </div>

                                    <div className="relative flex-1 shadow-sm">
                                        {events.filter(e => e.trackId === track.id).map(event => (
                                            <EventBlock 
                                                key={event.id} 
                                                event={event} 
                                                track={track} 
                                                pixelsPerHour={pixelsPerHour} 
                                            />
                                        ))}
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>
            </div>

            {/* New Track Modal */}
            {isNewTrackModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white border-[4px] border-black p-6 w-full max-w-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black uppercase tracking-widest">New Track</h2>
                            <button onClick={() => setIsNewTrackModalOpen(false)} className="hover:bg-black/10 p-1">
                                <X size={24} strokeWidth={3} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold uppercase tracking-wider mb-2">Track Name</label>
                                <input 
                                    type="text" 
                                    value={newTrackName}
                                    onChange={e => setNewTrackName(e.target.value)}
                                    className="w-full border-[3px] border-black p-2 font-bold focus:outline-none focus:ring-2 ring-[#F9D115]"
                                    placeholder="e.g., COMPLETE REPORT"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase tracking-wider mb-2">Theme Color</label>
                                <div className="flex gap-2">
                                    {(Object.keys(THEME_STYLES) as ThemeType[]).map(theme => (
                                        <button
                                            key={theme}
                                            onClick={() => setNewTrackTheme(theme)}
                                            className={cn(
                                                "w-8 h-8 border-[3px]",
                                                newTrackTheme === theme ? "border-black scale-110" : "border-transparent",
                                                THEME_STYLES[theme].bg
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase tracking-wider mb-2">Deadline Day</label>
                                <select 
                                    value={newEventEndDay}
                                    onChange={e => setNewEventEndDay(Number(e.target.value))}
                                    className="w-full border-[3px] border-black p-2 font-bold focus:outline-none focus:ring-2 ring-[#F9D115] bg-white"
                                >
                                    {DAYS_OF_WEEK.map((day, idx) => (
                                        <option key={idx} value={idx}>{day}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold uppercase tracking-wider mb-2">Deadline Time</label>
                                <input 
                                    type="time" 
                                    value={newEventEndTime}
                                    onChange={e => setNewEventEndTime(e.target.value)}
                                    className="w-full border-[3px] border-black p-2 font-bold focus:outline-none focus:ring-2 ring-[#F9D115]"
                                />
                            </div>
                            <button 
                                onClick={handleCreateTrack}
                                className="w-full mt-4 bg-black text-white font-black uppercase tracking-widest py-3 hover:bg-gray-800 transition-none"
                            >
                                Start Track Event
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}