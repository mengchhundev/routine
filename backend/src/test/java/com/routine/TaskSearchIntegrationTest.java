package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.RegisterRequest;
import com.routine.task.TaskPriority;
import com.routine.task.dto.TaskRequest;
import com.routine.task.dto.TaskResponse;
import java.time.LocalDate;
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
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

/**
 * The Tasks screen asks about a whole account rather than one day: what is
 * late, what is coming, what has no date yet, what is finished.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class TaskSearchIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String token;
    /** The account registers without a timezone, so its local day is UTC's. */
    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    @BeforeEach
    void signUp() {
        token = register("search-" + UUID.randomUUID() + "@example.com");
    }

    @Test
    void scopesSliceTheAccountByTheQuestionBeingAsked() {
        create("Late thing", today.minusDays(2), TaskPriority.HIGH);
        create("Today thing", today, TaskPriority.MEDIUM);
        create("Future thing", today.plusDays(3), TaskPriority.LOW);
        create("Someday thing", null, TaskPriority.LOW);

        assertThat(titles("?scope=ALL")).hasSize(4);
        assertThat(titles("?scope=OVERDUE")).containsExactly("Late thing");
        // Today counts as upcoming: it has not passed, so it still needs doing.
        assertThat(titles("?scope=UPCOMING")).containsExactly("Today thing", "Future thing");
        assertThat(titles("?scope=BACKLOG")).containsExactly("Someday thing");
    }

    @Test
    void datedTasksSortByDayAndUndatedOnesComeLast() {
        create("Someday thing", null, TaskPriority.LOW);
        create("Future thing", today.plusDays(3), TaskPriority.LOW);
        create("Today thing", today, TaskPriority.LOW);

        // A backlog item above tomorrow's plan would bury the plan under the
        // wish list, whichever order they were created in.
        assertThat(titles("?scope=ALL"))
                .containsExactly("Today thing", "Future thing", "Someday thing");
    }

    @Test
    void finishingATaskMovesItOutOfTheOpenScopesAndIntoDone() {
        TaskResponse task = create("Today thing", today, TaskPriority.MEDIUM);

        assertThat(titles("?scope=UPCOMING")).containsExactly("Today thing");
        assertThat(titles("?scope=DONE")).isEmpty();

        rest.exchange("/api/v1/tasks/" + task.id() + "/complete", HttpMethod.POST,
                new HttpEntity<>(headers()), TaskResponse.class);

        assertThat(titles("?scope=UPCOMING")).isEmpty();
        assertThat(titles("?scope=DONE")).containsExactly("Today thing");
    }

    @Test
    void anExplicitStatusOverridesTheScopesOwnIdeaOfOpen() {
        TaskResponse late = create("Late thing", today.minusDays(2), TaskPriority.HIGH);
        rest.exchange("/api/v1/tasks/" + late.id() + "/skip", HttpMethod.POST,
                new HttpEntity<>(headers()), TaskResponse.class);

        // Overdue alone means "still to do", so a skipped task has left it.
        assertThat(titles("?scope=OVERDUE")).isEmpty();
        // But asking for it by name is a fair question, and the two filters
        // must not cancel each other out.
        assertThat(titles("?scope=OVERDUE&status=SKIPPED")).containsExactly("Late thing");
    }

    @Test
    void searchMatchesAnyPartOfTheTitleRegardlessOfCase() {
        create("Study Kubernetes", today, TaskPriority.MEDIUM);
        create("Read 20 pages", today, TaskPriority.MEDIUM);

        assertThat(titles("?q=kubernetes")).containsExactly("Study Kubernetes");
        assertThat(titles("?q=PAGES")).containsExactly("Read 20 pages");
        assertThat(titles("?q=nothing here")).isEmpty();
    }

    @Test
    void priorityNarrowsWithinTheScopeRatherThanReplacingIt() {
        create("Late and urgent", today.minusDays(1), TaskPriority.HIGH);
        create("Late and not", today.minusDays(1), TaskPriority.LOW);
        create("Upcoming and urgent", today.plusDays(1), TaskPriority.HIGH);

        assertThat(titles("?scope=OVERDUE&priority=HIGH")).containsExactly("Late and urgent");
    }

    @Test
    void aFilteredListNeverReachesIntoAnotherAccount() {
        create("Mine", today, TaskPriority.MEDIUM);

        token = register("other-" + UUID.randomUUID() + "@example.com");

        assertThat(titles("?scope=ALL")).isEmpty();
    }

    @Test
    void askingWithNoFiltersStillMeansToday() {
        create("Today thing", today, TaskPriority.MEDIUM);
        create("Future thing", today.plusDays(3), TaskPriority.MEDIUM);

        // The day view is what every other screen depends on; adding scopes
        // must not have changed what a bare list means.
        assertThat(titles("")).containsExactly("Today thing");
    }

    // ------------------------------------------------------------ helpers ---

    private List<String> titles(String query) {
        ResponseEntity<List<TaskResponse>> response = rest.exchange("/api/v1/tasks" + query,
                HttpMethod.GET, new HttpEntity<>(headers()), new ParameterizedTypeReference<>() {});
        assertThat(response.getBody()).isNotNull();
        return response.getBody().stream().map(TaskResponse::title).toList();
    }

    private TaskResponse create(String title, LocalDate dueDate, TaskPriority priority) {
        ResponseEntity<TaskResponse> response = rest.exchange("/api/v1/tasks", HttpMethod.POST,
                new HttpEntity<>(new TaskRequest(title, null, null, priority, dueDate, null, null, null),
                        headers()),
                TaskResponse.class);
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
