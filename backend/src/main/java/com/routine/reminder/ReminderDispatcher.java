package com.routine.reminder;

import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Polls for reminders whose time has come and hands each to
 * {@link ReminderDelivery}.
 *
 * <p><b>Why a poll.</b> A timer per reminder does not survive a restart, and a
 * queue is a second piece of infrastructure to run before the product has
 * users. A minute of granularity is well inside what anyone notices about a
 * reminder, and the claim is one indexed read against
 * {@code ix_reminders_due}.
 */
@Component
public class ReminderDispatcher {

    private static final Logger log = LoggerFactory.getLogger(ReminderDispatcher.class);

    private final ReminderDelivery delivery;
    private final ReminderProperties properties;

    public ReminderDispatcher(ReminderDelivery delivery, ReminderProperties properties) {
        this.delivery = delivery;
        this.properties = properties;
    }

    @Scheduled(
            fixedDelayString = "${routine.reminders.poll-interval:PT1M}",
            initialDelayString = "${routine.reminders.initial-delay:PT30S}")
    public void poll() {
        if (!properties.enabled()) {
            return;
        }
        try {
            int delivered = dispatchDue();
            if (delivered > 0) {
                log.info("Dispatched {} reminder(s)", delivered);
            }
        } catch (Exception ex) {
            // An exception escaping a scheduled method can unschedule it on some
            // executors. Swallowing it here keeps the next tick coming.
            log.error("Reminder poll failed", ex);
        }
    }

    /** Run directly by the tests, which will not wait a minute for a tick. */
    public int dispatchDue() {
        List<UUID> due = delivery.claimDue();
        int delivered = 0;

        for (UUID id : due) {
            try {
                if (delivery.deliver(id)) {
                    delivered++;
                }
            } catch (DataIntegrityViolationException alreadySent) {
                // Another worker got there first; its send counts, not ours.
                log.debug("Reminder {} was already delivered elsewhere", id);
            }
        }
        return delivered;
    }
}
