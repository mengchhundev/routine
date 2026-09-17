package com.routine.goal;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Milestones are not user-owned rows in their own right — ownership comes from
 * the goal. Every finder here is scoped by {@code goalId}, and callers must
 * load the goal by {@code (id, userId)} first, so a guessed milestone id cannot
 * reach another account's data.
 */
public interface GoalMilestoneRepository extends JpaRepository<GoalMilestone, UUID> {

    /** Every milestone of a goal, both levels — the detail screen reads this once. */
    List<GoalMilestone> findByGoalIdOrderByOrderIndexAsc(UUID goalId);

    List<GoalMilestone> findByGoalIdInOrderByOrderIndexAsc(Collection<UUID> goalIds);

    Optional<GoalMilestone> findByIdAndGoalId(UUID id, UUID goalId);

    long deleteByIdAndGoalId(UUID id, UUID goalId);

    List<GoalMilestone> findByParentIdOrderByOrderIndexAsc(UUID parentId);

    long countByParentId(UUID parentId);
}
