import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Home, StickyNote, Wallet, User } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { cn } from '../utils/cn';

const TABS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/note', icon: StickyNote, label: 'Note' },
  { path: '/finance', icon: Wallet, label: 'Finance' },
  { path: '/personal', icon: User, label: 'Personal' },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-[#E8E8E8] overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 overflow-hidden">
        <Outlet context={{ onOpenSidebar: () => setSidebarOpen(true) }} />
      </div>

      {/* Bottom Tab Bar */}
      <div className="shrink-0 bg-[#C8C8C8] flex items-center justify-around px-2 py-2 border-t-2 border-[#A0A0A0]">
        {TABS.map((tab) => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center w-14 h-14 rounded-full transition-none",
                active
                  ? "bg-[#888] ring-2 ring-[#666]"
                  : "bg-[#999] hover:bg-[#888]"
              )}
            >
              <Icon
                size={22}
                strokeWidth={2.5}
                className={active ? "text-[#E8E8E8]" : "text-[#D0D0D0]"}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
