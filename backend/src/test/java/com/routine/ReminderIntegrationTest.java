package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.RegisterRequest;
import com.routine.reminder.ReminderChannel;
import com.routine.reminder.ReminderDispatcher;
import com.routine.reminder.ReminderStatus;
import com.routine.reminder.dto.NotificationResponse;
import com.routine.reminder.dto.ReminderRequest;
import com.routine.reminder.dto.ReminderResponse;
import com.routine.task.dto.TaskRequest;
import com.routine.task.dto.TaskResponse;
import com.routine.user.dto.UpdateSettingsRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
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
 * The scheduled poll is off in the test profile (see application-test.yml); the
 * dispatcher is driven directly so a tick cannot land mid-arrangement.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ReminderIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private ReminderDispatcher dispatcher;

    private String token;
    /** The account registers without a timezone, so its local day is UTC's. */
    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    @BeforeEach
    void signUp() {
        ResponseEntity<AuthResponse> registered = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest("remind-" + UUID.randomUUID() + "@example.com",
                        "correct-horse-battery", "Ada", null),
                AuthResponse.class);
        assertThat(registered.getBody()).isNotNull();
        token = registered.getBody().accessToken();
    }

    @Test
    void aReminderIsScheduledInTheUsersOwnWallClock() {
        ReminderResponse reminder = create(new ReminderRequest(
                LocalDateTime.of(today.plusDays(1), LocalTime.of(6, 30)),
                "Morning routine", ReminderChannel.IN_APP, null, null, null));

        assertThat(reminder.status()).isEqualTo(ReminderStatus.PENDING);
        assertThat(reminder.remindAtLocal()).isEqualTo(LocalDateTime.of(today.plusDays(1), LocalTime.of(6, 30)));
        assertThat(reminder.timezone()).isEqualTo("UTC");
        assertThat(list("UPCOMING")).extracting(ReminderResponse::id).containsExactly(reminder.id());
    }

    @Test
    void aReminderAboutATaskCarriesThatTasksTitle() {
        TaskResponse task = createTask("Study Kubernetes");

        ReminderResponse reminder = create(new ReminderRequest(
                LocalDateTime.of(today.plusDays(1), LocalTime.of(19, 0)),
                null, ReminderChannel.IN_APP, task.id(), null, null));

        assertThat(reminder.subject()).isNotNull();
        assertThat(reminder.subject().type()).isEqualTo("TASK");
        assertThat(reminder.subject().title()).isEqualTo("Study Kubernetes");
    }

    @Test
    void aDueReminderIsDeliveredOnceAndRecorded() {
        create(new ReminderRequest(LocalDateTime.now(ZoneOffset.UTC).minusMinutes(1),
                "Daily review", ReminderChannel.IN_APP, null, null, null));

        assertThat(dispatcher.dispatchDue()).isEqualTo(1);
        // The second pass has nothing left to claim: the reminder is no longer
        // pending, which is what makes the poll safe to run every minute.
        assertThat(dispatcher.dispatchDue()).isZero();

        ReminderResponse sent = list("PAST").getFirst();
        assertThat(sent.status()).isEqualTo(ReminderStatus.SENT);
        assertThat(sent.sentAt()).isNotNull();
        assertThat(sent.attempts()).isEqualTo((short) 1);

        List<NotificationResponse> history = history();
        assertThat(history).hasSize(1);
        assertThat(history.getFirst().outcome()).isEqualTo("SENT");
    }

    @Test
    void aReminderTooLateToActOnIsRecordedAsMissedRatherThanSent() {
        // Well past the six-hour grace window: waking someone at midnight about
        // this morning's workout is worse than staying quiet.
        create(new ReminderRequest(LocalDateTime.now(ZoneOffset.UTC).minusDays(2),
                "Morning workout", ReminderChannel.IN_APP, null, null, null));

        assertThat(dispatcher.dispatchDue()).isZero();

        ReminderResponse missed = list("PAST").getFirst();
        assertThat(missed.status()).isEqualTo(ReminderStatus.CANCELLED);
        assertThat(missed.lastError()).contains("Missed its window");
        assertThat(history()).isEmpty();
    }

    @Test
    void remindersSwitchedOffInSettingsAreNotDelivered() {
        rest.exchange("/api/v1/users/me/settings", HttpMethod.PUT,
                new HttpEntity<>(new UpdateSettingsRequest(false, false,
                        LocalTime.of(21, 30), (short) 1, "system"), headers()),
                String.class);

        create(new ReminderRequest(LocalDateTime.now(ZoneOffset.UTC).minusMinutes(1),
                "Daily review", ReminderChannel.IN_APP, null, null, null));

        assertThat(dispatcher.dispatchDue()).isZero();
        assertThat(list("PAST").getFirst().status()).isEqualTo(ReminderStatus.CANCELLED);
    }

    @Test
    void cancellingKeepsTheRecordAndStopsTheReminderFiring() {
        ReminderResponse reminder = create(new ReminderRequest(
                LocalDateTime.now(ZoneOffset.UTC).minusMinutes(1),
                "Daily review", ReminderChannel.IN_APP, null, null, null));

        rest.exchange("/api/v1/reminders/" + reminder.id() + "/cancel", HttpMethod.POST,
                new HttpEntity<>(headers()), ReminderResponse.class);

        assertThat(dispatcher.dispatchDue()).isZero();
        assertThat(list("PAST")).extracting(ReminderResponse::status)
                .containsExactly(ReminderStatus.CANCELLED);
    }

    @Test
    void aReminderMustSayOrPointAtSomething() {
        ResponseEntity<String> empty = rest.exchange("/api/v1/reminders", HttpMethod.POST,
                new HttpEntity<>(new ReminderRequest(LocalDateTime.of(today.plusDays(1), LocalTime.NOON),
                        null, null, null, null, null), headers()),
                String.class);

        assertThat(empty.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(empty.getBody()).contains("REMINDER_EMPTY");
    }

    @Test
    void aReminderCannotBeAboutTwoThingsAtOnce() {
        TaskResponse task = createTask("Study Kubernetes");

        ResponseEntity<String> ambiguous = rest.exchange("/api/v1/reminders", HttpMethod.POST,
                new HttpEntity<>(new ReminderRequest(LocalDateTime.of(today.plusDays(1), LocalTime.NOON),
                        null, null, task.id(), UUID.randomUUID(), null), headers()),
                String.class);

        assertThat(ambiguous.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(ambiguous.getBody()).contains("REMINDER_SUBJECT_AMBIGUOUS");
    }

    @Test
    void aReminderForSomebodyElsesTaskIsNotFound() {
        ResponseEntity<String> attempt = rest.exchange("/api/v1/reminders", HttpMethod.POST,
                new HttpEntity<>(new ReminderRequest(LocalDateTime.of(today.plusDays(1), LocalTime.NOON),
                        null, null, UUID.randomUUID(), null, null), headers()),
                String.class);

        assertThat(attempt.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ---------------------------------------------------------------- helpers

    private ReminderResponse create(ReminderRequest request) {
        ResponseEntity<ReminderResponse> created = rest.exchange("/api/v1/reminders", HttpMethod.POST,
                new HttpEntity<>(request, headers()), ReminderResponse.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();
        return created.getBody();
    }

    private TaskResponse createTask(String title) {
        ResponseEntity<TaskResponse> created = rest.exchange("/api/v1/tasks", HttpMethod.POST,
                new HttpEntity<>(new TaskRequest(title, null, null, null, today, null, null, null), headers()),
                TaskResponse.class);
        assertThat(created.getBody()).isNotNull();
        return created.getBody();
    }

    private List<ReminderResponse> list(String scope) {
        ResponseEntity<List<ReminderResponse>> found = rest.exchange(
                "/api/v1/reminders?scope=" + scope, HttpMethod.GET,
                new HttpEntity<>(headers()), new ParameterizedTypeReference<>() {});
        assertThat(found.getBody()).isNotNull();
        return found.getBody();
    }

    private List<NotificationResponse> history() {
        ResponseEntity<List<NotificationResponse>> found = rest.exchange(
                "/api/v1/reminders/history", HttpMethod.GET,
                new HttpEntity<>(headers()), new ParameterizedTypeReference<>() {});
        assertThat(found.getBody()).isNotNull();
        return found.getBody();
    }

    private HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return headers;
    }
}
