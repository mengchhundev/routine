package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.LoginRequest;
import com.routine.auth.dto.RefreshRequest;
import com.routine.auth.dto.RegisterRequest;
import com.routine.common.ApiError;
import com.routine.user.dto.UserResponse;
import java.util.UUID;
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
class AuthFlowIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    @Test
    void registersThenReadsOwnProfile() {
        String email = uniqueEmail();

        ResponseEntity<AuthResponse> registered = rest.postForEntity(
                "/api/v1/auth/register",
                new RegisterRequest(email, "correct-horse-battery", "Ada Lovelace", "Europe/London"),
                AuthResponse.class);

        assertThat(registered.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(registered.getBody()).isNotNull();
        assertThat(registered.getBody().accessToken()).isNotBlank();
        assertThat(registered.getBody().user().timezone()).isEqualTo("Europe/London");

        ResponseEntity<UserResponse> me = rest.exchange(
                "/api/v1/users/me", HttpMethod.GET,
                bearer(registered.getBody().accessToken()), UserResponse.class);

        assertThat(me.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(me.getBody()).isNotNull();
        assertThat(me.getBody().email()).isEqualTo(email);
    }

    @Test
    void rejectsDuplicateEmailRegardlessOfCase() {
        String email = uniqueEmail();
        rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest(email, "correct-horse-battery", "First", null), AuthResponse.class);

        ResponseEntity<ApiError> second = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest(email.toUpperCase(), "correct-horse-battery", "Second", null),
                ApiError.class);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(second.getBody()).isNotNull();
        assertThat(second.getBody().code()).isEqualTo("EMAIL_ALREADY_REGISTERED");
    }

    @Test
    void rejectsWrongPasswordWithoutRevealingWhy() {
        String email = uniqueEmail();
        rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest(email, "correct-horse-battery", "Ada", null), AuthResponse.class);

        ResponseEntity<ApiError> wrongPassword = rest.postForEntity("/api/v1/auth/login",
                new LoginRequest(email, "not-the-password"), ApiError.class);
        ResponseEntity<ApiError> unknownUser = rest.postForEntity("/api/v1/auth/login",
                new LoginRequest(uniqueEmail(), "not-the-password"), ApiError.class);

        // Identical answers: the response cannot be used to discover which
        // addresses have accounts.
        assertThat(wrongPassword.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(unknownUser.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(wrongPassword.getBody()).isNotNull();
        assertThat(unknownUser.getBody()).isNotNull();
        assertThat(wrongPassword.getBody().code()).isEqualTo(unknownUser.getBody().code());
        assertThat(wrongPassword.getBody().message()).isEqualTo(unknownUser.getBody().message());
    }

    @Test
    void refreshRotatesTheTokenAndRetiresTheOldOne() {
        AuthResponse session = register();

        ResponseEntity<AuthResponse> refreshed = rest.postForEntity("/api/v1/auth/refresh",
                new RefreshRequest(session.refreshToken()), AuthResponse.class);

        assertThat(refreshed.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(refreshed.getBody()).isNotNull();
        assertThat(refreshed.getBody().refreshToken()).isNotEqualTo(session.refreshToken());

        // Replaying the old token must fail: it was revoked when it was used.
        ResponseEntity<ApiError> replay = rest.postForEntity("/api/v1/auth/refresh",
                new RefreshRequest(session.refreshToken()), ApiError.class);
        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void logoutInvalidatesTheRefreshToken() {
        AuthResponse session = register();

        ResponseEntity<Void> logout = rest.postForEntity("/api/v1/auth/logout",
                new RefreshRequest(session.refreshToken()), Void.class);
        assertThat(logout.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<ApiError> afterLogout = rest.postForEntity("/api/v1/auth/refresh",
                new RefreshRequest(session.refreshToken()), ApiError.class);
        assertThat(afterLogout.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void protectedEndpointsRejectMissingAndForgedTokens() {
        ResponseEntity<ApiError> noToken =
                rest.getForEntity("/api/v1/users/me", ApiError.class);
        ResponseEntity<ApiError> forged = rest.exchange("/api/v1/users/me", HttpMethod.GET,
                bearer("not.a.real.token"), ApiError.class);

        assertThat(noToken.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(forged.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(noToken.getBody()).isNotNull();
        assertThat(noToken.getBody().code()).isEqualTo("UNAUTHENTICATED");
    }

    @Test
    void rejectsAWeakPasswordWithFieldLevelDetail() {
        ResponseEntity<ApiError> response = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest(uniqueEmail(), "short", "Ada", null), ApiError.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("VALIDATION_FAILED");
        assertThat(response.getBody().details()).containsKey("password");
    }

    private AuthResponse register() {
        ResponseEntity<AuthResponse> response = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest(uniqueEmail(), "correct-horse-battery", "Ada", null),
                AuthResponse.class);
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }

    private HttpEntity<Void> bearer(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }
}
