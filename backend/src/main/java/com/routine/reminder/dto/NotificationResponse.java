package com.routine.reminder.dto;

import com.routine.reminder.NotificationLog;
import java.time.Instant;
import java.util.UUID;

/** One delivery attempt, as the Reminders screen's history shows it. */
public record NotificationResponse(
        UUID id,
        UUID reminderId,
        String channel,
        String outcome,
        String detail,
        Instant processedAt) {

    public static NotificationResponse from(NotificationLog log) {
        return new NotificationResponse(
                log.getId(),
                log.getReminderId(),
                log.getChannel(),
                log.getOutcome(),
                log.getDetail(),
                log.getProcessedAt());
    }
}
