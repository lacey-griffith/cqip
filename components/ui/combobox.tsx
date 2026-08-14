'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computePopoverPosition, type PopoverPosition } from '@/lib/ui/popover-position';

// Matches the panel's own max-h-60 (15rem). Used only to decide whether to flip
// above the trigger; the rendered panel is still bounded by that class.
const PANEL_MAX_HEIGHT = 240;

// The option shape and the filter both live in lib/ui/combobox-filter.ts so they
// can be tested without loading the component tree. Re-exported here so existing
// consumers keep importing ComboboxOption from the component they use.
import { matchesComboboxQuery, type ComboboxOption } from '@/lib/ui/combobox-filter';

export type { ComboboxOption };

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  /**
   * Rendered on the trigger button so a sibling `<label htmlFor>` associates.
   * `<button>` IS a labelable element, so the association is valid and gives the
   * label click-to-activate. Mirrors MultiCombobox (`multi-combobox.tsx:29`) and
   * shadcn's SelectTrigger, which Severity and Status already use — before this,
   * Brand was the only control in either filter row whose label pointed at nothing.
   *
   * It does NOT change the accessible NAME: a button names itself from its content,
   * so the trigger still announces the selected value. SelectTrigger behaves the
   * same way, so the row is consistent. This fixes the broken association, not the
   * naming model.
   */
  id?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  emptyLabel = 'No results.',
  className,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  // The portalled panel is NOT a descendant of rootRef, so the outside-click
  // handler must know about it separately — see the comment there.
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<PopoverPosition | null>(null);

  const selected = options.find(o => o.value === value);

  const filtered = React.useMemo(
    () => options.filter(o => matchesComboboxQuery(o, query)),
    [options, query],
  );

  // Position is measured from the live trigger rect rather than derived from
  // layout, because the panel is now fixed-positioned in a portal and has no
  // positioned ancestor to inherit from. Recomputed on scroll and resize: a fixed
  // panel does not move with the page, so without this it detaches from its
  // trigger the moment anything scrolls. `true` on the scroll listener catches
  // scrolling INSIDE ancestors (the logs filter card, the dialog body), not just
  // the window.
  React.useEffect(() => {
    if (!open) return;
    function measure() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPosition(
        computePopoverPosition(
          { top: r.top, bottom: r.bottom, left: r.left, width: r.width },
          window.innerHeight,
          PANEL_MAX_HEIGHT,
        ),
      );
    }
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      // ⚠ BOTH refs. Before the portal the panel lived inside rootRef, so one
      // containment check covered it. A portalled panel is a child of <body>, so
      // checking rootRef alone would treat every click INSIDE the open panel —
      // including the search box and every option — as an outside click and close
      // it instantly, making the control unusable.
      const insideTrigger = rootRef.current?.contains(target) ?? false;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      if (!insideTrigger && !insidePanel) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  React.useEffect(() => {
    if (open) {
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
    }
  }, [open]);

  function commit(opt: ComboboxOption) {
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) commit(opt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => setOpen(o => !o)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-[color:var(--f92-border)] bg-white px-3 py-2 text-left text-sm text-[color:var(--f92-dark)] shadow-sm ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn('truncate', !selected && 'text-[color:var(--f92-lgray)]')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && position && typeof document !== 'undefined'
        ? createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: position.top, left: position.left, width: position.width }}
          className="z-50 rounded-md border border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] shadow-lg">
          <div className="flex items-center gap-2 border-b border-[color:var(--f92-border)] px-3 py-2">
            <Search className="h-4 w-4 text-[color:var(--f92-gray)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setHighlight(0); }}
              onKeyDown={onKeyDown}
              placeholder="Type to filter..."
              className="w-full bg-transparent text-sm text-[color:var(--f92-dark)] placeholder:text-[color:var(--f92-lgray)] focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[color:var(--f92-gray)]">{emptyLabel}</div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlight;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => commit(opt)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm',
                      isHighlighted ? 'bg-[color:var(--f92-tint)] text-[color:var(--f92-dark)]' : 'text-[color:var(--f92-dark)]',
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected ? <Check className="h-4 w-4 text-[color:var(--f92-orange)]" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
        )
        : null}
    </div>
  );
}
