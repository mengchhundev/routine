package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.routine.RoutineSchedule;
import com.routine.routine.ScheduleType;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** Schedule maths has no dependencies, so it is tested without a container. */
class RoutineScheduleTest {

    // 2026-09-07 is a Monday; 2026-09-12 a Saturday.
    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 7);
    private static final LocalDate SATURDAY = LocalDate.of(2026, 9, 12);

    private RoutineSchedule schedule(ScheduleType type, LocalDate start, Short... days) {
        RoutineSchedule schedule = new RoutineSchedule();
        schedule.setScheduleType(type);
        schedule.setStartDate(start);
        schedule.setDaysOfWeek(days);
        return schedule;
    }

    @Test
    void dailyOccursEveryDayFromTheStartDate() {
        RoutineSchedule daily = schedule(ScheduleType.DAILY, MONDAY);

        assertThat(daily.occursOn(MONDAY)).isTrue();
        assertThat(daily.occursOn(SATURDAY)).isTrue();
        assertThat(daily.occursOn(MONDAY.minusDays(1))).isFalse();
    }

    @Test
    void weekdaysSkipsTheWeekend() {
        RoutineSchedule weekdays = schedule(ScheduleType.WEEKDAYS, MONDAY);

        assertThat(weekdays.occursOn(MONDAY)).isTrue();
        assertThat(weekdays.occursOn(MONDAY.plusDays(4))).isTrue();  // Friday
        assertThat(weekdays.occursOn(SATURDAY)).isFalse();
        assertThat(weekdays.occursOn(SATURDAY.plusDays(1))).isFalse(); // Sunday
    }

    @Test
    void selectedDaysMatchesOnlyTheChosenIsoDays() {
        // Monday and Wednesday.
        RoutineSchedule selected = schedule(ScheduleType.SELECTED_DAYS, MONDAY, (short) 1, (short) 3);

        assertThat(selected.occursOn(MONDAY)).isTrue();
        assertThat(selected.occursOn(MONDAY.plusDays(2))).isTrue();
        assertThat(selected.occursOn(MONDAY.plusDays(1))).isFalse();
    }

    @Test
    void anEndDateClosesTheSchedule() {
        RoutineSchedule daily = schedule(ScheduleType.DAILY, MONDAY);
        daily.setEndDate(MONDAY.plusDays(2));

        assertThat(daily.occursOn(MONDAY.plusDays(2))).isTrue();
        assertThat(daily.occursOn(MONDAY.plusDays(3))).isFalse();
    }
}
