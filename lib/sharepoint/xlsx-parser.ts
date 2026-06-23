// Parses the `Preview Links` sheet per spec §3.2.
// Sheet name match is case-insensitive + trim-tolerant.
// Header depth is variable (1–2 rows). Data begins at the first row
// whose Col A is a variation label (Control/V1/V2/…), read
// contiguously; stop at first empty Col A.
// Col A → label, Col B → variation, Col C → national_url,
// Col D → local_url (nullable).

import * as XLSX from 'xlsx-js-style';

export const PREVIEW_SHEET_NAME = 'Preview Links';
// Matches a variation-label cell in Col A (case-insensitive). The
// title row and the optional National/Local sub-header row both have
// a non-matching Col A, so this locates the data start regardless of
// how many header rows precede it.
const LABEL_RE = /^(control|v\d+)$/i;

export interface PreviewRow {
  label: string;
  variation: string;
  national_url: string;
  local_url: string | null;
}

export class PreviewSheetNotFoundError extends Error {
  constructor() {
    super(`Sheet "${PREVIEW_SHEET_NAME}" not found`);
    this.name = 'PreviewSheetNotFoundError';
  }
}

function cellToString(cell: unknown): string {
  if (cell == null) return '';
  return String(cell).trim();
}

function findSheet(workbook: XLSX.WorkBook): string | null {
  const target = PREVIEW_SHEET_NAME.toLowerCase();
  for (const name of workbook.SheetNames) {
    if (name.trim().toLowerCase() === target) return name;
  }
  return null;
}

export function parsePreviewLinks(
  bytes: ArrayBuffer | Uint8Array | Buffer,
): PreviewRow[] {
  const buf =
    bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(bytes as ArrayBuffer);
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = findSheet(wb);
  if (!sheetName) throw new PreviewSheetNotFoundError();
  const sheet = wb.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: true,
  });

  // Dynamic data-start detection: the first row whose Col A is a
  // variation label. A fixed header offset would regress either the
  // one-row-header sheets or the two-row-header (sub-header) sheets
  // depending on the constant chosen.
  let start = -1;
  for (let i = 0; i < rows.length; i++) {
    if (LABEL_RE.test(cellToString((rows[i] ?? ([] as unknown[]))[0]))) {
      start = i;
      break;
    }
  }
  if (start === -1) return [];

  const dataRows: PreviewRow[] = [];
  for (let i = start; i < rows.length; i++) {
    const row = (rows[i] ?? []) as unknown[];
    const label = cellToString(row[0]);
    if (label === '') break;
    const variation = cellToString(row[1]);
    const nationalUrl = cellToString(row[2]);
    const localUrl = cellToString(row[3]);
    dataRows.push({
      label,
      variation,
      national_url: nationalUrl,
      local_url: localUrl === '' ? null : localUrl,
    });
  }
  return dataRows;
}
