package com.routine.note;

import com.routine.auth.AuthPrincipal;
import com.routine.note.dto.DailyReviewRequest;
import com.routine.note.dto.DailyReviewResponse;
import com.routine.note.dto.NotePage;
import com.routine.note.dto.NoteRequest;
import com.routine.note.dto.NoteResponse;
import com.routine.user.UserContext;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class NoteController {

    private final NoteService noteService;
    private final UserContext userContext;

    public NoteController(NoteService noteService, UserContext userContext) {
        this.noteService = noteService;
        this.userContext = userContext;
    }

    /** The notes filed under one day. Omit {@code date} for the user's today. */
    @GetMapping("/notes")
    public List<NoteResponse> list(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return noteService.onDate(principal.id(), date != null ? date : userContext.today(principal.id()));
    }

    /**
     * The Notes screen: every note, newest first, searchable.
     *
     * <p>A separate path from {@code /notes} rather than another parameter on
     * it, because the two return different shapes — a day's notes are a list, a
     * whole account's are a page — and one endpoint returning either would make
     * every caller check which it got.
     */
    @GetMapping("/notes/search")
    public NotePage search(@AuthenticationPrincipal AuthPrincipal principal,
                           @RequestParam(required = false) String q,
                           @RequestParam(required = false) UUID goalId,
                           @RequestParam(required = false, defaultValue = "0") int page) {
        return noteService.search(principal.id(), q, goalId, page);
    }

    @PostMapping("/notes")
    public ResponseEntity<NoteResponse> create(@AuthenticationPrincipal AuthPrincipal principal,
                                               @Valid @RequestBody NoteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(noteService.create(principal.id(), request));
    }

    @PutMapping("/notes/{id}")
    public NoteResponse update(@AuthenticationPrincipal AuthPrincipal principal,
                               @PathVariable UUID id,
                               @Valid @RequestBody NoteRequest request) {
        return noteService.update(principal.id(), id, request);
    }

    @DeleteMapping("/notes/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthPrincipal principal,
                                       @PathVariable UUID id) {
        noteService.delete(principal.id(), id);
        return ResponseEntity.noContent().build();
    }

    /** Addressed by date rather than id: there is exactly one per day. */
    @PutMapping("/reviews/{date}")
    public DailyReviewResponse saveReview(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @Valid @RequestBody DailyReviewRequest request) {
        return noteService.saveReview(principal.id(), date, request);
    }

    @GetMapping("/reviews/{date}")
    public ResponseEntity<DailyReviewResponse> review(
            @AuthenticationPrincipal AuthPrincipal principal,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return noteService.review(principal.id(), date)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
