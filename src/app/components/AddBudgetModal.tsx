import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';

export interface BudgetCategory {
  name: string;
  percent: number; // current usage percentage (0-200+), not limit
}

interface AddBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (budget: BudgetCategory) => void;
}

const PRESET_COLORS = [
  '#7BB4E3', '#9BDCA6', '#C8B3ED', '#9CE0E0',
  '#B9E6B9', '#B4C76A', '#F0B764', '#E87A6B',
];

export function AddBudgetModal({ isOpen, onClose, onAdd }: AddBudgetModalProps) {
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [colorIdx, setColorIdx] = useState(0);

  if (!isOpen) return null;

  const canSubmit = name.trim().length > 0 && Number(limit) > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    // Mock: start at 0% usage. Real app would derive from actual spend / limit.
    onAdd({ name: name.trim(), percent: 0 });
    setName('');
    setLimit('');
    setColorIdx(0);
  };

  const handleClose = () => {
    setName('');
    setLimit('');
    setColorIdx(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#333]/50 flex items-center justify-center p-4">
      <div className="bg-[#D8D8D8] rounded-lg w-full max-w-sm border-2 border-[#A0A0A0]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 pb-3">
          <h2
            className="text-base uppercase tracking-widest"
            style={{ color: '#555', fontWeight: 800 }}
          >
            New Budget
          </h2>
          <button onClick={handleClose} className="p-1">
            <X size={20} className="text-[#666]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 space-y-4">
          {/* Category name */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider mb-1"
              style={{ color: '#666', fontWeight: 700 }}
            >
              Category
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., COFFEE"
              className="w-full bg-[#C0C0C0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[#888] placeholder-[#999]"
              style={{ color: '#444', fontWeight: 600 }}
            />
          </div>

          {/* Monthly limit */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider mb-1"
              style={{ color: '#666', fontWeight: 700 }}
            >
              Monthly Limit
            </label>
            <input
              type="number"
              min={0}
              value={limit}
              onChange={e => setLimit(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#C0C0C0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[#888] placeholder-[#999]"
              style={{ color: '#444', fontWeight: 600 }}
            />
          </div>

          {/* Color */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider mb-2"
              style={{ color: '#666', fontWeight: 700 }}
            >
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c, i) => (
                <button
                  key={c}
                  onClick={() => setColorIdx(i)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    colorIdx === i ? 'border-[#333] scale-110' : 'border-white/70',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 rounded text-sm uppercase tracking-wider bg-[#C0C0C0] text-[#666] hover:bg-[#B0B0B0]"
              style={{ fontWeight: 700 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'flex-1 py-2.5 rounded text-sm uppercase tracking-wider transition-colors',
                canSubmit
                  ? 'bg-[#555] text-white hover:bg-[#444]'
                  : 'bg-[#C0C0C0] text-[#888] cursor-not-allowed',
              )}
              style={{ fontWeight: 700 }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
