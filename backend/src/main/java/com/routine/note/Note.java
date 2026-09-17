package com.routine.note;

import com.routine.common.Auditable;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A note may hang off a day, a task, a routine, a goal, or nothing at all. */
@Entity
@Table(name = "notes")
@Getter
@Setter
@NoArgsConstructor
public class Note extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "goal_id")
    private UUID goalId;

    @Column(name = "task_id")
    private UUID taskId;

    @Column(name = "routine_id")
    private UUID routineId;

    @Column(name = "note_date")
    private LocalDate noteDate;

    @Column(length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;
}
