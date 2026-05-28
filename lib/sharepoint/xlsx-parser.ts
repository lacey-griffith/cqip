// Parses the `Preview Links` sheet per spec §3.2.
// Sheet name match is case-insensitive + trim-tolerant.
// Row 1: title (skip). Row 2: blank (skip). Row 3: header (skip).
// Row 4+: data. Stop at first row where Col A is empty.
// Col A → label, Col B → variation, Col C → national_url,
// Col D → local_url (nullable).

import * as XLSX from 'xlsx-js-style';

export const PREVIEW_SHEET_NAME = 'Preview Links';
const HEADER_ROWS = 3;

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

  const dataRows: PreviewRow[] = [];
  for (let i = HEADER_ROWS; i < rows.length; i++) {
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
