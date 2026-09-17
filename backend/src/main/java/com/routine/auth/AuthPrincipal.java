package com.routine.auth;

import java.util.UUID;

/**
 * What every authenticated request carries. Controllers receive it via
 * {@code @AuthenticationPrincipal} and pass {@link #id()} into services, which
 * scope every query by it.
 */
public record AuthPrincipal(UUID id, String email) {
}
