package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.analytics.DashboardResponse;
import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.RegisterRequest;
import com.routine.goal.GoalRequest;
import com.routine.goal.GoalResponse;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")  // datasource and signing key: see application-test.yml
class DashboardIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String token;
    /** The account registers without a timezone, so its local day is UTC's. */
    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    @BeforeEach
    void signUp() {
        ResponseEntity<AuthResponse> registered = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest("dash-" + UUID.randomUUID() + "@example.com",
                        "correct-horse-battery", "Ada", null),
                AuthResponse.class);
        assertThat(registered.getBody()).isNotNull();
        token = registered.getBody().accessToken();
    }

    @Test
    void anEmptyDashboardReportsNothingRatherThanZeroPercent() {
        DashboardResponse dashboard = dashboard();

        assertThat(dashboard.today().planned()).isZero();
        assertThat(dashboard.today().percent()).isZero();
        assertThat(dashboard.streakDays()).isZero();
        assertThat(dashboard.todayTasks()).isEmpty();
        assertThat(dashboard.week().days()).hasSize(7);
        assertThat(dashboard.week().days().getLast().date()).isEqualTo(today);
    }

    @Test
    void completingTasksMovesTodaysRateAndStartsAStreak() {
        createTask("Morning workout", today);
        createTask("Read 20 pages", today);

        DashboardResponse planned = dashboard();
        assertThat(planned.today().planned()).isEqualTo(2);
        assertThat(planned.today().percent()).isZero();
        assertThat(planned.streakDays()).isZero();

        complete(planned.todayTasks().getFirst().id());

        DashboardResponse afterOne = dashboard();
        assertThat(afterOne.today().completed()).isEqualTo(1);
        assertThat(afterOne.today().percent()).isEqualTo(50);
        assertThat(afterOne.streakDays()).isEqualTo(1);
        assertThat(afterOne.openTaskCount()).isEqualTo(1);
    }

    /**
     * The regression that motivated counting by due date: ticking off a task
     * that was planned for an earlier day used to land on today's tally, which
     * could push a day above 100% — a rate that is not a rate.
     */
    @Test
    void completingAnOverdueTaskCreditsTheDayItWasPlannedFor() {
        LocalDate yesterday = today.minusDays(1);
        createTask("Yesterday's run", yesterday);
        createTask("Today's reading", today);

        TaskResponse overdue = rest.exchange("/api/v1/tasks?date=" + yesterday, HttpMethod.GET,
                authorized(), TaskResponse[].class).getBody()[0];
        complete(overdue.id());

        DashboardResponse dashboard = dashboard();

        assertThat(dashboard.today().planned()).isEqualTo(1);
        assertThat(dashboard.today().completed()).isZero();
        assertThat(dashboard.today().percent()).isZero();

        DashboardResponse.Day yesterdayRow = dashboard.week().days().stream()
                .filter(day -> day.date().equals(yesterday))
                .findFirst()
                .orElseThrow();
        assertThat(yesterdayRow.completed()).isEqualTo(1);
        assertThat(yesterdayRow.percent()).isEqualTo(100);

        // No day may ever exceed a full rate, whatever order things were ticked.
        assertThat(dashboard.week().days()).allSatisfy(day ->
                assertThat(day.percent()).isBetween(0, 100));
    }

    @Test
    void reopeningATaskWithdrawsItsCompletion() {
        createTask("Write daily note", today);
        TaskResponse task = dashboard().todayTasks().getFirst();

        complete(task.id());
        assertThat(dashboard().today().percent()).isEqualTo(100);

        rest.exchange("/api/v1/tasks/" + task.id() + "/reopen", HttpMethod.POST,
                authorized(), TaskResponse.class);

        DashboardResponse reopened = dashboard();
        assertThat(reopened.today().completed()).isZero();
        assertThat(reopened.today().percent()).isZero();
        assertThat(reopened.streakDays()).isZero();
    }

    @Test
    void activeGoalsAppearOnTheDashboard() {
        rest.exchange("/api/v1/goals", HttpMethod.POST,
                new HttpEntity<>(new GoalRequest("Become Senior DevOps Engineer", null, "Career",
                        null, LocalDate.of(2029, 3, 1), null, (short) 38), headers()),
                GoalResponse.class);

        assertThat(dashboard().activeGoals())
                .singleElement()
                .satisfies(goal -> {
                    assertThat(goal.title()).isEqualTo("Become Senior DevOps Engineer");
                    assertThat(goal.progress()).isEqualTo((short) 38);
                });
    }

    @Test
    void oneUserNeverSeesAnotherUsersTask() {
        createTask("Private task", today);
        UUID taskId = dashboard().todayTasks().getFirst().id();

        // A second account, with a valid token of its own, guessing the id.
        ResponseEntity<AuthResponse> intruder = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest("intruder-" + UUID.randomUUID() + "@example.com",
                        "correct-horse-battery", "Mallory", null),
                AuthResponse.class);
        assertThat(intruder.getBody()).isNotNull();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(intruder.getBody().accessToken());

        ResponseEntity<String> response = rest.exchange("/api/v1/tasks/" + taskId, HttpMethod.GET,
                new HttpEntity<>(headers), String.class);

        // Not found, not forbidden: the answer must not confirm the id exists.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    private void createTask(String title, LocalDate dueDate) {
        ResponseEntity<TaskResponse> created = rest.exchange("/api/v1/tasks", HttpMethod.POST,
                new HttpEntity<>(new TaskRequest(title, null, null, null, dueDate, null, null, null), headers()),
                TaskResponse.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    private void complete(UUID taskId) {
        rest.exchange("/api/v1/tasks/" + taskId + "/complete", HttpMethod.POST,
                authorized(), TaskResponse.class);
    }

    private DashboardResponse dashboard() {
        ResponseEntity<DashboardResponse> response = rest.exchange("/api/v1/analytics/dashboard",
                HttpMethod.GET, authorized(), DashboardResponse.class);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return headers;
    }

    private HttpEntity<Void> authorized() {
        return new HttpEntity<>(headers());
    }
}
