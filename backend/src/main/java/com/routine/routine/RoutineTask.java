package com.routine.routine;

import com.routine.common.Auditable;
import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A step in a routine: the template a generated daily task is copied from. */
@Entity
@Table(name = "routine_tasks")
@Getter
@Setter
@NoArgsConstructor
public class RoutineTask extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "routine_id", nullable = false)
    private UUID routineId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "order_index", nullable = false)
    private int orderIndex = 0;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;
}
