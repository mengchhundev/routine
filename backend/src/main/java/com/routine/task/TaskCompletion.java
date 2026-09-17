package com.routine.task;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * An append-only record that a task was completed on a given local day. Kept
 * separate from {@code tasks.status} so streaks and consistency metrics survive
 * a task being edited or rescheduled afterwards.
 */
@Entity
@Table(name = "task_completions")
@Getter
@Setter
@NoArgsConstructor
public class TaskCompletion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt = Instant.now();

    @Column(name = "completion_date", nullable = false)
    private LocalDate completionDate;
}
