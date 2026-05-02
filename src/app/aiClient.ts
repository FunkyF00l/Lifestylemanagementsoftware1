// AI Agent client
//
// Talks to Claude (Anthropic) from the browser.
//
// ⚠️ SECURITY: uses `dangerouslyAllowBrowser: true`. The API key is
// embedded in the client bundle at build time — anyone who opens DevTools
// (or inspects the site's network traffic) can read it. This is fine for
// local-only testing. For a real deployment, move the call behind a
// backend proxy that holds the key server-side.
//
// SETUP:
//   1. In the project root, create a file named `.env.local`
//   2. Add one line:  VITE_ANTHROPIC_API_KEY=sk-ant-...
//   3. Restart the dev server (`npm run dev`) — Vite only reads env vars at startup
//
// If the key is missing/invalid, the client falls back to the mock
// response so the UI still works.

import Anthropic from '@anthropic-ai/sdk';
import { TrackData, TrackEvent, ThemeType } from './data';

// ── Chat message types ──────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  plan?: ProposedPlan;
}

// ── Plan shape returned by AI ───────────────────────────────────

export interface ProposedEvent {
  title: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export interface ProposedPlan {
  trackName: string;
  theme: ThemeType;
  startDate: string;
  cutoffDate: string;
  events: ProposedEvent[];
  summary: string;
  milestones: string[];
}

export interface AIResponse {
  reply: string;
  plan?: ProposedPlan;
}

// ── System prompt ───────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a planning assistant embedded in a lifestyle management app.

The app has an "event track" panel: horizontal axis = tracks (one per life area), vertical axis = time. Each track has a weekly recurring pattern. Each event on a track has dayOfWeek (0=Sun..6=Sat), startTime, endTime in HH:MM (24-hour). Light-colored track background shows the track's intended lifespan; dark event blocks show the time the user has actually spent on it.

When the user states a long-term goal (e.g. "我要在十个月后学会 Python" / "I want to learn X in N months"):
1. Reply in the user's language (Chinese or English) with a RICH, detailed, warm message. The reply should feel like a supportive friend talking — not a terse acknowledgment. Structure it like this:
   - Opening: affirm the goal with an emoji and 1–2 encouraging sentences.
   - Weekly schedule: narrate each session on its own line using emoji + day + time + activity. Example: "📚 周一 19:00–20:30 · Python 基础练习". Do NOT wrap day names in asterisks.
   - Milestones: list each one on its own line using emoji + month + description. Example: "🎯 第2个月：掌握基础语法".
   - Emphasize that you avoided the user's existing schedule conflicts — this is a signature feature of the app. Phrase it naturally, e.g. "所有时间段都已经避开你现有的 Work / Health / Learn 等日程 ✅".
   - Closing: a short line of encouragement with an emoji.
   FORMATTING RULES: do NOT use markdown bold (**text**) or markdown horizontal rules (---). Also do NOT use any kind of horizontal divider line made of repeated characters — no "___", no "———", no "===", no "~~~", no "━━━". These characters do not wrap and overflow the chat bubble. Use emoji, line breaks, and Chinese punctuation ( · ： — ✅ ) for visual structure instead. For section headers, just put the header on its own line with an emoji, followed by a blank line.
2. ALSO call the \`propose_plan\` tool to produce a structured weekly schedule. The tool call is what powers the "Apply to schedule" button — without it the user cannot add the plan to their day.

Rules when calling propose_plan:
- Break the goal into concrete, small, daily-sized actions.
- HARD RULE: a person can only do one thing at a time. Never create events that overlap the occupied slots listed in the user prompt.
- Keep density reasonable — no more than ~2 hours of new work per day, at most 5 days per week.
- Pick a track theme from: blue, red, yellow, green, purple.
- Set startDate = today, cutoffDate = today + goal duration.
- Provide 3–5 milestones describing progress checkpoints, written in the user's language.

If the user is just chatting, asking a question, or their message is not a concrete long-term goal, simply reply with text and DO NOT call the tool.`;

function buildUserPrompt(
  userMessage: string,
  existingTracks: TrackData[],
  existingEvents: TrackEvent[],
): string {
  const today = new Date().toISOString().slice(0, 10);
  const occupied = existingEvents
    .map(e => `  - day ${e.dayOfWeek} ${e.startTime}-${e.endTime || '?'} (${e.title})`)
    .join('\n');
  return `Today is ${today}.

Existing tracks: ${existingTracks.map(t => t.name).join(', ') || '(none)'}
Occupied time slots (avoid these when scheduling new events):
${occupied || '  (none)'}

User message: "${userMessage}"`;
}

// ── Tool definition (the schema that will be enforced by the API) ─

const PROPOSE_PLAN_TOOL: Anthropic.Tool = {
  name: 'propose_plan',
  description:
    'Create a structured weekly schedule for a long-term goal stated by the user. Call this whenever the user asks for help achieving something over weeks or months. Do NOT call for casual chat, questions about the app, or when the user is not stating an actionable goal.',
  input_schema: {
    type: 'object',
    properties: {
      trackName: {
        type: 'string',
        description: '1–2 word track name (e.g., "Python", "Guitar", "Marathon").',
      },
      theme: {
        type: 'string',
        enum: ['blue', 'red', 'yellow', 'green', 'purple'],
        description: 'Color theme for the track.',
      },
      startDate: {
        type: 'string',
        description: 'ISO date YYYY-MM-DD. Should equal today.',
      },
      cutoffDate: {
        type: 'string',
        description: 'ISO date YYYY-MM-DD. Should equal today + goal duration.',
      },
      events: {
        type: 'array',
        description:
          "Weekly recurring events. Each represents one session in the user's weekly routine. Pick free slots that do not overlap the user's occupied slots.",
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short label for this session.' },
            dayOfWeek: {
              type: 'integer',
              minimum: 0,
              maximum: 6,
              description: '0=Sunday, 1=Monday, ..., 6=Saturday',
            },
            startTime: { type: 'string', description: 'HH:MM in 24-hour format.' },
            endTime: { type: 'string', description: 'HH:MM in 24-hour format.' },
          },
          required: ['title', 'dayOfWeek', 'startTime', 'endTime'],
        },
      },
      summary: {
        type: 'string',
        description: "Short summary of the plan in the user's language.",
      },
      milestones: {
        type: 'array',
        items: { type: 'string' },
        description: "3–5 progress milestones in the user's language.",
      },
    },
    required: ['trackName', 'theme', 'startDate', 'cutoffDate', 'events', 'summary', 'milestones'],
  },
};

// ── Claude client ───────────────────────────────────────────────

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
const BASE_URL = import.meta.env.VITE_ANTHROPIC_BASE_URL as string | undefined;
const client = API_KEY
  ? new Anthropic({
      apiKey: API_KEY,
      baseURL: BASE_URL,
      dangerouslyAllowBrowser: true,
    })
  : null;

export const IS_USING_REAL_AI = !!client;

export interface CallAIOptions {
  history: ChatMessage[];
  userMessage: string;
  existingTracks: TrackData[];
  existingEvents: TrackEvent[];
}

export async function callAI(opts: CallAIOptions): Promise<AIResponse> {
  if (!client) {
    console.warn('[aiClient] No VITE_ANTHROPIC_API_KEY — using mock. Create .env.local and restart dev server to use real Claude.');
    return mockAIResponse(opts);
  }

  // Messages must start with a user turn. Drop any leading assistant messages
  // (e.g. the UI's opening greeting) and pass only real exchanged turns.
  const trimmedHistory = [...opts.history];
  while (trimmedHistory.length > 0 && trimmedHistory[0].role === 'assistant') {
    trimmedHistory.shift();
  }

  const messages = [
    ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: buildUserPrompt(opts.userMessage, opts.existingTracks, opts.existingEvents) },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [PROPOSE_PLAN_TOOL],
      messages,
    });

    // Conversational text (for the chat bubble)
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text',
    );
    const reply = textBlocks.map(b => b.text).join('\n\n').trim();

    // Structured plan from the tool_use block, if the AI called our tool
    const toolUseBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'propose_plan',
    );
    const plan = toolUseBlock ? (toolUseBlock.input as ProposedPlan) : undefined;

    return {
      reply:
        reply ||
        (plan
          ? '✨ 我已经为你生成了规划，点击下方 **Apply to schedule** 添加到日程。'
          : '(AI 没有返回任何内容，请再试一次)'),
      plan,
    };
  } catch (err) {
    console.error('[aiClient] API call failed:', err);
    if (err instanceof Anthropic.AuthenticationError) {
      return { reply: '❌ API key 无效。请检查 .env.local 里的 VITE_ANTHROPIC_API_KEY。' };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { reply: '⏳ 请求太频繁了，稍等一下再试。' };
    }
    if (err instanceof Anthropic.APIError) {
      return { reply: `❌ API 错误 (${err.status})：${err.message}` };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { reply: `❌ 出错了：${msg}` };
  }
}

// ── Mock fallback (used when no API key is set) ─────────────────

const GOAL_PATTERNS: Array<{ match: RegExp; topic: string; theme: ThemeType; sessions: number; hours: number }> = [
  { match: /python/i,        topic: 'Python',       theme: 'blue',   sessions: 5, hours: 1 },
  { match: /英语|english/i,   topic: 'English',      theme: 'red',    sessions: 5, hours: 1 },
  { match: /吉他|guitar/i,    topic: 'Guitar',       theme: 'purple', sessions: 4, hours: 1 },
  { match: /跑步|run|马拉松|marathon/i, topic: 'Running', theme: 'yellow', sessions: 4, hours: 1 },
  { match: /健身|gym|workout|lift/i, topic: 'Workout', theme: 'green', sessions: 5, hours: 1 },
  { match: /画画|draw|paint|sketch/i, topic: 'Drawing', theme: 'purple', sessions: 4, hours: 1 },
];

function monthsFromText(text: string): number {
  const m1 = text.match(/(\d+)\s*(month|months|个月)/i);
  if (m1) return parseInt(m1[1]);
  const m2 = text.match(/(\d+)\s*(week|weeks|周)/i);
  if (m2) return Math.max(1, Math.round(parseInt(m2[1]) / 4));
  const m3 = text.match(/(\d+)\s*(year|years|年)/i);
  if (m3) return parseInt(m3[1]) * 12;
  const cnMap: Record<string, number> = { 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10 };
  const m4 = text.match(/([一二三四五六七八九十]+)\s*个月/);
  if (m4) return cnMap[m4[1]] || 3;
  return 3;
}

function addMonths(d: Date, months: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function timeKey(day: number, hour: number): string {
  return `${day}-${hour}`;
}

function buildOccupiedSet(events: TrackEvent[]): Set<string> {
  const occ = new Set<string>();
  events.forEach(ev => {
    const startH = parseInt(ev.startTime.split(':')[0]);
    const endH = ev.endTime ? parseInt(ev.endTime.split(':')[0]) : startH + 1;
    for (let h = startH; h < endH; h++) occ.add(timeKey(ev.dayOfWeek, h));
  });
  return occ;
}

const PREFERRED_SLOTS: Array<{ day: number; hour: number }> = [
  { day: 1, hour: 19 }, { day: 2, hour: 19 }, { day: 3, hour: 19 }, { day: 4, hour: 19 }, { day: 5, hour: 19 },
  { day: 1, hour: 20 }, { day: 2, hour: 20 }, { day: 3, hour: 20 }, { day: 4, hour: 20 }, { day: 5, hour: 20 },
  { day: 6, hour: 10 }, { day: 0, hour: 10 },
  { day: 6, hour: 15 }, { day: 0, hour: 15 },
];

function distributeSessions(
  sessionsPerWeek: number,
  hoursPerSession: number,
  occupied: Set<string>,
): ProposedEvent[] {
  const events: ProposedEvent[] = [];
  const usedDays = new Set<number>();
  for (const slot of PREFERRED_SLOTS) {
    if (events.length >= sessionsPerWeek) break;
    if (usedDays.has(slot.day)) continue;
    let free = true;
    for (let h = 0; h < hoursPerSession; h++) {
      if (occupied.has(timeKey(slot.day, slot.hour + h))) { free = false; break; }
    }
    if (!free) continue;
    const startTime = `${String(slot.hour).padStart(2, '0')}:00`;
    const endTime = `${String(slot.hour + hoursPerSession).padStart(2, '0')}:00`;
    events.push({ title: 'Session', dayOfWeek: slot.day, startTime, endTime });
    usedDays.add(slot.day);
    for (let h = 0; h < hoursPerSession; h++) occupied.add(timeKey(slot.day, slot.hour + h));
  }
  return events;
}

function detectGoal(text: string) {
  for (const p of GOAL_PATTERNS) {
    if (p.match.test(text)) return p;
  }
  if (/学|learn|master|掌握|study/i.test(text)) {
    return { topic: 'Goal', theme: 'purple' as ThemeType, sessions: 4, hours: 1 };
  }
  return null;
}

async function mockAIResponse(opts: CallAIOptions): Promise<AIResponse> {
  await new Promise(r => setTimeout(r, 900 + Math.random() * 600));

  const goal = detectGoal(opts.userMessage);
  if (!goal) {
    return {
      reply: '（Mock 模式）我可以帮你把长远目标拆解成每日小任务。比如："我要在十个月后学会 Python"。\n\n要用真实的 AI，请在项目根目录创建 .env.local 并添加 VITE_ANTHROPIC_API_KEY，然后重启 npm run dev。',
    };
  }

  const months = monthsFromText(opts.userMessage);
  const occupied = buildOccupiedSet(opts.existingEvents);
  const events = distributeSessions(goal.sessions, goal.hours, occupied);

  const today = new Date();
  const cutoff = addMonths(today, months);

  const milestones: string[] = [];
  const milestoneCount = Math.min(months, 4);
  for (let i = 1; i <= milestoneCount; i++) {
    const monthMark = Math.round((months * i) / milestoneCount);
    milestones.push(`Month ${monthMark}: ${goal.topic} ${i === milestoneCount ? 'fluent / confident' : 'level ' + i}`);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const slotDesc = events.length > 0
    ? events.map(e => `${dayNames[e.dayOfWeek]} ${e.startTime}–${e.endTime}`).join(', ')
    : '(no free slots found — please free up some evening time)';

  return {
    reply: `（Mock 模式）好，我把这个目标拆成每周 ${events.length} 次、每次 ${goal.hours} 小时的训练安排，持续 ${months} 个月。`,
    plan: {
      trackName: goal.topic,
      theme: goal.theme,
      startDate: today.toISOString().slice(0, 10),
      cutoffDate: cutoff.toISOString().slice(0, 10),
      events,
      summary: `Weekly: ${slotDesc}. Over ${months} months.`,
      milestones,
    },
  };
}
