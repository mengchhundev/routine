package com.routine.task;

/**
 * Which slice of a user's tasks the Tasks screen is asking for.
 *
 * <p>These are questions people actually ask about their own backlog, not a
 * generic filter language: what is late, what is coming, what has no date yet,
 * what is finished.
 */
public enum TaskScope {
    /** Everything, whatever its date or status. */
    ALL,
    /** Still to do, on a day that has passed. The list that needs a decision. */
    OVERDUE,
    /** Still to do, today or later. */
    UPCOMING,
    /** Still to do, with no day chosen yet. */
    BACKLOG,
    /** Finished, skipped or cancelled. */
    DONE
}
