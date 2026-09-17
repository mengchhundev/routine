package com.routine.task;

import com.routine.common.NotFoundException;
import com.routine.common.Progress;
import com.routine.goal.GoalRepository;
import com.routine.task.dto.TaskRequest;
import com.routine.task.dto.TaskResponse;
import com.routine.user.UserContext;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskService {

    private final TaskRepository tasks;
    private final TaskCompletionRepository completions;
    private final GoalRepository goals;
    private final UserContext userContext;

    public TaskService(TaskRepository tasks,
                       TaskCompletionRepository completions,
                       GoalRepository goals,
                       UserContext userContext) {
        this.tasks = tasks;
        this.completions = completions;
        this.goals = goals;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> onDate(UUID userId, LocalDate date) {
        return tasks.findByUserIdAndDueDateOrderByDueTimeAscCreatedAtAsc(userId, date)
                .stream().map(TaskResponse::from).toList();
    }

    /** Statuses that still want something from the user. */
    private static final List<TaskStatus> OPEN = List.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS);
    private static final List<TaskStatus> CLOSED =
            List.of(TaskStatus.COMPLETED, TaskStatus.SKIPPED, TaskStatus.CANCELLED);

    /**
     * The Tasks screen: every task, sliced by the question being asked.
     *
     * <p>The scope decides the dates and which statuses count as finished; the
     * other filters narrow within it. `OVERDUE` is relative to the user's own
     * today, never the server's.
     */
    @Transactional(readOnly = true)
    public List<TaskResponse> search(UUID userId,
                                     TaskScope scope,
                                     TaskStatus status,
                                     TaskPriority priority,
                                     String query) {
        TaskScope resolved = scope == null ? TaskScope.ALL : scope;
        LocalDate today = userContext.today(userId);

        // An explicit status always wins over the scope's own idea of open or
        // closed — "overdue and skipped" is a question someone may reasonably
        // ask, and the two filters should not fight.
        // "No filter" is a value that matches everything rather than a null —
        // see TaskRepository#search for why the query cannot take nulls.
        List<TaskStatus> statuses = status != null ? List.of(status) : switch (resolved) {
            case OVERDUE, UPCOMING, BACKLOG -> OPEN;
            case DONE -> CLOSED;
            case ALL -> List.of(TaskStatus.values());
        };

        List<TaskPriority> priorities =
                priority != null ? List.of(priority) : List.of(TaskPriority.values());

        String search = query == null || query.isBlank()
                ? "%"
                : "%" + query.trim().toLowerCase() + "%";

        return tasks.search(userId, statuses, priorities, search, resolved.name(), today)
                .stream().map(TaskResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> inRange(UUID userId, LocalDate from, LocalDate to) {
        return tasks.findByUserIdAndDueDateBetweenOrderByDueDateAscDueTimeAsc(userId, from, to)
                .stream().map(TaskResponse::from).toList();
    }

    /**
     * Per-day completion for a date range, in one pass.
     *
     * <p>A completion counts towards the day its task was <em>due</em>, not the
     * day the box happened to be ticked: "how much of Tuesday's plan did I do"
     * is a question about Tuesday. Counting by tick-date lets a catch-up session
     * push a day past 100%, which is not a rate at all.
     */
    @Transactional(readOnly = true)
    public Map<LocalDate, Progress> progressBetween(UUID userId, LocalDate from, LocalDate to) {
        List<Task> range = tasks.findByUserIdAndDueDateBetweenOrderByDueDateAscDueTimeAsc(userId, from, to);

        Map<LocalDate, Long> plannedByDay = range.stream()
                .filter(task -> task.getStatus() != TaskStatus.CANCELLED)
                .collect(Collectors.groupingBy(Task::getDueDate, Collectors.counting()));

        Map<UUID, LocalDate> dueDateByTask = range.stream()
                .collect(Collectors.toMap(Task::getId, Task::getDueDate));

        Map<LocalDate, Long> completedByDay = completions.findByTaskIdIn(dueDateByTask.keySet())
                .stream()
                .collect(Collectors.groupingBy(
                        completion -> dueDateByTask.get(completion.getTaskId()),
                        Collectors.counting()));

        Map<LocalDate, Progress> byDay = new HashMap<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            byDay.put(date, Progress.of(
                    plannedByDay.getOrDefault(date, 0L),
                    completedByDay.getOrDefault(date, 0L)));
        }
        return byDay;
    }

    @Transactional(readOnly = true)
    public Progress progressOn(UUID userId, LocalDate date) {
        return progressBetween(userId, date, date).getOrDefault(date, Progress.EMPTY);
    }

    /** Moving a task to another day is a first-class action, not an edit. */
    @Transactional
    public TaskResponse reschedule(UUID userId, UUID taskId, LocalDate dueDate) {
        Task task = require(userId, taskId);
        task.setDueDate(dueDate);
        // A rescheduled task is open again; its old completion stays in history.
        if (task.getStatus() == TaskStatus.SKIPPED) {
            task.setStatus(TaskStatus.TODO);
        }
        return TaskResponse.from(task);
    }

    @Transactional(readOnly = true)
    public TaskResponse byId(UUID userId, UUID taskId) {
        return TaskResponse.from(require(userId, taskId));
    }

    @Transactional
    public TaskResponse create(UUID userId, TaskRequest request) {
        Task task = new Task();
        task.setUserId(userId);
        apply(userId, task, request);
        return TaskResponse.from(tasks.save(task));
    }

    @Transactional
    public TaskResponse update(UUID userId, UUID taskId, TaskRequest request) {
        Task task = require(userId, taskId);
        apply(userId, task, request);
        return TaskResponse.from(task);
    }

    @Transactional
    public void delete(UUID userId, UUID taskId) {
        if (tasks.deleteByIdAndUserId(taskId, userId) == 0) {
            throw NotFoundException.of("TASK");
        }
    }

    /**
     * Marks a task done for the user's current local day and records it in the
     * completion history. The history row is what streaks and consistency read,
     * so it must be written even though the task also carries a status.
     */
    @Transactional
    public TaskResponse complete(UUID userId, UUID taskId) {
        Task task = require(userId, taskId);
        LocalDate today = userContext.today(userId);

        task.setStatus(TaskStatus.COMPLETED);

        // The unique index on (task_id, completion_date) makes a double tap a
        // no-op rather than a constraint violation.
        if (completions.findByTaskIdAndCompletionDate(taskId, today).isEmpty()) {
            TaskCompletion completion = new TaskCompletion();
            completion.setTaskId(taskId);
            completion.setUserId(userId);
            completion.setCompletionDate(today);
            completions.save(completion);
        }

        return TaskResponse.from(task);
    }

    @Transactional
    public TaskResponse skip(UUID userId, UUID taskId) {
        Task task = require(userId, taskId);
        task.setStatus(TaskStatus.SKIPPED);
        // Skipping something completed earlier today retracts that completion.
        completions.deleteByTaskIdAndCompletionDate(taskId, userContext.today(userId));
        return TaskResponse.from(task);
    }

    /** Undo: back to open, and today's completion record is withdrawn with it. */
    @Transactional
    public TaskResponse reopen(UUID userId, UUID taskId) {
        Task task = require(userId, taskId);
        task.setStatus(TaskStatus.TODO);
        completions.deleteByTaskIdAndCompletionDate(taskId, userContext.today(userId));
        return TaskResponse.from(task);
    }

    private void apply(UUID userId, Task task, TaskRequest request) {
        task.setTitle(request.title().trim());
        task.setDescription(request.description());
        task.setCategory(request.category());
        task.setPriority(request.priority() == null ? TaskPriority.MEDIUM : request.priority());
        task.setDueDate(request.dueDate());
        task.setDueTime(request.dueTime());
        task.setRoutineId(request.routineId());

        // A task may only be attached to a goal the same user owns; otherwise a
        // guessed id would leak the existence of someone else's goal.
        if (request.goalId() != null && !goals.existsByIdAndUserId(request.goalId(), userId)) {
            throw NotFoundException.of("GOAL");
        }
        task.setGoalId(request.goalId());
    }

    private Task require(UUID userId, UUID taskId) {
        return tasks.findByIdAndUserId(taskId, userId).orElseThrow(() -> NotFoundException.of("TASK"));
    }
}
