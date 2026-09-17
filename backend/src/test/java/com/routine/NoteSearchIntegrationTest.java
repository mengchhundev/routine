package com.routine;

import static org.assertj.core.api.Assertions.assertThat;

import com.routine.auth.dto.AuthResponse;
import com.routine.auth.dto.RegisterRequest;
import com.routine.note.dto.NotePage;
import com.routine.note.dto.NoteRequest;
import com.routine.note.dto.NoteResponse;
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

/**
 * The point of keeping notes is finding one again, so search is the part of the
 * Notes screen worth testing.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class NoteSearchIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    private String token;
    /** The account registers without a timezone, so its local day is UTC's. */
    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);

    @BeforeEach
    void signUp() {
        ResponseEntity<AuthResponse> registered = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest("note-" + UUID.randomUUID() + "@example.com",
                        "correct-horse-battery", "Ada", null),
                AuthResponse.class);
        assertThat(registered.getBody()).isNotNull();
        token = registered.getBody().accessToken();
    }

    @Test
    void everyNoteIsListedNewestFirst() {
        create("Monday", "Read about Kubernetes operators.");
        create("Tuesday", "Practised Linux networking.");

        NotePage page = search("");

        assertThat(page.total()).isEqualTo(2);
        assertThat(page.hasMore()).isFalse();
        assertThat(page.notes()).extracting(NoteResponse::title).containsExactly("Tuesday", "Monday");
    }

    @Test
    void searchMatchesTitleAndContent() {
        create("Monday", "Read about Kubernetes operators.");
        create("Tuesday", "Practised Linux networking.");

        assertThat(search("kubernetes").notes()).extracting(NoteResponse::title).containsExactly("Monday");
        // The title is indexed alongside the content.
        assertThat(search("Tuesday").notes()).extracting(NoteResponse::title).containsExactly("Tuesday");
        assertThat(search("kayaking").notes()).isEmpty();
    }

    @Test
    void oneUsersNotesAreNeverAnothersResults() {
        create("Private", "Something personal.");

        ResponseEntity<AuthResponse> other = rest.postForEntity("/api/v1/auth/register",
                new RegisterRequest("other-" + UUID.randomUUID() + "@example.com",
                        "correct-horse-battery", "Bob", null),
                AuthResponse.class);
        assertThat(other.getBody()).isNotNull();

        HttpHeaders theirs = new HttpHeaders();
        theirs.setBearerAuth(other.getBody().accessToken());

        ResponseEntity<NotePage> theirResults = rest.exchange("/api/v1/notes/search?q=personal",
                HttpMethod.GET, new HttpEntity<>(theirs), NotePage.class);

        assertThat(theirResults.getBody()).isNotNull();
        assertThat(theirResults.getBody().notes()).isEmpty();
    }

    // ---------------------------------------------------------------- helpers

    private void create(String title, String content) {
        ResponseEntity<NoteResponse> created = rest.exchange("/api/v1/notes", HttpMethod.POST,
                new HttpEntity<>(new NoteRequest(title, content, today, null, null, null), headers()),
                NoteResponse.class);
        assertThat(created.getBody()).isNotNull();
    }

    private NotePage search(String query) {
        ResponseEntity<NotePage> page = rest.exchange("/api/v1/notes/search?q=" + query,
                HttpMethod.GET, new HttpEntity<>(headers()), NotePage.class);
        assertThat(page.getBody()).isNotNull();
        return page.getBody();
    }

    private HttpHeaders headers() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return headers;
    }
}
