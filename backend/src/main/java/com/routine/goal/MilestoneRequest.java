package com.routine.goal;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A step on the way to a goal, or a part of one.
 *
 * <p>{@code orderIndex} is deliberately absent: position is decided by the
 * reorder endpoint, which takes a whole level at once. Letting each milestone
 * claim its own index invites two of them claiming the same one.
 *
 * @param parentId the milestone this one is part of, or null for a top-level
 *                 step. Read on create only — moving a milestone under a
 *                 different parent is a different action from editing it, and
 *                 one verb doing both makes a misclick indistinguishable from a
 *                 rename.
 */
public record MilestoneRequest(
        @NotBlank @Size(max = 200) String title,
        @Size(max = 5000) String description,
        LocalDate startDate,
        LocalDate targetDate,
        MilestoneStatus status,
        /** Partial credit for something under way. COMPLETED counts as 100 regardless. */
        @Min(0) @Max(100) Short progress,
        UUID parentId) {
}
