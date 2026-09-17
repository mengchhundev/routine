package com.routine.common;

/**
 * Completed against planned for one day, and the single definition of that
 * ratio in the product. The dashboard and the planner both read it from here,
 * so a screen can never disagree with the screen it links to.
 *
 * @param percent 0 when nothing was planned, because "no tasks" is not
 *                "0% done" — callers show an empty state instead of a zeroed bar
 */
public record Progress(int planned, int completed, int percent) {

    public static final Progress EMPTY = new Progress(0, 0, 0);

    public static Progress of(long planned, long completed) {
        int total = (int) planned;
        int done = (int) completed;
        return new Progress(total, done, total == 0 ? 0 : Math.round(100f * done / total));
    }
}
