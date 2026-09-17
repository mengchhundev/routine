# Tasks, goals & dashboard

Base path `/api/v1`. Every endpoint requires `Authorization: Bearer <token>` and
is scoped to the caller — a resource belonging to someone else answers `404`,
never `403`, so a guessed id cannot confirm that it exists.

---

## Tasks

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/tasks` | `?date=` one day · `?from=&to=` a range · `?scope=` a slice of the account · none of them means the user's today |
| `GET` | `/tasks/{id}` | |
| `POST` | `/tasks` | `201` |
| `PUT` | `/tasks/{id}` | Full replace |
| `DELETE` | `/tasks/{id}` | `204` |
| `POST` | `/tasks/{id}/complete` | Records a completion for the user's current local day |
| `POST` | `/tasks/{id}/skip` | Retracts today's completion if there was one |
| `POST` | `/tasks/{id}/reopen` | Undo — back to `TODO`, completion withdrawn |

```json
{
  "title": "Study Kubernetes",
  "description": null,
  "category": "Learning",
  "priority": "HIGH",
  "dueDate": "2026-09-05",
  "dueTime": "19:00",
  "goalId": "1f2e…",
  "routineId": null
}
```

`dueDate` is a **local calendar day**, not an instant: "do this Tuesday" stays
Tuesday wherever the user is. `priority` defaults to `MEDIUM`; `dueDate` may be
null for an unscheduled backlog item. A `goalId` the caller does not own is
rejected as `GOAL_NOT_FOUND`.

Responses add `generated: true` when the task came from a routine step rather
than being typed by hand.

## Goals

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/goals` | `?status=ACTIVE` to filter |
| `GET` | `/goals/{id}` | |
| `POST` | `/goals` | `201` |
| `PUT` | `/goals/{id}` | |
| `DELETE` | `/goals/{id}` | `204` |

### Milestones

Nested under the goal, because a milestone has no meaning without one — and
because the nesting is what carries ownership into every call.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/goals/{id}/milestones` | In display order |
| `POST` | `/goals/{id}/milestones` | `201`; lands at the end of the list |
| `PUT` | `/goals/{id}/milestones/{milestoneId}` | Full replace |
| `POST` | `/goals/{id}/milestones/{milestoneId}/status` | `{"status": "COMPLETED"}` |
| `POST` | `/goals/{id}/milestones/order` | `{"parentId": null, "order": ["id", …]}` |
| `DELETE` | `/goals/{id}/milestones/{milestoneId}` | `204`; takes its sub-milestones with it |

```json
{
  "title": "Deep understanding of Linux",
  "description": "Foundation to advanced: filesystems, processes, networking.",
  "startDate": "2026-01-01",
  "targetDate": "2026-09-30",
  "status": "IN_PROGRESS",
  "progress": 40,
  "parentId": null
}
```

`status` is `PENDING`, `IN_PROGRESS`, `COMPLETED` or `SKIPPED`. Ticking one off
is its own endpoint so that it is not a whole-form save, and completing a
milestone sets its `progress` to 100 rather than leaving a stale number behind.

A milestone runs over a span. Both dates are optional; `targetDate` before
`startDate` is `400 MILESTONE_DATES_REVERSED`.

### Sub-milestones

`parentId` nests a milestone under another. It is read **on create only** —
moving a milestone under a different parent is a different action from editing
it, and one verb doing both makes a misclick indistinguishable from a rename.

**Nesting stops at one level.** A sub-milestone of a sub-milestone is
`400 MILESTONE_NESTING_TOO_DEEP`. That is a product decision rather than a
shortcut: a goal broken down three deep is an outline, and an outline of a goal
is a plan nobody finishes writing.

`GET /goals/{id}` and `GET /goals/{id}/milestones` return the two levels nested,
with each milestone carrying its own `children` (always present, empty for a
sub-milestone). Ordering is **per level**: `parentId` on the reorder request
says which level is being rewritten, `null` for the goal's own steps.

Reordering keeps milestones the request does not mention, placing them after the
ones it names — a reorder computed against a slightly stale list cannot silently
drop a milestone added in another tab.

### How a goal's percentage is decided

```json
{
  "progress": 33,
  "progressSource": "MILESTONES",
  "manualProgress": 40,
  "milestoneCount": 3,
  "completedMilestones": 1
}
```

- **With milestones** — `progress` is their equal-weighted average, and
  `progressSource` is `MILESTONES`. A `COMPLETED` milestone counts as 100
  whatever its stored percentage says.
- **Only top-level milestones are averaged.** A milestone with sub-milestones
  contributes what *they* add up to, so the same rule applies at both levels and
  `milestoneCount` stays a count of the goal's own steps. Averaging every
  milestone flat instead would weight a step by how finely it happens to be
  broken down: splitting one into five would move the goal's number without
  anything having been done.
- **Completing a parent outright counts as 100**, whatever is still listed
  underneath it — ticking it is a deliberate "this is done".
- **Without** — `progress` is `manualProgress`, the number the user typed, and
  `progressSource` is `MANUAL`.
- **`SKIPPED` milestones leave the average entirely** rather than counting as
  zero. Deciding you do not need a step is a change of plan, not a failure.

`manualProgress` is always returned and never overwritten, so adding milestones
is not a silent data loss and deleting the last one restores the old number.

Anything finer than equal weighting — hours, effort, guessed weights — asks the
user to estimate the size of work they have not started, and makes the number
feel arbitrary the first time it moves the wrong way.


### Scopes

`?scope=` answers the Tasks screen's questions, and may be combined with
`status`, `priority` and `q` (a case-insensitive substring of the title).

| Scope | Means |
| --- | --- |
| `ALL` | Everything, whatever its date or status |
| `OVERDUE` | Still to do, on a day that has passed |
| `UPCOMING` | Still to do, today or later |
| `BACKLOG` | Still to do, with no day chosen yet |
| `DONE` | Completed, skipped or cancelled |

"Still to do" and "done" are the scope's own defaults; an explicit `status`
overrides them, so `?scope=OVERDUE&status=SKIPPED` is a question you can ask.
Overdue is relative to the caller's own today, never the server's.

Results sort by due date ascending, then time, then newest first. **Undated
tasks sort last** — a backlog above tomorrow's plan buries the plan under the
wish list.

Passing any of `scope`, `status`, `priority` or `q` selects this listing;
without them, `date`/`from`/`to` behave exactly as before.

---

## `GET /planner/day`

One day, whole — what the Today screen renders. `?date=YYYY-MM-DD`; omit it for
the user's own today, which the browser cannot determine reliably.

```json
{
  "date": "2026-09-05",
  "timezone": "Asia/Phnom_Penh",
  "isToday": true,
  "progress": { "planned": 5, "completed": 3, "percent": 60 },
  "tasks": [],
  "note": null,
  "review": null
}
```

`note` and `review` are always present, even when null. The service trims nulls
globally, but here their absence is the information: a client must be able to
tell "nothing written yet" from "the server did not send this field".

`progress` uses the same definition as the dashboard — one shared
implementation, so the two screens can never disagree.

## Notes

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/notes` | `?date=` — one day's notes, defaulting to the user's today |
| `GET` | `/notes/search` | `?q=` full text · `?goalId=` · `?page=` — the Notes screen |
| `POST` | `/notes` | `201` |
| `PUT` | `/notes/{id}` | |
| `DELETE` | `/notes/{id}` | `204` |

A note may hang off a day (`noteDate`), a task, a routine, a goal, or nothing.
The Today screen writes the day's note and deletes it when emptied, rather than
storing a blank row.

`/notes` and `/notes/search` return different shapes on purpose — a day's notes
are a list, a whole account's are a page (`{notes, page, size, total, hasMore}`).
One endpoint returning either would make every caller check which it got.

`?q=` goes through PostgreSQL's full-text index (`ix_notes_content_fts`), not a
`LIKE` scan: the whole point of keeping notes is finding one again, and that has
to keep working at a thousand notes. It matches whole words.

## Daily review

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/reviews/{date}` | `204` when the day has no review yet |
| `PUT` | `/reviews/{date}` | Upsert — creates or edits that day's review |

Addressed by date rather than id: a unique index allows exactly one per user per
day, so `PUT` is the honest verb. Every field is optional — a review with one
sentence in it is still a review, and a form that refuses to save until all
seven boxes are full is a form people stop opening. `rating`, `mood` and
`energy` are 1–5.

## `GET /analytics/dashboard`

Everything the dashboard renders, in one round trip.

```json
{
  "date": "2026-09-05",
  "timezone": "Asia/Phnom_Penh",
  "today":  { "planned": 5, "completed": 3, "percent": 60 },
  "streakDays": 7,
  "week": {
    "days": [{ "date": "2026-08-30", "planned": 5, "completed": 4, "percent": 80 }],
    "planned": 35, "completed": 29, "percent": 83
  },
  "todayTasks": [],
  "activeGoals": [],
  "openTaskCount": 6
}
```

### How each number is calculated

Progress that a user cannot explain is progress they will not trust, so the
definitions are deliberately plain — and the dashboard states them on screen.

- **planned(day)** — tasks whose `dueDate` is that day and whose status is not
  `CANCELLED`.
- **completed(day)** — completions of tasks **due that day**, whenever they were
  actually ticked off. Counting by the tick date instead lets a catch-up session
  push a day past 100%, which is not a rate at all.
- **percent** — `completed ÷ planned`, rounded. `0` when nothing was planned,
  because "no tasks" is not "0% done"; the UI shows an empty state rather than a
  zeroed bar.
- **week** — a *rolling* seven days ending today, not a calendar week, which
  would show a nearly empty chart every Monday morning.
- **streakDays** — consecutive days with at least one completion, counting back
  from today. A day with nothing done yet does **not** break the streak until it
  is over, so opening the app early in the morning does not show a zero.
- **openTaskCount** — every task still `TODO`, across all dates.

Metrics are derived on read and stored nowhere. A second copy could disagree
with the task list on the same screen, and a dashboard that contradicts the page
below it discredits both.
