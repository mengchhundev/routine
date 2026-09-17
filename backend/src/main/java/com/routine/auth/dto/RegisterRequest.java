package com.routine.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email @Size(max = 320) String email,
        // 10 characters minimum, no composition rules: length beats forced symbols.
        @NotBlank @Size(min = 10, max = 128) String password,
        @NotBlank @Size(max = 120) String displayName,
        @Size(max = 64) String timezone) {
}
