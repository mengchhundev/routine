package com.routine.routine;

import com.routine.task.Task;
import com.routine.task.TaskPriority;
import com.routine.task.TaskRepository;
import com.routine.user.UserContext;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns routines into the day's tasks.
 *
 * <p><b>When this runs.</b> On read, from the two screens that show a day —
 * not from a nightly cron. A scheduled sweep has to decide what "today" means
 * for every user at once, which is a different day per timezone and wrong for
 * somebody at every hour; asking as the day is opened asks in the reader's own
 * timezone by construction. The unique index on
 * {@code (routine_task_id, due_date)} is what makes repeating the question
 * cheap and safe.
 *
 * <p><b>Never backwards.</b> Generation is refused for days already past.
 * Browsing back through last month would otherwise create tasks nobody could
 * have done and quietly rewrite that month's completion rate — history is a
 * record, not something a page view may edit.
 */
@Service
public class RoutineGenerator {

    private final RoutineRepository routines;
    private final RoutineScheduleRepository schedules;
    private final RoutineTaskRepository steps;
    private final TaskRepository tasks;
    private final UserContext userContext;

    public RoutineGenerator(RoutineRepository routines,
                            RoutineScheduleRepository schedules,
                            RoutineTaskRepository steps,
                            TaskRepository tasks,
                            UserContext userContext) {
        this.routines = routines;
        this.schedules = schedules;
        this.steps = steps;
        this.tasks = tasks;
        this.userContext = userContext;
    }

    /**
     * Makes sure every active routine that falls on {@code date} has its tasks.
     * Safe to call on every request: already-generated days do nothing.
     *
     * @param date the day to materialise, or null for the user's today — the
     *             Today screen asks without a date, and treating that as "no
     *             day" would leave the product's main view generating nothing
     * @return how many tasks were created, for tests and logging
     */
    @Transactional
    public int ensure(UUID userId, LocalDate date) {
        LocalDate target = date == null ? userContext.today(userId) : date;
        return ensureRange(userId, target, target);
    }

    /**
     * The same guarantee across a span of days, for the week and month planners.
     *
     * <p>Written as a range rather than a loop over {@link #ensure} so that a
     * month view costs one pass over the routines and their steps instead of
     * thirty-one. Days before today are skipped exactly as they are for a
     * single day — see the class note on why generation never runs backwards.
     */
    @Transactional
    public int ensureRange(UUID userId, LocalDate from, LocalDate to) {
        LocalDate today = userContext.today(userId);
        LocalDate start = from.isBefore(today) ? today : from;

        if (to.isBefore(start)) {
            return 0;
        }

        List<Routine> active = routines.findByUserIdAndActiveTrueOrderByStartTimeAscNameAsc(userId);
        if (active.isEmpty()) {
            return 0;
        }

        List<UUID> ids = active.stream().map(Routine::getId).toList();
        Map<UUID, List<RoutineSchedule>> scheduleById = schedules.findByRoutineIdIn(ids).stream()
                .collect(Collectors.groupingBy(RoutineSchedule::getRoutineId));
        Map<UUID, List<RoutineTask>> stepsById = steps.findByRoutineIdInOrderByOrderIndexAsc(ids).stream()
                .collect(Collectors.groupingBy(RoutineTask::getRoutineId));

        List<Task> created = new ArrayList<>();

        for (LocalDate target = start; !target.isAfter(to); target = target.plusDays(1)) {
            for (Routine routine : active) {
                LocalDate day = target;
                boolean occurs = scheduleById.getOrDefault(routine.getId(), List.of()).stream()
                        .anyMatch(schedule -> schedule.occursOn(day));
                if (!occurs) {
                    continue;
                }

                List<RoutineTask> routineSteps = stepsById.getOrDefault(routine.getId(), List.of());
                for (RoutineTask step : routineSteps) {
                    if (tasks.existsByRoutineTaskIdAndDueDate(step.getId(), day)) {
                        continue;
                    }
                    created.add(taskFrom(userId, routine, step, routineSteps, day));
                }
            }
        }

        if (created.isEmpty()) {
            return 0;
        }

        tasks.saveAll(created);
        return created.size();
    }

    private Task taskFrom(UUID userId, Routine routine, RoutineTask step,
                          List<RoutineTask> siblings, LocalDate date) {
        Task task = new Task();
        task.setUserId(userId);
        task.setTitle(step.getTitle());
        task.setDescription(step.getDescription());
        task.setCategory(routine.getCategory());
        task.setPriority(TaskPriority.MEDIUM);
        task.setDueDate(date);
        task.setDueTime(timeFor(routine, step, siblings));
        task.setRoutineId(routine.getId());
        // The link back to the template: what makes this idempotent, and what
        // lets the UI explain why the task reappears tomorrow.
        task.setRoutineTaskId(step.getId());
        // A routine serving a goal passes that on, so the work counts towards it.
        task.setGoalId(routine.getGoalId());
        return task;
    }

    /**
     * Steps run in order from the routine's start time, each after the ones
     * before it. A routine with no start time generates untimed tasks rather
     * than inventing a clock the user never set.
     */
    private LocalTime timeFor(Routine routine, RoutineTask step, List<RoutineTask> siblings) {
        if (routine.getStartTime() == null) {
            return null;
        }

        // The sibling list is passed in rather than re-read: a month's worth of
        // generation would otherwise re-query the same steps once per day.
        int offset = siblings.stream()
                .filter(other -> other.getOrderIndex() < step.getOrderIndex())
                .mapToInt(other -> other.getDurationMinutes() == null ? 0 : other.getDurationMinutes())
                .sum();

        return routine.getStartTime().plusMinutes(offset);
    }
}
