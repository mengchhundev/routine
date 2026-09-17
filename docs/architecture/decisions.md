# Architecture decisions

Each entry records what was decided, why, and what would make it worth revisiting.

---

## 1. Modular monolith, not microservices

**Decision.** One Spring Boot deployable, one PostgreSQL database, with packages
drawn on the module boundaries from the project plan: `auth`, `user`, `task`,
`routine`, `goal`, `note`, `reminder`, `analytics`.

**Why.** Routine's hard problems are product problems, not scaling problems. A
monolith keeps a cross-module change — "completing a task updates goal progress"
— a single transaction and a single deployment instead of a distributed one.

**Revisit when.** A specific module's resource profile genuinely diverges from
the rest. The reminder worker is the likely first candidate, and it can move out
as a separate process against the same database long before anything needs to
become a service.

---

## 2. Modules refer to each other by id, not by JPA association

**Decision.** Entities hold `UUID goalId`, not `@ManyToOne Goal goal`.

**Why.** Associations across module boundaries make those boundaries decorative:
a lazy-loaded graph will happily pull half the schema into a request that asked
for one row, and the coupling only becomes visible under load. Ids keep every
query explicit and every ownership check local.

**Cost.** Multi-entity reads need a second query and assembly in the service
layer. That is the intended trade: visible N+1 beats invisible N+1.

---

## 3. Ownership is enforced by the repository's shape

**Decision.** Every user-owned repository extends `UserOwnedRepository`, whose
only lookups are `findByIdAndUserId`, `existsByIdAndUserId` and
`deleteByIdAndUserId`. Plain `findById` is not offered.

**Why.** The plan's security rule — every user-owned resource is authorized
against the authenticated user — is the kind of check that is easy to write
correctly ninety-nine times and forget once. Making the unscoped lookup
unavailable turns "remember to check" into "cannot express the unchecked
version". A forgotten check is a compile error, not a data leak.

---

## 4. Flyway owns the schema; Hibernate validates it

**Decision.** `spring.jpa.hibernate.ddl-auto: validate`. Every schema change is a
numbered migration.

**Why.** Generated DDL cannot express what this schema needs: partial unique
indexes (one `SENT` notification per reminder; one generated task per routine
step per day), array columns, GIN full-text indexes, and `CHECK` constraints on
status columns. Validation on startup means mapping drift fails at deploy time
rather than at the first request that touches the changed column.

---

## 5. Status columns are `varchar` + `CHECK`, not native enums

**Decision.** `status VARCHAR(20) NOT NULL CHECK (status IN (...))`.

**Why.** Adding a value to a PostgreSQL enum type is awkward to do inside a
transactional migration and awkward to roll back. A `CHECK` constraint is a
plain `ALTER TABLE`, and JPA maps the column as a string either way. The
database still rejects unknown values.

---

## 6. Completion history is separate from task status

**Decision.** `task_completions` records `(task_id, user_id, completed_at,
completion_date)`, in addition to `tasks.status`.

**Why.** Streaks, routine consistency and weekly completion rates are claims
about the past. If they read `tasks.status`, then editing, rescheduling or
deleting a task silently rewrites history the user already saw — and a product
whose central promise is "am I improving over time" cannot have numbers that
move under the user. The unique index on `(task_id, completion_date)` makes
double-completion impossible.

**A day's completion count follows the task's due date, not the moment the box
was ticked.** "How much of Tuesday's plan did I do" is a question about Tuesday;
crediting a catch-up session to the day it happened let a day exceed 100%, which
is not a rate. Streaks still read the tick date — *that* question really is
about when the user showed up.

---

## 7. Dates are local days; times are instants

**Decision.** `due_date` is a `DATE` in the user's timezone. `reminder_time` is a
`TIMESTAMPTZ`.

**Why.** These are genuinely different types of fact. "Do this on Tuesday" stays
Tuesday when the user flies to another continent; "notify me at 06:30" is a
specific moment that must survive a DST transition without shifting an hour.
Every user carries an IANA timezone, captured at sign-up from the browser.

---

## 8. Short access token, rotating refresh token

**Decision.** A 15-minute HS384 JWT for access; a 30-day opaque refresh token,
stored only as a SHA-256 digest, rotated on every use.

**Why.** A stateless access token keeps the hot path free of database lookups,
but it cannot be revoked — so it is short. Session length lives in the refresh
token, which is a database row and therefore *can* be revoked, on logout, on
password change, or wholesale. Rotation makes a stolen refresh token usable at
most once; presenting an already-revoked token is treated as evidence of theft
and drops every session for that user.

**Why hashed.** Refresh tokens are 256 bits of entropy, so a fast digest is
right — no work factor is needed, unlike passwords. Storing only the digest
means a database leak cannot be replayed as a live session.

---

## 9. Tokens live in httpOnly cookies, set by Next route handlers

**Decision.** The browser never calls Spring Boot directly. It posts to
`/api/auth/*` route handlers in Next.js, which call the API and set `routine_at`
and `routine_rt` as httpOnly, SameSite=Lax cookies.

**Why.** `localStorage` is readable by any script on the page, so one XSS bug
becomes a stolen session. httpOnly cookies are not reachable from JavaScript at
all. The route-handler hop is the price, and it also keeps the API's address off
the client entirely.

**Refresh happens in middleware**, before the page renders, so a signed-in user
never sees a token expire mid-navigation and no client-side token juggling is
needed.

---

## 10. No secret has a committed default

**Decision.** `routine.auth.jwt-secret` has no fallback value. A blank
`ROUTINE_JWT_SECRET` stops the application at startup.

**Why.** A default that works out of the box is a default that reaches
production. `Keys.hmacShaKeyFor` additionally rejects anything under 256 bits, so
a weak key fails loudly rather than quietly weakening every token issued. The
throwaway development key lives in `docker-compose.yml`, which is never the
source of production configuration.

---

## 11. Analytics owns no tables

**Decision.** The `analytics` module derives every metric from `tasks`,
`task_completions`, `routines` and `goals`.

**Why.** A separate metrics store is a second source of truth, and the failure
mode — a dashboard that disagrees with the task list — attacks the credibility of
the whole product. Derived numbers cannot drift.

**Revisit when.** Profiling shows the derivation is actually slow. Redis is
already in the compose stack for exactly that cache.

---

## 12. Errors have one shape

**Decision.** Every failure returns `{code, message, timestamp}`, plus `details`
for field-level validation. Unexpected exceptions are logged with a stack trace
and answered with a generic `INTERNAL_ERROR`.

**Why.** Clients get something they can branch on (`code`) without parsing prose,
and internal details never reach a response. Login failures deliberately return
one identical answer for a wrong password and an unknown account, and the login
path runs a bcrypt comparison either way, so neither the body nor the response
time discloses which addresses have accounts.

---

## 13. Routine tasks are generated when a day is opened, not by a nightly job

**Decision.** `RoutineGenerator.ensure(userId, date)` runs from the two
endpoints that serve a day — the planner and the dashboard — and creates any
missing tasks for active routines whose schedule falls on that date. Generation
is refused for days already past. The unique index on
`(routine_task_id, due_date)` makes repeating the call a no-op.

**Why.** A nightly sweep has to decide what "today" means for every user at
once, and there is no hour at which that is right for everyone: at 00:05 UTC it
is still yesterday afternoon in Los Angeles and mid-morning in Phnom Penh.
Asking as the day is opened asks in the reader's own timezone by construction,
and needs no scheduler, no leader election and no catch-up run after downtime.

Refusing the past is the other half. Without it, browsing back through last
month would create tasks nobody could have completed and silently rewrite that
month's completion rate — a page view must not be able to edit history.

**Cost.** A GET can write. That is accepted deliberately: the write is
idempotent, bounded by the number of steps due that day, and happens outside the
read-only transaction that assembles the response.

**Revisit when.** Reminders need to know about tomorrow's tasks before anyone
opens the app. That worker already has to run per-user in local time, and
generation can move into it — the guard against writing the past stays either
way.

---

## 14. Goal progress is derived from milestones, but the manual number is kept

**Decision.** A goal with milestones reports their equal-weighted average and
says `progressSource: "MILESTONES"`. A goal without them reports the number the
user typed and says `MANUAL`. The typed number is stored and returned either
way, as `manualProgress`. A `SKIPPED` milestone leaves the average rather than
counting as zero.

**Why.** "38%" that a user typed and "38%" the product worked out are different
claims, and rendering them identically makes both less believable — so the
response says which it is and the UI prints it. Keeping `manualProgress` means
adding the first milestone is not a silent data loss, and deleting the last one
restores what the goal said before.

Equal weighting is a deliberate refusal to do better. Anything finer — hours,
effort, weights — asks the user to estimate the size of work they have not
started, which they cannot do, and makes the number feel arbitrary the first
time it moves the wrong way.

Sub-milestones do not change the rule, they apply it twice: a milestone with
children derives its figure from them exactly as the goal derives its figure
from its top-level steps. Averaging every milestone flat instead would weight a
step by how finely it happens to be broken down — splitting one into five would
move the goal's percentage without any work having been done.

**Revisit when.** Milestones acquire their own tasks. Weighting by completed
tasks per milestone would then be derived from evidence rather than from a
guess, which is a different proposition.

---

## 17. Milestones nest exactly one level

**Decision.** A milestone may have sub-milestones; a sub-milestone may not.
`GoalService` rejects the third level with `MILESTONE_NESTING_TOO_DEEP`, and
ordering is kept per level rather than per goal.

**Why.** People write milestones that are really several things — "deep
understanding of Linux, foundation to advanced" — and need somewhere to put the
parts. One level gives them that. Arbitrary depth turns the goal screen into an
outline editor, and an outline of a goal is a plan nobody finishes writing: the
work moves from doing the thing to describing it.

Two levels also keep the reading cheap. The whole tree is one query, nested in
memory, and the UI can render a parent and its children without a recursive
component or an indent that stops being legible the moment a title wraps.

The limit lives in the service, not in a CHECK constraint, because SQL cannot
see a grandparent. The database still refuses a row that is its own parent,
which is the part it can enforce.

**Revisit when.** Somebody has a goal whose milestones genuinely have three
meaningful levels *and* is not better served by making the middle level its own
goal. The parent link is already self-referential, so the change is a service
rule and a recursive render, not a migration.

---

## 15. Reminders are delivered by an in-process poll, guarded by a unique index

**Decision.** `ReminderDispatcher` polls every minute for due reminders and
hands each to `ReminderDelivery`, which sends it in its own transaction.
Delivery is recorded in `notification_log`, whose partial unique index —
`(reminder_id) WHERE outcome = 'SENT'` — is what actually prevents a double
send. Delivery itself is behind `NotificationSender`, and the shipped
implementation is the in-app channel.

**Why.** A timer per reminder does not survive a restart. A queue is a second
piece of infrastructure to run before the product has users. A minute of
granularity is well inside what anybody notices about a reminder, and the claim
is one indexed read against a partial index.

The claim query's `SKIP LOCKED` lock is a politeness between pollers, not a
correctness guarantee: it is released when the claim transaction commits, before
anything is delivered. The unique index is the guarantee. Writing it the other
way round — trusting the lock — would work on one instance and fail quietly on
two.

Late reminders are cancelled rather than sent. Being pinged at midnight about
the morning's workout is worse than silence, and a reminder that arrives after
it could have been acted on teaches people to ignore the next one.

**Revisit when.** Delivery needs to fan out to email and push at volume. The
sender interface is already the seam; the poll becomes a producer and the
`notification_log` guarantee stays exactly as it is.

---

## 16. The planner's three horizons share one definition of progress

**Decision.** Day, week and month are three endpoints on one service, and all
three — plus the dashboard and analytics — read completion through
`TaskService.progressBetween`.

**Why.** The week view links to the day view. If the two computed their rates
separately they would eventually disagree, and a user who clicks from "Tuesday:
80%" into a Tuesday that says 60% has learned that neither number is worth
reading. One implementation makes the disagreement impossible rather than
unlikely.

The month deliberately carries counts and no task lists. The question a month
answers is *which days did I actually do the work*; thirty lists of tasks answer
it worse than thirty numbers, and cost far more to send.

**Revisit when.** A horizon needs a rate the others do not have — a quarter
measured against goal milestones rather than tasks, say. That is a new
definition, and it should be added as one rather than forked from this.
