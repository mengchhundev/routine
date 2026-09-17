package com.routine.routine.dto;

import com.routine.routine.Routine;
import com.routine.routine.RoutineSchedule;
import com.routine.routine.RoutineTask;
import com.routine.routine.ScheduleType;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

public record RoutineResponse(
        UUID id,
        String name,
        String description,
        String category,
        UUID goalId,
        LocalTime startTime,
        LocalTime endTime,
        boolean active,
        ScheduleResponse schedule,
        List<StepResponse> steps) {

    public record ScheduleResponse(
            ScheduleType type,
            List<Short> daysOfWeek,
            LocalDate startDate,
            LocalDate endDate) {

        public static ScheduleResponse from(RoutineSchedule schedule) {
            return new ScheduleResponse(
                    schedule.getScheduleType(),
                    Arrays.asList(schedule.getDaysOfWeek()),
                    schedule.getStartDate(),
                    schedule.getEndDate());
        }
    }

    public record StepResponse(
            UUID id,
            String title,
            String description,
            Integer durationMinutes,
            int orderIndex) {

        public static StepResponse from(RoutineTask step) {
            return new StepResponse(
                    step.getId(),
                    step.getTitle(),
                    step.getDescription(),
                    step.getDurationMinutes(),
                    step.getOrderIndex());
        }
    }

    public static RoutineResponse from(Routine routine, RoutineSchedule schedule, List<RoutineTask> steps) {
        return new RoutineResponse(
                routine.getId(),
                routine.getName(),
                routine.getDescription(),
                routine.getCategory(),
                routine.getGoalId(),
                routine.getStartTime(),
                routine.getEndTime(),
                routine.isActive(),
                schedule == null ? null : ScheduleResponse.from(schedule),
                steps.stream().map(StepResponse::from).toList());
    }
}
