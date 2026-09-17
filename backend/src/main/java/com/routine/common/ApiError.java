package com.routine.common;

import java.time.Instant;
import java.util.Map;

/**
 * The single error shape every endpoint returns (ROUTINE-PROJECT-PLAN section 26).
 * {@code details} is populated only for field-level validation failures.
 */
public record ApiError(String code, String message, Instant timestamp, Map<String, String> details) {

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, Instant.now(), null);
    }

    public static ApiError of(String code, String message, Map<String, String> details) {
        return new ApiError(code, message, Instant.now(), details);
    }
}
