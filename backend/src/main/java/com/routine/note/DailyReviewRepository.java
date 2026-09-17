package com.routine.note;

import com.routine.common.UserOwnedRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DailyReviewRepository extends UserOwnedRepository<DailyReview> {

    Optional<DailyReview> findByUserIdAndReviewDate(UUID userId, LocalDate reviewDate);

    List<DailyReview> findByUserIdAndReviewDateBetweenOrderByReviewDateDesc(
            UUID userId, LocalDate from, LocalDate to);
}
