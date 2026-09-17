package com.routine.goal;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * @param progress       the number to show: derived from the sub-milestones when
 *                       this milestone has any, otherwise its own
 * @param progressSource which of those two it is, so the screen can say so
 * @param ownProgress    what was set by hand, kept for the same reason a goal
 *                       keeps its manual figure — adding a sub-milestone must
 *                       not silently discard it
 * @param children       the sub-milestones, in order. Always empty for a
 *                       sub-milestone, since nesting stops at one level, and
 *                       never null, so a client can render it without a guard.
 */
public record MilestoneResponse(
        UUID id,
        UUID goalId,
        UUID parentId,
        String title,
        String description,
        LocalDate startDate,
        LocalDate targetDate,
        int orderIndex,
        MilestoneStatus status,
        short progress,
        ProgressSource progressSource,
        short ownProgress,
        int childCount,
        int completedChildren,
        List<MilestoneResponse> children) {

    /** A milestone on its own — used for sub-milestones, which have no children. */
    public static MilestoneResponse from(GoalMilestone milestone) {
        return from(milestone, List.of());
    }

    public static MilestoneResponse from(GoalMilestone milestone, List<GoalMilestone> children) {
        boolean derived = !children.isEmpty();

        return new MilestoneResponse(
                milestone.getId(),
                milestone.getGoalId(),
                milestone.getParentId(),
                milestone.getTitle(),
                milestone.getDescription(),
                milestone.getStartDate(),
                milestone.getTargetDate(),
                milestone.getOrderIndex(),
                milestone.getStatus(),
                derived ? GoalProgress.of(children) : milestone.getProgress(),
                derived ? ProgressSource.MILESTONES : ProgressSource.MANUAL,
                milestone.getProgress(),
                children.size(),
                (int) children.stream()
                        .filter(child -> child.getStatus() == MilestoneStatus.COMPLETED)
                        .count(),
                children.stream().map(MilestoneResponse::from).toList());
    }
}
