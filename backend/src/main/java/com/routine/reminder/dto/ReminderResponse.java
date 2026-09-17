package com.routine.reminder.dto;

import com.routine.reminder.Reminder;
import com.routine.reminder.ReminderChannel;
import com.routine.reminder.ReminderStatus;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

/**
 * @param remindAt      the stored instant, for clients that want to compute
 * @param remindAtLocal the same moment in the user's timezone, which is what
 *                      the screen shows — the browser's zone may differ from
 *                      the account's, and the account's is the one that fired it
 * @param subject       what the reminder is about, resolved so a list of
 *                      reminders does not need a request per row
 */
public record ReminderResponse(
        UUID id,
        String message,
        Instant remindAt,
        LocalDateTime remindAtLocal,
        String timezone,
        ReminderChannel channel,
        ReminderStatus status,
        Subject subject,
        Instant sentAt,
        short attempts,
        String lastError) {

    public record Subject(String type, UUID id, String title) {}

    public static ReminderResponse from(Reminder reminder, ZoneId zone, Subject subject) {
        return new ReminderResponse(
                reminder.getId(),
                reminder.getMessage(),
                reminder.getReminderTime(),
                LocalDateTime.ofInstant(reminder.getReminderTime(), zone),
                zone.getId(),
                reminder.getChannel(),
                reminder.getStatus(),
                subject,
                reminder.getSentAt(),
                reminder.getAttempts(),
                reminder.getLastError());
    }
}
