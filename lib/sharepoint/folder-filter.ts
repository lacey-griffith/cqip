// Folder-content filtering per spec §3.1:
//   - Identify the single xlsx file at folder root
//   - Identify the `Shareable Screenshots/` subfolder
//   - Ignore `assets/` and `bugs/` subfolders entirely
//   - Sort screenshots by filename ascending (stable order for AC)

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const SCREENSHOTS_FOLDER_NAME = 'shareable screenshots';
export const IGNORED_FOLDER_NAMES = new Set(['assets', 'bugs']);

export interface DriveItem {
  id: string;
  name: string;
  size?: number;
  folder?: { childCount?: number } | null;
  file?: { mimeType?: string } | null;
}

export interface XlsxRef {
  ref: string;
  name: string;
}

export interface ScreenshotRef {
  ref: string;
  name: string;
  size: number;
}

export interface ScreenshotsFolderRef {
  driveId: string;
  itemId: string;
}

export interface RootFilterResult {
  xlsx: XlsxRef | null;
  xlsxCandidateNames: string[];
  screenshotsFolder: ScreenshotsFolderRef | null;
}

function isFolder(item: DriveItem): boolean {
  return item.folder != null;
}

function isFile(item: DriveItem): boolean {
  return item.file != null;
}

function extOf(name: string): string {
  const lower = name.toLowerCase();
  const idx = lower.lastIndexOf('.');
  return idx === -1 ? '' : lower.slice(idx);
}

export function filterRoot(items: DriveItem[], driveId: string): RootFilterResult {
  const xlsxFiles = items.filter(
    (i) => isFile(i) && extOf(i.name) === '.xlsx' && !i.name.startsWith('~$'),
  );
  const screenshotsFolderItem = items.find(
    (i) => isFolder(i) && i.name.trim().toLowerCase() === SCREENSHOTS_FOLDER_NAME,
  );

  let xlsx: XlsxRef | null = null;
  if (xlsxFiles.length === 1) {
    const f = xlsxFiles[0];
    xlsx = { ref: `${driveId}:${f.id}`, name: f.name };
  }

  return {
    xlsx,
    xlsxCandidateNames: xlsxFiles.map((f) => f.name),
    screenshotsFolder: screenshotsFolderItem
      ? { driveId, itemId: screenshotsFolderItem.id }
      : null,
  };
}

export function filterScreenshots(items: DriveItem[], driveId: string): ScreenshotRef[] {
  return items
    .filter((i) => isFile(i) && IMAGE_EXTS.has(extOf(i.name)))
    .map((i) => ({
      ref: `${driveId}:${i.id}`,
      name: i.name,
      size: i.size ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
