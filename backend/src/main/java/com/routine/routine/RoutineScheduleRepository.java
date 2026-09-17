package com.routine.routine;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoutineScheduleRepository extends JpaRepository<RoutineSchedule, UUID> {

    List<RoutineSchedule> findByRoutineId(UUID routineId);

    List<RoutineSchedule> findByRoutineIdIn(List<UUID> routineIds);
}
