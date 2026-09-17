-- Routine :: initial schema
-- Conventions:
--   * UUID primary keys (gen_random_uuid() is built into PostgreSQL 13+)
--   * timestamptz for every instant; DATE for user-local calendar days
--   * status/type columns are varchar + CHECK, not native enums, so that
--     adding a value is a plain migration and JPA maps them as strings
--   * every user-owned table carries user_id so authorization is a single
--     predicate, never a join walk (see ROUTINE-PROJECT-PLAN section 7)

-- ---------------------------------------------------------------- users ----

CREATE TABLE users (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(320) NOT NULL,
    password_hash   VARCHAR(100) NOT NULL,
    display_name    VARCHAR(120) NOT NULL,
    timezone        VARCHAR(64)  NOT NULL DEFAULT 'UTC',
    email_verified  BOOLEAN      NOT NULL DEFAULT FALSE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                                 CHECK (status IN ('ACTIVE', 'DISABLED', 'DELETED')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Email is the login identifier: compare case-insensitively, store as given.
CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email));

CREATE TABLE user_settings (
    user_id             UUID        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    reminders_enabled   BOOLEAN     NOT NULL DEFAULT TRUE,
    email_reminders     BOOLEAN     NOT NULL DEFAULT TRUE,
    daily_review_time   TIME        NOT NULL DEFAULT '21:30',
    week_starts_on      SMALLINT    NOT NULL DEFAULT 1 CHECK (week_starts_on BETWEEN 1 AND 7),
    theme               VARCHAR(20) NOT NULL DEFAULT 'system',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refresh tokens are stored hashed so a database leak cannot mint sessions.
CREATE TABLE refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);

-- ---------------------------------------------------------------- goals ----

CREATE TABLE goals (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    category    VARCHAR(80),
    start_date  DATE,
    target_date DATE,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                             CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED')),
    progress    SMALLINT     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_goals_user_status ON goals (user_id, status);

CREATE TABLE goal_milestones (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id     UUID         NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    target_date DATE,
    order_index INTEGER      NOT NULL DEFAULT 0,
    status      VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    progress    SMALLINT     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_goal_milestones_goal ON goal_milestones (goal_id, order_index);

-- ------------------------------------------------------------- routines ----

CREATE TABLE routines (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    goal_id     UUID         REFERENCES goals (id) ON DELETE SET NULL,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    category    VARCHAR(80),
    start_time  TIME,
    end_time    TIME,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_routines_user_active ON routines (user_id, active);

-- The template steps of a routine. Generated daily tasks copy from these.
CREATE TABLE routine_tasks (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id       UUID         NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
    title            VARCHAR(200) NOT NULL,
    description      TEXT,
    order_index      INTEGER      NOT NULL DEFAULT 0,
    duration_minutes INTEGER      CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX ix_routine_tasks_routine ON routine_tasks (routine_id, order_index);

-- Deliberately small recurrence model (see plan section 28, "Complex Scheduling").
-- days_of_week is ISO-8601: 1 = Monday .. 7 = Sunday.
CREATE TABLE routine_schedules (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id    UUID        NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL
                              CHECK (schedule_type IN ('DAILY', 'WEEKDAYS', 'WEEKLY', 'SELECTED_DAYS')),
    days_of_week  SMALLINT[]  NOT NULL DEFAULT '{}',
    start_date    DATE        NOT NULL,
    end_date      DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_routine_schedule_range CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX ix_routine_schedules_routine ON routine_schedules (routine_id);

-- ---------------------------------------------------------------- tasks ----

CREATE TABLE tasks (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    goal_id         UUID         REFERENCES goals (id) ON DELETE SET NULL,
    routine_id      UUID         REFERENCES routines (id) ON DELETE SET NULL,
    routine_task_id UUID         REFERENCES routine_tasks (id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    category        VARCHAR(80),
    priority        VARCHAR(10)  NOT NULL DEFAULT 'MEDIUM'
                                 CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    status          VARCHAR(20)  NOT NULL DEFAULT 'TODO'
                                 CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED')),
    due_date        DATE,
    due_time        TIME,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- The Today page reads by (user, due_date); the dashboard filters on status.
CREATE INDEX ix_tasks_user_due     ON tasks (user_id, due_date);
CREATE INDEX ix_tasks_user_status  ON tasks (user_id, status);
CREATE INDEX ix_tasks_goal         ON tasks (goal_id)    WHERE goal_id    IS NOT NULL;
CREATE INDEX ix_tasks_routine      ON tasks (routine_id) WHERE routine_id IS NOT NULL;

-- One generated task per routine step per day: makes daily generation idempotent.
CREATE UNIQUE INDEX ux_tasks_routine_task_per_day
    ON tasks (routine_task_id, due_date)
    WHERE routine_task_id IS NOT NULL;

-- Completion history is kept separately from tasks.status so that streaks and
-- consistency metrics survive a task being edited, rescheduled or deleted.
CREATE TABLE task_completions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID        NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completion_date DATE        NOT NULL
);

CREATE UNIQUE INDEX ux_task_completions_task_date ON task_completions (task_id, completion_date);
CREATE INDEX ix_task_completions_user_date ON task_completions (user_id, completion_date);

-- ---------------------------------------------------------------- notes ----

CREATE TABLE notes (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    goal_id    UUID        REFERENCES goals (id)    ON DELETE CASCADE,
    task_id    UUID        REFERENCES tasks (id)    ON DELETE CASCADE,
    routine_id UUID        REFERENCES routines (id) ON DELETE CASCADE,
    note_date  DATE,
    title      VARCHAR(200),
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_notes_user_date ON notes (user_id, note_date DESC);
CREATE INDEX ix_notes_goal      ON notes (goal_id)    WHERE goal_id    IS NOT NULL;
CREATE INDEX ix_notes_task      ON notes (task_id)    WHERE task_id    IS NOT NULL;
CREATE INDEX ix_notes_routine   ON notes (routine_id) WHERE routine_id IS NOT NULL;

-- Full-text search over notes (plan section 12, "Search notes").
CREATE INDEX ix_notes_content_fts
    ON notes USING gin (to_tsvector('simple', coalesce(title, '') || ' ' || content));

-- ------------------------------------------------------------ reminders ----

CREATE TABLE reminders (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    task_id       UUID        REFERENCES tasks (id)    ON DELETE CASCADE,
    routine_id    UUID        REFERENCES routines (id) ON DELETE CASCADE,
    goal_id       UUID        REFERENCES goals (id)    ON DELETE CASCADE,
    message       VARCHAR(300),
    reminder_time TIMESTAMPTZ NOT NULL,
    channel       VARCHAR(20) NOT NULL DEFAULT 'EMAIL'
                              CHECK (channel IN ('EMAIL', 'IN_APP')),
    status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
    attempts      SMALLINT    NOT NULL DEFAULT 0,
    last_error    TEXT,
    sent_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The scheduler's hot query: pending reminders that are now due.
CREATE INDEX ix_reminders_due ON reminders (reminder_time) WHERE status = 'PENDING';
CREATE INDEX ix_reminders_user ON reminders (user_id, reminder_time);

-- Notification history + duplicate suppression (plan section 13).
CREATE TABLE notification_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id  UUID        NOT NULL REFERENCES reminders (id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    channel      VARCHAR(20) NOT NULL,
    outcome      VARCHAR(20) NOT NULL CHECK (outcome IN ('SENT', 'FAILED')),
    detail       TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_notification_log_reminder_sent
    ON notification_log (reminder_id) WHERE outcome = 'SENT';
CREATE INDEX ix_notification_log_user ON notification_log (user_id, processed_at DESC);

-- -------------------------------------------------------- daily reviews ----

CREATE TABLE daily_reviews (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    review_date      DATE        NOT NULL,
    summary          TEXT,
    what_went_well   TEXT,
    what_went_wrong  TEXT,
    what_to_improve  TEXT,
    rating           SMALLINT    CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    mood             SMALLINT    CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
    energy           SMALLINT    CHECK (energy IS NULL OR energy BETWEEN 1 AND 5),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_daily_reviews_user_date ON daily_reviews (user_id, review_date);
