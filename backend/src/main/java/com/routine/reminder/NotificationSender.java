package com.routine.reminder;

import com.routine.user.User;

/**
 * Delivery, kept behind an interface so the dispatcher's retry, logging and
 * duplicate-suppression logic is written and tested once, whatever eventually
 * carries the message. Email first, then web push (plan section 13).
 */
public interface NotificationSender {

    ReminderChannel channel();

    /**
     * Delivers one reminder, or throws. A thrown exception is recorded against
     * the reminder and retried; a return means delivered, and the notification
     * log's partial unique index makes a second delivery impossible.
     */
    void send(User user, Reminder reminder, String text) throws Exception;
}
