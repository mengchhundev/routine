package com.routine.goal;

import com.routine.auth.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/goals")
public class GoalController {

    private final GoalService goalService;

    public GoalController(GoalService goalService) {
        this.goalService = goalService;
    }

    @GetMapping
    public List<GoalResponse> list(@AuthenticationPrincipal AuthPrincipal principal,
                                   @RequestParam(required = false) GoalStatus status) {
        return goalService.list(principal.id(), status);
    }

    @GetMapping("/{id}")
    public GoalResponse byId(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id) {
        return goalService.byId(principal.id(), id);
    }

    @PostMapping
    public ResponseEntity<GoalResponse> create(@AuthenticationPrincipal AuthPrincipal principal,
                                               @Valid @RequestBody GoalRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(goalService.create(principal.id(), request));
    }

    @PutMapping("/{id}")
    public GoalResponse update(@AuthenticationPrincipal AuthPrincipal principal,
                               @PathVariable UUID id,
                               @Valid @RequestBody GoalRequest request) {
        return goalService.update(principal.id(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthPrincipal principal,
                                       @PathVariable UUID id) {
        goalService.delete(principal.id(), id);
        return ResponseEntity.noContent().build();
    }

    // -------------------------------------------------------- milestones ----

    // Nested under the goal because a milestone has no meaning without one, and
    // the nesting is what carries ownership into every one of these calls.

    /** Both levels, nested — {@code children} holds the sub-milestones. */
    @GetMapping("/{id}/milestones")
    public List<MilestoneResponse> milestones(@AuthenticationPrincipal AuthPrincipal principal,
                                              @PathVariable UUID id) {
        return goalService.milestones(principal.id(), id);
    }

    @PostMapping("/{id}/milestones")
    public ResponseEntity<MilestoneResponse> addMilestone(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody MilestoneRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(goalService.addMilestone(principal.id(), id, request));
    }

    @PutMapping("/{id}/milestones/{milestoneId}")
    public MilestoneResponse updateMilestone(@AuthenticationPrincipal AuthPrincipal principal,
                                             @PathVariable UUID id,
                                             @PathVariable UUID milestoneId,
                                             @Valid @RequestBody MilestoneRequest request) {
        return goalService.updateMilestone(principal.id(), id, milestoneId, request);
    }

    /** Its own endpoint so ticking one off is not a whole-form save. */
    @PostMapping("/{id}/milestones/{milestoneId}/status")
    public MilestoneResponse setMilestoneStatus(@AuthenticationPrincipal AuthPrincipal principal,
                                                @PathVariable UUID id,
                                                @PathVariable UUID milestoneId,
                                                @Valid @RequestBody StatusRequest request) {
        return goalService.setMilestoneStatus(principal.id(), id, milestoneId, request.status());
    }

    /**
     * Reorders one level. {@code parentId} names it: null for the goal's own
     * steps, a milestone id for that milestone's sub-milestones.
     */
    @PostMapping("/{id}/milestones/order")
    public List<MilestoneResponse> reorderMilestones(@AuthenticationPrincipal AuthPrincipal principal,
                                                     @PathVariable UUID id,
                                                     @Valid @RequestBody ReorderRequest request) {
        return goalService.reorderMilestones(principal.id(), id, request.parentId(), request.order());
    }

    @DeleteMapping("/{id}/milestones/{milestoneId}")
    public ResponseEntity<Void> deleteMilestone(@AuthenticationPrincipal AuthPrincipal principal,
                                                @PathVariable UUID id,
                                                @PathVariable UUID milestoneId) {
        goalService.deleteMilestone(principal.id(), id, milestoneId);
        return ResponseEntity.noContent().build();
    }

    public record StatusRequest(@NotNull MilestoneStatus status) {}

    public record ReorderRequest(UUID parentId, @NotEmpty List<UUID> order) {}
}
