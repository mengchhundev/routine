package com.routine.user.dto;

import com.routine.user.UserSettings;
import java.time.LocalTime;

public record SettingsResponse(
        boolean remindersEnabled,
        boolean emailReminders,
        LocalTime dailyReviewTime,
        short weekStartsOn,
        String theme) {

    public static SettingsResponse from(UserSettings settings) {
        return new SettingsResponse(
                settings.isRemindersEnabled(),
                settings.isEmailReminders(),
                settings.getDailyReviewTime(),
                settings.getWeekStartsOn(),
                settings.getTheme());
    }
}
