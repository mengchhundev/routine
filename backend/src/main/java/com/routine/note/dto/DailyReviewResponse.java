package com.routine.note.dto;

import com.routine.note.DailyReview;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record DailyReviewResponse(
        UUID id,
        LocalDate reviewDate,
        String summary,
        String whatWentWell,
        String whatWentWrong,
        String whatToImprove,
        Short rating,
        Short mood,
        Short energy,
        Instant updatedAt) {

    public static DailyReviewResponse from(DailyReview review) {
        return new DailyReviewResponse(
                review.getId(),
                review.getReviewDate(),
                review.getSummary(),
                review.getWhatWentWell(),
                review.getWhatWentWrong(),
                review.getWhatToImprove(),
                review.getRating(),
                review.getMood(),
                review.getEnergy(),
                review.getUpdatedAt());
    }
}
