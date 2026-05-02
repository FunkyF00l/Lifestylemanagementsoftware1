import { X, Home, StickyNote, Wallet, User, Settings, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: StickyNote, label: 'Notes', path: '/note' },
  { icon: Wallet, label: 'Finance', path: '/finance' },
  { icon: User, label: 'Personal', path: '/personal' },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate();

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-[#333]/60 z-[200]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed left-0 top-0 bottom-0 w-[75%] max-w-[300px] bg-[#D8D8D8] z-[201] flex flex-col shadow-lg">
        <div className="flex items-center justify-between px-4 py-5 border-b-2 border-[#B0B0B0]">
          <h2 className="text-lg tracking-widest uppercase" style={{ color: '#555', fontWeight: 800 }}>
            Yolo<span className="text-[#E01A22]">Track</span>
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[#C0C0C0] rounded">
            <X size={22} className="text-[#666]" />
          </button>
        </div>

        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); onClose(); }}
                className="flex items-center gap-4 w-full px-6 py-3 hover:bg-[#C0C0C0] transition-none"
              >
                <Icon size={20} className="text-[#666]" />
                <span className="text-sm tracking-wider uppercase" style={{ color: '#555', fontWeight: 700 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t-2 border-[#B0B0B0] py-3">
          <button className="flex items-center gap-4 w-full px-6 py-3 hover:bg-[#C0C0C0]">
            <Settings size={20} className="text-[#666]" />
            <span className="text-sm tracking-wider uppercase" style={{ color: '#555', fontWeight: 700 }}>Settings</span>
          </button>
          <button className="flex items-center gap-4 w-full px-6 py-3 hover:bg-[#C0C0C0]">
            <HelpCircle size={20} className="text-[#666]" />
            <span className="text-sm tracking-wider uppercase" style={{ color: '#555', fontWeight: 700 }}>Help</span>
          </button>
        </div>
      </div>
    </>
  );
}
