package com.routine.user;

import com.routine.common.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_settings")
@Getter
@Setter
@NoArgsConstructor
public class UserSettings extends Auditable {

    /** Shares the user's primary key: exactly one settings row per user. */
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "reminders_enabled", nullable = false)
    private boolean remindersEnabled = true;

    @Column(name = "email_reminders", nullable = false)
    private boolean emailReminders = true;

    @Column(name = "daily_review_time", nullable = false)
    private LocalTime dailyReviewTime = LocalTime.of(21, 30);

    /** ISO-8601 day number: 1 = Monday .. 7 = Sunday. */
    @Column(name = "week_starts_on", nullable = false)
    private short weekStartsOn = 1;

    @Column(nullable = false, length = 20)
    private String theme = "system";

    public static UserSettings defaultsFor(UUID userId) {
        UserSettings settings = new UserSettings();
        settings.setUserId(userId);
        return settings;
    }
}
