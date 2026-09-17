package com.routine.reminder;

import com.routine.common.Auditable;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "reminders")
@Getter
@Setter
@NoArgsConstructor
public class Reminder extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "task_id")
    private UUID taskId;

    @Column(name = "routine_id")
    private UUID routineId;

    @Column(name = "goal_id")
    private UUID goalId;

    @Column(length = 300)
    private String message;

    /**
     * An absolute instant. The user's local time and timezone are resolved when
     * the reminder is created, so the scheduler compares instants only and a
     * DST change cannot shift a reminder by an hour.
     */
    @Column(name = "reminder_time", nullable = false)
    private Instant reminderTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReminderChannel channel = ReminderChannel.EMAIL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReminderStatus status = ReminderStatus.PENDING;

    @Column(nullable = false)
    private short attempts = 0;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;

    @Column(name = "sent_at")
    private Instant sentAt;
}
