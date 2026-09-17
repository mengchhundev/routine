# Routines

Base path `/api/v1`. Every endpoint requires `Authorization: Bearer <token>` and
is scoped to the caller — a routine belonging to someone else answers `404`,
never `403`, so a guessed id cannot confirm that it exists.

A routine is a template: a schedule, and an ordered list of steps. It does not
hold your tasks — it produces them. See
[decision 13](../architecture/decisions.md) for when that happens and why.

---

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/routines` | `?activeOnly=true` to skip paused ones |
| `GET` | `/routines/{id}` | |
| `POST` | `/routines` | `201` |
| `PUT` | `/routines/{id}` | Full replace, including schedule and steps |
| `POST` | `/routines/{id}/active` | `{"active": false}` pauses, `true` resumes |
| `DELETE` | `/routines/{id}` | `204` |

```json
{
  "name": "Morning routine",
  "description": null,
  "category": "Health",
  "goalId": null,
  "startTime": "06:30",
  "endTime": null,
  "active": true,
  "schedule": {
    "type": "DAILY",
    "daysOfWeek": [],
    "startDate": "2026-09-06",
    "endDate": null
  },
  "steps": [
    { "id": null, "title": "Drink water", "description": null, "durationMinutes": 5 },
    { "id": null, "title": "Exercise", "description": null, "durationMinutes": 30 },
    { "id": null, "title": "Plan the day", "description": null, "durationMinutes": null }
  ]
}
```

## Schedules

`type` is one of `DAILY`, `WEEKDAYS`, `WEEKLY`, `SELECTED_DAYS`. The last two
read `daysOfWeek` as ISO-8601 day numbers (1 = Monday .. 7 = Sunday) and are
rejected with `SCHEDULE_DAYS_REQUIRED` if it is empty — generating nothing in
silence would look like a broken product rather than an unfinished form.

`startDate` defaults to the caller's today. `endDate` is optional; past it, the
routine stops producing tasks without being paused.

One schedule per routine. The table permits several, so a routine that runs
mornings and evenings remains possible without a migration.

## Steps

Send a step's `id` back when editing it. A step that keeps its id keeps its
identity, and with it the link from every task already generated from it —
which is what stops an edit from duplicating today's tasks. A step the request
omits is deleted; a step with a null id is new. `orderIndex` is assigned from
the order of the array, and `durationMinutes` staggers generated `dueTime`s from
the routine's `startTime`.

## What generation produces

Each step becomes an ordinary task on the days the routine runs, carrying the
routine's `category` and `goalId`, and marked `generated: true` in task
responses. From then on it behaves like any other task: it can be completed,
skipped, rescheduled or deleted, and it counts towards the day's rate.

Pausing a routine stops future days. Tasks already generated stay — the
difference between "I stopped doing this" and "this never happened".
