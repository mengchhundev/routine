/**
 * The Today screen's arrangement, owned by the reader.
 *
 * Stored in localStorage rather than on the account: it is a per-screen
 * preference with no server model behind it, and a layout that follows you to
 * a different monitor is usually the wrong layout for that monitor. The cost is
 * that it does not travel between browsers, which is the right trade until
 * there is a real settings endpoint to put it in.
 */
export type PanelId = "tasks" | "note";

/**
 * `main` and `side` sit beside each other and share the split; `full` is a row
 * beneath them at the board's whole width, for a panel that wants the width
 * rather than a column. It starts empty.
 */
export type RegionId = "main" | "side" | "full";
export type Layout = Record<RegionId, PanelId[]> & {
  /** Width of the main column, as a percentage of the board. */
  split: number;
};

export const PANEL_IDS: PanelId[] = ["tasks", "note"];
export const REGION_IDS: RegionId[] = ["main", "side", "full"];

/** The two that share a row, in the order they appear in it. */
export const COLUMN_IDS: RegionId[] = ["main", "side"];

export const PANEL_LABELS: Record<PanelId, string> = {
  tasks: "Tasks",
  note: "Note",
};

export const REGION_LABELS: Record<RegionId, string> = {
  main: "left column",
  side: "right column",
  full: "full-width row",
};

export const DEFAULT_LAYOUT: Layout = {
  main: ["tasks"],
  side: ["note"],
  full: [],
  split: 58,
};

/**
 * The range the divider can be dragged to while both columns hold something.
 * Past these the narrower column stops being able to show a panel at all, and
 * a column you cannot read is worse than one you cannot widen. A column with
 * nothing in it has no such claim — see `isSplitBoard`.
 */
export const MIN_SPLIT = 25;
export const MAX_SPLIT = 80;

/**
 * Versioned, and deliberately not migrated. Layouts written before the
 * full-width row existed could not express where the review belongs — they put
 * it in a column because there was nowhere else — so honouring them would pin
 * the reader to an arrangement the old model forced on them. A new key gives
 * everyone the new default once, and they can rearrange from there.
 */
const STORAGE_KEY = "routine-today-layout-v2";
const LEGACY_KEYS = ["routine-today-layout"];

export function clampSplit(value: unknown): number {
  const split = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_LAYOUT.split;
  return Math.round(Math.min(Math.max(split, MIN_SPLIT), MAX_SPLIT));
}

/**
 * Anything stored can be stale, hand-edited or written by an older build, so a
 * layout is repaired rather than trusted: unknown ids are dropped, duplicates
 * collapse to their first position, and any panel the stored value never heard
 * of is appended to the main column. A panel can therefore never go missing
 * because of what is in storage.
 */
export function normalize(value: unknown): Layout {
  const raw = value as Partial<Record<RegionId | "split", unknown>> | null;
  const seen = new Set<PanelId>();

  const clean = (region: unknown): PanelId[] =>
    (Array.isArray(region) ? region : []).filter((id): id is PanelId => {
      if (!PANEL_IDS.includes(id as PanelId) || seen.has(id as PanelId)) return false;
      seen.add(id as PanelId);
      return true;
    });

  const layout: Layout = {
    main: clean(raw?.main),
    side: clean(raw?.side),
    full: clean(raw?.full),
    split: clampSplit(raw?.split),
  };
  layout.main.push(...PANEL_IDS.filter((id) => !seen.has(id)));
  return layout;
}

export function readLayout(): Layout {
  try {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalize(JSON.parse(stored)) : DEFAULT_LAYOUT;
  } catch {
    // Unreadable or unparseable storage is not worth a broken screen.
    return DEFAULT_LAYOUT;
  }
}

export function writeLayout(layout: Layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage unavailable. The arrangement still holds for this visit.
  }
}

export function isDefaultLayout(layout: Layout) {
  if (layout.split !== DEFAULT_LAYOUT.split) return false;

  return REGION_IDS.every(
    (region) =>
      layout[region].length === DEFAULT_LAYOUT[region].length &&
      layout[region].every((id, index) => id === DEFAULT_LAYOUT[region][index]),
  );
}

/**
 * Whether the board currently has two columns to show.
 *
 * An empty column is not worth reserving width for, so once every panel has
 * left one of them the other becomes a single full-width column. The exception
 * is a drag in progress: the empty column has to reappear then, or there would
 * be nowhere to drop a panel back into.
 */
export function isSplitBoard(layout: Layout, dragging: boolean) {
  return dragging || (layout.main.length > 0 && layout.side.length > 0);
}

/** Where a panel currently sits. */
export function locate(layout: Layout, id: PanelId): { region: RegionId; index: number } {
  const region = REGION_IDS.find((candidate) => layout[candidate].includes(id)) ?? "main";
  return { region, index: layout[region].indexOf(id) };
}

/** Moves `id` to `index` within `region`, closing the gap it leaves behind. */
export function movePanel(layout: Layout, id: PanelId, region: RegionId, index: number): Layout {
  const from = locate(layout, id);
  const next: Layout = {
    ...layout,
    main: [...layout.main],
    side: [...layout.side],
    full: [...layout.full],
  };

  next[from.region].splice(from.index, 1);
  // Removing from earlier in the same region shifts every later slot down one.
  const target = from.region === region && from.index < index ? index - 1 : index;
  next[region].splice(Math.max(0, Math.min(target, next[region].length)), 0, id);

  return next;
}
