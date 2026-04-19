import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { useOutletContext } from 'react-router';
import { Menu, Search, Plus, FolderOpen, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';

// ── Tree data model ──────────────────────────────────────────────

export type NoteNode = NoteLeaf | NoteFolder;

export interface NoteLeaf {
  kind: 'note';
  id: string;
  title: string;
  preview: string;
  color?: string;
}

export interface NoteFolder {
  kind: 'folder';
  id: string;
  name: string;
  color: string;
  bgColor: string;
  children: NoteNode[];
}

// ── Initial data ─────────────────────────────────────────────────

const INITIAL_TREE: NoteFolder = {
  kind: 'folder',
  id: 'root',
  name: 'root',
  color: '#999',
  bgColor: '#E8E8E8',
  children: [
    {
      kind: 'folder', id: 'work', name: 'work',
      color: '#8B7AB8', bgColor: '#7BA3E0',
      children: [
        { kind: 'note', id: 'w1', title: 'report', preview: 'Monthly sales figures and quarterly projections...' },
        { kind: 'note', id: 'w2', title: 'review', preview: 'Performance review notes for Q2...' },
        { kind: 'note', id: 'w3', title: '', preview: 'Meeting agenda items for next sprint planning...' },
        { kind: 'note', id: 'w4', title: '', preview: 'Client feedback summary and action items...' },
        { kind: 'note', id: 'w5', title: '', preview: 'Budget allocation draft for new project...' },
      ],
    },
    {
      kind: 'folder', id: 'health', name: 'health',
      color: '#D4A054', bgColor: '#E8DC82',
      children: [
        { kind: 'note', id: 'h1', title: 'Physical exercise', preview: 'Weekly workout routine and progress tracking...' },
        { kind: 'note', id: 'h2', title: '', preview: 'Meal prep ideas for the week...' },
      ],
    },
    {
      kind: 'folder', id: 'learn', name: 'learn',
      color: '#D46B6B', bgColor: '#E8A0A0',
      children: [
        { kind: 'note', id: 'l1', title: 'Math', preview: 'Linear algebra chapter 4 notes and exercises...' },
      ],
    },
    {
      kind: 'folder', id: 'admin', name: 'admin',
      color: '#7DAA7D', bgColor: '#82D4B8',
      children: [
        { kind: 'note', id: 'a1', title: '', preview: 'Insurance renewal dates and documents...' },
        { kind: 'note', id: 'a2', title: '', preview: 'Tax filing checklist for this year...' },
      ],
    },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0
  };
}

function getTransparentColorToMatch(targetHex: string | undefined, bgHex: string, alpha: number) {
  if (!targetHex) return 'transparent';
  const t = hexToRgb(targetHex);
  const b = hexToRgb(bgHex);
  
  const r = Math.max(0, Math.min(255, Math.round((t.r - b.r * (1 - alpha)) / alpha)));
  const g = Math.max(0, Math.min(255, Math.round((t.g - b.g * (1 - alpha)) / alpha)));
  const bVal = Math.max(0, Math.min(255, Math.round((t.b - b.b * (1 - alpha)) / alpha)));
  
  return `rgba(${r}, ${g}, ${bVal}, ${alpha})`;
}

function findFolder(node: NoteFolder, id: string): NoteFolder | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    if (child.kind === 'folder') {
      const found = findFolder(child, id);
      if (found) return found;
    }
  }
  return null;
}

function updateTree(
  node: NoteFolder,
  targetId: string,
  updater: (folder: NoteFolder) => NoteFolder,
): NoteFolder {
  if (node.id === targetId) return updater(node);
  return {
    ...node,
    children: node.children.map(child =>
      child.kind === 'folder' ? updateTree(child, targetId, updater) : child,
    ),
  };
}

// ── Folder card (on the masonry wall) ────────────────────────────

function FolderCard({
  folder,
  onOpen,
  onAddNote,
}: {
  folder: NoteFolder;
  onOpen: (folder: NoteFolder, rect: DOMRect) => void;
  onAddNote: (folderId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const triggerOpen = (target?: NoteFolder) => {
    if (ref.current) onOpen(target || folder, ref.current.getBoundingClientRect());
  };

  const previewItems = folder.children.slice(0, 4);

  return (
    <div
      ref={ref}
      className="rounded-2xl p-3 cursor-pointer"
      style={{ backgroundColor: getTransparentColorToMatch(folder.bgColor, '#E0E0E0', 0.75) }}
      onClick={() => triggerOpen()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg lowercase" style={{ color: '#444', fontWeight: 700 }}>
          {folder.name}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onAddNote(folder.id); }}
          className="p-0.5 rounded hover:opacity-70"
        >
          <Plus size={18} style={{ color: '#555' }} />
        </button>
      </div>

      {/* Preview grid */}
      <div className="grid grid-cols-2 gap-2">
        {previewItems.map(item =>
          item.kind === 'folder' ? (
            <div
              key={item.id}
              className="rounded-xl p-2.5 aspect-square flex flex-col items-center justify-center"
              style={{ backgroundColor: getTransparentColorToMatch(item.bgColor, folder.bgColor, 0.8) }}
              onClick={e => { e.stopPropagation(); triggerOpen(item); }}
            >
              <FolderOpen size={20} style={{ color: item.color }} />
              <span className="text-[10px] mt-1 truncate w-full text-center" style={{ color: '#444', fontWeight: 600 }}>
                {item.name}
              </span>
            </div>
          ) : (
            <NoteCard key={item.id} note={item} color={folder.color} bgHex={folder.bgColor} />
          ),
        )}
      </div>

      {folder.children.length > 4 && (
        <div className="text-center mt-1.5">
          <span className="text-[10px]" style={{ color: '#666' }}>
            +{folder.children.length - 4} more
          </span>
        </div>
      )}
    </div>
  );
}

// ── Note card (small square preview) ─────────────────────────────

function NoteCard({ note, color, bgHex }: { note: NoteLeaf; color: string; bgHex: string }) {
  return (
    <div
      className="rounded-xl p-2.5 aspect-square flex flex-col justify-between hover:opacity-80 transition-opacity"
      style={{ backgroundColor: getTransparentColorToMatch(color, bgHex, 0.75) }}
      onClick={e => e.stopPropagation()}
    >
      {note.title && (
        <span className="text-xs truncate" style={{ color: '#E8E8E8', fontWeight: 600 }}>
          {note.title}
        </span>
      )}
      <div className="flex-1" />
      <div className="space-y-1">
        <div className="h-[1.5px] rounded-full" style={{ backgroundColor: '#E8E8E8', opacity: 0.4, width: '70%' }} />
        <div className="h-[1.5px] rounded-full" style={{ backgroundColor: '#E8E8E8', opacity: 0.4, width: '50%' }} />
      </div>
    </div>
  );
}

// ── iOS-style expanded folder overlay ────────────────────────────

function ExpandedFolder({
  folder,
  originRect,
  onClose,
  onOpenSubFolder,
  onAddNote,
}: {
  folder: NoteFolder;
  originRect: DOMRect;
  onClose: () => void;
  onOpenSubFolder: (folder: NoteFolder, rect: DOMRect) => void;
  onAddNote: (folderId: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [initialTransform, setInitialTransform] = useState<{
    x: number; y: number; scaleX: number; scaleY: number;
  } | null>(null);

  // Compute transform from final panel position back to origin card
  useLayoutEffect(() => {
    if (!panelRef.current) return;
    const panel = panelRef.current.getBoundingClientRect();
    const sx = originRect.width / panel.width;
    const sy = originRect.height / panel.height;
    const originCX = originRect.left + originRect.width / 2;
    const originCY = originRect.top + originRect.height / 2;
    const panelCX = panel.left + panel.width / 2;
    const panelCY = panel.top + panel.height / 2;
    setInitialTransform({
      x: originCX - panelCX,
      y: originCY - panelCY,
      scaleX: sx,
      scaleY: sy,
    });
  }, [originRect]);

  const notes = folder.children.filter(c => c.kind === 'note') as NoteLeaf[];
  const subFolders = folder.children.filter(c => c.kind === 'folder') as NoteFolder[];

  const springConfig = { type: 'spring' as const, damping: 26, stiffness: 260, mass: 0.9 };

  return (
    <>
      {/* Dimmed backdrop */}
      <motion.div
        className="fixed inset-0 z-[99]"
        style={{ backgroundColor: 'rgba(50,50,50,0.45)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      />

      {/* Folder name label above the panel */}
      <motion.div
        className="fixed z-[101] left-0 right-0 flex justify-center pointer-events-none"
        style={{ top: 'calc(12% - 32px)' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ delay: 0.08, duration: 0.22 }}
      >
        <span className="text-xl lowercase" style={{ color: '#E0E0E0', fontWeight: 700 }}>
          {folder.name}
        </span>
      </motion.div>

      {/* Expanded panel */}
      <motion.div
        ref={panelRef}
        className="fixed z-[100] overflow-hidden flex flex-col shadow-2xl"
        style={{
          left: '6%',
          right: '6%',
          top: '12%',
          bottom: '14%',
          borderRadius: 20,
          backgroundColor: getTransparentColorToMatch(folder.bgColor, '#929292', 0.8),
        }}
        initial={
          initialTransform
            ? {
                x: initialTransform.x,
                y: initialTransform.y,
                scaleX: initialTransform.scaleX,
                scaleY: initialTransform.scaleY,
                opacity: 0.7,
              }
            : { scale: 0.5, opacity: 0 }
        }
        animate={{ x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, scale: 1 }}
        exit={
          initialTransform
            ? {
                x: initialTransform.x,
                y: initialTransform.y,
                scaleX: initialTransform.scaleX,
                scaleY: initialTransform.scaleY,
                opacity: 0,
              }
            : { scale: 0.5, opacity: 0 }
        }
        transition={springConfig}
      >
        {/* Action bar inside panel */}
        <motion.div
          className="flex items-center justify-end gap-1 px-3 pt-3 pb-1 shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.2 }}
        >
          <button
            onClick={() => onAddNote(folder.id)}
            className="p-1.5 rounded hover:opacity-70"
          >
            <Plus size={16} style={{ color: '#555' }} />
          </button>
        </motion.div>

        {/* Scrollable contents */}
        <motion.div
          className="flex-1 overflow-y-auto px-3 pb-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.28 }}
        >
          {/* Sub-folders */}
          {subFolders.length > 0 && (
            <div className="mb-3">
              <div className="grid grid-cols-3 gap-2.5">
                {subFolders.map((sf, i) => (
                  <SubFolderCard key={sf.id} folder={sf} parentBgColor={folder.bgColor} onOpen={onOpenSubFolder} delay={i * 0.03} />
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              {notes.map((note, i) => (
                <motion.div
                  key={note.id}
                  className="rounded-xl p-3 aspect-square flex flex-col justify-between cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                  style={{ backgroundColor: getTransparentColorToMatch(folder.color, folder.bgColor, 0.75) }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.03, duration: 0.2 }}
                >
                  {note.title && (
                    <span className="text-xs" style={{ color: '#E8E8E8', fontWeight: 600 }}>
                      {note.title}
                    </span>
                  )}
                  <div className="flex-1" />
                  <div className="space-y-1.5 mt-2">
                    <div className="h-[1.5px] rounded-full" style={{ backgroundColor: '#E8E8E8', opacity: 0.4, width: '80%' }} />
                    <div className="h-[1.5px] rounded-full" style={{ backgroundColor: '#E8E8E8', opacity: 0.4, width: '55%' }} />
                    <div className="h-[1.5px] rounded-full" style={{ backgroundColor: '#E8E8E8', opacity: 0.4, width: '65%' }} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {folder.children.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <FolderOpen size={32} style={{ color: '#999' }} />
              <span className="text-sm" style={{ color: '#888' }}>Empty folder</span>
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}

// ── Sub-folder card inside expanded view ─────────────────────────

function SubFolderCard({
  folder,
  parentBgColor,
  onOpen,
  delay,
}: {
  folder: NoteFolder;
  parentBgColor: string;
  onOpen: (folder: NoteFolder, rect: DOMRect) => void;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <motion.div
      ref={ref}
      className="rounded-xl p-2.5 aspect-square flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
      style={{ backgroundColor: getTransparentColorToMatch(folder.bgColor, parentBgColor, 0.8) }}
      onClick={() => { if (ref.current) onOpen(folder, ref.current.getBoundingClientRect()); }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.15 + delay, duration: 0.2 }}
    >
      <FolderOpen size={22} style={{ color: folder.color }} />
      <span className="text-xs mt-1.5 truncate w-full text-center" style={{ color: '#444', fontWeight: 600 }}>
        {folder.name}
      </span>
      <span className="text-[9px] mt-0.5" style={{ color: '#777' }}>
        {folder.children.length}
      </span>
    </motion.div>
  );
}

// ── Types ────────────────────────────────────────────────────────

interface OpenEntry {
  folder: NoteFolder;
  rect: DOMRect;
}

// ── Color palette for new notes ──────────────────────────────────

const NOTE_COLORS = [
  '#8B7AB8', '#7BA3E0', '#6A8CCE', '#D4A054', '#E8DC82',
  '#D46B6B', '#E8A0A0', '#7DAA7D', '#82D4B8', '#B8B0CC',
  '#C49A6C', '#A0C4A0', '#CC8888', '#88AACC', '#D4B896',
];

// ── New Note Overlay ─────────────────────────────────────────────

function NewNoteOverlay({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (title: string, body: string, color: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0]);
  const titleRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Auto-focus title on mount
  useLayoutEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 300);
  }, []);

  const handleSave = () => {
    if (title.trim() || body.trim()) {
      onSave(title.trim(), body.trim(), selectedColor);
    }
    onClose();
  };

  const springConfig = { type: 'spring' as const, damping: 26, stiffness: 260, mass: 0.9 };

  // Color slider drag
  const [isDragging, setIsDragging] = useState(false);

  const pickColorAtX = (clientX: number) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const idx = Math.min(NOTE_COLORS.length - 1, Math.floor((x / rect.width) * NOTE_COLORS.length));
    setSelectedColor(NOTE_COLORS[idx]);
  };

  return (
    <>
      {/* Dimmed backdrop */}
      <motion.div
        className="fixed inset-0 z-[99]"
        style={{ backgroundColor: 'rgba(50,50,50,0.45)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={handleSave}
      />

      {/* Note panel */}
      <motion.div
        className="fixed z-[100] overflow-hidden flex flex-col shadow-2xl"
        style={{
          left: '6%',
          right: '6%',
          top: '12%',
          bottom: '14%',
          borderRadius: 20,
          backgroundColor: getTransparentColorToMatch(selectedColor, '#929292', 0.8),
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={springConfig}
      >
        {/* Top action bar */}
        <motion.div
          className="flex items-center justify-end gap-1 px-3 pt-3 pb-1 shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.2 }}
        >
          <button
            onClick={handleSave}
            className="p-1.5 rounded hover:opacity-70"
          >
            <X size={18} style={{ color: '#E8E8E8' }} />
          </button>
        </motion.div>

        {/* Text input area */}
        <motion.div
          className="flex-1 px-4 pb-2 overflow-y-auto flex flex-col"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.28 }}
        >
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-transparent focus:outline-none mb-2"
            style={{
              color: '#E8E8E8',
              caretColor: '#E8E8E8',
              fontWeight: 700,
              fontSize: '1.1rem',
              lineHeight: 1.5,
            }}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Start writing..."
            className="w-full flex-1 bg-transparent resize-none focus:outline-none"
            style={{
              color: '#E8E8E8',
              caretColor: '#E8E8E8',
              lineHeight: 1.7,
              fontFamily: 'inherit',
            }}
          />
        </motion.div>

        {/* Color band slider at bottom */}
        <motion.div
          className="shrink-0 px-4 pb-4 pt-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.25 }}
        >
          <div
            ref={sliderRef}
            className="relative h-8 rounded-full overflow-hidden cursor-pointer flex"
            onMouseDown={e => { setIsDragging(true); pickColorAtX(e.clientX); }}
            onMouseMove={e => { if (isDragging) pickColorAtX(e.clientX); }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onTouchStart={e => { pickColorAtX(e.touches[0].clientX); setIsDragging(true); }}
            onTouchMove={e => { if (isDragging) pickColorAtX(e.touches[0].clientX); }}
            onTouchEnd={() => setIsDragging(false)}
          >
            {NOTE_COLORS.map((c, i) => (
              <div
                key={i}
                className="flex-1 h-full relative"
                style={{ backgroundColor: c }}
              >
                {c === selectedColor && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div
                      className="rounded-full"
                      style={{
                        width: 14,
                        height: 14,
                        backgroundColor: '#E8E8E8',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

// ── Main NotePage ────────────────────────────────────────────────

export function NotePage() {
  const { onOpenSidebar } = useOutletContext<{ onOpenSidebar: () => void }>();
  const [tree, setTree] = useState<NoteFolder>(INITIAL_TREE);
  const [searchQuery, setSearchQuery] = useState('');
  const [openStack, setOpenStack] = useState<OpenEntry[]>([]);
  const [showNewNote, setShowNewNote] = useState(false);

  const openFolder = useCallback((folder: NoteFolder, rect: DOMRect) => {
    setOpenStack(prev => [...prev, { folder, rect }]);
  }, []);

  const closeFolder = useCallback(() => {
    setOpenStack(prev => prev.slice(0, -1));
  }, []);

  const resolvedStack = openStack.map(entry => {
    const resolved = findFolder(tree, entry.folder.id);
    return { ...entry, folder: resolved || entry.folder };
  });

  const handleAddNote = useCallback((folderId: string) => {
    setTree(prev =>
      updateTree(prev, folderId, f => ({
        ...f,
        children: [
          ...f.children,
          { kind: 'note' as const, id: `n-${Date.now()}`, title: '', preview: 'New note...' },
        ],
      })),
    );
  }, []);

  const topLevelFolders = tree.children.filter(c => c.kind === 'folder') as NoteFolder[];
  const filteredFolders = searchQuery
    ? topLevelFolders.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.children.some(c =>
          (c.kind === 'note' && (c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.preview.toLowerCase().includes(searchQuery.toLowerCase()))) ||
          (c.kind === 'folder' && c.name.toLowerCase().includes(searchQuery.toLowerCase())),
        ),
      )
    : topLevelFolders;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#E0E0E0]">
      {/* Top Bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-[#D0D0D0] z-50">
        <button onClick={onOpenSidebar} className="p-1.5 hover:bg-[#C0C0C0] rounded">
          <Menu size={20} strokeWidth={3} className="text-[#666]" />
        </button>

        <div className="flex-1 flex items-center bg-[#999] rounded-full px-3 py-1.5">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#E8E8E8] placeholder-[#C0C0C0] focus:outline-none"
          />
          <Search size={14} className="text-[#C0C0C0]" />
        </div>

        <button onClick={() => setShowNewNote(true)} className="p-1.5 hover:bg-[#C0C0C0] rounded">
          <Plus size={20} strokeWidth={3} className="text-[#666]" />
        </button>
      </div>

      {/* Masonry wall */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
        <ResponsiveMasonry columnsCountBreakPoints={{ 0: 2 }}>
          <Masonry gutter="10px">
            {filteredFolders.map(folder => (
              <FolderCard key={folder.id} folder={folder} onOpen={openFolder} onAddNote={handleAddNote} />
            ))}
          </Masonry>
        </ResponsiveMasonry>
        {filteredFolders.length === 0 && (
          <div className="text-center py-12">
            <span className="text-sm" style={{ color: '#999' }}>No folders found</span>
          </div>
        )}
      </div>

      {/* iOS-style folder overlays */}
      <AnimatePresence>
        {resolvedStack.map(entry => (
          <ExpandedFolder
            key={entry.folder.id}
            folder={entry.folder}
            originRect={entry.rect}
            onClose={closeFolder}
            onOpenSubFolder={openFolder}
            onAddNote={handleAddNote}
          />
        ))}
      </AnimatePresence>

      {/* New Note Overlay */}
      <AnimatePresence>
        {showNewNote && (
          <NewNoteOverlay
            onClose={() => setShowNewNote(false)}
            onSave={(title, body, color) => {
              setTree(prev => ({
                ...prev,
                children: [
                  ...prev.children,
                  { kind: 'note' as const, id: `n-${Date.now()}`, title, preview: body, color },
                ],
              }));
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}