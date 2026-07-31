'use client';

// Batch 012 restyle — a segmented single-choice tab group, the mockup's control
// treatment. THREE of these on the matrix (State / Status / Type) and TWO on the
// brand page (Status / Type), so it lives here rather than being copied — the
// same reason CellEditStrip and CELL_STATUS_LABEL are shared.

// A segmented single-choice tab group — the mockup's control treatment. One of
// three on the matrix, two on the brand page.
//
// A real <fieldset>/radiogroup would be the heavier option; this uses
// `role="radiogroup"` + `aria-checked` buttons so arrow-key/tab behaviour stays
// the browser's default for buttons while the group's exclusivity is announced.
// The visible legend doubles as the group's accessible name, so a bare "Done"
// tab is never ambiguous between the State and Status groups.
export function TabGroup<T extends string>({
  legend,
  options,
  labels,
  value,
  onChange,
}: {
  legend: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  const id = `tabgroup-${legend.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div
      className="flex items-center gap-1.5 border border-[color:var(--f92-border)] py-0.5 pl-2.5 pr-0.5"
      style={{ borderRadius: 'var(--radius-lg)', background: 'var(--f92-tint)' }}
    >
      <span
        id={id}
        className="shrink-0 text-[10px] font-semibold uppercase text-[color:var(--f92-gray)]"
        style={{ letterSpacing: 'var(--tracking-wide)' }}
      >
        {legend}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap items-center gap-0.5">
        {options.map((o) => {
          const active = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o)}
              className={
                'cursor-pointer whitespace-nowrap px-2 py-1 text-xs transition ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)] ' +
                (active
                  ? 'font-semibold text-[color:var(--f92-dark)]'
                  : 'font-medium text-[color:var(--f92-gray)] hover:text-[color:var(--f92-dark)]')
              }
              style={{
                borderRadius: 'var(--radius-md)',
                background: active ? 'var(--f92-surface)' : 'transparent',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {labels[o]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
