package com.routine.user;

import com.routine.common.NotFoundException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves "now" for a user. Every calendar decision in the product — which day
 * a task is due, which day a completion counts for, where a streak breaks —
 * happens in the user's own timezone, never the server's.
 */
@Service
public class UserContext {

    private final UserRepository users;
    private final UserSettingsRepository settings;

    public UserContext(UserRepository users, UserSettingsRepository settings) {
        this.users = users;
        this.settings = settings;
    }

    @Transactional(readOnly = true)
    public ZoneId zoneOf(UUID userId) {
        String timezone = users.findById(userId)
                .orElseThrow(() -> NotFoundException.of("USER"))
                .getTimezone();
        try {
            return ZoneId.of(timezone);
        } catch (Exception ex) {
            // A zone id that the JVM no longer recognises must not break the
            // dashboard; UTC is wrong by hours, an exception is wrong entirely.
            return ZoneId.of("UTC");
        }
    }

    @Transactional(readOnly = true)
    public LocalDate today(UUID userId) {
        return LocalDate.now(zoneOf(userId));
    }

    /**
     * The day the user's week begins on. A planner that always starts on Monday
     * is wrong for everyone whose week does not, and the setting already exists.
     */
    @Transactional(readOnly = true)
    public DayOfWeek weekStartsOn(UUID userId) {
        short day = settings.findById(userId)
                .map(UserSettings::getWeekStartsOn)
                .orElse((short) 1);
        return DayOfWeek.of(day < 1 || day > 7 ? 1 : day);
    }

    /** The first day of the week containing {@code date}, for this user. */
    @Transactional(readOnly = true)
    public LocalDate startOfWeek(UUID userId, LocalDate date) {
        DayOfWeek first = weekStartsOn(userId);
        int back = (date.getDayOfWeek().getValue() - first.getValue() + 7) % 7;
        return date.minusDays(back);
    }
}
