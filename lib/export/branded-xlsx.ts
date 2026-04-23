// Shared branded-XLSX writer for CQIP exports. Uses xlsx-js-style for
// styling (the vanilla xlsx community edition doesn't support cell
// styles). Produces one sheet with a navy title bar, subtitle meta line,
// summary callout rows, styled header, alternating data rows, drought-
// style highlight callouts, and a footer line with timestamp. Freezes
// the header row so the table scrolls cleanly in Excel / Sheets /
// Numbers.

import XLSX from 'xlsx-js-style';

export interface BrandedXlsxOptions {
  title: string;
  subtitle?: string;
  exportedBy?: string;
  summaryRows?: Array<{ label: string; value: string | number }>;
  headers: string[];
  rows: Array<(string | number | null)[]>;
  highlightRowWhen?: (row: (string | number | null)[]) => boolean;
  highlightNote?: string;
  filename: string;
}

type CellValue = string | number | null;

function str(v: CellValue): string {
  return v == null ? '' : String(v);
}

export function downloadBrandedXlsx(opts: BrandedXlsxOptions): void {
  const colCount = Math.max(opts.headers.length, 1);
  const lastColLetter = XLSX.utils.encode_col(colCount - 1);

  const navy = '1E2D6B';
  const orange = 'F47920';
  const warm = 'FEF6EE';
  const borderColor = 'E8D5C4';
  const amber = 'FEF3C7';
  const dark = '1A1A2E';
  const gray = '6B7280';

  const border = {
    top: { style: 'thin', color: { rgb: borderColor } },
    bottom: { style: 'thin', color: { rgb: borderColor } },
    left: { style: 'thin', color: { rgb: borderColor } },
    right: { style: 'thin', color: { rgb: borderColor } },
  } as const;

  const rowsOut: Array<Record<string, unknown>[]> = [];
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
  const rowHeights: Record<number, number> = {};
  let rowIndex = 0;

  // Row 1: title bar
  const titleCell: Record<string, unknown> = {
    v: `FUSION92 · CQIP — ${opts.title}`,
    s: {
      font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: navy } },
      alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
    },
  };
  rowsOut.push([titleCell, ...Array.from({ length: colCount - 1 }, () => ({ s: { fill: { patternType: 'solid', fgColor: { rgb: navy } } } }))]);
  merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: colCount - 1 } });
  rowHeights[rowIndex] = 36;
  rowIndex += 1;

  // Orange accent bar (thin)
  const accentCell: Record<string, unknown> = {
    v: '',
    s: { fill: { patternType: 'solid', fgColor: { rgb: orange } } },
  };
  rowsOut.push([accentCell, ...Array.from({ length: colCount - 1 }, () => ({ s: { fill: { patternType: 'solid', fgColor: { rgb: orange } } } }))]);
  merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: colCount - 1 } });
  rowHeights[rowIndex] = 4;
  rowIndex += 1;

  // Row: subtitle + meta
  if (opts.subtitle || opts.exportedBy) {
    const parts = [opts.subtitle, opts.exportedBy ? `by ${opts.exportedBy}` : null].filter(Boolean);
    rowsOut.push([
      {
        v: parts.join(' · '),
        s: {
          font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: gray } },
          alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
        },
      },
      ...Array.from({ length: colCount - 1 }, () => ({})),
    ]);
    merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: colCount - 1 } });
    rowHeights[rowIndex] = 18;
    rowIndex += 1;
  }

  // Blank spacer
  rowsOut.push([]);
  rowIndex += 1;

  // Summary callout rows
  if (opts.summaryRows && opts.summaryRows.length > 0) {
    for (const { label, value } of opts.summaryRows) {
      const labelCell = {
        v: label,
        s: {
          font: { name: 'Calibri', sz: 10, color: { rgb: gray } },
          fill: { patternType: 'solid', fgColor: { rgb: warm } },
          alignment: { horizontal: 'left', indent: 1 },
        },
      };
      const valueCell = {
        v: value,
        t: typeof value === 'number' ? 'n' : 's',
        s: {
          font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: dark } },
          fill: { patternType: 'solid', fgColor: { rgb: warm } },
          alignment: { horizontal: 'left' },
        },
      };
      const fillers = Array.from({ length: colCount - 2 }, () => ({
        s: { fill: { patternType: 'solid', fgColor: { rgb: warm } } },
      }));
      rowsOut.push([labelCell, valueCell, ...fillers]);
      rowIndex += 1;
    }
    rowsOut.push([]);
    rowIndex += 1;
  }

  // Highlight note (if any) sits between summary and headers
  if (opts.highlightNote) {
    rowsOut.push([
      {
        v: opts.highlightNote,
        s: {
          font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: dark } },
          fill: { patternType: 'solid', fgColor: { rgb: amber } },
          alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
        },
      },
      ...Array.from({ length: colCount - 1 }, () => ({
        s: { fill: { patternType: 'solid', fgColor: { rgb: amber } } },
      })),
    ]);
    merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: colCount - 1 } });
    rowIndex += 1;
    rowsOut.push([]);
    rowIndex += 1;
  }

  // Header row
  const headerRowIndex = rowIndex;
  rowsOut.push(
    opts.headers.map(h => ({
      v: h,
      s: {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: navy } },
        alignment: { vertical: 'center', horizontal: 'center' },
        border,
      },
    })),
  );
  rowHeights[rowIndex] = 22;
  rowIndex += 1;

  // Data rows
  for (let i = 0; i < opts.rows.length; i += 1) {
    const raw = opts.rows[i];
    const highlight = opts.highlightRowWhen?.(raw) ?? false;
    const bg = highlight ? amber : i % 2 === 0 ? 'FFFFFF' : warm;
    rowsOut.push(
      raw.map((cell, colIdx) => {
        const isNumber = typeof cell === 'number';
        const prefix = highlight && colIdx === 0 ? '⚠ ' : '';
        return {
          v: isNumber ? cell : `${prefix}${str(cell)}`,
          t: isNumber ? 'n' : 's',
          s: {
            font: { name: 'Calibri', sz: 10, color: { rgb: dark } },
            fill: { patternType: 'solid', fgColor: { rgb: bg } },
            alignment: { vertical: 'center', horizontal: isNumber ? 'right' : 'left', indent: isNumber ? 0 : 1 },
            border,
          },
        };
      }),
    );
    rowIndex += 1;
  }

  // Blank spacer
  rowsOut.push([]);
  rowIndex += 1;

  // Footer
  const stamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  rowsOut.push([
    {
      v: `Generated by CQIP · cqip.l-hay.workers.dev · ${stamp}`,
      s: {
        font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: gray } },
        alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
      },
    },
    ...Array.from({ length: colCount - 1 }, () => ({})),
  ]);
  merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: colCount - 1 } });
  rowIndex += 1;

  // Build the sheet directly from the styled cells rather than running
  // aoa_to_sheet + overlaying styles. aoa_to_sheet collapses empty rows
  // and the two-phase address math gets fragile when spacer rows are in
  // play; direct assembly keeps the row indices exact and preserves
  // each cell's type + style atomically.
  const ws: Record<string, unknown> = {};
  for (let r = 0; r < rowsOut.length; r += 1) {
    const row = rowsOut[r];
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c] as Record<string, unknown> | undefined;
      if (!cell) continue;
      const hasValue = 'v' in cell;
      const hasStyle = 's' in cell;
      if (!hasValue && !hasStyle) continue;
      const addr = XLSX.utils.encode_cell({ r, c });
      const out: Record<string, unknown> = {
        v: hasValue ? cell.v : '',
        t: cell.t ?? (typeof cell.v === 'number' ? 'n' : 's'),
      };
      if (hasStyle) out.s = cell.s;
      ws[addr] = out;
    }
  }

  // Column widths — auto-fit with min 10, max 45
  const widths = opts.headers.map((h, c) => {
    let maxLen = Math.max(10, h.length + 2);
    for (const row of opts.rows) {
      const cell = row[c];
      if (cell == null) continue;
      maxLen = Math.max(maxLen, Math.min(45, String(cell).length + 2));
    }
    return { wch: Math.min(45, maxLen) };
  });
  ws['!cols'] = widths;

  // Row heights — SheetJS' RowInfo array wants an entry per index, so
  // fill unset rows with {} rather than undefined.
  const rowsMeta: Array<{ hpt?: number }> = [];
  const maxRow = Math.max(rowIndex, ...Object.keys(rowHeights).map(Number));
  for (let r = 0; r <= maxRow; r += 1) {
    rowsMeta[r] = rowHeights[r] !== undefined ? { hpt: rowHeights[r] } : {};
  }
  ws['!rows'] = rowsMeta;

  // Merges
  ws['!merges'] = merges;

  // Span the sheet from A1 through the last footer row. rowIndex is the
  // 0-based next-unwritten index, which equals the 1-based last row — so
  // `A1:{col}{rowIndex}` covers exactly the written range.
  ws['!ref'] = `A1:${lastColLetter}${rowIndex}`;
  // Freeze the header row via sheet views. Excel, Sheets, and Numbers
  // all read this shape; the undocumented `!freeze` key used previously
  // was redundant.
  ws['!views'] = [{ state: 'frozen', ySplit: headerRowIndex + 1, xSplit: 0 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

  const buf: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename.endsWith('.xlsx') ? opts.filename : `${opts.filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // TODO(batch-004): embed the F92 logo as an image anchored in the
  // title bar. xlsx-js-style's image embedding API is available but
  // workbook-local; skipping to keep this shipment scope-contained.
  // Navy title bar + 'FUSION92 · CQIP' text is the documented fallback.
}
