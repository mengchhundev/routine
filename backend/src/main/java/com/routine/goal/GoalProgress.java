package com.routine.goal;

import java.util.List;

/**
 * The one rule for turning a list of milestones into a percentage. It is used
 * twice, at the two levels that have one: a goal from its top-level milestones,
 * and a milestone from its sub-milestones.
 *
 * <p>Milestones are weighted equally. Anything finer — hours, effort, guessed
 * weights — asks the user to estimate the size of work they have not started,
 * which they cannot do, and would make the number feel arbitrary the first time
 * it moved the wrong way.
 *
 * <p>A skipped milestone leaves the count entirely rather than counting as
 * zero: deciding you do not need a step is progress in the plan, not a failure
 * to be punished for.
 */
final class GoalProgress {

    private GoalProgress() {
    }

    static short of(List<GoalMilestone> milestones) {
        List<GoalMilestone> counted = milestones.stream()
                .filter(milestone -> milestone.getStatus() != MilestoneStatus.SKIPPED)
                .toList();

        if (counted.isEmpty()) {
            return 0;
        }

        int total = counted.stream().mapToInt(GoalProgress::weightOf).sum();
        return (short) Math.round((float) total / counted.size());
    }

    /**
     * A goal's percentage, averaged over its top-level milestones only.
     *
     * <p>Sub-milestones reach the number through their parent, which already
     * derives its own figure from them. Counting every milestone flat instead
     * would silently weight a step by how finely it happens to be broken down —
     * splitting one milestone into five would move the goal's number without
     * anything having been done.
     */
    static short ofGoal(List<GoalMilestone> all) {
        List<GoalMilestone> top = all.stream()
                .filter(milestone -> milestone.getParentId() == null)
                .toList();

        if (top.isEmpty()) {
            return 0;
        }

        List<GoalMilestone> counted = top.stream()
                .filter(milestone -> milestone.getStatus() != MilestoneStatus.SKIPPED)
                .toList();

        if (counted.isEmpty()) {
            return 0;
        }

        int total = counted.stream()
                .mapToInt(milestone -> effectiveWeight(milestone, childrenOf(all, milestone.getId())))
                .sum();
        return (short) Math.round((float) total / counted.size());
    }

    private static List<GoalMilestone> childrenOf(List<GoalMilestone> all, java.util.UUID parentId) {
        return all.stream()
                .filter(milestone -> parentId.equals(milestone.getParentId()))
                .toList();
    }

    /**
     * A milestone with sub-milestones contributes what they add up to, unless it
     * has been ticked off outright — completing the parent is a deliberate "this
     * is done, whatever is still listed underneath".
     */
    private static int effectiveWeight(GoalMilestone milestone, List<GoalMilestone> children) {
        if (milestone.getStatus() == MilestoneStatus.COMPLETED) {
            return 100;
        }
        return children.isEmpty() ? milestone.getProgress() : of(children);
    }

    /** A completed milestone is 100 whatever its stored percentage says. */
    private static int weightOf(GoalMilestone milestone) {
        return milestone.getStatus() == MilestoneStatus.COMPLETED ? 100 : milestone.getProgress();
    }
}
