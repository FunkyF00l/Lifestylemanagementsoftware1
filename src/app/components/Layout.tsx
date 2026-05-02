import { useState, useRef, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Home, StickyNote, Wallet, User, Bot } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AIAgentModal } from './AIAgentModal';
import { TracksProvider } from '../TracksContext';
import { cn } from '../utils/cn';

const TABS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/note', icon: StickyNote, label: 'Note' },
  { path: '/finance', icon: Wallet, label: 'Finance' },
  { path: '/personal', icon: User, label: 'Personal' },
];

const FAB_SIZE = 56;
const EDGE_THRESHOLD = 20; // px from edge to trigger hide
const PEEK_SIZE = 14; // how much peeks out when hidden

export function Layout() {
  return (
    <TracksProvider>
      <LayoutInner />
    </TracksProvider>
  );
}

function LayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // FAB drag state
  const [fabPos, setFabPos] = useState({ x: window.innerWidth - FAB_SIZE - 16, y: window.innerHeight - 160 });
  const [fabHidden, setFabHidden] = useState<'left' | 'right' | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const currentX = fabHidden === 'left' ? -FAB_SIZE + PEEK_SIZE : fabHidden === 'right' ? window.innerWidth - PEEK_SIZE : fabPos.x;
    const currentY = fabPos.y;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: currentX, origY: currentY, moved: false };
    if (fabHidden) {
      setFabHidden(null);
      setFabPos({ x: currentX, y: currentY });
    }
  }, [fabPos, fabHidden]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    const newX = Math.max(-FAB_SIZE / 2, Math.min(window.innerWidth - FAB_SIZE / 2, dragRef.current.origX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, dragRef.current.origY + dy));
    setFabPos({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const wasDrag = dragRef.current.moved;
    dragRef.current = null;

    // Check edges
    if (fabPos.x <= EDGE_THRESHOLD) {
      setFabHidden('left');
      setFabPos(p => ({ ...p, x: -FAB_SIZE + PEEK_SIZE }));
    } else if (fabPos.x + FAB_SIZE >= window.innerWidth - EDGE_THRESHOLD) {
      setFabHidden('right');
      setFabPos(p => ({ ...p, x: window.innerWidth - PEEK_SIZE }));
    }
  }, [fabPos]);

  const handleFabClick = useCallback(() => {
    if (fabHidden) {
      // Bring it back on screen
      setFabHidden(null);
      setFabPos(p => ({
        ...p,
        x: fabHidden === 'left' ? 16 : window.innerWidth - FAB_SIZE - 16,
      }));
      return;
    }
    setAiOpen(true);
  }, [fabHidden]);

  return (
    <div className="flex flex-col h-screen bg-[#E8E8E8] overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 overflow-hidden">
        <Outlet context={{ onOpenSidebar: () => setSidebarOpen(true) }} />
      </div>

      {/* AI Agent FAB */}
      <div
        className="fixed z-[90] w-14 h-14 rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing select-none"
        style={{
          background: 'linear-gradient(135deg, #7B68EE, #9B59B6)',
          left: fabPos.x,
          top: fabPos.y,
          transition: dragRef.current ? 'none' : 'left 0.3s ease, top 0.3s ease, opacity 0.3s ease',
          opacity: fabHidden ? 0.5 : 1,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleFabClick}
      >
        <Bot size={26} className="text-[#E8E8E8] pointer-events-none" />
      </div>

      {/* AI Agent Modal */}
      <AIAgentModal isOpen={aiOpen} onClose={() => setAiOpen(false)} />

      {/* Bottom Tab Bar */}
      <div className="shrink-0 bg-[#C8C8C8] flex items-center justify-around px-2 py-2 border-t-2 border-[#A0A0A0]">
        {TABS.map((tab) => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center py-1 flex-1"
            >
              <Icon
                size={22}
                strokeWidth={2.5}
                fill={active ? '#888' : 'none'}
                className="text-[#888]"
              />
              <span
                className="text-[10px] mt-0.5"
                style={{ color: '#888', fontWeight: active ? 700 : 400 }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}