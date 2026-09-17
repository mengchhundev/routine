package com.routine.auth;

import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.LoginRequest;
import com.routine.auth.dto.RefreshRequest;
import com.routine.auth.dto.RegisterRequest;
import com.routine.auth.jwt.JwtService;
import com.routine.auth.jwt.TokenHasher;
import com.routine.common.ConflictException;
import com.routine.common.UnauthorizedException;
import com.routine.config.AuthProperties;
import com.routine.user.User;
import com.routine.user.UserRepository;
import com.routine.user.UserSettings;
import com.routine.user.UserSettingsRepository;
import com.routine.user.dto.UserResponse;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthProperties properties;

    /**
     * A real bcrypt hash of a random value nothing can ever submit. Verifying
     * against it when the email is unknown keeps a failed login's cost identical
     * either way, so response time cannot be used to enumerate registered accounts.
     */
    private final String dummyHash;

    public AuthService(UserRepository users,
                       UserSettingsRepository settings,
                       RefreshTokenRepository refreshTokens,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       AuthProperties properties) {
        this.users = users;
        this.settings = settings;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.properties = properties;
        this.dummyHash = passwordEncoder.encode(TokenHasher.randomToken());
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim();
        if (users.existsByEmailIgnoreCase(email)) {
            throw new ConflictException("EMAIL_ALREADY_REGISTERED", "That email is already registered");
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName().trim());
        user.setTimezone(normalizeTimezone(request.timezone()));
        users.save(user);

        settings.save(UserSettings.defaultsFor(user.getId()));

        log.info("Registered user {}", user.getId());
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        Optional<User> found = users.findByEmailIgnoreCase(request.email().trim());

        // Always run the (deliberately slow) hash comparison, present or not.
        String hash = found.map(User::getPasswordHash).orElse(dummyHash);
        boolean passwordMatches = passwordEncoder.matches(request.password(), hash);

        User user = found.filter(candidate -> passwordMatches && candidate.isActive())
                .orElseThrow(this::invalidCredentials);

        return issueTokens(user);
    }

    /**
     * Rotates the refresh token on every use: the presented token is revoked and
     * a new one issued. A stolen token is therefore usable at most once, and its
     * reuse after the legitimate client has refreshed is detectable.
     */
    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        Instant now = Instant.now();
        RefreshToken stored = refreshTokens.findByTokenHash(TokenHasher.hash(request.refreshToken()))
                .orElseThrow(() -> new UnauthorizedException(
                        "INVALID_REFRESH_TOKEN", "Refresh token is not valid"));

        if (!stored.isUsable(now)) {
            // Presenting an already-revoked token means it leaked, or the client
            // is replaying: drop every session for this user and make them re-auth.
            if (stored.getRevokedAt() != null) {
                log.warn("Reuse of revoked refresh token for user {}; revoking all sessions",
                        stored.getUserId());
                refreshTokens.revokeAllForUser(stored.getUserId(), now);
            }
            throw new UnauthorizedException("INVALID_REFRESH_TOKEN", "Refresh token is not valid");
        }

        User user = users.findById(stored.getUserId())
                .filter(User::isActive)
                .orElseThrow(this::invalidCredentials);

        stored.setRevokedAt(now);
        return issueTokens(user);
    }

    @Transactional
    public void logout(String refreshToken) {
        // Idempotent: an unknown or already-revoked token is still a successful logout.
        refreshTokens.findByTokenHash(TokenHasher.hash(refreshToken))
                .filter(token -> token.getRevokedAt() == null)
                .ifPresent(token -> token.setRevokedAt(Instant.now()));
    }

    private AuthResponse issueTokens(User user) {
        String refreshValue = TokenHasher.randomToken();

        RefreshToken token = new RefreshToken();
        token.setUserId(user.getId());
        token.setTokenHash(TokenHasher.hash(refreshValue));
        token.setExpiresAt(Instant.now().plus(properties.refreshTokenTtl()));
        refreshTokens.save(token);

        return new AuthResponse(
                "Bearer",
                jwtService.issueAccessToken(user.getId(), user.getEmail()),
                refreshValue,
                jwtService.accessTokenTtl().toSeconds(),
                UserResponse.from(user));
    }

    /** One message for every failure mode, so the response reveals nothing. */
    private UnauthorizedException invalidCredentials() {
        return new UnauthorizedException("INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    private String normalizeTimezone(String timezone) {
        if (timezone == null || timezone.isBlank()) {
            return "UTC";
        }
        return ZoneId.getAvailableZoneIds().contains(timezone) ? timezone : "UTC";
    }
}
