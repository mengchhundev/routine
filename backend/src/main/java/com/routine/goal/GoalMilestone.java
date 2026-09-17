package com.routine.goal;

import com.routine.common.Auditable;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "goal_milestones")
@Getter
@Setter
@NoArgsConstructor
public class GoalMilestone extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Ownership is inherited from the goal; always load the goal by (id, userId) first. */
    @Column(name = "goal_id", nullable = false)
    private UUID goalId;

    /**
     * The milestone this one is a part of, or null for a top-level step.
     *
     * <p>Held as a plain id, like every other association in the product, and
     * limited to one level of nesting by {@link GoalService} — that rule lives
     * there because a CHECK constraint cannot see a grandparent.
     */
    @Column(name = "parent_id")
    private UUID parentId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "start_date")
    private LocalDate startDate;

    /** The end of the span — what "by when" means on the screen. */
    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "order_index", nullable = false)
    private int orderIndex = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MilestoneStatus status = MilestoneStatus.PENDING;

    @Column(nullable = false)
    private short progress = 0;
}
