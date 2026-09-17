package com.routine.goal;

import com.routine.common.Auditable;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "goals")
@Getter
@Setter
@NoArgsConstructor
public class Goal extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Denormalized owner. Associations are held as plain ids rather than JPA
     * relationships: it keeps modules loosely coupled, makes every query
     * ownership-scoped by construction, and avoids accidental lazy-load fan-out.
     */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(length = 80)
    private String category;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GoalStatus status = GoalStatus.ACTIVE;

    /** 0-100. Manual in the MVP; derived from milestones later (plan section 15). */
    @Column(nullable = false)
    private short progress = 0;
}
