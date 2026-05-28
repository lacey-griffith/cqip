import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as XLSX from 'xlsx-js-style';

import {
  parsePreviewLinks,
  PreviewSheetNotFoundError,
  PREVIEW_SHEET_NAME,
} from '../lib/sharepoint/xlsx-parser';

type Row = (string | null)[];

function buildWorkbook(sheetName: string, rows: Row[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}

const HEADER_ROWS: Row[] = [
  ['Preview Links — Title row'],
  [],
  ['Label', 'Variation', 'National URL', 'Local URL'],
];

test('parses rows 4+ after skipping title/blank/header', () => {
  const bytes = buildWorkbook(PREVIEW_SHEET_NAME, [
    ...HEADER_ROWS,
    ['Control', 'Control', 'https://national.example/control', 'https://local.example/control'],
    ['V1', 'Hero Swap', 'https://national.example/v1', 'https://local.example/v1'],
  ]);
  const rows = parsePreviewLinks(bytes);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    label: 'Control',
    variation: 'Control',
    national_url: 'https://national.example/control',
    local_url: 'https://local.example/control',
  });
  assert.equal(rows[1].label, 'V1');
  assert.equal(rows[1].variation, 'Hero Swap');
});

test('stops at the first row where Col A is empty', () => {
  const bytes = buildWorkbook(PREVIEW_SHEET_NAME, [
    ...HEADER_ROWS,
    ['Control', 'Control', 'https://n/c', 'https://l/c'],
    ['V1', 'Hero', 'https://n/v1', 'https://l/v1'],
    [null, 'phantom', 'https://n/x', 'https://l/x'],
    ['V2', 'Should not be reached', 'https://n/v2', null],
  ]);
  const rows = parsePreviewLinks(bytes);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map((r) => r.label),
    ['Control', 'V1'],
  );
});

test('null local_url when Col D is empty or whitespace', () => {
  const bytes = buildWorkbook(PREVIEW_SHEET_NAME, [
    ...HEADER_ROWS,
    ['V1', 'Hero', 'https://n/v1', null],
    ['V2', 'Copy', 'https://n/v2', '   '],
    ['V3', 'Layout', 'https://n/v3', 'https://l/v3'],
  ]);
  const rows = parsePreviewLinks(bytes);
  assert.equal(rows[0].local_url, null);
  assert.equal(rows[1].local_url, null);
  assert.equal(rows[2].local_url, 'https://l/v3');
});

test('matches sheet name case-insensitively with surrounding whitespace', () => {
  const bytes = buildWorkbook('  preview LINKS  ', [
    ...HEADER_ROWS,
    ['Control', 'Control', 'https://n/c', 'https://l/c'],
  ]);
  const rows = parsePreviewLinks(bytes);
  assert.equal(rows.length, 1);
});

test('throws PreviewSheetNotFoundError when sheet absent', () => {
  const bytes = buildWorkbook('Some Other Sheet', [['x']]);
  assert.throws(() => parsePreviewLinks(bytes), PreviewSheetNotFoundError);
});
