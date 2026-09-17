package com.routine.reminder;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param enabled     off in tests, and a kill switch in production if delivery
 *                    has to be stopped without a redeploy
 * @param batchSize   how many reminders one poll claims — small, because the
 *                    poll runs often and a long batch holds its row locks
 * @param maxAttempts after this many failures a reminder is abandoned rather
 *                    than retried forever; the user sees why on the screen
 * @param graceWindow how late a reminder may be and still be worth sending.
 *                    A reminder for this morning's workout, delivered after a
 *                    two-day outage, is worse than silence.
 */
@ConfigurationProperties(prefix = "routine.reminders")
public record ReminderProperties(
        boolean enabled,
        int batchSize,
        int maxAttempts,
        Duration graceWindow) {

    public ReminderProperties {
        if (batchSize <= 0) batchSize = 50;
        if (maxAttempts <= 0) maxAttempts = 3;
        if (graceWindow == null) graceWindow = Duration.ofHours(6);
    }
}
