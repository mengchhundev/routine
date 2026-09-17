package com.routine.routine;

import com.routine.common.ApiException;
import com.routine.common.NotFoundException;
import com.routine.routine.dto.RoutineRequest;
import com.routine.routine.dto.RoutineResponse;
import com.routine.user.UserContext;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Routines: the templates that put the same work on the right days without
 * anyone retyping it. A routine owns a schedule and an ordered list of steps,
 * and {@link RoutineGenerator} turns those into real tasks a day at a time.
 */
@Service
public class RoutineService {

    private final RoutineRepository routines;
    private final RoutineScheduleRepository schedules;
    private final RoutineTaskRepository steps;
    private final UserContext userContext;

    public RoutineService(RoutineRepository routines,
                          RoutineScheduleRepository schedules,
                          RoutineTaskRepository steps,
                          UserContext userContext) {
        this.routines = routines;
        this.schedules = schedules;
        this.steps = steps;
        this.userContext = userContext;
    }

    @Transactional(readOnly = true)
    public List<RoutineResponse> list(UUID userId, Boolean activeOnly) {
        List<Routine> found = Boolean.TRUE.equals(activeOnly)
                ? routines.findByUserIdAndActiveTrueOrderByStartTimeAscNameAsc(userId)
                : routines.findByUserIdOrderByStartTimeAscNameAsc(userId);
        if (found.isEmpty()) {
            return List.of();
        }

        // Two queries for the whole list rather than two per routine: a page of
        // ten routines should not be twenty-one round trips.
        List<UUID> ids = found.stream().map(Routine::getId).toList();
        Map<UUID, RoutineSchedule> scheduleById = schedules.findByRoutineIdIn(ids).stream()
                .collect(Collectors.toMap(RoutineSchedule::getRoutineId, Function.identity(), (first, second) -> first));
        Map<UUID, List<RoutineTask>> stepsById = steps.findByRoutineIdInOrderByOrderIndexAsc(ids).stream()
                .collect(Collectors.groupingBy(RoutineTask::getRoutineId));

        return found.stream()
                .map(routine -> RoutineResponse.from(
                        routine,
                        scheduleById.get(routine.getId()),
                        stepsById.getOrDefault(routine.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public RoutineResponse byId(UUID userId, UUID routineId) {
        return read(require(userId, routineId));
    }

    @Transactional
    public RoutineResponse create(UUID userId, RoutineRequest request) {
        Routine routine = new Routine();
        routine.setUserId(userId);
        routine.setActive(request.active() == null || request.active());
        applyDetails(routine, request);
        routines.save(routine);

        applySchedule(userId, routine, request.schedule());
        applySteps(routine, request.steps());

        return read(routine);
    }

    @Transactional
    public RoutineResponse update(UUID userId, UUID routineId, RoutineRequest request) {
        Routine routine = require(userId, routineId);
        applyDetails(routine, request);
        if (request.active() != null) {
            routine.setActive(request.active());
        }

        applySchedule(userId, routine, request.schedule());
        applySteps(routine, request.steps());

        return read(routine);
    }

    /**
     * Pausing rather than deleting. An inactive routine stops generating tasks
     * from tomorrow but keeps its history, which is the difference between "I
     * stopped doing this" and "this never happened".
     */
    @Transactional
    public RoutineResponse setActive(UUID userId, UUID routineId, boolean active) {
        Routine routine = require(userId, routineId);
        routine.setActive(active);
        return read(routine);
    }

    @Transactional
    public void delete(UUID userId, UUID routineId) {
        // Schedules and steps cascade in the database. Tasks already generated
        // survive with a null routine_task_id: work that was done stays done.
        if (routines.deleteByIdAndUserId(routineId, userId) == 0) {
            throw NotFoundException.of("ROUTINE");
        }
    }

    private void applyDetails(Routine routine, RoutineRequest request) {
        routine.setName(request.name().trim());
        routine.setDescription(request.description());
        routine.setCategory(request.category());
        routine.setGoalId(request.goalId());
        routine.setStartTime(request.startTime());
        routine.setEndTime(request.endTime());
    }

    private void applySchedule(UUID userId, Routine routine, RoutineRequest.ScheduleRequest request) {
        boolean needsDays = request.type() == ScheduleType.WEEKLY
                || request.type() == ScheduleType.SELECTED_DAYS;
        List<Short> days = request.daysOfWeek() == null ? List.of() : request.daysOfWeek();

        if (needsDays && days.isEmpty()) {
            // Silently generating nothing would look like a bug in the product
            // rather than a gap in the form.
            throw new ApiException(HttpStatus.BAD_REQUEST, "SCHEDULE_DAYS_REQUIRED",
                    "Pick at least one day for this schedule.");
        }

        RoutineSchedule schedule = schedules.findByRoutineId(routine.getId()).stream()
                .findFirst()
                .orElseGet(() -> {
                    RoutineSchedule fresh = new RoutineSchedule();
                    fresh.setRoutineId(routine.getId());
                    return fresh;
                });

        schedule.setScheduleType(request.type());
        schedule.setDaysOfWeek(needsDays ? days.toArray(new Short[0]) : new Short[0]);
        schedule.setStartDate(request.startDate() != null ? request.startDate() : userContext.today(userId));
        schedule.setEndDate(request.endDate());
        schedules.save(schedule);
    }

    /**
     * Reconciles the step list by id rather than replacing it.
     *
     * <p>Deleting and re-inserting would be simpler and quietly destructive:
     * every task already generated from a step points at it, and dropping the
     * row would break that link and let the same task be generated twice.
     */
    private void applySteps(Routine routine, List<RoutineRequest.StepRequest> requested) {
        List<RoutineRequest.StepRequest> wanted = requested == null ? List.of() : requested;

        Map<UUID, RoutineTask> existing = new HashMap<>();
        steps.findByRoutineIdOrderByOrderIndexAsc(routine.getId())
                .forEach(step -> existing.put(step.getId(), step));

        List<RoutineTask> kept = new ArrayList<>();
        for (int index = 0; index < wanted.size(); index++) {
            RoutineRequest.StepRequest request = wanted.get(index);
            RoutineTask step = request.id() == null ? null : existing.remove(request.id());

            if (step == null) {
                step = new RoutineTask();
                step.setRoutineId(routine.getId());
            }

            step.setTitle(request.title().trim());
            step.setDescription(request.description());
            step.setDurationMinutes(request.durationMinutes());
            step.setOrderIndex(index);
            kept.add(step);
        }

        steps.saveAll(kept);
        // Whatever the request no longer mentions is gone on purpose.
        steps.deleteAll(existing.values());
    }

    private RoutineResponse read(Routine routine) {
        return RoutineResponse.from(
                routine,
                schedules.findByRoutineId(routine.getId()).stream().findFirst().orElse(null),
                steps.findByRoutineIdOrderByOrderIndexAsc(routine.getId()));
    }

    private Routine require(UUID userId, UUID routineId) {
        return routines.findByIdAndUserId(routineId, userId)
                .orElseThrow(() -> NotFoundException.of("ROUTINE"));
    }
}
