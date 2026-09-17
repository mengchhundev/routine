package com.routine.task;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TaskCompletionRepository extends JpaRepository<TaskCompletion, UUID> {

    Optional<TaskCompletion> findByTaskIdAndCompletionDate(UUID taskId, LocalDate completionDate);

    List<TaskCompletion> findByUserIdAndCompletionDateBetween(UUID userId, LocalDate from, LocalDate to);

    List<TaskCompletion> findByTaskIdIn(Collection<UUID> taskIds);

    long countByUserIdAndCompletionDate(UUID userId, LocalDate completionDate);

    void deleteByTaskIdAndCompletionDate(UUID taskId, LocalDate completionDate);

    /**
     * Distinct days the user completed something, most recent first. The streak
     * walk needs only the days, not the rows, and only as far back as the first
     * gap — hence the page limit rather than a full scan.
     */
    @Query("SELECT DISTINCT c.completionDate FROM TaskCompletion c "
            + "WHERE c.userId = :userId AND c.completionDate <= :until "
            + "ORDER BY c.completionDate DESC")
    List<LocalDate> findCompletionDaysBefore(UUID userId, LocalDate until, Pageable pageable);
}
