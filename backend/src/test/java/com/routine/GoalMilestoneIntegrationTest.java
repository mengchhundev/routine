package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.RegisterRequest;
import com.routine.goal.GoalRequest;
import com.routine.goal.GoalResponse;
import com.routine.goal.MilestoneRequest;
import com.routine.goal.MilestoneResponse;
import com.routine.goal.MilestoneStatus;
import com.routine.goal.ProgressSource;
import java.time.LocalDate;
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
 * Milestones exist to turn "38%" from a number the user typed into one the
 * product can defend. These tests are mostly about that switchover.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class GoalMilestoneIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String token;

    @BeforeEach
    void signUp() {
        ResponseEntity<AuthResponse> registered = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest("goal-" + UUID.randomUUID() + "@example.com",
                        "correct-horse-battery", "Ada", null),
                AuthResponse.class);
        assertThat(registered.getBody()).isNotNull();
        token = registered.getBody().accessToken();
    }

    @Test
    void aGoalWithoutMilestonesKeepsTheProgressTheUserTyped() {
        GoalResponse goal = createGoal("Become a Senior DevOps Engineer", (short) 40);

        assertThat(goal.progress()).isEqualTo((short) 40);
        assertThat(goal.progressSource()).isEqualTo(ProgressSource.MANUAL);
        assertThat(goal.milestoneCount()).isZero();
    }

    @Test
    void addingMilestonesTakesOverTheGoalsPercentage() {
        GoalResponse goal = createGoal("Become a Senior DevOps Engineer", (short) 40);

        addMilestone(goal.id(), "Linux");
        addMilestone(goal.id(), "Kubernetes");
        MilestoneResponse cloud = addMilestone(goal.id(), "Cloud");

        GoalResponse withMilestones = read(goal.id());
        assertThat(withMilestones.progressSource()).isEqualTo(ProgressSource.MILESTONES);
        assertThat(withMilestones.progress()).isZero();
        // The typed number is kept, not overwritten: deleting the milestones
        // must not lose what the user said before they existed.
        assertThat(withMilestones.manualProgress()).isEqualTo((short) 40);

        setStatus(goal.id(), cloud.id(), MilestoneStatus.COMPLETED);

        GoalResponse afterOne = read(goal.id());
        assertThat(afterOne.progress()).isEqualTo((short) 33);
        assertThat(afterOne.completedMilestones()).isEqualTo(1);
    }

    @Test
    void aSkippedMilestoneLeavesTheAverageRatherThanScoringZero() {
        GoalResponse goal = createGoal("Learn Spanish", (short) 0);

        MilestoneResponse first = addMilestone(goal.id(), "A1");
        MilestoneResponse second = addMilestone(goal.id(), "A2");
        MilestoneResponse third = addMilestone(goal.id(), "Conversation club");

        setStatus(goal.id(), first.id(), MilestoneStatus.COMPLETED);
        setStatus(goal.id(), second.id(), MilestoneStatus.SKIPPED);

        // One of two counted milestones is done — 50%, not 33%. Deciding you do
        // not need a step is a change of plan, not a failure.
        assertThat(read(goal.id()).progress()).isEqualTo((short) 50);
        assertThat(third.status()).isEqualTo(MilestoneStatus.PENDING);
    }

    @Test
    void partialProgressOnAMilestoneCounts() {
        GoalResponse goal = createGoal("Run a marathon", (short) 0);

        MilestoneResponse half = addMilestone(goal.id(), "Half marathon");
        rest.exchange("/api/v1/goals/" + goal.id() + "/milestones/" + half.id(), HttpMethod.PUT,
                new HttpEntity<>(new MilestoneRequest("Half marathon", null, null, null,
                        MilestoneStatus.IN_PROGRESS, (short) 60, null), headers()),
                MilestoneResponse.class);

        assertThat(read(goal.id()).progress()).isEqualTo((short) 60);
    }

    @Test
    void deletingEveryMilestoneReturnsTheGoalToItsManualNumber() {
        GoalResponse goal = createGoal("Read 24 books", (short) 25);
        MilestoneResponse only = addMilestone(goal.id(), "First twelve");

        assertThat(read(goal.id()).progressSource()).isEqualTo(ProgressSource.MILESTONES);

        rest.exchange("/api/v1/goals/" + goal.id() + "/milestones/" + only.id(), HttpMethod.DELETE,
                new HttpEntity<>(headers()), Void.class);

        GoalResponse restored = read(goal.id());
        assertThat(restored.progressSource()).isEqualTo(ProgressSource.MANUAL);
        assertThat(restored.progress()).isEqualTo((short) 25);
    }

    @Test
    void reorderingRewritesEveryIndex() {
        GoalResponse goal = createGoal("Become a Senior DevOps Engineer", (short) 0);
        MilestoneResponse linux = addMilestone(goal.id(), "Linux");
        MilestoneResponse kubernetes = addMilestone(goal.id(), "Kubernetes");
        MilestoneResponse cloud = addMilestone(goal.id(), "Cloud");

        ResponseEntity<List<MilestoneResponse>> reordered = rest.exchange(
                "/api/v1/goals/" + goal.id() + "/milestones/order", HttpMethod.POST,
                new HttpEntity<>(new Order(null, List.of(cloud.id(), linux.id(), kubernetes.id())), headers()),
                new ParameterizedTypeReference<>() {});

        assertThat(reordered.getBody()).extracting(MilestoneResponse::title)
                .containsExactly("Cloud", "Linux", "Kubernetes");
        assertThat(reordered.getBody()).extracting(MilestoneResponse::orderIndex)
                .containsExactly(0, 1, 2);
    }

    @Test
    void anotherUsersGoalIsNotFound() {
        GoalResponse mine = createGoal("Private", (short) 0);

        ResponseEntity<AuthResponse> other = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest("other-" + UUID.randomUUID() + "@example.com",
                        "correct-horse-battery", "Bob", null),
                AuthResponse.class);
        assertThat(other.getBody()).isNotNull();

        HttpHeaders theirs = new HttpHeaders();
        theirs.setBearerAuth(other.getBody().accessToken());

        ResponseEntity<String> attempt = rest.exchange(
                "/api/v1/goals/" + mine.id() + "/milestones", HttpMethod.GET,
                new HttpEntity<>(theirs), String.class);

        assertThat(attempt.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }


    @Test
    void aMilestoneCarriesASpanAndADescription() {
        GoalResponse goal = createGoal("Become a Senior DevOps Engineer", (short) 0);

        ResponseEntity<MilestoneResponse> created = rest.exchange(
                "/api/v1/goals/" + goal.id() + "/milestones", HttpMethod.POST,
                new HttpEntity<>(new MilestoneRequest(
                        "Deep understanding of Linux",
                        "Foundation to advanced: filesystems, processes, networking.",
                        LocalDate.of(2026, 1, 1),
                        LocalDate.of(2026, 9, 30),
                        null, null, null), headers()),
                MilestoneResponse.class);

        assertThat(created.getBody()).isNotNull();
        assertThat(created.getBody().startDate()).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(created.getBody().targetDate()).isEqualTo(LocalDate.of(2026, 9, 30));
        assertThat(created.getBody().description()).startsWith("Foundation to advanced");
    }

    @Test
    void aSpanThatEndsBeforeItStartsIsRejectedWithASentence() {
        GoalResponse goal = createGoal("Learn Spanish", (short) 0);

        ResponseEntity<String> reversed = rest.exchange(
                "/api/v1/goals/" + goal.id() + "/milestones", HttpMethod.POST,
                new HttpEntity<>(new MilestoneRequest("A1", null,
                        LocalDate.of(2026, 9, 1), LocalDate.of(2026, 1, 1),
                        null, null, null), headers()),
                String.class);

        assertThat(reversed.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(reversed.getBody()).contains("MILESTONE_DATES_REVERSED");
    }

    @Test
    void subMilestonesAreNestedUnderTheirParentAndDecideItsProgress() {
        GoalResponse goal = createGoal("Become a Senior DevOps Engineer", (short) 0);
        MilestoneResponse linux = addMilestone(goal.id(), "Linux");
        MilestoneResponse cloud = addMilestone(goal.id(), "Cloud");

        MilestoneResponse filesystems = addChild(goal.id(), linux.id(), "Filesystems");
        addChild(goal.id(), linux.id(), "Networking");

        setStatus(goal.id(), filesystems.id(), MilestoneStatus.COMPLETED);

        GoalResponse read = read(goal.id());

        // The top level is two milestones, not four: breaking one down must not
        // change what the goal says it is made of.
        assertThat(read.milestoneCount()).isEqualTo(2);
        assertThat(read.milestones()).extracting(MilestoneResponse::title)
                .containsExactly("Linux", "Cloud");

        MilestoneResponse parent = read.milestones().getFirst();
        assertThat(parent.children()).extracting(MilestoneResponse::title)
                .containsExactly("Filesystems", "Networking");
        assertThat(parent.childCount()).isEqualTo(2);
        assertThat(parent.completedChildren()).isEqualTo(1);
        assertThat(parent.progress()).isEqualTo((short) 50);
        assertThat(parent.progressSource()).isEqualTo(ProgressSource.MILESTONES);

        // Linux is half done, Cloud is not started: the goal is 25%, not the
        // 33% a flat count of three finished-out-of-four would produce.
        assertThat(read.progress()).isEqualTo((short) 25);
        assertThat(cloud.children()).isEmpty();
    }

    @Test
    void completingAParentOutrightCountsWhateverIsStillListedUnderIt() {
        GoalResponse goal = createGoal("Become a Senior DevOps Engineer", (short) 0);
        MilestoneResponse linux = addMilestone(goal.id(), "Linux");
        addChild(goal.id(), linux.id(), "Filesystems");
        addChild(goal.id(), linux.id(), "Networking");

        setStatus(goal.id(), linux.id(), MilestoneStatus.COMPLETED);

        // Ticking the parent is a deliberate "this is done" — the goal takes it.
        assertThat(read(goal.id()).progress()).isEqualTo((short) 100);
    }

    @Test
    void nestingStopsAtOneLevel() {
        GoalResponse goal = createGoal("Become a Senior DevOps Engineer", (short) 0);
        MilestoneResponse linux = addMilestone(goal.id(), "Linux");
        MilestoneResponse filesystems = addChild(goal.id(), linux.id(), "Filesystems");

        ResponseEntity<String> tooDeep = rest.exchange(
                "/api/v1/goals/" + goal.id() + "/milestones", HttpMethod.POST,
                new HttpEntity<>(new MilestoneRequest("ext4", null, null, null, null, null,
                        filesystems.id()), headers()),
                String.class);

        assertThat(tooDeep.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(tooDeep.getBody()).contains("MILESTONE_NESTING_TOO_DEEP");
    }

    @Test
    void deletingAMilestoneTakesItsSubMilestonesWithIt() {
        GoalResponse goal = createGoal("Become a Senior DevOps Engineer", (short) 0);
        MilestoneResponse linux = addMilestone(goal.id(), "Linux");
        addChild(goal.id(), linux.id(), "Filesystems");

        rest.exchange("/api/v1/goals/" + goal.id() + "/milestones/" + linux.id(), HttpMethod.DELETE,
                new HttpEntity<>(headers()), Void.class);

        assertThat(read(goal.id()).milestones()).isEmpty();
        assertThat(read(goal.id()).progressSource()).isEqualTo(ProgressSource.MANUAL);
    }

    @Test
    void eachLevelIsOrderedIndependently() {
        GoalResponse goal = createGoal("Become a Senior DevOps Engineer", (short) 0);
        MilestoneResponse linux = addMilestone(goal.id(), "Linux");
        MilestoneResponse cloud = addMilestone(goal.id(), "Cloud");

        MilestoneResponse first = addChild(goal.id(), linux.id(), "Filesystems");
        MilestoneResponse second = addChild(goal.id(), linux.id(), "Networking");

        // Reordering inside Linux must not disturb the goal's own two steps.
        rest.exchange("/api/v1/goals/" + goal.id() + "/milestones/order", HttpMethod.POST,
                new HttpEntity<>(new Order(linux.id(), List.of(second.id(), first.id())), headers()),
                new ParameterizedTypeReference<List<MilestoneResponse>>() {});

        GoalResponse read = read(goal.id());
        assertThat(read.milestones()).extracting(MilestoneResponse::title)
                .containsExactly("Linux", "Cloud");
        assertThat(read.milestones().getFirst().children()).extracting(MilestoneResponse::title)
                .containsExactly("Networking", "Filesystems");
        assertThat(cloud.orderIndex()).isEqualTo(1);
    }

    // ---------------------------------------------------------------- helpers

    private record Order(UUID parentId, List<UUID> order) {}

    private record Status(MilestoneStatus status) {}

    private GoalResponse createGoal(String title, short progress) {
        ResponseEntity<GoalResponse> created = rest.exchange("/api/v1/goals", HttpMethod.POST,
                new HttpEntity<>(new GoalRequest(title, null, null, null, null, null, progress), headers()),
                GoalResponse.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();
        return created.getBody();
    }

    private MilestoneResponse addChild(UUID goalId, UUID parentId, String title) {
        ResponseEntity<MilestoneResponse> created = rest.exchange(
                "/api/v1/goals/" + goalId + "/milestones", HttpMethod.POST,
                new HttpEntity<>(new MilestoneRequest(title, null, null, null, null, null, parentId),
                        headers()),
                MilestoneResponse.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();
        return created.getBody();
    }

    private MilestoneResponse addMilestone(UUID goalId, String title) {
        ResponseEntity<MilestoneResponse> created = rest.exchange(
                "/api/v1/goals/" + goalId + "/milestones", HttpMethod.POST,
                new HttpEntity<>(new MilestoneRequest(title, null, null, null, null, null, null), headers()),
                MilestoneResponse.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();
        return created.getBody();
    }

    private void setStatus(UUID goalId, UUID milestoneId, MilestoneStatus status) {
        rest.exchange("/api/v1/goals/" + goalId + "/milestones/" + milestoneId + "/status",
                HttpMethod.POST, new HttpEntity<>(new Status(status), headers()),
                MilestoneResponse.class);
    }

    private GoalResponse read(UUID goalId) {
        ResponseEntity<GoalResponse> goal = rest.exchange("/api/v1/goals/" + goalId, HttpMethod.GET,
                new HttpEntity<>(headers()), GoalResponse.class);
        assertThat(goal.getBody()).isNotNull();
        return goal.getBody();
    }

    private HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return headers;
    }
}
