package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.RegisterRequest;
import com.routine.note.dto.DailyReviewRequest;
import com.routine.note.dto.DailyReviewResponse;
import com.routine.note.dto.NoteRequest;
import com.routine.note.dto.NoteResponse;
import com.routine.planner.DayResponse;
import com.routine.task.dto.TaskRequest;
import com.routine.task.dto.TaskResponse;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")  // datasource and signing key: see application-test.yml
class TodayIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String token;
    /** The account registers without a timezone, so its local day is UTC's. */
    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    @BeforeEach
    void signUp() {
        token = register("today-" + UUID.randomUUID() + "@example.com");
    }

    @Test
    void theDayDefaultsToTheUsersTodayAndSaysSo() {
        DayResponse day = day(null);

        assertThat(day.date()).isEqualTo(today);
        assertThat(day.isToday()).isTrue();
        assertThat(day.timezone()).isEqualTo("UTC");
        assertThat(day.tasks()).isEmpty();
        // Absent, not omitted: the client must be able to tell "nothing written
        // yet" from "the server did not send this field".
        assertThat(day.note()).isNull();
        assertThat(day.review()).isNull();
    }

    @Test
    void anExplicitDateIsNotMarkedAsToday() {
        DayResponse yesterday = day(today.minusDays(1));

        assertThat(yesterday.date()).isEqualTo(today.minusDays(1));
        assertThat(yesterday.isToday()).isFalse();
    }

    @Test
    void theDayCarriesItsOwnProgress() {
        createTask("Morning workout", today);
        createTask("Read 20 pages", today);
        complete(day(null).tasks().getFirst().id());

        assertThat(day(null).progress().planned()).isEqualTo(2);
        assertThat(day(null).progress().completed()).isEqualTo(1);
        assertThat(day(null).progress().percent()).isEqualTo(50);
    }

    @Test
    void theDaysNoteAppearsOnTheDay() {
        ResponseEntity<NoteResponse> created = rest.exchange("/api/v1/notes", HttpMethod.POST,
                new HttpEntity<>(new NoteRequest(null, "CNI is just a plugin contract.", today, null, null, null),
                        headers()),
                NoteResponse.class);

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();

        DayResponse day = day(null);
        assertThat(day.note()).isNotNull();
        assertThat(day.note().id()).isEqualTo(created.getBody().id());
        assertThat(day.note().content()).isEqualTo("CNI is just a plugin contract.");

        // A note filed under today must not leak into another day.
        assertThat(day(today.minusDays(1)).note()).isNull();
    }

    /** One review per day: saving again edits it rather than stacking a second. */
    @Test
    void savingTheReviewTwiceUpdatesTheSameDay() {
        DailyReviewResponse first = saveReview(new DailyReviewRequest(
                "Solid day.", "Kept the routine.", "Started late.", "Study at 18:00.",
                (short) 4, (short) 4, (short) 3));

        DailyReviewResponse second = saveReview(new DailyReviewRequest(
                "Better than it felt.", "Kept the routine.", null, "Study at 18:00.",
                (short) 5, (short) 4, (short) 3));

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(second.rating()).isEqualTo((short) 5);
        assertThat(second.summary()).isEqualTo("Better than it felt.");
        // A cleared answer really clears rather than keeping the old text.
        assertThat(second.whatWentWrong()).isNull();

        assertThat(day(null).review()).isNotNull();
        assertThat(day(null).review().id()).isEqualTo(first.id());
    }

    @Test
    void anOutOfRangeRatingIsRejected() {
        ResponseEntity<String> response = rest.exchange("/api/v1/reviews/" + today, HttpMethod.PUT,
                new HttpEntity<>(new DailyReviewRequest(null, null, null, null, (short) 9, null, null), headers()),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("VALIDATION_FAILED");
    }

    @Test
    void reschedulingMovesTheTaskAndBothDaysProgressWithIt() {
        createTask("Write daily note", today);
        createTask("Review goals", today);
        UUID toMove = day(null).tasks().getFirst().id();

        LocalDate tomorrow = today.plusDays(1);
        rest.exchange("/api/v1/tasks/" + toMove + "/reschedule", HttpMethod.POST,
                new HttpEntity<>(Map.of("dueDate", tomorrow.toString()), headers()),
                TaskResponse.class);

        assertThat(day(null).tasks()).hasSize(1);
        assertThat(day(null).progress().planned()).isEqualTo(1);

        DayResponse next = day(tomorrow);
        assertThat(next.tasks()).singleElement()
                .satisfies(task -> assertThat(task.title()).isEqualTo("Write daily note"));
        assertThat(next.progress().planned()).isEqualTo(1);
    }

    @Test
    void oneUsersDayNeverContainsAnothersWork() {
        createTask("Private task", today);
        rest.exchange("/api/v1/notes", HttpMethod.POST,
                new HttpEntity<>(new NoteRequest(null, "Private note", today, null, null, null), headers()),
                NoteResponse.class);

        token = register("intruder-" + UUID.randomUUID() + "@example.com");

        DayResponse theirs = day(null);
        assertThat(theirs.tasks()).isEmpty();
        assertThat(theirs.note()).isNull();
        assertThat(theirs.progress().planned()).isZero();
    }

    // ------------------------------------------------------------ helpers ---

    private String register(String email) {
        ResponseEntity<AuthResponse> response = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest(email, "correct-horse-battery", "Ada", null), AuthResponse.class);
        assertThat(response.getBody()).isNotNull();
        return response.getBody().accessToken();
    }

    private DayResponse day(LocalDate date) {
        String url = "/api/v1/planner/day" + (date == null ? "" : "?date=" + date);
        ResponseEntity<DayResponse> response =
                rest.exchange(url, HttpMethod.GET, new HttpEntity<>(headers()), DayResponse.class);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private DailyReviewResponse saveReview(DailyReviewRequest request) {
        ResponseEntity<DailyReviewResponse> response = rest.exchange("/api/v1/reviews/" + today,
                HttpMethod.PUT, new HttpEntity<>(request, headers()), DailyReviewResponse.class);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private void createTask(String title, LocalDate dueDate) {
        rest.exchange("/api/v1/tasks", HttpMethod.POST,
                new HttpEntity<>(new TaskRequest(title, null, null, null, dueDate, null, null, null), headers()),
                TaskResponse.class);
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
