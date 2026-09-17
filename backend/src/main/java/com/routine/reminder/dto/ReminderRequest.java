package com.routine.reminder.dto;

import com.routine.reminder.ReminderChannel;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * @param remindAt the user's own wall clock, not an instant. People set
 *                 reminders in the time they live in; the server resolves it
 *                 against their timezone once, at write time, so a later
 *                 timezone change cannot move an already-scheduled reminder.
 * @param taskId   at most one of task / routine / goal — a reminder is about
 *                 one thing, and the UI needs to know which thing to link to
 */
public record ReminderRequest(
        @NotNull LocalDateTime remindAt,
        @Size(max = 300) String message,
        ReminderChannel channel,
        UUID taskId,
        UUID routineId,
        UUID goalId) {
}
