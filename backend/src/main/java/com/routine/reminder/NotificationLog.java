package com.routine.reminder;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Notification history and duplicate suppression: a partial unique index allows
 * at most one SENT row per reminder, so a retry that races cannot double-send.
 */
@Entity
@Table(name = "notification_log")
@Getter
@Setter
@NoArgsConstructor
public class NotificationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "reminder_id", nullable = false)
    private UUID reminderId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 20)
    private String channel;

    @Column(nullable = false, length = 20)
    private String outcome;

    @Column(columnDefinition = "text")
    private String detail;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt = Instant.now();
}
