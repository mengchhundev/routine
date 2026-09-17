package com.routine.user;

import com.routine.auth.RefreshTokenRepository;
import com.routine.common.NotFoundException;
import com.routine.common.UnauthorizedException;
import com.routine.user.dto.ChangePasswordRequest;
import com.routine.user.dto.SettingsResponse;
import com.routine.user.dto.UpdateProfileRequest;
import com.routine.user.dto.UpdateSettingsRequest;
import com.routine.user.dto.UserResponse;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository users,
                       UserSettingsRepository settings,
                       RefreshTokenRepository refreshTokens,
                       PasswordEncoder passwordEncoder) {
        this.users = users;
        this.settings = settings;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public UserResponse profile(UUID userId) {
        return UserResponse.from(require(userId));
    }

    @Transactional
    public UserResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        if (!ZoneId.getAvailableZoneIds().contains(request.timezone())) {
            throw new com.routine.common.ApiException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "INVALID_TIMEZONE",
                    "Timezone must be a valid IANA zone id");
        }
        User user = require(userId);
        user.setDisplayName(request.displayName().trim());
        user.setTimezone(request.timezone());
        return UserResponse.from(user);
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        User user = require(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("INVALID_CREDENTIALS", "Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));

        // A password change ends every other session; the caller signs in again.
        refreshTokens.revokeAllForUser(userId, Instant.now());
    }

    @Transactional(readOnly = true)
    public SettingsResponse settings(UUID userId) {
        return SettingsResponse.from(loadSettings(userId));
    }

    @Transactional
    public SettingsResponse updateSettings(UUID userId, UpdateSettingsRequest request) {
        UserSettings current = loadSettings(userId);
        current.setRemindersEnabled(request.remindersEnabled());
        current.setEmailReminders(request.emailReminders());
        current.setDailyReviewTime(request.dailyReviewTime());
        current.setWeekStartsOn(request.weekStartsOn());
        if (request.theme() != null) {
            current.setTheme(request.theme());
        }
        return SettingsResponse.from(current);
    }

    private User require(UUID userId) {
        return users.findById(userId).orElseThrow(() -> NotFoundException.of("USER"));
    }

    /** Accounts created before user_settings existed still get sane defaults. */
    private UserSettings loadSettings(UUID userId) {
        return settings.findById(userId)
                .orElseGet(() -> settings.save(UserSettings.defaultsFor(userId)));
    }
}
