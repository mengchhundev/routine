package com.routine.common;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

/**
 * Base repository for every user-owned resource.
 *
 * <p>The security rule in ROUTINE-PROJECT-PLAN section 7 — "every user-owned
 * resource must be authorized against the authenticated user" — is enforced
 * structurally rather than by convention: services look rows up by
 * {@code (id, userId)} together, so a missing ownership check cannot compile
 * into a working lookup. Never add a plain {@code findById} to a subinterface.
 */
@NoRepositoryBean
public interface UserOwnedRepository<T> extends JpaRepository<T, UUID> {

    Optional<T> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByIdAndUserId(UUID id, UUID userId);

    long deleteByIdAndUserId(UUID id, UUID userId);
}
