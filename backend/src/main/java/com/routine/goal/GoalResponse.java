package com.routine.goal;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * @param progress       the number to show: derived from milestones when the
 *                       goal has any, otherwise the manual figure
 * @param manualProgress what the user typed, kept visible so switching a goal
 *                       to milestones is not a silent data loss
 */
public record GoalResponse(
        UUID id,
        String title,
        String description,
        String category,
        LocalDate startDate,
        LocalDate targetDate,
        GoalStatus status,
        short progress,
        ProgressSource progressSource,
        short manualProgress,
        int milestoneCount,
        int completedMilestones,
        List<MilestoneResponse> milestones) {

    /**
     * Nests a flat list into the two levels it actually has, in order. Done
     * here, from one query, rather than with a query per parent.
     */
    private static List<MilestoneResponse> tree(List<GoalMilestone> all) {
        Map<UUID, List<GoalMilestone>> childrenByParent = all.stream()
                .filter(step -> step.getParentId() != null)
                .collect(Collectors.groupingBy(GoalMilestone::getParentId));

        return all.stream()
                .filter(step -> step.getParentId() == null)
                .map(step -> MilestoneResponse.from(
                        step, childrenByParent.getOrDefault(step.getId(), List.of())))
                .toList();
    }

    /** A goal on its own — used where milestones have not been loaded. */
    public static GoalResponse from(Goal goal) {
        return build(goal, null);
    }

    public static GoalResponse from(Goal goal, List<GoalMilestone> milestones) {
        return build(goal, milestones == null ? List.of() : milestones);
    }

    private static GoalResponse build(Goal goal, List<GoalMilestone> milestones) {
        List<GoalMilestone> steps = milestones == null ? List.of() : milestones;
        boolean derived = !steps.isEmpty();

        // The counts on a goal card are about its top-level steps: "1 of 3
        // milestones" should not become "1 of 11" because one of them was
        // broken down. The sub-milestones are still there, inside their parent.
        List<GoalMilestone> topLevel = steps.stream()
                .filter(step -> step.getParentId() == null)
                .toList();

        return new GoalResponse(
                goal.getId(),
                goal.getTitle(),
                goal.getDescription(),
                goal.getCategory(),
                goal.getStartDate(),
                goal.getTargetDate(),
                goal.getStatus(),
                derived ? GoalProgress.ofGoal(steps) : goal.getProgress(),
                derived ? ProgressSource.MILESTONES : ProgressSource.MANUAL,
                goal.getProgress(),
                topLevel.size(),
                (int) topLevel.stream()
                        .filter(step -> step.getStatus() == MilestoneStatus.COMPLETED)
                        .count(),
                // null means "not loaded" and is omitted from the JSON, which a
                // client can tell apart from a goal that genuinely has none.
                milestones == null ? null : tree(steps));
    }
}
