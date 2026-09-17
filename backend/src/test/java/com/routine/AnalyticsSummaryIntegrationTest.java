package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.analytics.SummaryResponse;
import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.RegisterRequest;
import com.routine.task.dto.TaskRequest;
import com.routine.task.dto.TaskResponse;
import java.time.LocalDate;
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
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AnalyticsSummaryIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String token;
    /** The account registers without a timezone, so its local day is UTC's. */
    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    @BeforeEach
    void signUp() {
        ResponseEntity<AuthResponse> registered = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest("stats-" + UUID.randomUUID() + "@example.com",
                        "correct-horse-battery", "Ada", null),
                AuthResponse.class);
        assertThat(registered.getBody()).isNotNull();
        token = registered.getBody().accessToken();
    }

    @Test
    void anEmptyAccountReportsAnEmptyWindowRatherThanZeroPercent() {
        SummaryResponse summary = summary(null);

        assertThat(summary.dayCount()).isEqualTo(30);
        assertThat(summary.days()).hasSize(30);
        assertThat(summary.days().getLast().date()).isEqualTo(today);
        assertThat(summary.total().planned()).isZero();
        assertThat(summary.total().percent()).isZero();
        assertThat(summary.categories()).isEmpty();
        assertThat(summary.routines()).isEmpty();
        // Seven weekday rows always, so the chart has a shape before there is data.
        assertThat(summary.weekdays()).hasSize(7);
    }

    @Test
    void theWindowIsClampedRatherThanScanningWhateverTheUrlAsksFor() {
        assertThat(summary(1).dayCount()).isEqualTo(7);
        assertThat(summary(5000).dayCount()).isEqualTo(365);
    }

    @Test
    void effortIsGroupedByCategoryWithUntaggedWorkKeptVisible() {
        complete(createTask("Kubernetes study", "Learning", today).id());
        createTask("Cloud lab", "Learning", today);
        createTask("Dentist", null, today);

        SummaryResponse summary = summary(null);

        assertThat(summary.categories()).extracting(SummaryResponse.Slice::label)
                .containsExactly("Learning", "Uncategorised");

        SummaryResponse.Slice learning = summary.categories().getFirst();
        assertThat(learning.planned()).isEqualTo(2);
        assertThat(learning.completed()).isEqualTo(1);
        assertThat(learning.percent()).isEqualTo(50);

        assertThat(summary.total().planned()).isEqualTo(3);
        assertThat(summary.currentStreak()).isEqualTo(1);
        assertThat(summary.longestStreak()).isEqualTo(1);
    }

    @Test
    void workThatWasPlannedAndNeverHappenedIsCounted() {
        // Backdated: a task due yesterday and still open is the missed count.
        createTask("Yesterday's run", null, today.minusDays(1));
        createTask("Today's run", null, today);

        SummaryResponse summary = summary(null);

        assertThat(summary.missedTaskCount()).isEqualTo(1);
        // Today is not missed until it is over.
        assertThat(summary.total().planned()).isEqualTo(2);
    }

    // ---------------------------------------------------------------- helpers

    private SummaryResponse summary(Integer days) {
        ResponseEntity<SummaryResponse> response = rest.exchange(
                "/api/v1/analytics/summary" + (days == null ? "" : "?days=" + days),
                HttpMethod.GET, new HttpEntity<>(headers()), SummaryResponse.class);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private TaskResponse createTask(String title, String category, LocalDate dueDate) {
        ResponseEntity<TaskResponse> created = rest.exchange("/api/v1/tasks", HttpMethod.POST,
                new HttpEntity<>(new TaskRequest(title, null, category, null, dueDate, null, null, null),
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
