"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, GridIcon, ListIcon, PencilIcon, TargetIcon, TrashIcon } from "@/components/icons";
import { FormMessage } from "@/components/form/controls";
import { Modal } from "@/components/Modal";
import { MilestoneForm } from "@/components/goals/MilestoneForm";
import { LayoutToggle, type LayoutOption } from "@/components/LayoutToggle";
import {
  deleteMilestone,
  MILESTONE_STATUSES,
  reorderMilestones,
  setMilestoneStatus,
} from "@/lib/goals";
import { formatDay } from "@/lib/dates";
import {
  DEFAULT_MILESTONE_LAYOUT,
  readMilestoneLayout,
  writeMilestoneLayout,
  type MilestoneLayout,
} from "@/lib/milestoneLayout";
import { useBeforePaint } from "@/lib/useBeforePaint";
import type { MilestoneResponse, MilestoneStatus } from "@/types/api";

const LAYOUT_OPTIONS: LayoutOption<MilestoneLayout>[] = [
  { value: "list", label: "List", icon: ListIcon },
  { value: "grid", label: "Grid", icon: GridIcon },
];

/**
 * The milestones section of a goal: its heading, its controls and its list.
 *
 * <p>All three live here because the controls sit in the heading's own row —
 * adding a milestone and choosing how to look at them are the two things you
 * do to this list, and they belong where the list is named rather than at
 * opposite ends of it.
 *
 * <p>The ladder between "what I am trying to become" and "what I did today".
 *
 * <p>Ticking one off is a single click, because that is the action people
 * actually take. Everything else — the description, the span, partial
 * progress — is behind Edit, so the common case stays one click on a list that
 * still reads as a list.
 *
 * <p>Nesting stops at one level, which the API enforces. A goal broken down
 * three deep is a plan nobody finishes writing.
 *
 * <p>The list and the grid are the same cards in a different flow, not two
 * components: a milestone that gained a field in one and not the other would be
 * a bug nobody noticed until they switched.
 */
export function MilestoneSection({
  goalId,
  milestones,
  today,
}: {
  goalId: string;
  milestones: MilestoneResponse[];
  /** The reader's own today, for deciding what is late. */
  today: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<MilestoneLayout>(DEFAULT_MILESTONE_LAYOUT);

  // The stored choice lands before the first paint, so the default never
  // flashes into the reader's own — the same trick the Today board uses.
  useBeforePaint(() => setLayout(readMilestoneLayout()), []);

  function chooseLayout(next: MilestoneLayout) {
    setLayout(next);
    writeMilestoneLayout(next);
  }

  type Patch = { id: string; status: MilestoneStatus } | { id: string; removed: true };

  // Patches reach sub-milestones too, so ticking one off inside a parent feels
  // as immediate as ticking off a top-level step.
  const [optimistic, applyPatch] = useOptimistic(milestones, (state, patch: Patch) =>
    patchTree(state, patch),
  );

  function mutate(patch: Patch, request: () => Promise<unknown>, failure: string) {
    setError(null);
    startTransition(async () => {
      applyPatch(patch);
      try {
        await request();
        router.refresh();
      } catch {
        // The optimistic value is dropped when the transition ends, so the row
        // comes back on its own; all that is left is to say why.
        setError(failure);
      }
    });
  }

  function move(siblings: MilestoneResponse[], parentId: string | null, index: number, delta: number) {
    const next = [...siblings];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];
    setError(null);
    startTransition(async () => {
      try {
        await reorderMilestones(goalId, parentId, next.map((milestone) => milestone.id));
        router.refresh();
      } catch {
        setError("Could not reorder those milestones.");
      }
    });
  }

  const empty = optimistic.length === 0;

  return (
    <section aria-labelledby="milestones-heading" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <h2 id="milestones-heading" className="text-sm font-medium">
            Milestones
          </h2>
          <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">
            The things that have to be true before this goal is reached. Break
            any of them into sub-milestones — one level, so the plan stays a plan
            rather than an outline.
          </p>
        </div>

        {/* The layout toggle has nothing to act on while the list is empty —
            the empty state below owns the first milestone — but the add button
            stays, so the action is in the same place however full the goal is. */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setAdding(true)} className="btn btn-primary px-4 py-2">
            New milestone
          </button>
          {!empty ? (
            <LayoutToggle
              label="Milestone layout"
              options={LAYOUT_OPTIONS}
              value={layout}
              onChange={chooseLayout}
            />
          ) : null}
        </div>
      </div>

      <FormMessage error={error} />

      {/* A new milestone lands at the end of the list, where a next step
          belongs — the order is the plan, not the order things were typed. */}
      {adding ? (
        <Modal
          title="New milestone"
          description="Something that has to be true before the goal is reached. Only the title is required."
          onClose={() => setAdding(false)}
        >
          <MilestoneForm goalId={goalId} onDone={() => setAdding(false)} />
        </Modal>
      ) : null}

      {empty ? (
        <div className="card p-6 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
            <TargetIcon className="size-5" />
          </span>
          <h3 className="mt-4 text-sm font-medium">No milestones yet.</h3>
          <p className="mx-auto mt-1.5 max-w-md text-[0.8125rem] leading-relaxed text-muted">
            Break the goal into the handful of things that have to be true before
            it is reached. The percentage stops being a guess and becomes a count
            of what is actually done.
          </p>
          <button type="button" onClick={() => setAdding(true)} className="btn btn-primary mt-5 px-4 py-2">
            Add the first milestone
          </button>
        </div>
      ) : null}

      {/* An ordered list either way — the grid changes how it flows, not what
          it is, so the order stays in the markup for anyone not seeing it. */}
      <ol
        className={
          layout === "grid"
            ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            : "space-y-3"
        }
      >
        {optimistic.map((milestone, index) => (
          <li key={milestone.id} className={layout === "grid" ? "h-full" : undefined}>
            <MilestoneCard
              goalId={goalId}
              milestone={milestone}
              layout={layout}
              today={today}
              onMove={(delta) => move(optimistic, null, index, delta)}
              canMoveEarlier={index > 0}
              canMoveLater={index < optimistic.length - 1}
              onReorderChildren={(children, childIndex, delta) =>
                move(children, milestone.id, childIndex, delta)
              }
              mutate={mutate}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function MilestoneCard({
  goalId,
  milestone,
  layout,
  today,
  onMove,
  canMoveEarlier,
  canMoveLater,
  onReorderChildren,
  mutate,
}: {
  goalId: string;
  milestone: MilestoneResponse;
  layout: MilestoneLayout;
  today: string;
  onMove: (delta: number) => void;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  onReorderChildren: (children: MilestoneResponse[], index: number, delta: number) => void;
  mutate: (patch: Patch, request: () => Promise<unknown>, failure: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);

  const grid = layout === "grid";
  const done = milestone.status === "COMPLETED";
  const closed = done || milestone.status === "SKIPPED";

  function remove() {
    mutate(
      { id: milestone.id, removed: true },
      () => deleteMilestone(goalId, milestone.id),
      "Could not delete that milestone.",
    );
  }

  /**
   * Reordering is a refinement, not a primary action, so it stays out of the
   * way until the card is hovered or focused. `(hover: none)` brings it back
   * for touch, where there is no hover to reveal it with and a permanently
   * hidden control is simply a missing one.
   */
  const reorder = (
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
      {/* The arrow points where the milestone will actually go: up a column in
          the list, back along the row in the grid. */}
      <IconButton
        label={`Move ${milestone.title} earlier`}
        onClick={() => onMove(-1)}
        disabled={!canMoveEarlier}
      >
        {grid ? "←" : "↑"}
      </IconButton>
      <IconButton
        label={`Move ${milestone.title} later`}
        onClick={() => onMove(1)}
        disabled={!canMoveLater}
      >
        {grid ? "→" : "↓"}
      </IconButton>
    </div>
  );

  const editAndDelete = (
    <div className="flex shrink-0 items-center gap-0.5">
      <IconButton label={`Edit ${milestone.title}`} onClick={() => setEditing(true)}>
        <PencilIcon className="size-3.5" />
      </IconButton>
      <IconButton label={`Delete ${milestone.title}`} danger onClick={remove}>
        <TrashIcon className="size-3.5" />
      </IconButton>
    </div>
  );

  const description = milestone.description ? (
    <p
      className={`text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-muted ${
        // Clamped in the grid so one long description cannot set the height of
        // its whole row. Edit shows the whole thing.
        grid ? "line-clamp-2" : "max-w-2xl"
      }`}
    >
      {milestone.description}
    </p>
  ) : null;

  /**
   * Always drawn, including at nothing done.
   *
   * <p>An empty track is a statement — this has not been started — where a
   * missing bar is just an absence the reader has to interpret, and it gives
   * every card the same anatomy so a row of them can be compared down a column
   * rather than read one at a time.
   *
   * <p>The track is `line`, the product's neutral hairline, and not the tinted
   * `accent-soft` it began as: in the dark theme that tint is a deep violet, so
   * an empty bar read as a nearly full one. A track must not be able to be
   * mistaken for fill.
   */
  const progress = (
    <div className={`flex items-center gap-2.5 ${grid ? "" : "max-w-md"}`}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={milestone.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${milestone.title} progress`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${done ? "bg-positive" : "bg-accent"}`}
          style={{ width: `${milestone.progress}%` }}
        />
      </div>
      {/* The figure takes the colour of the bar it belongs to, so the two read
          as one statement. A zero stays quiet: it is a real answer, but it is
          not news, and a wall of untouched milestones should not look alarming. */}
      <span
        className={`text-[0.6875rem] font-medium tabular-nums ${
          milestone.progress === 0 ? "text-faint" : done ? "text-positive" : "text-accent"
        }`}
      >
        {milestone.progress}%
      </span>
    </div>
  );

  const children =
    milestone.children.length > 0 ? (
      <ol className={grid ? "space-y-0.5" : "space-y-0.5 border-l border-line pl-3"}>
        {milestone.children.map((child, index) => (
          <li key={child.id}>
            <SubMilestone
              goalId={goalId}
              milestone={child}
              today={today}
              onMove={(delta) => onReorderChildren(milestone.children, index, delta)}
              canMoveEarlier={index > 0}
              canMoveLater={index < milestone.children.length - 1}
              mutate={mutate}
            />
          </li>
        ))}
      </ol>
    ) : null;

  // The card's own action, and the only thing on it that asks to be clicked
  // rather than read — so it carries the accent rather than another grey.
  const addChild = (
    <button
      type="button"
      onClick={() => setAddingChild(true)}
      className="text-[0.8125rem] font-medium text-accent transition-colors hover:text-accent-hover"
    >
      + Sub-milestone
    </button>
  );

  const dialogs = (
    <>
      {/* The card stays where it is while either dialog is open, so you can see
          what you are editing behind it. */}
      {editing ? (
        <Modal title="Edit milestone" onClose={() => setEditing(false)}>
          <MilestoneForm goalId={goalId} milestone={milestone} onDone={() => setEditing(false)} />
        </Modal>
      ) : null}

      {addingChild ? (
        <Modal
          title="New sub-milestone"
          description={`A part of \u201c${milestone.title}\u201d.`}
          onClose={() => setAddingChild(false)}
        >
          <MilestoneForm
            goalId={goalId}
            parentId={milestone.id}
            onDone={() => setAddingChild(false)}
          />
        </Modal>
      ) : null}
    </>
  );

  /**
   * A card and a row want genuinely different anatomies, so the two are laid
   * out separately rather than by threading conditionals through one tree. The
   * pieces above are shared, which is what keeps them from drifting: a field
   * added to a milestone is added to both by construction.
   */
  if (grid) {
    return (
      <article
        className={`card group flex h-full flex-col p-4 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-lift ${
          closed ? "opacity-70" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <Tick milestone={milestone} mutate={mutate} />
          {/* Clamped to two lines, so an essay of a title cannot push the rest
              of the card down past everything beside it. */}
          <h3
            className={`line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-medium ${
              closed ? "text-muted line-through" : ""
            }`}
          >
            {milestone.title}
          </h3>
          {reorder}
        </div>

        {/* Everything below the title lines up under it rather than under the
            checkbox: `size-5` plus `gap-3` is exactly `pl-8`. */}
        <div className="mt-2 space-y-2 pl-8">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={milestone.status} />
            {span(milestone) ? (
              <span
                className={`text-[0.6875rem] ${
                  // The one colour on the card that is a warning rather than a
                  // label: a date that has gone by with the work still open.
                  isOverdue(milestone, today) ? "font-medium text-danger" : "text-faint"
                }`}
              >
                {span(milestone)}
              </span>
            ) : null}
          </div>

          {description}
          {progress}
        </div>

        {children ? (
          <div className="mt-2.5 rounded-lg border border-line/60 p-2 pl-2.5">
            <p className="px-1 pb-1 text-[0.625rem] font-semibold tracking-[0.08em] text-faint uppercase">
              Sub-milestones
              <span className="ml-1.5 font-normal tracking-normal normal-case">
                {milestone.completedChildren}/{milestone.childCount}
              </span>
            </p>
            {children}
          </div>
        ) : null}

        {/* One footer rather than two rows: `mt-auto` pins it to the card's
            floor, so the controls line up across a row of uneven cards. */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line/60 pt-2.5">
          {addChild}
          {editAndDelete}
        </div>

        {dialogs}
      </article>
    );
  }

  return (
    <article className={`card group p-4 transition-opacity ${closed ? "opacity-75" : ""}`}>
      <div className="flex items-start gap-3">
        <Tick milestone={milestone} mutate={mutate} />

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className={`text-sm font-medium ${closed ? "text-muted line-through" : ""}`}>
                {milestone.title}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusPill status={milestone.status} />
                {milestone.childCount > 0 ? (
                  <span className="text-[0.6875rem] text-faint">
                    {milestone.completedChildren}/{milestone.childCount} sub-milestones
                  </span>
                ) : null}
                {span(milestone) ? (
                  <span
                    className={`text-[0.6875rem] ${
                      isOverdue(milestone, today) ? "font-medium text-danger" : "text-faint"
                    }`}
                  >
                    {span(milestone)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {reorder}
              {editAndDelete}
            </div>
          </div>

          {description}
          {progress}
          {children}
          <div>{addChild}</div>
        </div>
      </div>

      {dialogs}
    </article>
  );
}

function SubMilestone({
  goalId,
  milestone,
  today,
  onMove,
  canMoveEarlier,
  canMoveLater,
  mutate,
}: {
  goalId: string;
  milestone: MilestoneResponse;
  today: string;
  onMove: (delta: number) => void;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  mutate: (patch: Patch, request: () => Promise<unknown>, failure: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  const closed = milestone.status === "COMPLETED" || milestone.status === "SKIPPED";

  return (
    <div className="group flex items-start gap-2.5 rounded-md px-1 py-1.5 transition-colors hover:bg-canvas">
      <Tick milestone={milestone} mutate={mutate} small />

      <div className="min-w-0 flex-1">
        <p className={`text-[0.8125rem] leading-snug ${closed ? "text-muted line-through" : ""}`}>
          {milestone.title}
        </p>
        {/* No status pill down here: the tick already says whether it is done,
            and a pill on every child would out-shout the milestone itself. */}
        {span(milestone) ? (
          <p
            className={`mt-0.5 text-[0.625rem] ${
              isOverdue(milestone, today) ? "font-medium text-danger" : "text-faint"
            }`}
          >
            {span(milestone)}
          </p>
        ) : null}
        {milestone.description ? (
          <p className="mt-1 line-clamp-2 max-w-2xl text-[0.6875rem] leading-relaxed whitespace-pre-wrap text-muted">
            {milestone.description}
          </p>
        ) : null}

        {/* Unlike a card, a row only carries what is true of it: a part-done
            sub-milestone says so, an untouched one stays a single clean line. */}
        {milestone.progress > 0 && milestone.status !== "COMPLETED" ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full bg-accent-soft"
              role="progressbar"
              aria-valuenow={milestone.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${milestone.title} progress`}
            >
              <div className="h-full rounded-full bg-accent" style={{ width: `${milestone.progress}%` }} />
            </div>
            <span className="text-[0.625rem] tabular-nums text-faint">{milestone.progress}%</span>
          </div>
        ) : null}
      </div>

      {/* Icons rather than words, because these four sit inside a card that is
          a third of a screen wide: as text they took more room than the title
          they belong to, and the space was taken whether or not they showed.
          `(hover: none)` keeps them reachable on touch, where there is no hover
          to reveal them with. */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
        {/* Sub-milestones are always a column, whichever way their parent is
            laid out, so these arrows do not change. */}
        <IconButton
          label={`Move ${milestone.title} earlier`}
          onClick={() => onMove(-1)}
          disabled={!canMoveEarlier}
        >
          ↑
        </IconButton>
        <IconButton
          label={`Move ${milestone.title} later`}
          onClick={() => onMove(1)}
          disabled={!canMoveLater}
        >
          ↓
        </IconButton>
        <IconButton label={`Edit ${milestone.title}`} onClick={() => setEditing(true)}>
          <PencilIcon className="size-3.5" />
        </IconButton>
        <IconButton
          label={`Delete ${milestone.title}`}
          danger
          onClick={() =>
            mutate(
              { id: milestone.id, removed: true },
              () => deleteMilestone(goalId, milestone.id),
              "Could not delete that sub-milestone.",
            )
          }
        >
          <TrashIcon className="size-3.5" />
        </IconButton>
      </div>

      {editing ? (
        <Modal title="Edit sub-milestone" onClose={() => setEditing(false)}>
          <MilestoneForm goalId={goalId} milestone={milestone} onDone={() => setEditing(false)} />
        </Modal>
      ) : null}
    </div>
  );
}

/** A small square button: an icon or a glyph, and the name it goes by. */
function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid size-6 shrink-0 place-items-center rounded-md text-[0.75rem] text-faint transition-colors hover:bg-canvas disabled:pointer-events-none disabled:opacity-25 ${
        danger ? "hover:text-danger" : "hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** The checkbox, at either size. The one action worth a single click. */
function Tick({
  milestone,
  mutate,
  small,
}: {
  milestone: MilestoneResponse;
  mutate: (patch: Patch, request: () => Promise<unknown>, failure: string) => void;
  small?: boolean;
}) {
  const done = milestone.status === "COMPLETED";
  const next: MilestoneStatus = done ? "PENDING" : "COMPLETED";

  return (
    <button
      type="button"
      onClick={() =>
        mutate(
          { id: milestone.id, status: next },
          () => setMilestoneStatus(milestone.goalId, milestone.id, next),
          "That did not save. Check your connection and try again.",
        )
      }
      aria-pressed={done}
      aria-label={done ? `Reopen ${milestone.title}` : `Complete ${milestone.title}`}
      className={`mt-0.5 grid shrink-0 place-items-center rounded-md border transition-colors ${
        small ? "size-4" : "size-5"
      } ${
        done
          ? "animate-check-pop border-positive bg-positive text-white"
          : "border-line-strong hover:border-accent"
      }`}
    >
      {done ? <CheckIcon className={small ? "size-2.5" : "size-3"} /> : null}
    </button>
  );
}

/**
 * The milestone's state, as a word with a colour behind it.
 *
 * <p>A pill rather than a line of grey text: status is the thing you scan a
 * card for, and on a wall of cards a colour is read before any of the words
 * are. The tones come from the product's own palette, so "done" is the same
 * green as a completed task everywhere else.
 *
 * <p>"Not started" is drawn as an outline rather than a filled grey blob.
 * Nothing has happened yet, so nothing should be colour-coded — but an outline
 * still reads as a considered state rather than as a missing one.
 */
const STATUS_TONE: Record<MilestoneStatus, string> = {
  PENDING: "border border-line-strong/60 text-muted",
  IN_PROGRESS: "bg-accent-soft text-accent",
  COMPLETED: "bg-positive-soft text-positive",
  SKIPPED: "border border-line text-faint",
};

function StatusPill({ status }: { status: MilestoneStatus }) {
  const label = MILESTONE_STATUSES.find((option) => option.value === status)?.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${STATUS_TONE[status]}`}
    >
      {/* `bg-current` takes the pill's own colour, so the dot is green on done
          and violet in progress without a second table to keep in step. */}
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {label}
    </span>
  );
}

/** Whether a milestone's target has passed with the work still open. */
function isOverdue(milestone: MilestoneResponse, today: string): boolean {
  return (
    milestone.targetDate !== null &&
    milestone.targetDate < today &&
    milestone.status !== "COMPLETED" &&
    milestone.status !== "SKIPPED"
  );
}

/** "Mar 2026 – Sep 2026", or whichever half of it exists. */
function span(milestone: MilestoneResponse): string | null {
  const options = { month: "short", year: "numeric" } as const;
  const from = milestone.startDate ? formatDay(milestone.startDate, options) : null;
  const to = milestone.targetDate ? formatDay(milestone.targetDate, options) : null;

  if (from && to) return from === to ? from : `${from} – ${to}`;
  if (to) return `by ${to}`;
  if (from) return `from ${from}`;
  return null;
}

type Patch = { id: string; status: MilestoneStatus } | { id: string; removed: true };

/** Applies one patch at whichever level the milestone lives on. */
function patchTree(tree: MilestoneResponse[], patch: Patch): MilestoneResponse[] {
  if ("removed" in patch) {
    return tree
      .filter((milestone) => milestone.id !== patch.id)
      .map((milestone) => ({
        ...milestone,
        children: milestone.children.filter((child) => child.id !== patch.id),
      }));
  }

  const applied = (milestone: MilestoneResponse): MilestoneResponse =>
    milestone.id === patch.id
      ? {
          ...milestone,
          status: patch.status,
          progress: patch.status === "COMPLETED" ? 100 : milestone.progress,
        }
      : milestone;

  return tree.map((milestone) => ({
    ...applied(milestone),
    children: milestone.children.map(applied),
  }));
}
