// Shared PostgREST pager.
//
// WHY THIS EXISTS: PostgREST caps an UNRANGED select at 1,000 rows and returns
// the short result WITHOUT an error. Every consumer that can exceed 1,000 rows
// must page explicitly with .range(), or it silently reads partial data.
//
// This repo has learned that lesson twice already and both times fixed only the
// caller in front of it:
//   - Batch 004.12 added a defensive .range() on the /dashboard/logs queries
//     (CLAUDE.md §15 item 5.18).
//   - scripts/backfill-convert-reconciliation.ts hit the cap for real: its cell
//     read came back truncated, so its "cell does not exist" hard-fail fired on
//     20 rows whose cells were present. It gained a local fetchAllPaged().
// The Pulse PAGES never got it, and on 2026-07-31 NBLYCRO crossed the cap
// (76 directives × 16 brands = 1,216 cells): the matrix read 1,000 of 1,216, so
// 46 directives rendered some cells hollow, under-counted Outstanding, and made
// those cells non-editable (`editable = isAdmin && !!cell`).
//
// So the pager lives HERE, once, and callers share it. A local copy per caller
// is how this drifted apart the first two times.
//
// NOTE the script's version calls process.exit(1) on error, which is correct for
// a one-off script and wrong for a page. This one RETURNS the error so a page can
// surface it the way it already surfaces fetch failures.

/** PostgREST's default `db-max-rows`. Pages are requested at exactly this size. */
export const POSTGREST_PAGE_SIZE = 1000;

/**
 * Hard iteration cap, a backstop against spinning forever if a pathological
 * response keeps returning full pages (e.g. a proxy that ignores Range). At the
 * default page size this allows 500,000 rows — far beyond any real table here,
 * so hitting it means something is wrong, not that the data grew.
 */
export const MAX_PAGES = 500;

export interface PagedFetchResult<T> {
  data: T[];
  /** null on success. Set on a query error OR on hitting MAX_PAGES. */
  error: string | null;
}

/**
 * Read every row of a query by paging in explicit .range() windows until a short
 * page comes back.
 *
 * Usage — pass a thunk that applies .range() to your query:
 *
 *   const { data, error } = await fetchAllPaged('cells', (from, to) =>
 *     supabase.from('directive_brand_status')
 *       .select('id, directive_id, brand_id, status, note')
 *       .in('directive_id', ids)
 *       .range(from, to));
 *
 * Termination: a page shorter than `pageSize` is the last one. A dataset that is
 * an exact multiple of `pageSize` therefore costs one extra empty request — that
 * is deliberate. The alternative (stop when `length === 0`) cannot distinguish
 * "exactly full" from "done", and the alternative of trusting a count header
 * adds a second failure mode. One cheap request beats guessing.
 *
 * Errors are RETURNED, not thrown, so callers can fold them into whatever
 * error-surfacing they already do. On error the partial `data` is still returned
 * — callers should check `error` first and not render partial data as complete,
 * which is the whole failure mode this helper exists to prevent.
 */
export async function fetchAllPaged<T>(
  describe: string,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  opts: { pageSize?: number; maxPages?: number } = {},
): Promise<PagedFetchResult<T>> {
  const pageSize = opts.pageSize ?? POSTGREST_PAGE_SIZE;
  const maxPages = opts.maxPages ?? MAX_PAGES;
  const out: T[] = [];

  for (let i = 0; i < maxPages; i += 1) {
    const from = i * pageSize;
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) {
      return { data: out, error: `${describe}: ${error.message}` };
    }
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < pageSize) return { data: out, error: null };
  }

  // Fail loudly rather than silently returning a capped read — returning
  // maxPages × pageSize rows as if complete would recreate the exact bug this
  // helper exists to fix.
  return {
    data: out,
    error:
      `${describe}: still returning full pages after ${maxPages} requests ` +
      `(${out.length} rows). Refusing to continue — this is not normal data growth.`,
  };
}
