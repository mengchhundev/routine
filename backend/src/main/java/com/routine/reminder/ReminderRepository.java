package com.routine.reminder;

import com.routine.common.UserOwnedRepository;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;

public interface ReminderRepository extends UserOwnedRepository<Reminder> {

    List<Reminder> findByUserIdAndStatusOrderByReminderTimeAsc(UUID userId, ReminderStatus status);

    List<Reminder> findByUserIdOrderByReminderTimeDesc(UUID userId);

    List<Reminder> findByUserIdAndStatusAndReminderTimeAfterOrderByReminderTimeAsc(
            UUID userId, ReminderStatus status, Instant after);

    List<Reminder> findByUserIdAndStatusInOrderByReminderTimeDesc(
            UUID userId, Collection<ReminderStatus> statuses);

    /**
     * The scheduler's claim query. The pessimistic write lock (with skip-locked
     * semantics configured on the query hint) lets more than one worker poll the
     * same table without two of them sending the same reminder.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    // -2 is Hibernate's SKIP_LOCKED: a worker steps over rows another worker
    // has already claimed rather than queueing behind them.
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("SELECT r FROM Reminder r WHERE r.status = com.routine.reminder.ReminderStatus.PENDING "
            + "AND r.reminderTime <= :now ORDER BY r.reminderTime ASC")
    List<Reminder> claimDue(Instant now, Pageable pageable);
}
