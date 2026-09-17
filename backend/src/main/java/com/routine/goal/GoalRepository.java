package com.routine.goal;

import com.routine.common.UserOwnedRepository;
import java.util.List;
import java.util.UUID;

public interface GoalRepository extends UserOwnedRepository<Goal> {

    List<Goal> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Goal> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, GoalStatus status);
}
