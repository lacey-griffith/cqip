'use client';

// Multi-select Combobox primitive. Sibling to Combobox; the two
// components share a visual identity but the value contract here
// is `string[]` and toggling an option adds or removes it.
//
// Built for the taxonomy-backed edit-dialog inputs in Batch 005.28.
// Generic shape; reusable for any multi-select field with a finite
// option list.

import * as React from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface MultiComboboxProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiComboboxOption[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function MultiCombobox({
  values,
  onChange,
  options,
  placeholder = 'Select...',
  emptyLabel = 'No options.',
  className,
  disabled = false,
  id,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedValues = React.useMemo(() => new Set(values), [values]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  function toggle(opt: MultiComboboxOption) {
    if (selectedValues.has(opt.value)) {
      onChange(values.filter(v => v !== opt.value));
    } else {
      onChange([...values, opt.value]);
    }
  }

  function removePill(v: string) {
    onChange(values.filter(x => x !== v));
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
      if (opt) toggle(opt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  const triggerLabel = values.length === 0 ? placeholder : `${values.length} selected`;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between rounded-md border border-[color:var(--f92-border)] bg-white px-3 py-2 text-left text-sm text-[color:var(--f92-dark)] shadow-sm ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)] disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn('truncate', values.length === 0 && 'text-[color:var(--f92-lgray)]')}>
          {triggerLabel}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {values.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map(v => {
            const opt = options.find(o => o.value === v);
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full bg-[color:var(--f92-tint)] px-2 py-0.5 text-xs text-[color:var(--f92-dark)]"
              >
                <span className="max-w-[14rem] truncate">{opt?.label ?? v}</span>
                <button
                  type="button"
                  onClick={() => removePill(v)}
                  className="rounded-full p-0.5 hover:bg-[color:var(--f92-warm-hover)]"
                  aria-label={`Remove ${opt?.label ?? v}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {open ? (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-[color:var(--f92-border)] bg-[color:var(--f92-surface)] shadow-lg">
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
          <div className="max-h-60 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[color:var(--f92-gray)]">{emptyLabel}</div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = selectedValues.has(opt.value);
                const isHighlighted = idx === highlight;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => toggle(opt)}
                    className={cn(
                      'flex w-full items-start justify-between gap-2 px-3 py-1.5 text-left text-sm',
                      isHighlighted ? 'bg-[color:var(--f92-tint)] text-[color:var(--f92-dark)]' : 'text-[color:var(--f92-dark)]',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{opt.label}</div>
                      {opt.description ? (
                        <div className="mt-0.5 truncate text-xs text-[color:var(--f92-gray)]">{opt.description}</div>
                      ) : null}
                    </div>
                    {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--f92-orange)]" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
