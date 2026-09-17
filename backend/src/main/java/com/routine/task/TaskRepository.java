package com.routine.task;

import com.routine.common.UserOwnedRepository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskRepository extends UserOwnedRepository<Task> {

    /**
     * The Tasks screen, which asks about a whole account rather than one day.
     *
     * <p>One query with switchable filters rather than a method per
     * combination: the alternative is either a dozen finders or filtering in
     * memory, and filtering a whole account's history in memory is a bug
     * waiting for its first heavy user.
     *
     * <p><b>No parameter is ever null.</b> "Don't filter on this" is expressed
     * as a value that matches everything — every status, every priority, the
     * {@code %} pattern — because PostgreSQL cannot infer the type of a bind
     * that only ever appears in {@code ? IS NULL}, and rejects the statement
     * outright rather than guessing.
     *
     * <p>Undated tasks sort last. They are a backlog — things to do at some
     * point — and putting them above tomorrow would bury the plan under the
     * wish list.
     */
    @Query("""
            SELECT t FROM Task t
            WHERE t.userId = :userId
              AND t.status IN :statuses
              AND t.priority IN :priorities
              AND LOWER(t.title) LIKE :search
              AND (
                   :mode = 'ALL'
                OR :mode = 'DONE'
                OR (:mode = 'BACKLOG'  AND t.dueDate IS NULL)
                OR (:mode = 'OVERDUE'  AND t.dueDate IS NOT NULL AND t.dueDate <  :today)
                OR (:mode = 'UPCOMING' AND t.dueDate IS NOT NULL AND t.dueDate >= :today)
              )
            ORDER BY t.dueDate ASC NULLS LAST, t.dueTime ASC NULLS LAST, t.createdAt DESC
            """)
    List<Task> search(@Param("userId") UUID userId,
                      @Param("statuses") Collection<TaskStatus> statuses,
                      @Param("priorities") Collection<TaskPriority> priorities,
                      @Param("search") String search,
                      @Param("mode") String mode,
                      @Param("today") LocalDate today);

    List<Task> findByUserIdAndDueDateOrderByDueTimeAscCreatedAtAsc(UUID userId, LocalDate dueDate);

    List<Task> findByUserIdAndDueDateBetweenOrderByDueDateAscDueTimeAsc(
            UUID userId, LocalDate from, LocalDate to);

    List<Task> findByUserIdAndStatusOrderByDueDateAsc(UUID userId, TaskStatus status);

    List<Task> findByUserIdAndGoalIdOrderByDueDateAsc(UUID userId, UUID goalId);

    boolean existsByRoutineTaskIdAndDueDate(UUID routineTaskId, LocalDate dueDate);
}
