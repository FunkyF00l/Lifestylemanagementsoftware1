import { useState, useRef, useCallback } from 'react';
import { Menu, Search, Plus, X, Check, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  percentage: number;
  isTemporary: boolean;
  completed: boolean;
  sourceTrackId?: string;
  _startHfe?: number;
  color?: string;
}

interface TodaysAffairsProps {
  todos: TodoItem[];
  onAddTodo: (title: string, description: string) => void;
  onToggleTodo: (id: string) => void;
  onDismissTodo?: (id: string, action: 'complete' | 'delete') => void;
}

const BUTTON_WIDTH = 56;
const REVEAL_WIDTH = BUTTON_WIDTH * 2;

function SwipeableItem({
  todo,
  children,
  onAction,
}: {
  todo: TodoItem;
  children: React.ReactNode;
  onAction: (id: string, action: 'complete' | 'delete') => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const dragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startOffset.current = offsetX;
    dragging.current = true;
    setAnimating(false);
  }, [offsetX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const newOffset = Math.max(-REVEAL_WIDTH, Math.min(0, startOffset.current + dx));
    setOffsetX(newOffset);
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    setAnimating(true);
    if (offsetX < -REVEAL_WIDTH / 2) {
      setOffsetX(-REVEAL_WIDTH);
    } else {
      setOffsetX(0);
    }
  }, [offsetX]);

  const handleAction = (action: 'complete' | 'delete') => {
    setAnimating(true);
    setDismissed(true);
    setTimeout(() => onAction(todo.id, action), 300);
  };

  if (dismissed) {
    return (
      <div
        className="overflow-hidden"
        style={{
          maxHeight: 0,
          opacity: 0,
          transition: 'max-height 0.3s ease, opacity 0.3s ease',
        }}
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Sliding container: card + buttons move together */}
      <div
        className="flex"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: animating ? 'transform 0.25s ease' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Card content */}
        <div className="w-full shrink-0">
          {children}
        </div>
        {/* Action buttons flush to card's right edge */}
        <div className="flex shrink-0">
          <button
            onClick={() => handleAction('complete')}
            className="flex items-center justify-center rounded-l-lg"
            style={{ width: BUTTON_WIDTH, backgroundColor: '#22C55E' }}
          >
            <Check size={24} className="text-[#E8E8E8]" strokeWidth={3} />
          </button>
          <button
            onClick={() => handleAction('delete')}
            className="flex items-center justify-center rounded-r-lg"
            style={{ width: BUTTON_WIDTH, backgroundColor: '#DC2626' }}
          >
            <Trash2 size={22} className="text-[#E8E8E8]" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function TodaysAffairs({ todos, onAddTodo, onToggleTodo, onDismissTodo }: TodaysAffairsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const filtered = todos.filter(t =>
    !dismissedIds.has(t.id) &&
    (!searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAddTodo(newTitle.trim(), newDesc.trim());
    setNewTitle('');
    setNewDesc('');
    setShowAddModal(false);
  };

  const handleSwipeAction = (id: string, action: 'complete' | 'delete') => {
    setDismissedIds(prev => new Set(prev).add(id));
    onDismissTodo?.(id, action);
  };

  const lightenColor = (color: string, amount: number) => {
    const hex = color.replace('#', '');
    const r = Math.round(Math.min(255, parseInt(hex.slice(0, 2), 16) + (255 - parseInt(hex.slice(0, 2), 16)) * amount));
    const g = Math.round(Math.min(255, parseInt(hex.slice(2, 4), 16) + (255 - parseInt(hex.slice(2, 4), 16)) * amount));
    const b = Math.round(Math.min(255, parseInt(hex.slice(4, 6), 16) + (255 - parseInt(hex.slice(4, 6), 16)) * amount));
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          onClick={() => setShowManage(!showManage)}
          className="p-2 hover:bg-[#C0C0C0] rounded"
        >
          <Menu size={18} className="text-[#666]" />
        </button>

        <div className="flex-1 flex items-center bg-[#999] rounded-full px-3 py-1.5">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#E8E8E8] placeholder-[#C0C0C0] focus:outline-none"
          />
          <Search size={14} className="text-[#C0C0C0]" />
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="p-2 hover:bg-[#C0C0C0] rounded"
        >
          <Plus size={18} className="text-[#666]" />
        </button>
      </div>

      {/* Todo List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.map(todo => {
          const baseColor = todo.color || '#B0B0B0';
          const lightColor = lightenColor(baseColor, 0.65);
          const pct = Math.min(100, Math.max(0, todo.percentage));

          return (
            <SwipeableItem key={todo.id} todo={todo} onAction={handleSwipeAction}>
              <div
                className={cn(
                  "rounded-lg p-3 flex items-start gap-3 relative overflow-hidden",
                  todo.completed && "opacity-50"
                )}
                style={{ backgroundColor: lightColor }}
              >
                {/* Progress bar overlay */}
                <div
                  className="absolute inset-y-0 left-0 z-0"
                  style={{ width: `${pct}%`, backgroundColor: baseColor }}
                />

                {showManage && (
                  <button
                    onClick={() => onToggleTodo(todo.id)}
                    className={cn(
                      "relative z-[1] mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0",
                      todo.completed ? "bg-[#008A27] border-[#008A27]" : "border-[#999]"
                    )}
                  >
                    {todo.completed && <Check size={12} className="text-[#E8E8E8]" />}
                  </button>
                )}
                <div className="flex-1 min-w-0 relative z-[1]">
                  <div className={cn("text-sm", todo.completed && "line-through")} style={{ color: '#333', fontWeight: 700 }}>
                    {todo.title}
                  </div>
                  {todo.description && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: '#444', opacity: 0.9 }}>
                      {todo.description}
                    </div>
                  )}
                  {todo.isTemporary && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded mt-1 inline-block" style={{ backgroundColor: baseColor, color: '#E8E8E8', opacity: 0.7 }}>
                      Temp
                    </span>
                  )}
                </div>
                <span className="text-sm shrink-0 relative z-[1]" style={{ color: '#333', fontWeight: 700 }}>
                  {todo.percentage}%
                </span>
              </div>
            </SwipeableItem>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: '#999' }}>
            No tasks for today
          </div>
        )}
      </div>

      {/* Add Todo Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[150] bg-[#333]/50 flex items-center justify-center p-4">
          <div className="bg-[#D8D8D8] rounded-lg p-5 w-full max-w-sm border-2 border-[#A0A0A0]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base uppercase tracking-wider" style={{ color: '#555', fontWeight: 800 }}>Add Task</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1">
                <X size={20} className="text-[#666]" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Task title"
                className="w-full bg-[#C0C0C0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[#888] placeholder-[#999]"
                style={{ color: '#444', fontWeight: 600 }}
              />
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-[#C0C0C0] rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-[#888] placeholder-[#999] resize-none"
                style={{ color: '#444' }}
              />
              <button
                onClick={handleAdd}
                className="w-full bg-[#888] text-[#E8E8E8] py-2.5 rounded text-sm uppercase tracking-wider hover:bg-[#777]"
                style={{ fontWeight: 700 }}
              >
                Add Temporary Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}