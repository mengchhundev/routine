package com.routine.planner;

import com.routine.common.Progress;
import com.routine.note.NoteService;
import com.routine.task.TaskService;
import com.routine.task.dto.TaskResponse;
import com.routine.user.UserContext;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Assembles the planner's three horizons — a day, a week, a month.
 *
 * <p>Each answers in one round trip: the tasks, the progress they add up to and
 * the writing about them belong to the same moment and should not arrive
 * separately. All three read completion through {@code TaskService}, so the day
 * you open from the week always agrees with the week you opened it from.
 */
@Service
public class PlannerService {

    private final TaskService tasks;
    private final NoteService notes;
    private final UserContext userContext;

    public PlannerService(TaskService tasks, NoteService notes, UserContext userContext) {
        this.tasks = tasks;
        this.notes = notes;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public DayResponse day(UUID userId, LocalDate date) {
        LocalDate resolved = date != null ? date : userContext.today(userId);

        return new DayResponse(
                resolved,
                userContext.zoneOf(userId).getId(),
                resolved.equals(userContext.today(userId)),
                tasks.progressOn(userId, resolved),
                tasks.onDate(userId, resolved),
                notes.dayNote(userId, resolved).orElse(null),
                notes.review(userId, resolved).orElse(null));
    }

    /**
     * The week containing {@code anchor}, starting on the user's chosen first
     * day of the week rather than an assumed Monday.
     */
    @Transactional(readOnly = true)
    public WeekResponse week(UUID userId, LocalDate anchor) {
        LocalDate today = userContext.today(userId);
        LocalDate start = userContext.startOfWeek(userId, anchor != null ? anchor : today);
        LocalDate end = start.plusDays(6);

        Map<LocalDate, Progress> progressByDay = tasks.progressBetween(userId, start, end);

        // One query for the week's tasks, grouped here — seven queries would be
        // seven chances for the list and the bar above it to disagree.
        Map<LocalDate, List<TaskResponse>> tasksByDay = tasks.inRange(userId, start, end).stream()
                .collect(Collectors.groupingBy(TaskResponse::dueDate));

        List<WeekResponse.Day> days = new ArrayList<>(7);
        int planned = 0;
        int completed = 0;

        for (int offset = 0; offset < 7; offset++) {
            LocalDate date = start.plusDays(offset);
            Progress progress = progressByDay.getOrDefault(date, Progress.EMPTY);
            planned += progress.planned();
            completed += progress.completed();

            days.add(new WeekResponse.Day(
                    date,
                    date.equals(today),
                    progress,
                    tasksByDay.getOrDefault(date, List.of())));
        }

        return new WeekResponse(
                start,
                end,
                userContext.zoneOf(userId).getId(),
                today,
                userContext.weekStartsOn(userId).getValue(),
                days,
                Progress.of(planned, completed));
    }

    /** A calendar month of completion rates. Counts only — see MonthResponse. */
    @Transactional(readOnly = true)
    public MonthResponse month(UUID userId, YearMonth month) {
        LocalDate today = userContext.today(userId);
        YearMonth resolved = month != null ? month : YearMonth.from(today);

        LocalDate start = resolved.atDay(1);
        LocalDate end = resolved.atEndOfMonth();

        Map<LocalDate, Progress> progressByDay = tasks.progressBetween(userId, start, end);

        List<MonthResponse.Day> days = new ArrayList<>(resolved.lengthOfMonth());
        int planned = 0;
        int completed = 0;
        int activeDays = 0;

        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            Progress progress = progressByDay.getOrDefault(date, Progress.EMPTY);
            planned += progress.planned();
            completed += progress.completed();
            if (progress.planned() > 0) {
                activeDays++;
            }

            days.add(new MonthResponse.Day(
                    date,
                    date.equals(today),
                    progress.planned(),
                    progress.completed(),
                    progress.percent()));
        }

        return new MonthResponse(
                resolved.toString(),
                start,
                end,
                userContext.zoneOf(userId).getId(),
                today,
                userContext.weekStartsOn(userId).getValue(),
                days,
                Progress.of(planned, completed),
                activeDays);
    }
}
