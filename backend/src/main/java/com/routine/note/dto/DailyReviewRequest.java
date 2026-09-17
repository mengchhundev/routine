package com.routine.note.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * Every field is optional. A review with one sentence in it is still a review,
 * and a form that refuses to save until all five boxes are full is a form
 * people stop opening.
 */
public record DailyReviewRequest(
        @Size(max = 5000) String summary,
        @Size(max = 5000) String whatWentWell,
        @Size(max = 5000) String whatWentWrong,
        @Size(max = 5000) String whatToImprove,
        @Min(1) @Max(5) Short rating,
        @Min(1) @Max(5) Short mood,
        @Min(1) @Max(5) Short energy) {
}
