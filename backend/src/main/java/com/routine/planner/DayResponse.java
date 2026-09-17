package com.routine.planner;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.routine.common.Progress;
import com.routine.note.dto.DailyReviewResponse;
import com.routine.note.dto.NoteResponse;
import com.routine.task.dto.TaskResponse;
import java.time.LocalDate;
import java.util.List;

/**
 * One day, whole: what was planned, what got done, what was written about it.
 *
 * @param isToday lets the client style and word the page without re-deriving
 *                the user's local date, which it cannot do reliably
 * @param note    the day's note, or null — a day with nothing written is normal
 * @param review  the day's reflection, or null until one is started
 */
// The service trims nulls globally, but here their absence is the point: a
// client must be able to tell "no note yet" from "note field not sent".
@JsonInclude(JsonInclude.Include.ALWAYS)
public record DayResponse(
        LocalDate date,
        String timezone,
        boolean isToday,
        Progress progress,
        List<TaskResponse> tasks,
        NoteResponse note,
        DailyReviewResponse review) {
}
