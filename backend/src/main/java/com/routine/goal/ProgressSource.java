package com.routine.goal;

/**
 * Where a goal's percentage came from. Sent with every goal so the UI can say
 * so plainly: a number the user typed and a number the product worked out are
 * different claims, and showing them identically makes both less trustworthy.
 */
public enum ProgressSource {
    /** Averaged over the goal's milestones. */
    MILESTONES,
    /** Typed by the user, because the goal has no milestones to average. */
    MANUAL
}
