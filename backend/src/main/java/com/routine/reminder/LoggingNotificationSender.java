package com.routine.reminder;

import com.routine.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The in-app channel, and the development stand-in for email.
 *
 * <p>An IN_APP reminder is "delivered" by being recorded: the client reads it
 * from the reminder list, so there is nothing to transmit. That makes this the
 * honest implementation of the channel rather than a placeholder — and it is
 * why the MVP ships with reminders that work without any mail provider
 * configured. A real {@code EmailNotificationSender} can be added alongside it
 * without touching the dispatcher.
 */
@Component
public class LoggingNotificationSender implements NotificationSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingNotificationSender.class);

    @Override
    public ReminderChannel channel() {
        return ReminderChannel.IN_APP;
    }

    @Override
    public void send(User user, Reminder reminder, String text) {
        log.info("Reminder {} for user {} delivered in-app: {}", reminder.getId(), user.getId(), text);
    }
}
