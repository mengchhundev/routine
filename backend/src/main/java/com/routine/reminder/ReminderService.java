package com.routine.reminder;

import com.routine.common.ApiException;
import com.routine.common.NotFoundException;
import com.routine.goal.GoalRepository;
import com.routine.reminder.dto.NotificationResponse;
import com.routine.reminder.dto.ReminderRequest;
import com.routine.reminder.dto.ReminderResponse;
import com.routine.routine.RoutineRepository;
import com.routine.task.TaskRepository;
import com.routine.user.UserContext;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reminders the user schedules by hand. The dispatcher
 * ({@link ReminderDispatcher}) is what eventually delivers them; everything
 * here is about writing them down correctly.
 */
@Service
public class ReminderService {

    /** How much recent delivery history the Reminders screen shows. */
    private static final int HISTORY_LIMIT = 50;

    private static final List<ReminderStatus> CLOSED =
            List.of(ReminderStatus.SENT, ReminderStatus.FAILED, ReminderStatus.CANCELLED);

    private final ReminderRepository reminders;
    private final NotificationLogRepository notifications;
    private final TaskRepository tasks;
    private final RoutineRepository routines;
    private final GoalRepository goals;
    private final UserContext userContext;

    public ReminderService(ReminderRepository reminders,
                           NotificationLogRepository notifications,
                           TaskRepository tasks,
                           RoutineRepository routines,
                           GoalRepository goals,
                           UserContext userContext) {
        this.reminders = reminders;
        this.notifications = notifications;
        this.tasks = tasks;
        this.routines = routines;
        this.goals = goals;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public List<ReminderResponse> list(UUID userId, ReminderScope scope) {
        ZoneId zone = userContext.zoneOf(userId);

        List<Reminder> found = switch (scope == null ? ReminderScope.UPCOMING : scope) {
            // "Upcoming" means still going to happen: a pending reminder whose
            // time has passed is the dispatcher's backlog, not the user's plan.
            case UPCOMING -> reminders.findByUserIdAndStatusAndReminderTimeAfterOrderByReminderTimeAsc(
                    userId, ReminderStatus.PENDING, Instant.now());
            case PAST -> reminders.findByUserIdAndStatusInOrderByReminderTimeDesc(userId, CLOSED);
            case ALL -> reminders.findByUserIdOrderByReminderTimeDesc(userId);
        };

        return found.stream().map(reminder -> read(reminder, zone)).toList();
    }

    @Transactional(readOnly = true)
    public ReminderResponse byId(UUID userId, UUID reminderId) {
        return read(require(userId, reminderId), userContext.zoneOf(userId));
    }

    @Transactional
    public ReminderResponse create(UUID userId, ReminderRequest request) {
        Reminder reminder = new Reminder();
        reminder.setUserId(userId);
        apply(userId, reminder, request);
        return read(reminders.save(reminder), userContext.zoneOf(userId));
    }

    @Transactional
    public ReminderResponse update(UUID userId, UUID reminderId, ReminderRequest request) {
        Reminder reminder = require(userId, reminderId);

        if (reminder.getStatus() == ReminderStatus.SENT) {
            throw new ApiException(HttpStatus.CONFLICT, "REMINDER_ALREADY_SENT",
                    "That reminder has already been sent and cannot be changed.");
        }

        apply(userId, reminder, request);
        // Editing a failed reminder is how you retry it: a new time means a new
        // attempt, and leaving it FAILED would keep it out of the claim query.
        reminder.setStatus(ReminderStatus.PENDING);
        reminder.setLastError(null);

        return read(reminder, userContext.zoneOf(userId));
    }

    /**
     * Cancelling rather than deleting, for a reminder that has already fired or
     * is about to: the history of what was sent stays readable.
     */
    @Transactional
    public ReminderResponse cancel(UUID userId, UUID reminderId) {
        Reminder reminder = require(userId, reminderId);
        if (reminder.getStatus() == ReminderStatus.PENDING) {
            reminder.setStatus(ReminderStatus.CANCELLED);
        }
        return read(reminder, userContext.zoneOf(userId));
    }

    @Transactional
    public void delete(UUID userId, UUID reminderId) {
        if (reminders.deleteByIdAndUserId(reminderId, userId) == 0) {
            throw NotFoundException.of("REMINDER");
        }
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> history(UUID userId) {
        return notifications
                .findByUserIdOrderByProcessedAtDesc(userId, PageRequest.of(0, HISTORY_LIMIT))
                .map(NotificationResponse::from)
                .getContent();
    }

    // ------------------------------------------------------------ internals --

    private void apply(UUID userId, Reminder reminder, ReminderRequest request) {
        long subjects = java.util.stream.Stream
                .of(request.taskId(), request.routineId(), request.goalId())
                .filter(java.util.Objects::nonNull)
                .count();
        if (subjects > 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "REMINDER_SUBJECT_AMBIGUOUS",
                    "A reminder can be about one task, routine or goal — not several.");
        }

        // A guessed id must not confirm that somebody else's task exists.
        if (request.taskId() != null && !tasks.existsByIdAndUserId(request.taskId(), userId)) {
            throw NotFoundException.of("TASK");
        }
        if (request.routineId() != null && !routines.existsByIdAndUserId(request.routineId(), userId)) {
            throw NotFoundException.of("ROUTINE");
        }
        if (request.goalId() != null && !goals.existsByIdAndUserId(request.goalId(), userId)) {
            throw NotFoundException.of("GOAL");
        }

        if (request.message() == null && subjects == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "REMINDER_EMPTY",
                    "Write a message, or attach the reminder to a task, routine or goal.");
        }

        reminder.setMessage(request.message());
        reminder.setTaskId(request.taskId());
        reminder.setRoutineId(request.routineId());
        reminder.setGoalId(request.goalId());
        reminder.setChannel(request.channel() == null ? ReminderChannel.EMAIL : request.channel());
        // The local time the user typed, resolved in their zone once and stored
        // as an instant — see Reminder#reminderTime.
        reminder.setReminderTime(request.remindAt().atZone(userContext.zoneOf(userId)).toInstant());
    }

    private ReminderResponse read(Reminder reminder, ZoneId zone) {
        return ReminderResponse.from(reminder, zone, subjectOf(reminder));
    }

    /**
     * Resolves the title of whatever the reminder is about. A subject whose row
     * has since been deleted reads as null rather than failing the whole list.
     */
    private ReminderResponse.Subject subjectOf(Reminder reminder) {
        if (reminder.getTaskId() != null) {
            return tasks.findByIdAndUserId(reminder.getTaskId(), reminder.getUserId())
                    .map(task -> new ReminderResponse.Subject("TASK", task.getId(), task.getTitle()))
                    .orElse(null);
        }
        if (reminder.getRoutineId() != null) {
            return routines.findByIdAndUserId(reminder.getRoutineId(), reminder.getUserId())
                    .map(routine -> new ReminderResponse.Subject("ROUTINE", routine.getId(), routine.getName()))
                    .orElse(null);
        }
        if (reminder.getGoalId() != null) {
            return goals.findByIdAndUserId(reminder.getGoalId(), reminder.getUserId())
                    .map(goal -> new ReminderResponse.Subject("GOAL", goal.getId(), goal.getTitle()))
                    .orElse(null);
        }
        return null;
    }

    private Reminder require(UUID userId, UUID reminderId) {
        return reminders.findByIdAndUserId(reminderId, userId)
                .orElseThrow(() -> NotFoundException.of("REMINDER"));
    }
}
