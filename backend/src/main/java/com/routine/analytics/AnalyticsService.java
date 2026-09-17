package com.routine.analytics;

import com.routine.analytics.DashboardResponse.Day;
import com.routine.analytics.DashboardResponse.Week;
import com.routine.common.Progress;
import com.routine.goal.GoalResponse;
import com.routine.goal.GoalService;
import com.routine.goal.GoalStatus;
import com.routine.task.Task;
import com.routine.task.TaskCompletionRepository;
import com.routine.task.TaskRepository;
import com.routine.task.TaskService;
import com.routine.task.TaskStatus;
import com.routine.routine.Routine;
import com.routine.routine.RoutineRepository;
import com.routine.task.dto.TaskResponse;
import com.routine.user.UserContext;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Derives every dashboard metric from tasks, completions and goals. Nothing here
 * is stored: a second copy of these numbers could disagree with the task list
 * the user is looking at, and a dashboard that contradicts the page below it
 * destroys trust in both.
 */
@Service
public class AnalyticsService {

    /** A rolling week: today plus the six days before it. */
    private static final int WEEK_DAYS = 7;

    /** How far back the streak walk will look before giving up. */
    private static final int MAX_STREAK_LOOKBACK = 366;

    /** The analytics window, clamped so one hand-edited URL cannot scan a decade. */
    private static final int MIN_WINDOW_DAYS = 7;
    private static final int MAX_WINDOW_DAYS = 365;
    private static final int DEFAULT_WINDOW_DAYS = 30;

    private final TaskRepository tasks;
    private final TaskService taskService;
    private final TaskCompletionRepository completions;
    private final GoalService goals;
    private final RoutineRepository routines;
    private final UserContext userContext;

    public AnalyticsService(TaskRepository tasks,
                            TaskService taskService,
                            TaskCompletionRepository completions,
                            GoalService goals,
                            RoutineRepository routines,
                            UserContext userContext) {
        this.tasks = tasks;
        this.taskService = taskService;
        this.completions = completions;
        this.goals = goals;
        this.routines = routines;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(UUID userId) {
        LocalDate today = userContext.today(userId);
        LocalDate weekStart = today.minusDays(WEEK_DAYS - 1L);

        List<Task> weekTasks = tasks.findByUserIdAndDueDateBetweenOrderByDueDateAscDueTimeAsc(
                userId, weekStart, today);

        // One definition of "completed ÷ planned", shared with the planner.
        Map<LocalDate, Progress> progressByDay = taskService.progressBetween(userId, weekStart, today);

        List<Day> days = new ArrayList<>(WEEK_DAYS);
        int weekPlanned = 0;
        int weekCompleted = 0;

        for (int offset = 0; offset < WEEK_DAYS; offset++) {
            LocalDate date = weekStart.plusDays(offset);
            Progress progress = progressByDay.getOrDefault(date, Progress.EMPTY);

            weekPlanned += progress.planned();
            weekCompleted += progress.completed();
            days.add(new Day(date, progress.planned(), progress.completed(), progress.percent()));
        }

        List<TaskResponse> todayTasks = weekTasks.stream()
                .filter(task -> today.equals(task.getDueDate()))
                .map(TaskResponse::from)
                .toList();

        List<GoalResponse> activeGoals = goals.list(userId, GoalStatus.ACTIVE);

        long openTasks = tasks.findByUserIdAndStatusOrderByDueDateAsc(userId, TaskStatus.TODO).size();

        return new DashboardResponse(
                today,
                userContext.zoneOf(userId).getId(),
                progressByDay.getOrDefault(today, Progress.EMPTY),
                streak(userId, today),
                new Week(days, weekPlanned, weekCompleted,
                        weekPlanned == 0 ? 0 : Math.round(100f * weekCompleted / weekPlanned)),
                todayTasks,
                activeGoals,
                (int) openTasks);
    }


    /**
     * The Analytics screen, over a window of days ending today.
     *
     * <p>Everything is derived from the same tasks and completions the rest of
     * the product reads, for the same reason the dashboard is: a stored copy of
     * these numbers could disagree with the task list underneath them.
     */
    @Transactional(readOnly = true)
    public SummaryResponse summary(UUID userId, Integer requestedDays) {
        int window = requestedDays == null
                ? DEFAULT_WINDOW_DAYS
                : Math.clamp(requestedDays, MIN_WINDOW_DAYS, MAX_WINDOW_DAYS);

        LocalDate today = userContext.today(userId);
        LocalDate start = today.minusDays(window - 1L);

        List<Task> windowTasks =
                tasks.findByUserIdAndDueDateBetweenOrderByDueDateAscDueTimeAsc(userId, start, today);
        Map<LocalDate, Progress> progressByDay = taskService.progressBetween(userId, start, today);

        List<SummaryResponse.DayPoint> points = new ArrayList<>(window);
        int planned = 0;
        int completed = 0;

        for (LocalDate date = start; !date.isAfter(today); date = date.plusDays(1)) {
            Progress progress = progressByDay.getOrDefault(date, Progress.EMPTY);
            planned += progress.planned();
            completed += progress.completed();
            points.add(new SummaryResponse.DayPoint(
                    date, progress.planned(), progress.completed(), progress.percent()));
        }

        return new SummaryResponse(
                start,
                today,
                userContext.zoneOf(userId).getId(),
                window,
                Progress.of(planned, completed),
                points,
                categories(windowTasks),
                weekdays(points),
                routineConsistency(userId, windowTasks),
                missedCount(windowTasks, today),
                streak(userId, today),
                longestStreak(userId, start, today),
                goalPoints(userId));
    }

    /**
     * Where the effort went. Grouped on the task's own category, with untagged
     * work gathered under one honest label rather than dropped — a chart that
     * silently omits half the tasks is worse than no chart.
     */
    private List<SummaryResponse.Slice> categories(List<Task> windowTasks) {
        Map<String, int[]> byCategory = new LinkedHashMap<>();

        for (Task task : windowTasks) {
            if (task.getStatus() == TaskStatus.CANCELLED) {
                continue;
            }
            String label = task.getCategory() == null || task.getCategory().isBlank()
                    ? "Uncategorised"
                    : task.getCategory();
            int[] counts = byCategory.computeIfAbsent(label, key -> new int[2]);
            counts[0]++;
            if (task.getStatus() == TaskStatus.COMPLETED) {
                counts[1]++;
            }
        }

        return byCategory.entrySet().stream()
                .map(entry -> slice(entry.getKey(), entry.getValue()[0], entry.getValue()[1]))
                // Most-planned first: the biggest slice of the week is the one
                // worth looking at, whatever its completion rate.
                .sorted((first, second) -> Integer.compare(second.planned(), first.planned()))
                .toList();
    }

    /** Which days of the week actually work out, Monday first. */
    private List<SummaryResponse.Slice> weekdays(List<SummaryResponse.DayPoint> points) {
        Map<DayOfWeek, int[]> byDay = new LinkedHashMap<>();
        for (DayOfWeek day : DayOfWeek.values()) {
            byDay.put(day, new int[2]);
        }

        for (SummaryResponse.DayPoint point : points) {
            int[] counts = byDay.get(point.date().getDayOfWeek());
            counts[0] += point.planned();
            counts[1] += point.completed();
        }

        return byDay.entrySet().stream()
                .map(entry -> slice(
                        entry.getKey().getDisplayName(TextStyle.FULL, Locale.ENGLISH),
                        entry.getValue()[0],
                        entry.getValue()[1]))
                .toList();
    }

    /**
     * Consistency per routine: of the tasks a routine put on the calendar in
     * this window, how many were done. This is the number that says whether a
     * routine is working or is just a promise on a page.
     */
    private List<SummaryResponse.RoutineConsistency> routineConsistency(UUID userId, List<Task> windowTasks) {
        Map<UUID, int[]> byRoutine = new LinkedHashMap<>();

        for (Task task : windowTasks) {
            if (task.getRoutineId() == null || task.getStatus() == TaskStatus.CANCELLED) {
                continue;
            }
            int[] counts = byRoutine.computeIfAbsent(task.getRoutineId(), key -> new int[2]);
            counts[0]++;
            if (task.getStatus() == TaskStatus.COMPLETED) {
                counts[1]++;
            }
        }

        if (byRoutine.isEmpty()) {
            return List.of();
        }

        Map<UUID, Routine> named = routines.findByUserIdOrderByStartTimeAscNameAsc(userId).stream()
                .collect(Collectors.toMap(Routine::getId, routine -> routine));

        return byRoutine.entrySet().stream()
                .map(entry -> {
                    Routine routine = named.get(entry.getKey());
                    int expected = entry.getValue()[0];
                    int done = entry.getValue()[1];
                    return new SummaryResponse.RoutineConsistency(
                            entry.getKey(),
                            // A deleted routine keeps its generated tasks, so it
                            // can still appear here; say so rather than blank.
                            routine == null ? "Deleted routine" : routine.getName(),
                            routine != null && routine.isActive(),
                            expected,
                            done,
                            expected == 0 ? 0 : Math.round(100f * done / expected));
                })
                .sorted((first, second) -> Integer.compare(second.expected(), first.expected()))
                .toList();
    }

    /** Work the window planned that never happened — the honest other half. */
    private int missedCount(List<Task> windowTasks, LocalDate today) {
        return (int) windowTasks.stream()
                .filter(task -> task.getDueDate().isBefore(today))
                .filter(task -> task.getStatus() == TaskStatus.TODO
                        || task.getStatus() == TaskStatus.IN_PROGRESS
                        || task.getStatus() == TaskStatus.SKIPPED)
                .count();
    }

    /** The best run of consecutive completed days inside the window. */
    private int longestStreak(UUID userId, LocalDate start, LocalDate end) {
        Set<LocalDate> completedDays = new HashSet<>(completions.findCompletionDaysBefore(
                userId, end, PageRequest.of(0, MAX_STREAK_LOOKBACK)));

        int best = 0;
        int run = 0;
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            run = completedDays.contains(date) ? run + 1 : 0;
            best = Math.max(best, run);
        }
        return best;
    }

    private List<SummaryResponse.GoalPoint> goalPoints(UUID userId) {
        return goals.list(userId, GoalStatus.ACTIVE).stream()
                .map(goal -> new SummaryResponse.GoalPoint(
                        goal.id(), goal.title(), goal.progress(), goal.progressSource().name()))
                .toList();
    }

    private SummaryResponse.Slice slice(String label, int planned, int completed) {
        return new SummaryResponse.Slice(
                label, planned, completed,
                planned == 0 ? 0 : Math.round(100f * completed / planned));
    }

    /**
     * Consecutive days with at least one completion, counting back from today.
     *
     * <p>A day with nothing done yet does not break the streak until it is over,
     * so an untouched morning still shows yesterday's run rather than resetting
     * to zero — the alternative punishes the user for opening the app early.
     */
    private int streak(UUID userId, LocalDate today) {
        Set<LocalDate> completedDays = new HashSet<>(completions.findCompletionDaysBefore(
                userId, today, PageRequest.of(0, MAX_STREAK_LOOKBACK)));

        if (completedDays.isEmpty()) {
            return 0;
        }

        LocalDate cursor = completedDays.contains(today) ? today : today.minusDays(1);
        int streak = 0;
        while (completedDays.contains(cursor) && streak < MAX_STREAK_LOOKBACK) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }
}
