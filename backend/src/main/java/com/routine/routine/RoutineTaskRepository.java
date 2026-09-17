package com.routine.routine;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoutineTaskRepository extends JpaRepository<RoutineTask, UUID> {

    List<RoutineTask> findByRoutineIdOrderByOrderIndexAsc(UUID routineId);

    /** Loads the steps of many routines at once, for the list screen. */
    List<RoutineTask> findByRoutineIdInOrderByOrderIndexAsc(List<UUID> routineIds);

    void deleteByRoutineId(UUID routineId);
}
