package com.routine.reminder;

/** Which slice of a user's reminders the screen is asking for. */
public enum ReminderScope {
    /** Pending, still in the future — the list that is going to do something. */
    UPCOMING,
    /** Everything already sent, failed or cancelled. */
    PAST,
    ALL
}
