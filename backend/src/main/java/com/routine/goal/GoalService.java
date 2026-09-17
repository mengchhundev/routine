package com.routine.goal;

import com.routine.common.ApiException;
import com.routine.common.NotFoundException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GoalService {

    private final GoalRepository goals;
    private final GoalMilestoneRepository milestones;

    public GoalService(GoalRepository goals, GoalMilestoneRepository milestones) {
        this.goals = goals;
        this.milestones = milestones;
    }

    @Transactional(readOnly = true)
    public List<GoalResponse> list(UUID userId, GoalStatus status) {
        List<Goal> found = status == null
                ? goals.findByUserIdOrderByCreatedAtDesc(userId)
                : goals.findByUserIdAndStatusOrderByCreatedAtDesc(userId, status);

        if (found.isEmpty()) {
            return List.of();
        }

        // One extra query for the whole page rather than one per goal: the
        // percentage on every card is derived from these rows.
        Map<UUID, List<GoalMilestone>> byGoal = milestones
                .findByGoalIdInOrderByOrderIndexAsc(found.stream().map(Goal::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(GoalMilestone::getGoalId));

        return found.stream()
                .map(goal -> GoalResponse.from(goal, byGoal.getOrDefault(goal.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public GoalResponse byId(UUID userId, UUID goalId) {
        return read(require(userId, goalId));
    }

    @Transactional
    public GoalResponse create(UUID userId, GoalRequest request) {
        Goal goal = new Goal();
        goal.setUserId(userId);
        apply(goal, request);
        return GoalResponse.from(goals.save(goal), List.of());
    }

    @Transactional
    public GoalResponse update(UUID userId, UUID goalId, GoalRequest request) {
        Goal goal = require(userId, goalId);
        apply(goal, request);
        return read(goal);
    }

    @Transactional
    public void delete(UUID userId, UUID goalId) {
        if (goals.deleteByIdAndUserId(goalId, userId) == 0) {
            throw NotFoundException.of("GOAL");
        }
    }

    // -------------------------------------------------------- milestones ----

    /**
     * Every milestone of a goal, nested. One query for both levels: the detail
     * screen needs all of it, and a query per parent would make a goal with ten
     * milestones eleven round trips.
     */
    @Transactional(readOnly = true)
    public List<MilestoneResponse> milestones(UUID userId, UUID goalId) {
        require(userId, goalId);
        return nest(milestones.findByGoalIdOrderByOrderIndexAsc(goalId));
    }

    /** New milestones land at the end of their own level — where a next step belongs. */
    @Transactional
    public MilestoneResponse addMilestone(UUID userId, UUID goalId, MilestoneRequest request) {
        require(userId, goalId);

        UUID parentId = request.parentId();
        if (parentId != null) {
            GoalMilestone parent = milestones.findByIdAndGoalId(parentId, goalId)
                    .orElseThrow(() -> NotFoundException.of("MILESTONE"));

            // One level only. Deeper nesting turns the screen into an outline
            // editor, and an outline of a goal is a plan nobody finishes
            // writing — so the refusal is the product decision, not a shortcut.
            if (parent.getParentId() != null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "MILESTONE_NESTING_TOO_DEEP",
                        "A sub-milestone cannot have sub-milestones of its own.");
            }
        }

        GoalMilestone milestone = new GoalMilestone();
        milestone.setGoalId(goalId);
        milestone.setParentId(parentId);
        milestone.setOrderIndex(nextIndex(goalId, parentId));
        apply(milestone, request);

        return MilestoneResponse.from(milestones.save(milestone));
    }

    @Transactional
    public MilestoneResponse updateMilestone(UUID userId, UUID goalId, UUID milestoneId,
                                             MilestoneRequest request) {
        require(userId, goalId);
        GoalMilestone milestone = milestones.findByIdAndGoalId(milestoneId, goalId)
                .orElseThrow(() -> NotFoundException.of("MILESTONE"));
        // parentId is not read here — see MilestoneRequest.
        apply(milestone, request);
        return read(milestone);
    }

    /**
     * Ticking a milestone off, which is the action people actually take — the
     * full form is for writing one, not for finishing one.
     */
    @Transactional
    public MilestoneResponse setMilestoneStatus(UUID userId, UUID goalId, UUID milestoneId,
                                                MilestoneStatus status) {
        require(userId, goalId);
        GoalMilestone milestone = milestones.findByIdAndGoalId(milestoneId, goalId)
                .orElseThrow(() -> NotFoundException.of("MILESTONE"));

        milestone.setStatus(status);
        // Completing a milestone that was sitting at 40% should not leave a
        // stale number behind it; reopening one at 100% should not claim it is
        // still finished.
        if (status == MilestoneStatus.COMPLETED) {
            milestone.setProgress((short) 100);
        } else if (status == MilestoneStatus.PENDING && milestone.getProgress() == 100) {
            milestone.setProgress((short) 0);
        }

        return read(milestone);
    }

    /** Deleting a milestone takes its sub-milestones with it — the database cascades. */
    @Transactional
    public void deleteMilestone(UUID userId, UUID goalId, UUID milestoneId) {
        require(userId, goalId);
        if (milestones.deleteByIdAndGoalId(milestoneId, goalId) == 0) {
            throw NotFoundException.of("MILESTONE");
        }
    }

    /**
     * Reorders one level by rewriting its indexes from the supplied order.
     *
     * <p>Ids the request omits keep their relative order after the ones it
     * names, so a reorder computed against a slightly stale list cannot silently
     * drop a milestone somebody added in another tab.
     *
     * @param parentId the level being reordered: null for the top-level steps,
     *                 or a milestone id for its sub-milestones. Ordering is per
     *                 level, so the two cannot interfere.
     */
    @Transactional
    public List<MilestoneResponse> reorderMilestones(UUID userId, UUID goalId, UUID parentId,
                                                     List<UUID> order) {
        require(userId, goalId);

        List<GoalMilestone> level = milestones.findByGoalIdOrderByOrderIndexAsc(goalId).stream()
                .filter(milestone -> Objects.equals(milestone.getParentId(), parentId))
                .toList();

        Map<UUID, GoalMilestone> byId = new HashMap<>();
        level.forEach(milestone -> byId.put(milestone.getId(), milestone));

        List<GoalMilestone> ordered = new ArrayList<>();
        for (UUID id : order) {
            GoalMilestone milestone = byId.remove(id);
            if (milestone == null) {
                // An id that is not on this level is a client bug, not something
                // the user can act on — but reordering around it silently would
                // hide the bug, so say so.
                throw NotFoundException.of("MILESTONE");
            }
            ordered.add(milestone);
        }
        level.stream().filter(milestone -> byId.containsKey(milestone.getId())).forEach(ordered::add);

        for (int index = 0; index < ordered.size(); index++) {
            ordered.get(index).setOrderIndex(index);
        }
        milestones.saveAll(ordered);

        return milestones(userId, goalId);
    }

    // ------------------------------------------------------------ internals --

    private void apply(Goal goal, GoalRequest request) {
        goal.setTitle(request.title().trim());
        goal.setDescription(request.description());
        goal.setCategory(request.category());
        goal.setStartDate(request.startDate());
        goal.setTargetDate(request.targetDate());
        if (request.status() != null) {
            goal.setStatus(request.status());
        }
        // Stored even when milestones are driving the displayed number: it is
        // the fallback the goal returns to if its milestones are all deleted.
        if (request.progress() != null) {
            goal.setProgress(request.progress());
        }
    }

    private void apply(GoalMilestone milestone, MilestoneRequest request) {
        if (request.startDate() != null && request.targetDate() != null
                && request.targetDate().isBefore(request.startDate())) {
            // The database enforces this too; caught here so the message is a
            // sentence rather than a constraint name.
            throw new ApiException(HttpStatus.BAD_REQUEST, "MILESTONE_DATES_REVERSED",
                    "That milestone would end before it starts.");
        }

        milestone.setTitle(request.title().trim());
        milestone.setDescription(request.description());
        milestone.setStartDate(request.startDate());
        milestone.setTargetDate(request.targetDate());
        if (request.status() != null) {
            milestone.setStatus(request.status());
        }
        if (request.progress() != null) {
            milestone.setProgress(request.progress());
        }
        if (milestone.getStatus() == MilestoneStatus.COMPLETED) {
            milestone.setProgress((short) 100);
        }
    }

    /** The next free position at the end of one level. */
    private int nextIndex(UUID goalId, UUID parentId) {
        return milestones.findByGoalIdOrderByOrderIndexAsc(goalId).stream()
                .filter(milestone -> Objects.equals(milestone.getParentId(), parentId))
                .mapToInt(GoalMilestone::getOrderIndex)
                .max()
                .orElse(-1) + 1;
    }

    /** One milestone with whatever sits under it. */
    private MilestoneResponse read(GoalMilestone milestone) {
        return milestone.getParentId() != null
                ? MilestoneResponse.from(milestone)
                : MilestoneResponse.from(milestone,
                        milestones.findByParentIdOrderByOrderIndexAsc(milestone.getId()));
    }

    private List<MilestoneResponse> nest(List<GoalMilestone> all) {
        Map<UUID, List<GoalMilestone>> childrenByParent = all.stream()
                .filter(milestone -> milestone.getParentId() != null)
                .collect(Collectors.groupingBy(GoalMilestone::getParentId));

        return all.stream()
                .filter(milestone -> milestone.getParentId() == null)
                .map(milestone -> MilestoneResponse.from(
                        milestone, childrenByParent.getOrDefault(milestone.getId(), List.of())))
                .toList();
    }

    private GoalResponse read(Goal goal) {
        return GoalResponse.from(goal, milestones.findByGoalIdOrderByOrderIndexAsc(goal.getId()));
    }

    private Goal require(UUID userId, UUID goalId) {
        return goals.findByIdAndUserId(goalId, userId).orElseThrow(() -> NotFoundException.of("GOAL"));
    }
}
