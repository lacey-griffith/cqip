'use client';

// Batch 012 restyle — segmented filter groups, the mockup's control treatment.
// THREE on the matrix (State / Status / Type) and TWO on the brand page
// (Status / Type), so they live here rather than being copied — the same reason
// CellEditStrip and CELL_STATUS_LABEL are shared.
//
// TWO selection models, ONE visual language:
//   TabGroup       single-choice, role="radiogroup" + aria-checked
//   MultiTabGroup  multi-select,  role="group"      + aria-pressed
// The shell and the option button are shared between them (GroupShell,
// OptionButton) so the two cannot drift apart visually while sitting adjacent in
// the same bar.

import type { ReactNode } from 'react';

// Shared shell for both groups (spec §A1). ONE definition, because the two
// groups sit adjacent in the same bar and a half-pixel difference between them
// would read as a rendering fault rather than a distinction.
//
// `active` brightens the border and the legend when the group holds a
// non-default value. It is passed in rather than derived here: what counts as
// "default" differs per group (a single-choice group compares to 'all', a
// multi-select compares to empty), and a component that guessed would be wrong
// for one of them.
function GroupShell({
  id,
  legend,
  active,
  children,
}: {
  id: string;
  legend: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-1.5 border py-0.5 pl-2.5 pr-0.5 transition-colors"
      style={{
        borderRadius: 'var(--radius-lg)',
        background: 'var(--f92-tint)',
        borderColor: active ? 'var(--f92-orange)' : 'var(--f92-border)',
      }}
    >
      <span
        id={id}
        className="shrink-0 text-[10px] font-semibold uppercase transition-colors"
        style={{
          letterSpacing: 'var(--tracking-wide)',
          color: active ? 'var(--f92-orange)' : 'var(--f92-gray)',
        }}
      >
        {legend}
      </span>
      {children}
    </div>
  );
}

function groupId(legend: string) {
  return `tabgroup-${legend.toLowerCase().replace(/\s+/g, '-')}`;
}

export function TabGroup<T extends string>({
  legend,
  options,
  labels,
  value,
  onChange,
  active = false,
}: {
  legend: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
  /** Group holds a non-default value — brightens the border + legend. */
  active?: boolean;
}) {
  const id = groupId(legend);
  return (
    <GroupShell id={id} legend={legend} active={active}>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap items-center gap-0.5">
        {options.map((o) => (
          <OptionButton
            key={o}
            mode="radio"
            label={labels[o]}
            on={o === value}
            onClick={() => onChange(o)}
          />
        ))}
      </div>
    </GroupShell>
  );
}

// MULTI-SELECT sibling of TabGroup (spec §A2 — the STATUS group). Same shell and
// same button treatment, so the two groups read as one control family; only the
// selection model differs.
//
// NOT `role="radiogroup"`. Radio semantics announce exclusivity, which is exactly
// what this group does not have — a screen-reader user told "radio, To do,
// checked" would reasonably conclude that selecting Done had deselected To do.
// Toggle buttons with `aria-pressed` state the real model: each option is
// independently on or off. The visible legend is the group's accessible name via
// `aria-labelledby`, so a bare "Done" is never ambiguous between this group and
// the State group next to it.
//
// `All` is a BUTTON THAT CLEARS, not a sixth member of the set. It is pressed
// exactly when the selection is empty, which is the one state that means "all" —
// see the MatrixCellSelection comment for why a set holding all five statuses is
// a different thing and not an equivalent one.
export function MultiTabGroup<T extends string>({
  legend,
  options,
  labels,
  selected,
  onToggle,
  onClear,
  allLabel = 'All',
}: {
  legend: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: readonly T[];
  onToggle: (v: T) => void;
  onClear: () => void;
  allLabel?: string;
}) {
  const id = groupId(legend);
  const none = selected.length === 0;
  return (
    <GroupShell id={id} legend={legend} active={!none}>
      <div role="group" aria-labelledby={id} className="flex flex-wrap items-center gap-0.5">
        <OptionButton mode="toggle" label={allLabel} on={none} onClick={onClear} />
        {options.map((o) => (
          <OptionButton
            key={o}
            mode="toggle"
            label={labels[o]}
            on={selected.includes(o)}
            onClick={() => onToggle(o)}
          />
        ))}
      </div>
    </GroupShell>
  );
}

// ONE option button for both groups. The "on" treatment is shared rather than
// duplicated deliberately: a user should not have to learn two visual languages
// for "this option is selected" in a single filter bar, and two copies of the
// same className/style pair is precisely the kind of thing that drifts silently
// when only one of them is edited.
//
// Only the ARIA differs, and it must: `aria-checked` on a radio announces
// exclusivity, `aria-pressed` on a toggle announces independent on/off. Getting
// that backwards would tell a screen-reader user the opposite of how the control
// behaves — which is why it is a required prop with no default.
function OptionButton({
  mode,
  label,
  on,
  onClick,
}: {
  mode: 'radio' | 'toggle';
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  const pressed = on;
  return (
    <button
      type="button"
      role={mode === 'radio' ? 'radio' : undefined}
      aria-checked={mode === 'radio' ? pressed : undefined}
      aria-pressed={mode === 'toggle' ? pressed : undefined}
      onClick={onClick}
      className={
        'cursor-pointer whitespace-nowrap px-2 py-1 text-xs transition ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-focus-ring)] ' +
        (pressed
          ? 'font-semibold text-[color:var(--f92-dark)]'
          : 'font-medium text-[color:var(--f92-gray)] hover:text-[color:var(--f92-dark)]')
      }
      style={{
        borderRadius: 'var(--radius-md)',
        background: pressed ? 'var(--f92-surface)' : 'transparent',
        boxShadow: pressed ? 'var(--shadow-sm)' : 'none',
      }}
    >
      {label}
    </button>
  );
}
