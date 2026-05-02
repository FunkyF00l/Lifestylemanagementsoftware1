import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { TRACKS, EVENTS, TrackData, TrackEvent } from './data';

interface TracksContextValue {
  tracks: TrackData[];
  events: TrackEvent[];
  setTracks: React.Dispatch<React.SetStateAction<TrackData[]>>;
  setEvents: React.Dispatch<React.SetStateAction<TrackEvent[]>>;
  addTrack: (track: TrackData, newEvents: TrackEvent[]) => void;
  removeTrack: (trackId: string) => void;
}

const TracksContext = createContext<TracksContextValue | null>(null);

export function TracksProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<TrackData[]>(TRACKS);
  const [events, setEvents] = useState<TrackEvent[]>(EVENTS);

  const addTrack = useCallback((track: TrackData, newEvents: TrackEvent[]) => {
    setTracks(prev => [...prev, track]);
    setEvents(prev => [...prev, ...newEvents]);
  }, []);

  const removeTrack = useCallback((trackId: string) => {
    setTracks(prev => prev.filter(t => t.id !== trackId));
    setEvents(prev => prev.filter(e => e.trackId !== trackId));
  }, []);

  return (
    <TracksContext.Provider
      value={{ tracks, events, setTracks, setEvents, addTrack, removeTrack }}
    >
      {children}
    </TracksContext.Provider>
  );
}

export function useTracks(): TracksContextValue {
  const ctx = useContext(TracksContext);
  if (!ctx) throw new Error('useTracks must be used inside TracksProvider');
  return ctx;
}
