import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  filterRoot,
  filterScreenshots,
  IGNORED_FOLDER_NAMES,
  type DriveItem,
} from '../lib/sharepoint/folder-filter';

const DRIVE_ID = 'b!fake-drive-id';

function folder(name: string, id = `f-${name}`): DriveItem {
  return { id, name, folder: { childCount: 0 } };
}
function file(name: string, id = `i-${name}`, size = 1024): DriveItem {
  return { id, name, file: { mimeType: 'application/octet-stream' }, size };
}

test('filterRoot identifies the single xlsx at root', () => {
  const items: DriveItem[] = [
    folder('Shareable Screenshots'),
    file('NBLY_PreviewLinks.xlsx'),
    file('readme.txt'),
  ];
  const out = filterRoot(items, DRIVE_ID);
  assert.deepEqual(out.xlsx, {
    ref: `${DRIVE_ID}:i-NBLY_PreviewLinks.xlsx`,
    name: 'NBLY_PreviewLinks.xlsx',
  });
  assert.deepEqual(out.xlsxCandidateNames, ['NBLY_PreviewLinks.xlsx']);
});

test('filterRoot ignores assets/ and bugs/ folders', () => {
  const items: DriveItem[] = [
    folder('assets'),
    folder('bugs'),
    folder('Shareable Screenshots'),
    file('preview.xlsx'),
  ];
  const out = filterRoot(items, DRIVE_ID);
  // Sentinel: the ignored names appear in the constant set
  assert.ok(IGNORED_FOLDER_NAMES.has('assets'));
  assert.ok(IGNORED_FOLDER_NAMES.has('bugs'));
  // And they never appear in any returned ref
  assert.ok(out.screenshotsFolder !== null);
  assert.ok(!out.xlsxCandidateNames.some((n) => n.toLowerCase().includes('assets')));
  assert.ok(!out.xlsxCandidateNames.some((n) => n.toLowerCase().includes('bugs')));
});

test('filterRoot returns null xlsx + empty candidates when no xlsx at root', () => {
  const items: DriveItem[] = [folder('Shareable Screenshots'), file('readme.txt')];
  const out = filterRoot(items, DRIVE_ID);
  assert.equal(out.xlsx, null);
  assert.deepEqual(out.xlsxCandidateNames, []);
});

test('filterRoot 0-xlsx signal drives the route 422 xlsx_not_found branch', () => {
  // D2 contract (2026-05-28): when the route sees this shape, it must
  // hard-fail with errorResponse('xlsx_not_found', ...). The filter
  // must give the route the means to detect 0 — neither `xlsx` set
  // nor any name in `xlsxCandidateNames` — without ambiguity.
  const items: DriveItem[] = [folder('Shareable Screenshots'), folder('assets'), file('notes.md')];
  const out = filterRoot(items, DRIVE_ID);
  assert.equal(out.xlsx, null);
  assert.equal(out.xlsxCandidateNames.length, 0);
  // The screenshots subfolder still resolves — D2 only changes the
  // xlsx-absence branch, not the screenshots-absence branch.
  assert.ok(out.screenshotsFolder !== null);
});

test('filterRoot returns null xlsx + candidate names when 2+ xlsx at root', () => {
  const items: DriveItem[] = [
    file('alpha.xlsx'),
    file('beta.xlsx'),
    folder('Shareable Screenshots'),
  ];
  const out = filterRoot(items, DRIVE_ID);
  assert.equal(out.xlsx, null);
  assert.deepEqual(out.xlsxCandidateNames.sort(), ['alpha.xlsx', 'beta.xlsx']);
});

test('filterRoot skips Excel temp-lock files (~$)', () => {
  const items: DriveItem[] = [
    file('preview.xlsx'),
    file('~$preview.xlsx'),
    folder('Shareable Screenshots'),
  ];
  const out = filterRoot(items, DRIVE_ID);
  assert.equal(out.xlsxCandidateNames.length, 1);
  assert.equal(out.xlsx?.name, 'preview.xlsx');
});

test('filterRoot matches Shareable Screenshots case-insensitively', () => {
  const items: DriveItem[] = [folder('SHAREABLE SCREENSHOTS', 'f-upper')];
  const out = filterRoot(items, DRIVE_ID);
  assert.deepEqual(out.screenshotsFolder, { driveId: DRIVE_ID, itemId: 'f-upper' });
});

test('filterRoot returns null screenshotsFolder when absent', () => {
  const items: DriveItem[] = [file('preview.xlsx')];
  const out = filterRoot(items, DRIVE_ID);
  assert.equal(out.screenshotsFolder, null);
});

test('filterScreenshots: keeps only image extensions, sorts ascending', () => {
  const items: DriveItem[] = [
    file('variation-3.png', 'i3', 300),
    file('variation-1.png', 'i1', 100),
    file('thumbs.db'),
    file('notes.txt'),
    file('variation-2.JPG', 'i2', 200),
    file('animation.gif', 'i4', 400),
    file('promo.webp', 'i5', 500),
  ];
  const out = filterScreenshots(items, DRIVE_ID);
  assert.deepEqual(
    out.map((s) => s.name),
    ['animation.gif', 'promo.webp', 'variation-1.png', 'variation-2.JPG', 'variation-3.png'],
  );
  assert.equal(out[2].ref, `${DRIVE_ID}:i1`);
  assert.equal(out[2].size, 100);
});

test('filterScreenshots: empty subfolder returns empty array', () => {
  const out = filterScreenshots([], DRIVE_ID);
  assert.deepEqual(out, []);
});
