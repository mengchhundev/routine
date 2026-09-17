package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.RegisterRequest;
import com.routine.planner.MonthResponse;
import com.routine.planner.WeekResponse;
import com.routine.task.dto.TaskRequest;
import com.routine.task.dto.TaskResponse;
import com.routine.user.dto.UpdateSettingsRequest;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

/** The planner's other two horizons: a week and a month. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class PlannerRangeIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String token;
    /** The account registers without a timezone, so its local day is UTC's. */
    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    @BeforeEach
    void signUp() {
        ResponseEntity<AuthResponse> registered = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest("plan-" + UUID.randomUUID() + "@example.com",
                        "correct-horse-battery", "Ada", null),
                AuthResponse.class);
        assertThat(registered.getBody()).isNotNull();
        token = registered.getBody().accessToken();
    }

    @Test
    void theWeekAlwaysHasSevenDaysInOrder() {
        WeekResponse week = week(null);

        assertThat(week.days()).hasSize(7);
        assertThat(week.days().getFirst().date()).isEqualTo(week.start());
        assertThat(week.days().getLast().date()).isEqualTo(week.end());
        assertThat(week.end()).isEqualTo(week.start().plusDays(6));
        assertThat(week.days()).filteredOn(WeekResponse.Day::isToday).hasSize(1);
    }

    @Test
    void theWeekStartsOnTheDayTheUserChose() {
        // Default is Monday.
        assertThat(week(null).start().getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);

        rest.exchange("/api/v1/users/me/settings", HttpMethod.PUT,
                new HttpEntity<>(new UpdateSettingsRequest(true, true,
                        LocalTime.of(21, 30), (short) DayOfWeek.SUNDAY.getValue(), "system"), headers()),
                String.class);

        WeekResponse sundayFirst = week(null);
        assertThat(sundayFirst.start().getDayOfWeek()).isEqualTo(DayOfWeek.SUNDAY);
        assertThat(sundayFirst.weekStartsOn()).isEqualTo(DayOfWeek.SUNDAY.getValue());
        // Today is still inside the week, whichever day it begins on.
        assertThat(sundayFirst.days()).filteredOn(WeekResponse.Day::isToday).hasSize(1);
    }

    @Test
    void anyDayInTheWeekAsksForTheSameWeek() {
        WeekResponse fromToday = week(today);
        WeekResponse fromItsStart = week(fromToday.start());
        WeekResponse fromItsEnd = week(fromToday.end());

        assertThat(fromItsStart.start()).isEqualTo(fromToday.start());
        assertThat(fromItsEnd.start()).isEqualTo(fromToday.start());
    }

    @Test
    void theWeekCarriesEachDaysTasksAndTheTotalTheyAddUpTo() {
        TaskResponse first = createTask("Morning workout", today);
        createTask("Read 20 pages", today);
        createTask("Cloud lab", today.plusDays(1));

        complete(first.id());

        WeekResponse week = week(null);
        WeekResponse.Day day = week.days().stream()
                .filter(WeekResponse.Day::isToday).findFirst().orElseThrow();

        assertThat(day.tasks()).extracting(TaskResponse::title)
                .contains("Morning workout", "Read 20 pages");
        assertThat(day.progress().planned()).isEqualTo(2);
        assertThat(day.progress().percent()).isEqualTo(50);

        // Tomorrow may fall in next week, so only assert on what is inside this one.
        int plannedInWeek = week.days().stream().mapToInt(entry -> entry.progress().planned()).sum();
        assertThat(week.total().planned()).isEqualTo(plannedInWeek);
        assertThat(week.total().completed()).isEqualTo(1);
    }

    @Test
    void theMonthIsAFullCalendarOfRates() {
        createTask("Morning workout", today);

        MonthResponse month = month(null);
        YearMonth current = YearMonth.from(today);

        assertThat(month.month()).isEqualTo(current.toString());
        assertThat(month.days()).hasSize(current.lengthOfMonth());
        assertThat(month.start()).isEqualTo(current.atDay(1));
        assertThat(month.end()).isEqualTo(current.atEndOfMonth());

        MonthResponse.Day day = month.days().stream()
                .filter(MonthResponse.Day::isToday).findFirst().orElseThrow();
        assertThat(day.planned()).isEqualTo(1);
        assertThat(day.percent()).isZero();
        // Days with nothing planned are not counted against the month.
        assertThat(month.activeDays()).isEqualTo(1);
    }

    @Test
    void anEarlierMonthCanBeAskedForByName() {
        YearMonth last = YearMonth.from(today).minusMonths(1);

        MonthResponse month = month(last.toString());

        assertThat(month.month()).isEqualTo(last.toString());
        assertThat(month.days()).hasSize(last.lengthOfMonth());
        assertThat(month.days()).noneMatch(MonthResponse.Day::isToday);
    }

    @Test
    void anUnreadableMonthSaysWhatItWantedRatherThanFailing() {
        ResponseEntity<String> response = rest.exchange("/api/v1/planner/month?month=March",
                HttpMethod.GET, new HttpEntity<>(headers()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("INVALID_MONTH");
    }

    // ---------------------------------------------------------------- helpers

    private WeekResponse week(LocalDate date) {
        ResponseEntity<WeekResponse> response = rest.exchange(
                "/api/v1/planner/week" + (date == null ? "" : "?date=" + date),
                HttpMethod.GET, new HttpEntity<>(headers()), WeekResponse.class);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private MonthResponse month(String month) {
        ResponseEntity<MonthResponse> response = rest.exchange(
                "/api/v1/planner/month" + (month == null ? "" : "?month=" + month),
                HttpMethod.GET, new HttpEntity<>(headers()), MonthResponse.class);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private TaskResponse createTask(String title, LocalDate dueDate) {
        ResponseEntity<TaskResponse> created = rest.exchange("/api/v1/tasks", HttpMethod.POST,
                new HttpEntity<>(new TaskRequest(title, null, null, null, dueDate, null, null, null),
                        headers()),
                TaskResponse.class);
        assertThat(created.getBody()).isNotNull();
        return created.getBody();
    }

    private void complete(UUID taskId) {
        rest.exchange("/api/v1/tasks/" + taskId + "/complete", HttpMethod.POST,
                new HttpEntity<>(headers()), TaskResponse.class);
    }

    private HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return headers;
    }
}
