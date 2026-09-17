package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.RegisterRequest;
import com.routine.planner.DayResponse;
import com.routine.routine.ScheduleType;
import com.routine.routine.dto.RoutineRequest;
import com.routine.routine.dto.RoutineResponse;
import com.routine.task.dto.TaskResponse;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

/**
 * A routine earns its place by generating the right tasks on the right days —
 * once, in the user's timezone, and never into a past it cannot change.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class RoutineIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String token;
    /** The account registers without a timezone, so its local day is UTC's. */
    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    @BeforeEach
    void signUp() {
        token = register("routine-" + UUID.randomUUID() + "@example.com");
    }

    @Test
    void aDailyRoutineTurnsIntoTodaysTasksWhenTheDayIsOpened() {
        create(daily("Morning routine", LocalTime.of(6, 30),
                step("Drink water", 5), step("Exercise", 30), step("Plan the day", null)));

        DayResponse day = day(null);

        assertThat(day.tasks()).extracting(TaskResponse::title)
                .containsExactly("Drink water", "Exercise", "Plan the day");
        // Steps run in order from the start time, each after the ones before it.
        assertThat(day.tasks()).extracting(TaskResponse::dueTime)
                .containsExactly(LocalTime.of(6, 30), LocalTime.of(6, 35), LocalTime.of(7, 5));
        // Marked as generated, so the UI can say why they reappear tomorrow.
        assertThat(day.tasks()).allMatch(TaskResponse::generated);
        assertThat(day.progress().planned()).isEqualTo(3);
    }

    @Test
    void openingTheSameDayTwiceDoesNotGenerateTwice() {
        create(daily("Morning routine", null, step("Drink water", null)));

        day(null);
        day(null);
        day(null);

        assertThat(day(null).tasks()).hasSize(1);
    }

    @Test
    void aRoutineOnlyGeneratesOnItsOwnDays() {
        DayOfWeek target = today.plusDays(2).getDayOfWeek();
        RoutineRequest request = new RoutineRequest("Study", null, null, null, null, null, true,
                new RoutineRequest.ScheduleRequest(ScheduleType.SELECTED_DAYS,
                        List.of((short) target.getValue()), today, null),
                List.of(new RoutineRequest.StepRequest(null, "Kubernetes", null, null)));
        create(request);

        assertThat(day(today.plusDays(1)).tasks()).isEmpty();
        assertThat(day(today.plusDays(2)).tasks()).extracting(TaskResponse::title)
                .containsExactly("Kubernetes");
    }

    @Test
    void generationNeverReachesIntoThePast() {
        // The schedule starts well before today, so the only thing stopping
        // yesterday from filling up is the refusal to write history.
        RoutineRequest request = new RoutineRequest("Morning routine", null, null, null, null, null, true,
                new RoutineRequest.ScheduleRequest(ScheduleType.DAILY, null, today.minusDays(30), null),
                List.of(new RoutineRequest.StepRequest(null, "Drink water", null, null)));
        create(request);

        assertThat(day(today.minusDays(1)).tasks()).isEmpty();
        assertThat(day(today.minusDays(1)).progress().planned()).isZero();
        // Today still generates, so the guard is about the past, not about being off.
        assertThat(day(null).tasks()).hasSize(1);
    }

    @Test
    void pausingARoutineStopsFutureDaysButKeepsWhatWasAlreadyGenerated() {
        RoutineResponse routine = create(daily("Morning routine", null, step("Drink water", null)));

        assertThat(day(null).tasks()).hasSize(1);

        rest.exchange("/api/v1/routines/" + routine.id() + "/active", HttpMethod.POST,
                new HttpEntity<>(new Active(false), headers()), RoutineResponse.class);

        assertThat(day(today.plusDays(1)).tasks()).isEmpty();
        // Today's task was already real work; pausing is not a retraction.
        assertThat(day(null).tasks()).hasSize(1);
    }

    @Test
    void editingAStepKeepsItsIdentityAndDoesNotDuplicateTodaysTask() {
        RoutineResponse routine = create(daily("Morning routine", null, step("Drink water", null)));
        day(null);

        UUID stepId = routine.steps().getFirst().id();
        RoutineRequest edit = new RoutineRequest("Morning routine", null, null, null, null, null, true,
                new RoutineRequest.ScheduleRequest(ScheduleType.DAILY, null, today, null),
                List.of(new RoutineRequest.StepRequest(stepId, "Drink two glasses of water", null, null)));

        RoutineResponse updated = rest.exchange("/api/v1/routines/" + routine.id(), HttpMethod.PUT,
                new HttpEntity<>(edit, headers()), RoutineResponse.class).getBody();

        assertThat(updated).isNotNull();
        assertThat(updated.steps().getFirst().id()).isEqualTo(stepId);
        // The generated task still points at the same step, so reopening the day
        // recognises it rather than generating a second one.
        assertThat(day(null).tasks()).hasSize(1);
    }

    @Test
    void aScheduleThatNeedsDaysIsRejectedWithoutThem() {
        RoutineRequest request = new RoutineRequest("Study", null, null, null, null, null, true,
                new RoutineRequest.ScheduleRequest(ScheduleType.SELECTED_DAYS, List.of(), today, null),
                List.of(new RoutineRequest.StepRequest(null, "Kubernetes", null, null)));

        ResponseEntity<String> response = rest.exchange("/api/v1/routines", HttpMethod.POST,
                new HttpEntity<>(request, headers()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void routinesAreNotVisibleToAnotherAccount() {
        create(daily("Morning routine", null, step("Drink water", null)));

        token = register("other-" + UUID.randomUUID() + "@example.com");

        assertThat(list()).isEmpty();
        assertThat(day(null).tasks()).isEmpty();
    }

    // ------------------------------------------------------------ helpers ---

    private record Active(Boolean active) {}

    private RoutineRequest.StepRequest step(String title, Integer minutes) {
        return new RoutineRequest.StepRequest(null, title, null, minutes);
    }

    private RoutineRequest daily(String name, LocalTime startTime, RoutineRequest.StepRequest... steps) {
        return new RoutineRequest(name, null, null, null, startTime, null, true,
                new RoutineRequest.ScheduleRequest(ScheduleType.DAILY, null, today, null),
                List.of(steps));
    }

    private RoutineResponse create(RoutineRequest request) {
        ResponseEntity<RoutineResponse> response = rest.exchange("/api/v1/routines", HttpMethod.POST,
                new HttpEntity<>(request, headers()), RoutineResponse.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private List<RoutineResponse> list() {
        ResponseEntity<List<RoutineResponse>> response = rest.exchange("/api/v1/routines", HttpMethod.GET,
                new HttpEntity<>(headers()), new ParameterizedTypeReference<>() {});
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private DayResponse day(LocalDate date) {
        String url = "/api/v1/planner/day" + (date == null ? "" : "?date=" + date);
        ResponseEntity<DayResponse> response =
                rest.exchange(url, HttpMethod.GET, new HttpEntity<>(headers()), DayResponse.class);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private String register(String email) {
        ResponseEntity<AuthResponse> response = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest(email, "correct-horse-battery", "Ada", null), AuthResponse.class);
        assertThat(response.getBody()).isNotNull();
        return response.getBody().accessToken();
    }

    private HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return headers;
    }
}
