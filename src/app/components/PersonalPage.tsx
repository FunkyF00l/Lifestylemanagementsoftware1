import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { Menu, Search, Bell, Settings2, ChevronRight } from 'lucide-react';

interface ProfileData {
  name: string;
  id: string;
  motto: string;
  historyCount: number;
  checkInDays: number;
}

const MOCK_PROFILE: ProfileData = {
  name: 'XXX',
  id: 'xxxxxx',
  motto: 'xxxxxxxx',
  historyCount: 128,
  checkInDays: 47,
};

const MENU_ITEMS = [
  'Settings',
  'Theme',
  'Account Management',
  'Feedback',
];

export function PersonalPage() {
  const { onOpenSidebar } = useOutletContext<{ onOpenSidebar: () => void }>();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#E0E0E0]">
      {/* Top Bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-[#D0D0D0] z-40">
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
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="relative px-4 pt-6 pb-5">
          {/* Top-right action icons */}
          <div className="absolute top-3 right-3 flex gap-2">
            <button className="w-7 h-7 bg-[#B0B0B0] rounded-sm flex items-center justify-center hover:bg-[#A0A0A0]">
              <Bell size={14} className="text-[#555]" strokeWidth={2.5} />
            </button>
            <button className="w-7 h-7 bg-[#B0B0B0] rounded-sm flex items-center justify-center hover:bg-[#A0A0A0]">
              <Settings2 size={14} className="text-[#555]" strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-[#999] shrink-0" />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-2xl" style={{ color: '#222', fontWeight: 700 }}>
                {MOCK_PROFILE.name}
              </div>
              <div className="text-sm mt-1" style={{ color: '#333', fontWeight: 500 }}>
                ID:{MOCK_PROFILE.id}
              </div>
              <div className="text-sm mt-0.5" style={{ color: '#333', fontWeight: 500 }}>
                Life Motto:{MOCK_PROFILE.motto}
              </div>
            </div>
          </div>
        </div>

        {/* Menu card */}
        <div className="mx-3 mb-4 bg-[#CCCCCC] rounded-2xl p-4 space-y-3">
          {/* Top row: two small tiles */}
          <div className="flex gap-3">
            <button className="flex-1 bg-[#A8A8A8] rounded-2xl py-6 text-center hover:bg-[#9A9A9A] transition-colors">
              <div className="text-lg" style={{ color: '#222', fontWeight: 600 }}>
                History
              </div>
            </button>
            <button className="flex-1 bg-[#A8A8A8] rounded-2xl py-6 text-center hover:bg-[#9A9A9A] transition-colors">
              <div className="text-lg leading-tight" style={{ color: '#222', fontWeight: 600 }}>
                Check-in
                <br />
                Days
              </div>
            </button>
          </div>

          {/* Full-width menu rows */}
          {MENU_ITEMS.map(item => (
            <button
              key={item}
              className="w-full bg-[#A8A8A8] rounded-2xl py-4 px-5 flex items-center justify-between hover:bg-[#9A9A9A] transition-colors"
            >
              <span className="text-lg" style={{ color: '#222', fontWeight: 600 }}>
                {item}
              </span>
              <ChevronRight size={20} className="text-[#666]" strokeWidth={2.5} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
