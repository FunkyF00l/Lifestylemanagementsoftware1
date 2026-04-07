export type EventType = 'regular' | 'cycle' | 'cutoff';
export type ThemeType = 'blue' | 'red' | 'yellow' | 'green' | 'purple';
export type EventKind = 'cycle' | 'cutoff';

export interface TrackData {
    id: string;
    name: string;
    theme: ThemeType;
    customColor?: string;       // hex color from importance slider
    eventKind?: EventKind;      // cycle or cutoff
    // Track lifespan: light background spans from start to cutoff
    startDay: number;    // day of week (0-6) — used for weekly schedule template
    startTime: string;   // HH:MM - when the track begins
    cutoffDay: number;   // day of week (0-6) — used for weekly schedule template
    cutoffTime: string;  // HH:MM - when the entire track ends
    cutoffDate?: string; // ISO date string for absolute cutoff
    startDate?: string;  // ISO date string for absolute start (defaults to creation time)
    indefinite?: boolean; // extends to end of timeline
}

export interface TrackEvent {
    id: string;
    trackId: string;
    title: string;
    type: EventType;
    dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    startTime: string; // HH:MM
    endTime?: string; // HH:MM
    endDayOfWeek?: number; // 0-6
    description?: string;
}

export const TRACKS: TrackData[] = [
    { id: 't1', name: 'Work', theme: 'blue', startDay: 1, startTime: '08:00', cutoffDay: 5, cutoffTime: '18:00' },
    { id: 't2', name: 'Health', theme: 'yellow', startDay: 0, startTime: '06:00', cutoffDay: 6, cutoffTime: '22:00' },
    { id: 't3', name: 'Learn', theme: 'red', startDay: 1, startTime: '19:00', cutoffDay: 4, cutoffTime: '23:00' },
    { id: 't4', name: 'Admin', theme: 'green', startDay: 1, startTime: '10:00', cutoffDay: 6, cutoffTime: '12:00' },
];

export const EVENTS: TrackEvent[] = [
    // Work (Monday - Friday)
    { id: 'e1', trackId: 't1', title: 'Deep Work', type: 'regular', dayOfWeek: 1, startTime: '09:00', endTime: '11:30' },
    { id: 'e2', trackId: 't1', title: 'Team Sync', type: 'regular', dayOfWeek: 1, startTime: '13:00', endTime: '14:00' },
    { id: 'e3', trackId: 't1', title: 'Deep Work', type: 'regular', dayOfWeek: 2, startTime: '09:00', endTime: '11:30' },
    { id: 'e4', trackId: 't1', title: 'Review', type: 'regular', dayOfWeek: 3, startTime: '14:00', endTime: '16:00' },

    // Health (Spread out)
    { id: 'e6', trackId: 't2', title: 'Stretch', type: 'cycle', dayOfWeek: 1, startTime: '07:30', endTime: '08:00' },
    { id: 'e7', trackId: 't2', title: 'Gym', type: 'regular', dayOfWeek: 1, startTime: '18:30', endTime: '20:00' },
    { id: 'e8', trackId: 't2', title: 'Stretch', type: 'cycle', dayOfWeek: 2, startTime: '07:30', endTime: '08:00' },
    { id: 'e9', trackId: 't2', title: 'Run', type: 'regular', dayOfWeek: 3, startTime: '06:30', endTime: '07:30' },
    { id: 'e10', trackId: 't2', title: 'Gym', type: 'regular', dayOfWeek: 4, startTime: '18:30', endTime: '20:00' },

    // Learning
    { id: 'e12', trackId: 't3', title: 'Read', type: 'cycle', dayOfWeek: 1, startTime: '21:00', endTime: '22:00' },
    { id: 'e13', trackId: 't3', title: 'Course', type: 'regular', dayOfWeek: 2, startTime: '20:00', endTime: '21:30' },
    { id: 'e14', trackId: 't3', title: 'Read', type: 'cycle', dayOfWeek: 3, startTime: '21:00', endTime: '22:00' },

    // Admin
    { id: 'e16', trackId: 't4', title: 'Bank', type: 'regular', dayOfWeek: 1, startTime: '11:30', endTime: '12:00' },
    { id: 'e18', trackId: 't4', title: 'Groceries', type: 'regular', dayOfWeek: 6, startTime: '10:00', endTime: '11:30' },
];

export const THEME_STYLES: Record<ThemeType, any> = {
    blue: { bg: 'bg-[#0052C2]', text: 'text-white', lightBg: 'bg-[#B3CFF3]' },
    red: { bg: 'bg-[#E01A22]', text: 'text-white', lightBg: 'bg-[#F9C3C5]' },
    yellow: { bg: 'bg-[#F9D115]', text: 'text-black', lightBg: 'bg-[#FDECA8]' },
    green: { bg: 'bg-[#008A27]', text: 'text-white', lightBg: 'bg-[#B3E1C0]' },
    purple: { bg: 'bg-[#7000FF]', text: 'text-white', lightBg: 'bg-[#DFCCFF]' }
};