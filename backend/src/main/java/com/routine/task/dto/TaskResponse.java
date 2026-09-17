package com.routine.task.dto;

import com.routine.task.Task;
import com.routine.task.TaskPriority;
import com.routine.task.TaskStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record TaskResponse(
        UUID id,
        String title,
        String description,
        String category,
        TaskPriority priority,
        TaskStatus status,
        LocalDate dueDate,
        LocalTime dueTime,
        UUID goalId,
        UUID routineId,
        boolean generated) {

    public static TaskResponse from(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getCategory(),
                task.getPriority(),
                task.getStatus(),
                task.getDueDate(),
                task.getDueTime(),
                task.getGoalId(),
                task.getRoutineId(),
                // Generated tasks came from a routine step, so the UI can mark
                // them and explain why they reappear tomorrow.
                task.getRoutineTaskId() != null);
    }
}
