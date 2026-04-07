import { StickyNote, Wallet, User } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  icon: 'note' | 'finance' | 'personal';
}

const ICONS = {
  note: StickyNote,
  finance: Wallet,
  personal: User,
};

export function PlaceholderPage({ title, icon }: PlaceholderPageProps) {
  const Icon = ICONS[icon];
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#E0E0E0] gap-4">
      <Icon size={48} className="text-[#999]" />
      <h2 className="text-lg uppercase tracking-widest" style={{ color: '#888', fontWeight: 800 }}>{title}</h2>
      <p className="text-sm" style={{ color: '#AAA' }}>Coming soon</p>
    </div>
  );
}
