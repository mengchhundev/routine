package com.routine.routine;

import com.routine.common.UserOwnedRepository;
import java.util.List;
import java.util.UUID;

public interface RoutineRepository extends UserOwnedRepository<Routine> {

    List<Routine> findByUserIdOrderByStartTimeAscNameAsc(UUID userId);

    List<Routine> findByUserIdAndActiveTrueOrderByStartTimeAscNameAsc(UUID userId);

    /** Used by the daily generation job, which sweeps every user at once. */
    List<Routine> findByActiveTrue();
}
