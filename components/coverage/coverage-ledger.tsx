'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { DeliverySparkline } from '@/components/coverage/sparkline';
import { formatReworkRatio, type Brand, type CoverageRow } from '@/lib/coverage/queries';
import {
  OVERLAY_KEYS,
  PIPELINE_STAGES,
  STAGE_LABELS,
  overlayKeyForTag,
  type OverlayKey,
  type PipelineBrand,
  type PipelineStage,
} from '@/lib/coverage/pipeline-stages';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Coverage Ledger (Batch 005.2, polished 005.3). One accordion row per brand:
// collapsed summary (delivered / this-week / pipeline) + inline expandable
// detail (7-day sparkline, delivery stats, per-stage pipeline with status-tag
// chips). Merges the Batch 010 split Output + Pipeline tables into one structure.
//
// Read-only render. All numbers come from functions/state the page already
// owns (lib/coverage/queries.ts + /api/coverage/pipeline); this file only
// derives per-stage ready/held from the shared pipeline data and renders.
// ---------------------------------------------------------------------------

// 6-column grid (Batch 005.3 §2.1 dropped the standalone "Live" summary column —
// a live test never carries a hold tag, so its ratio is always N/N; the freed
// width goes to the pipeline bar). Fixed-px + fr mix, so it lives in the layout
// (inline), not as a color token.
const GRID = '22px 4px minmax(220px,1.3fr) 120px 92px minmax(320px,1.7fr)';

export type LedgerSortKey = 'brand' | 'delivered' | 'thisWk' | 'pipeline';

// Stacked-bar / chip segment colors — tokens (§13 r25). `ready` = untagged.
const SEG_VAR: Record<'ready' | OverlayKey, string> = {
  ready: 'var(--ledger-seg-ready)',
  needs_info: 'var(--ledger-seg-ni)',
  troubleshooting: 'var(--ledger-seg-ts)',
  on_hold: 'var(--ledger-seg-oh)',
  awaiting_client_input: 'var(--ledger-seg-aci)',
};

// Chip fills stay bright in both themes (README: solid fill + near-black text).
const CHIP_VAR: Record<OverlayKey, string> = {
  needs_info: 'var(--ledger-chip-ni)',
  troubleshooting: 'var(--ledger-chip-ts)',
  on_hold: 'var(--ledger-chip-oh)',
  awaiting_client_input: 'var(--ledger-chip-aci)',
};

// Concise chip labels matching the mock (the verbatim Jira match strings live
// in OVERLAY_TAG_VALUES / the data layer, not here).
const CHIP_LABEL: Record<OverlayKey, string> = {
  needs_info: 'Needs Info',
  troubleshooting: 'Troubleshooting',
  on_hold: 'On Hold',
  awaiting_client_input: 'Awaiting',
};

// Segment render order (mock order): ready first, then the four hold tags.
const SEG_ORDER: Array<'ready' | OverlayKey> = ['ready', ...OVERLAY_KEYS];

// The last pipeline stage is Live (Batch 005.3 §2.2). Derived from the SoT
// order, not hardcoded, so it tracks any future change to PIPELINE_STAGES.
const LIVE_STAGE: PipelineStage = PIPELINE_STAGES[PIPELINE_STAGES.length - 1];

export interface StageSummary {
  stage: PipelineStage;
  total: number;
  /** tickets with NO overlay tag (total − held). */
  ready: number;
  /** tickets carrying ≥1 overlay tag. */
  held: number;
  /** per-tag counts (may overlap — a ticket with two tags counts in both). */
  perTag: Record<OverlayKey, number>;
}

export interface LedgerRow {
  row: CoverageRow;
  stages: StageSummary[]; // length 5, PIPELINE_STAGES order
  wip: number; // Σ stage totals
  wipReady: number; // Σ stage ready (untagged)
  wipHeld: number; // wip − wipReady
  aggPerTag: Record<OverlayKey, number>;
  live: StageSummary; // stages[4]
}

function emptyPerTag(): Record<OverlayKey, number> {
  return { needs_info: 0, troubleshooting: 0, on_hold: 0, awaiting_client_input: 0 };
}

function summarizeStage(pipeline: PipelineBrand | undefined, stage: PipelineStage): StageSummary {
  const total = pipeline?.counts[stage] ?? 0;
  const perTag = emptyPerTag();
  for (const k of OVERLAY_KEYS) perTag[k] = pipeline?.overlays[k][stage] ?? 0;
  // `ready` is derived from tickets[] (count with zero overlay tags), NOT
  // total − Σ perTag — a ticket carrying two tags would be double-subtracted.
  const stageTickets = (pipeline?.tickets ?? []).filter(t => t.stage === stage);
  const held = stageTickets.filter(t => t.tags.some(tag => overlayKeyForTag(tag) !== null)).length;
  const ready = Math.max(0, total - held);
  return { stage, total, ready, held, perTag };
}

// Pure merge of a CoverageRow with its live pipeline data. Exported so the
// page can build the array once, then sort by the pipeline-derived keys
// (live / pipeline) alongside the coverage-derived keys.
export function buildLedgerRow(row: CoverageRow, pipeline: PipelineBrand | undefined): LedgerRow {
  const stages = PIPELINE_STAGES.map(s => summarizeStage(pipeline, s));
  const wip = stages.reduce((a, s) => a + s.total, 0);
  const wipReady = stages.reduce((a, s) => a + s.ready, 0);
  const aggPerTag = emptyPerTag();
  for (const s of stages) for (const k of OVERLAY_KEYS) aggPerTag[k] += s.perTag[k];
  return {
    row,
    stages,
    wip,
    wipReady,
    wipHeld: wip - wipReady,
    aggPerTag,
    live: stages[4],
  };
}

// Ready-figure color: faint when the stage is empty, periwinkle when there's
// ready work, muted when everything is held.
function readyColorVar(total: number, ready: number): string {
  if (total === 0) return 'var(--f92-lgray)';
  if (ready > 0) return 'var(--ledger-seg-ready)';
  return 'var(--f92-gray)';
}

function caretFor(active: boolean, dir: 'asc' | 'desc'): string {
  if (!active) return ' ⇅';
  return dir === 'asc' ? ' ↑' : ' ↓';
}

interface CoverageLedgerProps {
  rows: LedgerRow[];
  loading: boolean;
  brandsConfigured: boolean;
  showPaused: boolean; // drives the Paused legend swatch (§2.8)
  sortKey: LedgerSortKey | null; // null = default (status), no active column
  sortDir: 'asc' | 'desc';
  onSort: (k: LedgerSortKey) => void;
  isAdmin: boolean;
  onAdmin: (brand: Brand) => void;
  onFullDetail: (row: CoverageRow) => void;
  onStage: (row: CoverageRow, stage: PipelineStage) => void;
}

const SORT_COLUMNS: Array<{ key: LedgerSortKey; label: string; align: 'left' | 'right'; padLeft?: number }> = [
  { key: 'brand', label: 'Brand', align: 'left', padLeft: 12 },
  { key: 'delivered', label: 'Delivered 28d', align: 'right' },
  { key: 'thisWk', label: 'This Wk', align: 'right' },
  { key: 'pipeline', label: 'Pipeline · ready / WIP', align: 'left', padLeft: 18 },
];

export function CoverageLedger({
  rows,
  loading,
  brandsConfigured,
  showPaused,
  sortKey,
  sortDir,
  onSort,
  isAdmin,
  onAdmin,
  onFullDetail,
  onStage,
}: CoverageLedgerProps) {
  // Single source of expand state (§3): a Set of brand ids. Order-independent,
  // so it survives a sort. Inits empty → all rows collapsed on load (§2.6).
  const [open, setOpen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Expand/collapse all operate on the currently filter/paused-scoped `rows`,
  // so "expand all" opens exactly what's visible (§3).
  const expandAll = () => setOpen(new Set(rows.map(lr => lr.row.brand.id)));
  const collapseAll = () => setOpen(new Set());
  const bulkDisabled = loading || rows.length === 0;

  return (
    <div>
      {/* Ledger header + legend */}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="cqip-section-title text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--f92-navy)]">
            Coverage Ledger
          </span>
          <span className="text-xs text-[color:var(--f92-gray)]">Delivered + live pipeline, one row per brand.</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Expand all / Collapse all (§3) — operate on the existing open Set. */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={expandAll}
              disabled={bulkDisabled}
              className="text-[11px] font-medium text-[color:var(--f92-gray)] transition hover:text-[color:var(--f92-dark)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              disabled={bulkDisabled}
              className="text-[11px] font-medium text-[color:var(--f92-gray)] transition hover:text-[color:var(--f92-dark)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Collapse all
            </button>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--f92-gray)]">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: 'var(--ledger-drought)' }} />
              Drought
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--f92-gray)]">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: 'var(--ledger-active)' }} />
              Active
            </span>
            {/* Paused swatch only when paused brands are being shown (§2.8). */}
            {showPaused ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--f92-gray)]">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: 'var(--ledger-paused)' }} />
                Paused
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Column labels — four sortable cells (Live column dropped, §2.1) */}
          <div
            className="grid items-end border-b border-[color:var(--f92-border)] pb-3 pr-3.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[color:var(--f92-gray)]"
            style={{ gridTemplateColumns: GRID }}
          >
            <div />
            <div />
            {SORT_COLUMNS.map(col => {
              const active = sortKey === col.key;
              return (
                <div
                  key={col.key}
                  className={cn(col.align === 'right' && 'text-right')}
                  style={col.padLeft ? { paddingLeft: col.padLeft } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col.key)}
                    aria-label={`Sort by ${col.label}${active ? `, currently ${sortDir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
                    className="inline select-none uppercase hover:text-[color:var(--f92-dark)] focus-visible:underline"
                  >
                    {col.label}
                    <span className={active ? 'text-[color:var(--f92-orange)]' : 'text-[color:var(--f92-lgray)]'}>
                      {caretFor(active, sortDir)}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {loading ? (
            Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="border-b border-[color:var(--f92-border)] px-3.5 py-4">
                <div className="h-4 w-full animate-pulse rounded bg-[color:var(--f92-tint)]" />
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="px-3.5 py-10 text-center text-sm text-[color:var(--f92-gray)]">
              {!brandsConfigured
                ? 'No brands configured. Ask an admin to seed brands with “Add brand”.'
                : 'No brands match the current filters.'}
            </div>
          ) : (
            rows.map(lr => {
              const { row, stages, wip, wipReady, wipHeld } = lr;
              const { brand } = row;
              const isOpen = open.has(brand.id);
              const railColor = brand.is_paused
                ? 'var(--ledger-paused)'
                : row.droughtFlag
                  ? 'var(--ledger-drought)'
                  : 'var(--ledger-active)';
              // Summary numerals (Delivered 28d + This Wk) are colored by brand
              // status (§2.7), NOT zero-vs-nonzero. Paused uses muted grey (the
              // row is already opacity-75); drought/active reuse the rail tokens.
              const numeralColor = brand.is_paused
                ? 'var(--f92-lgray)'
                : row.droughtFlag
                  ? 'var(--ledger-drought)'
                  : 'var(--ledger-active)';

              return (
                <div
                  key={brand.id}
                  className={cn(
                    'border-b border-[color:var(--f92-border)]',
                    isOpen && 'bg-[color:var(--f92-tint)]',
                    brand.is_paused && 'opacity-75',
                  )}
                >
                  {/* Summary row — clickable to toggle. The chevron is the
                      keyboard-accessible control (labeled aria-expanded); the
                      row onClick is a mouse convenience. Gear + full-detail are
                      separate focusable controls (gear stops propagation). */}
                  <div
                    onClick={() => toggle(brand.id)}
                    className="grid cursor-pointer items-center py-3.5 pr-3.5 transition hover:bg-[color:var(--f92-warm-hover)]"
                    style={{ gridTemplateColumns: GRID }}
                  >
                    {/* chevron */}
                    <div className="flex justify-center">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${brand.display_name}`}
                        onClick={e => {
                          e.stopPropagation();
                          toggle(brand.id);
                        }}
                        className="text-xs text-[color:var(--f92-lgray)] transition-transform focus-visible:text-[color:var(--f92-orange)]"
                        style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
                      >
                        ▶
                      </button>
                    </div>
                    {/* rail */}
                    <div className="h-8 w-1 rounded-[3px]" style={{ background: railColor }} />
                    {/* brand */}
                    <div className="flex items-center gap-2 pl-3">
                      <span className="text-[15px] font-medium text-[color:var(--f92-dark)]">{brand.display_name}</span>
                      <span className="rounded-full border border-[color:var(--f92-border)] bg-white px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-widest text-[color:var(--f92-gray)]">
                        {brand.brand_code}
                      </span>
                      {isAdmin ? (
                        <button
                          type="button"
                          aria-label={`Manage ${brand.display_name}`}
                          onClick={e => {
                            e.stopPropagation();
                            onAdmin(brand);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--f92-lgray)] transition hover:bg-[color:var(--f92-tint)] hover:text-[color:var(--f92-dark)] focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
                        >
                          <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    {/* delivered 28d — colored by status (§2.7) */}
                    <div
                      className="text-right text-[22px] font-bold tabular-nums"
                      style={{ color: numeralColor }}
                    >
                      {row.testsRolling28}
                    </div>
                    {/* this wk — colored by status (§2.7) */}
                    <div
                      className="text-right text-[15px] font-medium tabular-nums"
                      style={{ color: numeralColor }}
                    >
                      {row.testsCurrentWeek}
                    </div>
                    {/* pipeline */}
                    <div className="flex items-center gap-3 pl-[18px]">
                      <div className="whitespace-nowrap tabular-nums">
                        <span className="text-[18px] font-bold" style={{ color: 'var(--ledger-seg-ready)' }}>
                          {wipReady}
                        </span>
                        <span className="text-xs font-medium text-[color:var(--f92-gray)]"> / {wip}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="flex h-[7px] overflow-hidden rounded"
                          style={{ background: 'var(--ledger-bar-track)' }}
                        >
                          {wip > 0 ? (
                            SEG_ORDER.map(seg => {
                              const n = seg === 'ready' ? wipReady : lr.aggPerTag[seg];
                              if (n <= 0) return null;
                              return <div key={seg} style={{ flex: `${n} 1 0`, background: SEG_VAR[seg] }} />;
                            })
                          ) : (
                            <div style={{ flex: 1, background: 'var(--ledger-bar-empty)' }} />
                          )}
                        </div>
                        <div className="mt-1 text-[10px] text-[color:var(--f92-gray)]">
                          {wipReady} ready · {wipHeld} held by tags
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen ? (
                    <div className="flex flex-col gap-6 border-b border-[color:var(--f92-border)] bg-[color:var(--f92-bg)] px-4 pb-7 pl-10 pt-1.5 lg:flex-row lg:gap-6">
                      {/* delivery detail */}
                      <div className="w-full lg:w-[236px] lg:flex-none">
                        <div className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--f92-gray)]">
                          Delivery Detail
                        </div>
                        <div className="mb-4">
                          <DeliverySparkline values={row.daily7} />
                        </div>
                        <dl className="divide-y divide-[color:var(--f92-border)] overflow-hidden rounded-xl border border-[color:var(--f92-border)]">
                          {[
                            { l: 'Last Week', v: String(row.testsLastWeek), zero: row.testsLastWeek === 0 },
                            { l: 'This Month', v: String(row.testsCurrentMonth), zero: row.testsCurrentMonth === 0 },
                            { l: 'Rework Ratio', v: formatReworkRatio(row.testsRolling28, row.reworkRolling28), muted: true },
                          ].map(stat => (
                            <div
                              key={stat.l}
                              className="flex items-center justify-between bg-white px-3 py-2.5"
                            >
                              <dt className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[color:var(--f92-gray)]">
                                {stat.l}
                              </dt>
                              <dd
                                className="text-[15px] font-semibold tabular-nums"
                                style={{
                                  color: stat.muted
                                    ? 'var(--f92-gray)'
                                    : stat.zero
                                      ? 'var(--f92-lgray)'
                                      : 'var(--f92-dark)',
                                }}
                              >
                                {stat.v}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        {/* Secondary/outlined button (§2.5) — was a text link,
                            too easy to miss in smoke. */}
                        <button
                          type="button"
                          onClick={() => onFullDetail(row)}
                          className="mt-4 inline-flex items-center gap-1 rounded-lg border border-[color:var(--f92-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--f92-navy)] transition hover:border-[color:var(--f92-orange)] hover:text-[color:var(--f92-orange)]"
                        >
                          Full detail →
                        </button>
                      </div>

                      {/* pipeline by stage */}
                      <div className="min-w-0 flex-1">
                        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--f92-gray)]">
                            Pipeline by Stage
                          </span>
                          <span className="text-[11px] text-[color:var(--f92-gray)]">
                            Bold = ready (no tags) · remainder held by status tags
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
                          {stages.map(st => {
                            const chips = OVERLAY_KEYS.filter(k => st.perTag[k] > 0);
                            const hasBar = st.total > 0;
                            // Live shows presence ("N live"), not a ready/total
                            // fraction — a live test never carries a hold tag
                            // (§2.2). DEFENSIVE: if a tag ever lands on Live
                            // (held > 0 — mid-sync, cron lag, dirty data), fall
                            // back to the normal ready/total + bar + chips render
                            // so the anomaly SURFACES. Do NOT hardcode held === 0.
                            const presence = st.stage === LIVE_STAGE && st.held === 0;
                            return (
                              <div
                                key={st.stage}
                                className="rounded-[10px] border border-[color:var(--f92-border)] bg-white p-3"
                              >
                                {/* Stage NAME is the drawer link when the stage
                                    has tickets (§2.3); empty stage = plain span,
                                    no arrow, no dead drawer. */}
                                <div className="mb-2">
                                  {st.total > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => onStage(row, st.stage)}
                                      aria-label={`View ${STAGE_LABELS[st.stage]} tickets for ${brand.display_name}`}
                                      className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[color:var(--f92-navy)] transition hover:text-[color:var(--f92-orange)] hover:underline focus-visible:underline"
                                    >
                                      {STAGE_LABELS[st.stage]} →
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[color:var(--f92-gray)]">
                                      {STAGE_LABELS[st.stage]}
                                    </span>
                                  )}
                                </div>
                                {presence ? (
                                  // Live, clean: presence only ("N live"), no
                                  // fraction / bar / chips.
                                  <div className="flex items-baseline gap-1.5">
                                    <span
                                      className="text-[21px] font-bold tabular-nums"
                                      style={{ color: readyColorVar(st.total, st.ready) }}
                                    >
                                      {st.total === 0 ? '—' : st.total}
                                    </span>
                                    {st.total > 0 ? (
                                      <span className="text-xs font-medium text-[color:var(--f92-gray)]">live</span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-baseline gap-1.5">
                                      <span
                                        className="text-[21px] font-bold tabular-nums"
                                        style={{ color: readyColorVar(st.total, st.ready) }}
                                      >
                                        {st.total === 0 ? '—' : st.ready}
                                      </span>
                                      {st.total > 0 ? (
                                        <span className="text-xs font-medium tabular-nums text-[color:var(--f92-gray)]">
                                          / {st.total}
                                        </span>
                                      ) : null}
                                    </div>
                                    {hasBar ? (
                                      <div
                                        className="mt-2.5 flex h-1.5 overflow-hidden rounded-[3px]"
                                        style={{ background: 'var(--ledger-bar-track)' }}
                                      >
                                        {SEG_ORDER.map(seg => {
                                          const n = seg === 'ready' ? st.ready : st.perTag[seg];
                                          if (n <= 0) return null;
                                          return <div key={seg} style={{ flex: `${n} 1 0`, background: SEG_VAR[seg] }} />;
                                        })}
                                      </div>
                                    ) : null}
                                    {chips.length > 0 ? (
                                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                                        {chips.map(k => (
                                          <span
                                            key={k}
                                            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold"
                                            style={{ background: CHIP_VAR[k], borderColor: CHIP_VAR[k], color: 'var(--ledger-chip-fg)' }}
                                          >
                                            <span
                                              className="h-1.5 w-1.5 rounded-full"
                                              style={{ background: 'var(--ledger-chip-dot)' }}
                                            />
                                            {CHIP_LABEL[k]} {st.perTag[k]}
                                          </span>
                                        ))}
                                      </div>
                                    ) : hasBar ? (
                                      <div className="mt-2.5 text-[10.5px] font-medium text-[color:var(--ledger-active)]">
                                        ✓ all clear
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
