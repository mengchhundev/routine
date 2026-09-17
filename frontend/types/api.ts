/** Mirrors the DTOs in com.routine.*.dto. Keep in step with the backend. */

export type UserResponse = {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  emailVerified: boolean;
  createdAt: string;
};

export type AuthResponse = {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  /** Seconds until accessToken expires. */
  expiresIn: number;
  user: UserResponse;
};

export type SettingsResponse = {
  remindersEnabled: boolean;
  emailReminders: boolean;
  dailyReviewTime: string;
  weekStartsOn: number;
  theme: string;
};

/** The one error shape every endpoint returns (see ApiError.java). */
export type ApiErrorBody = {
  code: string;
  message: string;
  timestamp: string;
  details?: Record<string, string>;
};

export type TaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type TaskResponse = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  dueTime: string | null;
  goalId: string | null;
  routineId: string | null;
  /** Came from a routine step rather than being typed by hand. */
  generated: boolean;
};

export type TaskScope = "ALL" | "OVERDUE" | "UPCOMING" | "BACKLOG" | "DONE";

/** What the task form sends. Only the title is required. */
export type TaskDraft = {
  title: string;
  description?: string | null;
  category?: string | null;
  priority: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
};

export type GoalStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ABANDONED";
export type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export type MilestoneResponse = {
  id: string;
  goalId: string;
  /** The milestone this one is part of, or null for a top-level step. */
  parentId: string | null;
  title: string;
  description: string | null;
  startDate: string | null;
  targetDate: string | null;
  orderIndex: number;
  status: MilestoneStatus;
  /** Derived from `children` when there are any, otherwise `ownProgress`. */
  progress: number;
  progressSource: "MILESTONES" | "MANUAL";
  ownProgress: number;
  childCount: number;
  completedChildren: number;
  /** Always empty for a sub-milestone — nesting stops at one level. */
  children: MilestoneResponse[];
};

export type GoalResponse = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  startDate: string | null;
  targetDate: string | null;
  status: GoalStatus;
  /** The number to show — derived from milestones when the goal has any. */
  progress: number;
  progressSource: "MILESTONES" | "MANUAL";
  /** What the user typed, kept so adding milestones is not a silent data loss. */
  manualProgress: number;
  milestoneCount: number;
  completedMilestones: number;
  /** Absent when the goal was returned without its milestones loaded. */
  milestones?: MilestoneResponse[];
};

export type GoalDraft = {
  title: string;
  description?: string | null;
  category?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  status?: GoalStatus;
  progress?: number | null;
};

export type MilestoneDraft = {
  title: string;
  description?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  status?: MilestoneStatus;
  progress?: number | null;
  /** Create only — the API ignores it on an update. */
  parentId?: string | null;
};

export type DayProgress = {
  date: string;
  planned: number;
  completed: number;
  percent: number;
};

export type DashboardResponse = {
  date: string;
  timezone: string;
  today: { planned: number; completed: number; percent: number };
  streakDays: number;
  week: { days: DayProgress[]; planned: number; completed: number; percent: number };
  todayTasks: TaskResponse[];
  activeGoals: GoalResponse[];
  openTaskCount: number;
};

export type NoteResponse = {
  id: string;
  title: string | null;
  content: string;
  noteDate: string | null;
  goalId: string | null;
  taskId: string | null;
  routineId: string | null;
  updatedAt: string;
};

/** A page of notes — GET /api/v1/notes/search. */
export type NotePage = {
  notes: NoteResponse[];
  page: number;
  size: number;
  total: number;
  hasMore: boolean;
};

export type DailyReviewResponse = {
  id: string;
  reviewDate: string;
  summary: string | null;
  whatWentWell: string | null;
  whatWentWrong: string | null;
  whatToImprove: string | null;
  rating: number | null;
  mood: number | null;
  energy: number | null;
  updatedAt: string;
};

export type Progress = { planned: number; completed: number; percent: number };

/** One day, whole — GET /api/v1/planner/day. */
export type DayResponse = {
  date: string;
  timezone: string;
  isToday: boolean;
  progress: Progress;
  tasks: TaskResponse[];
  note: NoteResponse | null;
  review: DailyReviewResponse | null;
};

// ------------------------------------------------------------- routines ----

export type ScheduleType = "DAILY" | "WEEKDAYS" | "WEEKLY" | "SELECTED_DAYS";

export type RoutineStep = {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  orderIndex: number;
};

export type RoutineSchedule = {
  type: ScheduleType;
  /** ISO-8601 day numbers, 1 = Monday .. 7 = Sunday. */
  daysOfWeek: number[];
  startDate: string;
  endDate: string | null;
};

export type RoutineResponse = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  goalId: string | null;
  startTime: string | null;
  endTime: string | null;
  active: boolean;
  /** Absent only for a routine saved before schedules were required. */
  schedule?: RoutineSchedule | null;
  steps: RoutineStep[];
};

/** What the form sends. Steps keep their id so an edit is not a delete. */
export type RoutineDraft = {
  name: string;
  description?: string | null;
  category?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  active?: boolean;
  schedule: {
    type: ScheduleType;
    daysOfWeek: number[];
    startDate?: string | null;
    endDate?: string | null;
  };
  steps: { id?: string; title: string; durationMinutes?: number | null }[];
};

// ------------------------------------------------------- planner: ranges ----

/** One day of the week planner — GET /api/v1/planner/week. */
export type WeekDay = {
  date: string;
  isToday: boolean;
  progress: Progress;
  tasks: TaskResponse[];
};

export type WeekResponse = {
  start: string;
  end: string;
  timezone: string;
  today: string;
  /** ISO-8601 day number the user's week begins on. */
  weekStartsOn: number;
  days: WeekDay[];
  total: Progress;
};

/** One day of the month calendar — counts only, by design. */
export type MonthDay = {
  date: string;
  isToday: boolean;
  planned: number;
  completed: number;
  percent: number;
};

export type MonthResponse = {
  /** YYYY-MM. */
  month: string;
  start: string;
  end: string;
  timezone: string;
  today: string;
  weekStartsOn: number;
  days: MonthDay[];
  total: Progress;
  /** Days that had at least one task planned. */
  activeDays: number;
};

// ------------------------------------------------------------ reminders ----

export type ReminderChannel = "EMAIL" | "IN_APP";
export type ReminderStatus = "PENDING" | "SENT" | "FAILED" | "CANCELLED";
export type ReminderScope = "UPCOMING" | "PAST" | "ALL";

export type ReminderResponse = {
  id: string;
  message: string | null;
  /** The stored instant. */
  remindAt: string;
  /** The same moment in the account's timezone — what the screen shows. */
  remindAtLocal: string;
  timezone: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  subject: { type: "TASK" | "ROUTINE" | "GOAL"; id: string; title: string } | null;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
};

/** What the reminder form sends. `remindAt` is local wall-clock, no zone. */
export type ReminderDraft = {
  remindAt: string;
  message?: string | null;
  channel?: ReminderChannel;
  taskId?: string | null;
  routineId?: string | null;
  goalId?: string | null;
};

export type NotificationResponse = {
  id: string;
  reminderId: string;
  channel: string;
  outcome: "SENT" | "FAILED";
  detail: string | null;
  processedAt: string;
};

// ------------------------------------------------------------ analytics ----

export type SummarySlice = {
  label: string;
  planned: number;
  completed: number;
  percent: number;
};

export type SummaryResponse = {
  start: string;
  end: string;
  timezone: string;
  dayCount: number;
  total: Progress;
  days: DayProgress[];
  categories: SummarySlice[];
  /** Seven rows, Monday first. */
  weekdays: SummarySlice[];
  routines: {
    routineId: string;
    name: string;
    active: boolean;
    expected: number;
    completed: number;
    percent: number;
  }[];
  missedTaskCount: number;
  currentStreak: number;
  longestStreak: number;
  goals: { goalId: string; title: string; progress: number; progressSource: string }[];
};
