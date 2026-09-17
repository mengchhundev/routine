"use client";

import { useRef, useState } from "react";
import { useBeforePaint } from "@/lib/useBeforePaint";
import {
  clampSplit,
  isDefaultLayout,
  isSplitBoard,
  locate,
  movePanel,
  readLayout,
  writeLayout,
  COLUMN_IDS,
  DEFAULT_LAYOUT,
  MAX_SPLIT,
  MIN_SPLIT,
  PANEL_LABELS,
  REGION_IDS,
  REGION_LABELS,
  type Layout,
  type PanelId,
  type RegionId,
} from "@/lib/todayLayout";

type Drop = { region: RegionId; index: number } | null;

/**
 * Lets the reader arrange the day's panels: drag one by its handle, or move it
 * with the arrow keys while the handle has focus.
 *
 * Both routes exist because neither covers everyone. The HTML5 drag API is
 * mouse-only — it does not fire for touch and cannot be driven from a keyboard
 * — so the arrow keys are not a courtesy here, they are the other half of the
 * feature, and the only half that works on a phone.
 */
export function PanelBoard({ panels }: { panels: Record<PanelId, React.ReactNode> }) {
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [armed, setArmed] = useState<PanelId | null>(null);
  const [dragging, setDragging] = useState<PanelId | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const [resizing, setResizing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const handles = useRef(new Map<PanelId, HTMLButtonElement | null>());
  const board = useRef<HTMLDivElement>(null);

  // The stored arrangement lands before the first paint, so the default never
  // flashes into the reader's own layout.
  useBeforePaint(() => setLayout(readLayout()), []);

  function apply(next: Layout, moved?: PanelId) {
    setLayout(next);
    writeLayout(next);

    if (moved) {
      const { region, index } = locate(next, moved);
      setAnnouncement(
        `${PANEL_LABELS[moved]} moved to ${REGION_LABELS[region]}, position ${index + 1} of ${next[region].length}.`,
      );
    }
  }

  /**
   * `settled` marks the end of a gesture. A drag calls this on every pointer
   * move, and localStorage writes synchronously — persisting sixty times a
   * second would stutter the very drag it is recording, so the write and the
   * announcement wait for the release.
   */
  function setSplit(split: number, settled = false) {
    const next = { ...layout, split: clampSplit(split) };
    setLayout(next);

    if (settled) {
      writeLayout(next);
      setAnnouncement(`Columns split ${next.split} to ${100 - next.split}.`);
    }
  }

  function onResizeKeyDown(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 10 : 2;
    switch (event.key) {
      case "ArrowLeft":
        setSplit(layout.split - step, true);
        break;
      case "ArrowRight":
        setSplit(layout.split + step, true);
        break;
      case "Home":
        setSplit(DEFAULT_LAYOUT.split, true);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function reset() {
    setLayout(DEFAULT_LAYOUT);
    writeLayout(DEFAULT_LAYOUT);
    setAnnouncement("Layout reset to its default arrangement.");
  }

  function onHandleKeyDown(event: React.KeyboardEvent, id: PanelId) {
    const { region, index } = locate(layout, id);
    // Left and right walk the regions in reading order: left column, right
    // column, then the full-width row beneath them.
    const order = REGION_IDS.indexOf(region);

    const next = (() => {
      switch (event.key) {
        case "ArrowUp":
          return index > 0 ? movePanel(layout, id, region, index - 1) : null;
        case "ArrowDown":
          return index < layout[region].length - 1
            ? movePanel(layout, id, region, index + 2)
            : null;
        case "ArrowLeft": {
          const to = REGION_IDS[order - 1];
          return to ? movePanel(layout, id, to, layout[to].length) : null;
        }
        case "ArrowRight": {
          const to = REGION_IDS[order + 1];
          return to ? movePanel(layout, id, to, layout[to].length) : null;
        }
        default:
          return null;
      }
    })();

    if (!next) return;
    event.preventDefault();
    apply(next, id);
    // The handle moves with its panel, so focus has to be put back on it.
    requestAnimationFrame(() => handles.current.get(id)?.focus());
  }

  function onDropAt(region: RegionId, index: number) {
    if (dragging) apply(movePanel(layout, dragging, region, index), dragging);
    setArmed(null);
    setDragging(null);
    setDrop(null);
  }

  // Both columns are drawn while a drag is in flight, so an emptied one still
  // offers somewhere to drop; otherwise the occupied column takes the board.
  const split = isSplitBoard(layout, dragging !== null);
  const columns = split ? COLUMN_IDS : COLUMN_IDS.filter((region) => layout[region].length > 0);
  const showFull = dragging !== null || layout.full.length > 0;

  const region = (id: RegionId) => (
    <Region
      key={id}
      id={id}
      panels={panels}
      order={layout[id]}
      drop={drop}
      armed={armed}
      dragging={dragging}
      handles={handles}
      onArm={setArmed}
      onDragStart={setDragging}
      onDragEnd={() => {
        setArmed(null);
        setDragging(null);
        setDrop(null);
      }}
      onHover={setDrop}
      onDrop={onDropAt}
      onHandleKeyDown={onHandleKeyDown}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* The handle only appears on hover, so something has to say it is
          there. Once the reader has moved a panel they know — and what they
          need then is the way back. */}
      <div className="hidden justify-end lg:flex">
        {isDefaultLayout(layout) ? (
          <p className="flex items-center gap-1.5 py-1.5 text-[0.8125rem] text-faint">
            <Grip className="size-3.5" />
            Drag a panel by its handle to move it, or the divider to resize
          </p>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem]"
          >
            Reset layout
          </button>
        )}
      </div>

      {columns.length > 0 ? (
        <div
          ref={board}
          className={`panel-board items-start ${split ? "" : "panel-board-single"} ${
            resizing ? "cursor-col-resize select-none" : ""
          }`}
          style={{ "--split": layout.split } as React.CSSProperties}
        >
          {columns.map(region)}

          {/* Pointer events rather than the drag API: this needs to track every
              pixel of the movement, which a drag only reports at drop. Hidden
              while a panel is being dragged, where it would sit under the
              pointer for no purpose. */}
          <div
            hidden={!split || dragging !== null}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the columns"
            aria-valuenow={layout.split}
            aria-valuemin={MIN_SPLIT}
            aria-valuemax={MAX_SPLIT}
            tabIndex={0}
            onKeyDown={onResizeKeyDown}
            onDoubleClick={() => setSplit(DEFAULT_LAYOUT.split, true)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setResizing(true);
            }}
            onPointerMove={(event) => {
              if (!resizing) return;
              const box = board.current?.getBoundingClientRect();
              if (!box) return;
              setSplit(((event.clientX - box.left) / box.width) * 100);
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              setResizing(false);
              setSplit(layout.split, true);
            }}
            className="panel-split group/split z-10 hidden cursor-col-resize touch-none place-items-center rounded-full lg:grid"
          >
            <span
              aria-hidden
              className={`h-16 w-1 rounded-full transition-colors duration-150 group-hover/split:bg-accent group-focus-visible/split:bg-accent ${
                resizing ? "bg-accent" : "bg-line-strong"
              }`}
            />
          </div>
        </div>
      ) : null}

      {showFull ? region("full") : null}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function Region({
  id,
  panels,
  order,
  drop,
  armed,
  dragging,
  handles,
  onArm,
  onDragStart,
  onDragEnd,
  onHover,
  onDrop,
  onHandleKeyDown,
}: {
  id: RegionId;
  panels: Record<PanelId, React.ReactNode>;
  order: PanelId[];
  drop: Drop;
  armed: PanelId | null;
  dragging: PanelId | null;
  handles: React.RefObject<Map<PanelId, HTMLButtonElement | null>>;
  onArm: (id: PanelId | null) => void;
  onDragStart: (id: PanelId) => void;
  onDragEnd: () => void;
  onHover: (drop: Drop) => void;
  onDrop: (region: RegionId, index: number) => void;
  onHandleKeyDown: (event: React.KeyboardEvent, id: PanelId) => void;
}) {
  /** Which half of a panel the pointer is over decides which side it lands on. */
  const indexAt = (event: React.DragEvent, index: number) => {
    const box = event.currentTarget.getBoundingClientRect();
    return index + (event.clientY > box.top + box.height / 2 ? 1 : 0);
  };

  return (
    <div
      // A region has to accept the drop itself, or the empty space below the
      // last panel — the obvious place to aim for "put it at the end" — would
      // reject it.
      onDragOver={(event) => {
        if (!dragging) return;
        event.preventDefault();
        onHover({ region: id, index: order.length });
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(id, order.length);
      }}
      className={`flex flex-col gap-4 rounded-panel transition-colors ${
        dragging ? "min-h-24 outline-2 outline-offset-4 outline-dashed outline-line-strong" : ""
      }`}
    >
      {order.map((panel, index) => (
        <div key={panel} className="contents">
          <DropLine active={drop?.region === id && drop.index === index} />

          <div
            // A container query, not a viewport one: a panel has to lay itself
            // out for the region it was dropped into, and only it knows how
            // wide that is.
            className={`group/panel @container relative transition-opacity ${
              dragging === panel ? "opacity-40" : ""
            }`}
            draggable={armed === panel}
            onDragStart={(event) => {
              // Firefox refuses to start a drag without payload, and the id is
              // what a drop needs anyway.
              event.dataTransfer.setData("text/plain", panel);
              event.dataTransfer.effectAllowed = "move";
              onDragStart(panel);
            }}
            onDragEnd={onDragEnd}
            onDragOver={(event) => {
              if (!dragging) return;
              event.preventDefault();
              event.stopPropagation();
              onHover({ region: id, index: indexAt(event, index) });
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDrop(id, indexAt(event, index));
            }}
          >
            <Handle
              ref={(node) => {
                handles.current.set(panel, node);
              }}
              label={PANEL_LABELS[panel]}
              position={`${REGION_LABELS[id]}, position ${index + 1} of ${order.length}`}
              // The panel is only draggable while its handle is held, so
              // selecting text inside a note never starts a drag.
              onArm={() => onArm(panel)}
              onDisarm={() => onArm(null)}
              onKeyDown={(event) => onHandleKeyDown(event, panel)}
            />

            {panels[panel]}
          </div>
        </div>
      ))}

      <DropLine active={drop?.region === id && drop.index === order.length} />
    </div>
  );
}

function Grip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} text-faint`} fill="currentColor" aria-hidden>
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
      <circle cx="15" cy="17" r="1.5" />
    </svg>
  );
}

/** Where the panel would land if it were released now. */
function DropLine({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={`-my-2 h-1 rounded-full transition-[background-color,opacity] duration-150 ${
        active ? "bg-accent opacity-100" : "opacity-0"
      }`}
    />
  );
}

function Handle({
  ref,
  label,
  position,
  onArm,
  onDisarm,
  onKeyDown,
}: {
  ref: (node: HTMLButtonElement | null) => void;
  label: string;
  position: string;
  onArm: () => void;
  onDisarm: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onPointerDown={onArm}
      onPointerUp={onDisarm}
      onKeyDown={onKeyDown}
      title={`Move ${label} — drag, or use the arrow keys`}
      aria-label={`Move ${label}. Currently ${position}. Use the arrow keys to move it.`}
      className="absolute -top-2 left-1/2 z-20 hidden -translate-x-1/2 cursor-grab items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 opacity-0 shadow-card transition-opacity duration-150 hover:border-line-strong focus-visible:opacity-100 active:cursor-grabbing group-hover/panel:opacity-100 lg:flex"
    >
      <Grip className="size-3.5" />
    </button>
  );
}
