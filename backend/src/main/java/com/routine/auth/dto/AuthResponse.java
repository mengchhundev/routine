package com.routine.auth.dto;

import com.routine.user.dto.UserResponse;

/**
 * @param expiresIn seconds until {@code accessToken} expires, so the client can
 *                  refresh ahead of time instead of waiting for a 401
 */
public record AuthResponse(
        String tokenType,
        String accessToken,
        String refreshToken,
        long expiresIn,
        UserResponse user) {
}
