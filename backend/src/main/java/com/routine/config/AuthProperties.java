package com.routine.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * @param jwtSecret       base64-encoded HMAC key, at least 256 bits after decoding
 * @param accessTokenTtl  short by design; the refresh token carries session length
 * @param refreshTokenTtl how long a user stays signed in without re-entering a password
 */
@Validated
@ConfigurationProperties(prefix = "routine.auth")
public record AuthProperties(
        @NotBlank String jwtSecret,
        @NotBlank String issuer,
        @NotNull Duration accessTokenTtl,
        @NotNull Duration refreshTokenTtl) {
}
