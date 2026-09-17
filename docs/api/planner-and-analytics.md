# Planner & analytics

Base path `/api/v1`. Every endpoint requires `Authorization: Bearer <token>` and
answers only about the caller.

The planner has three horizons — a day, a week, a month — and analytics is the
same data asked a longer question. All four read completion through one shared
implementation, so a day opened from the week always agrees with the week it was
opened from. `GET /planner/day` is documented with
[tasks and the dashboard](tasks-and-dashboard.md).

---

## `GET /planner/week`

The week containing `?date=YYYY-MM-DD`; omit it for the week the user is in.
**Any** day in the week asks for the same week, so "next week" is the current
start plus seven rather than arithmetic the client has to get right against the
user's first-day-of-week setting.

```json
{
  "start": "2026-09-07",
  "end": "2026-09-13",
  "timezone": "Asia/Phnom_Penh",
  "today": "2026-09-10",
  "weekStartsOn": 1,
  "days": [
    {
      "date": "2026-09-07",
      "isToday": false,
      "progress": { "planned": 5, "completed": 4, "percent": 80 },
      "tasks": []
    }
  ],
  "total": { "planned": 31, "completed": 24, "percent": 77 }
}
```

`days` is always seven, in order, including days with nothing on them — an
absent Wednesday would read as a bug. `weekStartsOn` is the ISO-8601 day number
from the user's settings (1 = Monday), and the week genuinely starts there: a
planner that always starts on Monday is wrong for everyone whose week does not.

## `GET /planner/month`

`?month=YYYY-MM`; omit it for the month the user is in. A malformed value
answers `400 INVALID_MONTH` rather than 500 — the URL is hand-editable.

```json
{
  "month": "2026-09",
  "start": "2026-09-01",
  "end": "2026-09-30",
  "timezone": "Asia/Phnom_Penh",
  "today": "2026-09-10",
  "weekStartsOn": 1,
  "days": [{ "date": "2026-09-01", "isToday": false, "planned": 5, "completed": 4, "percent": 80 }],
  "total": { "planned": 120, "completed": 96, "percent": 80 },
  "activeDays": 24
}
```

Counts only, no task lists: the question a month answers is *which days did I
actually do the work*, and thirty lists of tasks answer it worse than thirty
numbers. `activeDays` counts days with at least one task planned — a month is
not 30% done because you took weekends off.

### Generation on read

Both endpoints materialise their range from the user's active routines before
answering, exactly as `/planner/day` does, and with the same refusal to write
into days already past. Opening last March cannot create tasks nobody could have
done — history is a record, not something a page view may edit. See
[decision 13](../architecture/decisions.md).

---

## `GET /analytics/summary`

`?days=` — clamped to 7–365, default 30. A window of days ending today, and the
handful of cuts through it that answer *am I becoming better over time*.

```json
{
  "start": "2026-08-12", "end": "2026-09-10",
  "timezone": "Asia/Phnom_Penh",
  "dayCount": 30,
  "total": { "planned": 120, "completed": 96, "percent": 80 },
  "days": [{ "date": "2026-08-12", "planned": 5, "completed": 4, "percent": 80 }],
  "categories": [{ "label": "Learning", "planned": 40, "completed": 31, "percent": 78 }],
  "weekdays":   [{ "label": "Monday",   "planned": 20, "completed": 18, "percent": 90 }],
  "routines": [
    { "routineId": "…", "name": "Morning routine", "active": true,
      "expected": 60, "completed": 54, "percent": 90 }
  ],
  "missedTaskCount": 9,
  "currentStreak": 7,
  "longestStreak": 14,
  "goals": [{ "goalId": "…", "title": "Senior DevOps", "progress": 38, "progressSource": "MILESTONES" }]
}
```

- **categories** — grouped on the task's own category, most-planned first.
  Untagged work is gathered under `Uncategorised` rather than dropped: a chart
  that silently omits half the tasks is worse than no chart.
- **weekdays** — always seven rows, Monday first, so the chart has a shape
  before there is data.
- **routines** — of the tasks a routine put on the calendar in this window, how
  many were done. This is the number that says whether a routine is working or
  is just a promise on a page. A deleted routine can still appear, named
  `Deleted routine`, because its generated tasks survive it.
- **missedTaskCount** — tasks due on a day that has passed and still open or
  skipped. The honest other half of a completion rate.
- **longestStreak** — the best run inside the window; `currentStreak` uses the
  same definition as the dashboard.

No generation runs here. Analytics reads history, and history is not something a
page view may add to.

Every figure is derived on read and stored nowhere — see the dashboard's note on
why a second copy of these numbers would be a liability.

---

## Reminders

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/reminders` | `?scope=UPCOMING` (default) · `PAST` · `ALL` |
| `GET` | `/reminders/history` | The last 50 delivery attempts |
| `GET` | `/reminders/{id}` | |
| `POST` | `/reminders` | `201` |
| `PUT` | `/reminders/{id}` | Also retries a failed one — it returns to `PENDING` |
| `POST` | `/reminders/{id}/cancel` | Stops it firing, keeps the record |
| `DELETE` | `/reminders/{id}` | `204` |

```json
{
  "remindAt": "2026-09-11T06:30",
  "message": "Morning routine",
  "channel": "IN_APP",
  "taskId": null,
  "routineId": "…",
  "goalId": null
}
```

`remindAt` is the user's own **wall clock**, not an instant. People set reminders
in the time they live in; the server resolves it against their timezone once, at
write time, and the scheduler then compares instants only — so a DST change
cannot shift an already-scheduled reminder by an hour.

A reminder is about **at most one** thing. Sending more than one of
`taskId` / `routineId` / `goalId` is `400 REMINDER_SUBJECT_AMBIGUOUS`; sending
neither a subject nor a message is `400 REMINDER_EMPTY`. Responses resolve the
subject's title, so a list of reminders does not need a request per row.

`scope=UPCOMING` means *still going to happen* — pending and in the future. A
pending reminder whose time has passed is the dispatcher's backlog, not the
user's plan.

### Delivery

A poll every minute (`routine.reminders.poll-interval`) claims what is due and
delivers each in its own transaction, so one failure cannot roll back the
deliveries either side of it. A timer per reminder would not survive a restart,
and a queue is a second piece of infrastructure to run before the product has
users.

- **What stops a double send** is not the claim query's lock, which is released
  when the claim transaction commits. It is the partial unique index on
  `notification_log (reminder_id) WHERE outcome = 'SENT'`: two workers may both
  decide to send, but only one can record having done so.
- **Failures retry** until `max-attempts` (3), then the reminder is `FAILED`
  with `lastError` set, which the screen shows on the row. A reminder that fails
  silently teaches people to stop trusting reminders.
- **Late reminders are not delivered.** Past `grace-window` (6 hours) the
  reminder is `CANCELLED` and says it missed its window — being pinged at
  midnight about this morning's workout is worse than silence.
- **Settings are honoured at delivery**, not at write time. Reminders switched
  off entirely means nothing is delivered; email switched off downgrades an
  `EMAIL` reminder to `IN_APP` rather than dropping it.

`IN_APP` is delivered by being recorded — the client reads it from the reminder
list, so there is nothing to transmit. That is why reminders work in the MVP
with no mail provider configured. A real email sender implements
`NotificationSender` alongside it without the dispatcher changing.

---

## Account

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/users/me` | |
| `PUT` | `/users/me` | `displayName`, `timezone` (a valid IANA zone id) |
| `POST` | `/users/me/password` | Revokes every other session |
| `GET` | `/users/me/settings` | |
| `PUT` | `/users/me/settings` | |

`timezone` decides what counts as today throughout the product — which day a
task is due, which day a completion lands on, where a streak breaks.
`weekStartsOn` drives the week planner. `remindersEnabled` and `emailReminders`
are read by the dispatcher, above.
