package com.routine.routine;

import com.routine.common.Auditable;
import jakarta.persistence.*;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "routine_schedules")
@Getter
@Setter
@NoArgsConstructor
public class RoutineSchedule extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "routine_id", nullable = false)
    private UUID routineId;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type", nullable = false, length = 20)
    private ScheduleType scheduleType = ScheduleType.DAILY;

    /** ISO-8601 day numbers, 1 = Monday .. 7 = Sunday. Only used by SELECTED_DAYS/WEEKLY. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "days_of_week", nullable = false)
    private Short[] daysOfWeek = new Short[0];

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    /** Whether this schedule puts the routine on a given calendar day. */
    public boolean occursOn(LocalDate date) {
        if (date.isBefore(startDate) || (endDate != null && date.isAfter(endDate))) {
            return false;
        }
        DayOfWeek day = date.getDayOfWeek();
        return switch (scheduleType) {
            case DAILY -> true;
            case WEEKDAYS -> day.getValue() <= DayOfWeek.FRIDAY.getValue();
            case WEEKLY, SELECTED_DAYS -> Arrays.asList(daysOfWeek).contains((short) day.getValue());
        };
    }
}
