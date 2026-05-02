import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { X, Plus, Mic, Send, Bot, CalendarPlus, Check } from 'lucide-react';
import { cn } from '../utils/cn';
import {
  callAI,
  ChatMessage,
  ProposedPlan,
  IS_USING_REAL_AI,
} from '../aiClient';
import { TrackData, TrackEvent, THEME_STYLES } from '../data';
import { useTracks } from '../TracksContext';

interface AIAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const GREETING: ChatMessage = {
  role: 'assistant',
  content: '我可以帮你把长远目标拆解成每天的小任务，并把它们合理地排进你的事件轨道里。\n\n试试告诉我："我要在十个月后学会 Python"',
};

export function AIAgentModal({ isOpen, onClose }: AIAgentModalProps) {
  const { tracks, events, addTrack } = useTracks();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [appliedPlans, setAppliedPlans] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    setMessages([GREETING]);
    setAppliedPlans(new Set());
  };

  // Auto-scroll to bottom when a new message arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const history = messages;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await callAI({
        history,
        userMessage: text,
        existingTracks: tracks,
        existingEvents: events,
      });
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: res.reply, plan: res.plan },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '抱歉，出了点问题。请稍后重试。' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPlan = (msgIdx: number, plan: ProposedPlan) => {
    const trackId = `ai-${Date.now()}`;
    const earliestEvent = plan.events[0];
    const startDay = earliestEvent?.dayOfWeek ?? 1;
    const startTime = earliestEvent?.startTime ?? '09:00';
    const lastEvent = plan.events[plan.events.length - 1];
    const cutoffDay = lastEvent?.dayOfWeek ?? 5;
    const cutoffTime = lastEvent?.endTime ?? '18:00';

    const newTrack: TrackData = {
      id: trackId,
      name: plan.trackName,
      theme: plan.theme,
      startDay,
      startTime,
      cutoffDay,
      cutoffTime,
      startDate: plan.startDate,
      cutoffDate: plan.cutoffDate,
    };

    const newEvents: TrackEvent[] = plan.events.map((e, i) => ({
      id: `${trackId}-e${i}`,
      trackId,
      title: e.title,
      type: 'regular',
      dayOfWeek: e.dayOfWeek,
      startTime: e.startTime,
      endTime: e.endTime,
    }));

    addTrack(newTrack, newEvents);
    setAppliedPlans(prev => new Set(prev).add(msgIdx));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[#333]/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#F4F4F4] w-full sm:max-w-md h-[90vh] sm:h-[80vh] sm:rounded-xl flex flex-col border-t-2 sm:border-2 border-[#A0A0A0] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D0D0D0]"
          style={{ background: 'linear-gradient(135deg, #7B68EE, #9B59B6)' }}
        >
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-white" />
            <span className="text-sm text-white uppercase tracking-widest" style={{ fontWeight: 800 }}>
              AI Agent
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{
                background: IS_USING_REAL_AI ? 'rgba(255,255,255,0.2)' : 'rgba(255,100,100,0.3)',
                color: 'white',
                fontWeight: 700,
                letterSpacing: '0.5px',
              }}
              title={IS_USING_REAL_AI ? 'Using Claude Sonnet 4.6' : 'No API key set — using mock. Add VITE_ANTHROPIC_API_KEY to .env.local and restart.'}
            >
              {IS_USING_REAL_AI ? 'SONNET 4.6' : 'MOCK'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              applied={appliedPlans.has(i)}
              onApply={() => m.plan && handleApplyPlan(i, m.plan)}
            />
          ))}
          {loading && <TypingBubble />}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-[#D0D0D0] bg-[#E8E8E8] px-2 py-2">
          <div className="flex items-end gap-2 bg-white rounded-2xl px-2 py-1.5 border border-[#D0D0D0]">
            <button
              className="p-1.5 rounded-full hover:bg-[#EEE] shrink-0 text-[#888]"
              title="Upload image (coming soon)"
              onClick={() => {/* placeholder */}}
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me a long-term goal..."
              rows={1}
              className="flex-1 resize-none bg-transparent outline-none text-sm py-1.5 max-h-28"
              style={{ color: '#222' }}
            />

            <button
              className="p-1.5 rounded-full hover:bg-[#EEE] shrink-0 text-[#888]"
              title="Voice input (coming soon)"
              onClick={() => {/* placeholder */}}
            >
              <Mic size={18} strokeWidth={2.5} />
            </button>

            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className={cn(
                'p-2 rounded-full shrink-0 transition-colors',
                input.trim() && !loading
                  ? 'bg-[#7B68EE] text-white hover:bg-[#6A57DD]'
                  : 'bg-[#D0D0D0] text-[#999] cursor-not-allowed',
              )}
            >
              <Send size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────

function MessageBubble({
  message,
  applied,
  onApply,
}: {
  message: ChatMessage;
  applied: boolean;
  onApply: () => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap',
          isUser
            ? 'bg-[#7B68EE] text-white rounded-br-sm'
            : 'bg-white text-[#222] rounded-bl-sm border border-[#E0E0E0]',
        )}
      >
        <div>{message.content}</div>
        {message.plan && (
          <PlanPreview plan={message.plan} applied={applied} onApply={onApply} />
        )}
      </div>
    </div>
  );
}

function PlanPreview({
  plan,
  applied,
  onApply,
}: {
  plan: ProposedPlan;
  applied: boolean;
  onApply: () => void;
}) {
  const themeStyle = THEME_STYLES[plan.theme];
  return (
    <div className="mt-2 bg-[#FAFAFA] rounded-lg p-3 border border-[#E0E0E0]">
      {/* Track badge */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn('px-2 py-0.5 rounded text-xs', themeStyle.bg, themeStyle.text)}
          style={{ fontWeight: 700 }}
        >
          {plan.trackName}
        </span>
        <span className="text-[11px] text-[#888]">
          {plan.startDate} → {plan.cutoffDate}
        </span>
      </div>

      {/* Weekly slots */}
      <div className="text-[11px] text-[#555] mb-2">
        <div style={{ fontWeight: 700 }} className="mb-1">Weekly schedule</div>
        {plan.events.length === 0 ? (
          <div className="text-[#C33]">No free slots found in your schedule.</div>
        ) : (
          <ul className="space-y-0.5">
            {plan.events.map((e, i) => (
              <li key={i}>
                · {DAY_NAMES[e.dayOfWeek]} {e.startTime}–{e.endTime}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Milestones */}
      {plan.milestones.length > 0 && (
        <div className="text-[11px] text-[#555] mb-2">
          <div style={{ fontWeight: 700 }} className="mb-1">Milestones</div>
          <ul className="space-y-0.5">
            {plan.milestones.map((m, i) => <li key={i}>· {m}</li>)}
          </ul>
        </div>
      )}

      {/* Apply button */}
      <button
        onClick={onApply}
        disabled={applied || plan.events.length === 0}
        className={cn(
          'w-full mt-1 py-2 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors',
          applied
            ? 'bg-[#D8F3D8] text-[#2A7A2A]'
            : plan.events.length === 0
              ? 'bg-[#E0E0E0] text-[#999] cursor-not-allowed'
              : 'bg-[#7B68EE] text-white hover:bg-[#6A57DD]',
        )}
        style={{ fontWeight: 700 }}
      >
        {applied ? (
          <>
            <Check size={14} strokeWidth={3} /> Added to schedule
          </>
        ) : (
          <>
            <CalendarPlus size={14} strokeWidth={2.5} /> Apply to schedule
          </>
        )}
      </button>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2.5 border border-[#E0E0E0]">
        <div className="flex gap-1 items-center">
          <Dot delay={0} />
          <Dot delay={0.15} />
          <Dot delay={0.3} />
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <>
      <span
        className="w-1.5 h-1.5 rounded-full bg-[#888] inline-block"
        style={{
          animation: 'ai-typing-dot 1s ease-in-out infinite',
          animationDelay: `${delay}s`,
        }}
      />
      <style>{`
        @keyframes ai-typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </>
  );
}
