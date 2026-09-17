package com.routine.note;

import com.routine.common.NotFoundException;
import com.routine.note.dto.DailyReviewRequest;
import com.routine.note.dto.DailyReviewResponse;
import com.routine.note.dto.NotePage;
import com.routine.note.dto.NoteRequest;
import com.routine.note.dto.NoteResponse;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoteService {

    private final NoteRepository notes;
    private final DailyReviewRepository reviews;

    public NoteService(NoteRepository notes, DailyReviewRepository reviews) {
        this.notes = notes;
        this.reviews = reviews;
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> onDate(UUID userId, LocalDate date) {
        return notes.findByUserIdAndNoteDateOrderByCreatedAtDesc(userId, date)
                .stream().map(NoteResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Optional<NoteResponse> dayNote(UUID userId, LocalDate date) {
        // The day's note is simply the most recent one filed under that date.
        return notes.findByUserIdAndNoteDateOrderByCreatedAtDesc(userId, date)
                .stream().findFirst().map(NoteResponse::from);
    }

    /** The default page size for the Notes screen — long enough to scroll. */
    private static final int PAGE_SIZE = 25;

    /**
     * The Notes screen: everything written, newest first, narrowed by whatever
     * the reader is looking for.
     *
     * <p>A query goes through PostgreSQL's full-text index rather than a LIKE
     * scan — the whole point of keeping notes is being able to find one again,
     * and that has to keep working at a thousand notes.
     */
    @Transactional(readOnly = true)
    public NotePage search(UUID userId, String query, UUID goalId, int page) {
        int resolved = Math.max(page, 0);
        PageRequest pageable = PageRequest.of(resolved, PAGE_SIZE);

        Page<Note> found;
        if (query != null && !query.isBlank()) {
            found = notes.search(userId, query.trim(), pageable);
        } else if (goalId != null) {
            // Small by nature — the notes on one goal — so it is not paged in
            // the query; the page shape is kept for one consistent response.
            List<Note> all = notes.findByUserIdAndGoalIdOrderByCreatedAtDesc(userId, goalId);
            return new NotePage(all.stream().map(NoteResponse::from).toList(), 0, all.size(), all.size(), false);
        } else {
            found = notes.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        }

        return new NotePage(
                found.getContent().stream().map(NoteResponse::from).toList(),
                resolved,
                PAGE_SIZE,
                found.getTotalElements(),
                found.hasNext());
    }

    @Transactional
    public NoteResponse create(UUID userId, NoteRequest request) {
        Note note = new Note();
        note.setUserId(userId);
        apply(note, request);
        return NoteResponse.from(notes.save(note));
    }

    @Transactional
    public NoteResponse update(UUID userId, UUID noteId, NoteRequest request) {
        Note note = notes.findByIdAndUserId(noteId, userId)
                .orElseThrow(() -> NotFoundException.of("NOTE"));
        apply(note, request);
        return NoteResponse.from(note);
    }

    @Transactional
    public void delete(UUID userId, UUID noteId) {
        if (notes.deleteByIdAndUserId(noteId, userId) == 0) {
            throw NotFoundException.of("NOTE");
        }
    }

    // ------------------------------------------------------ daily review ----

    @Transactional(readOnly = true)
    public Optional<DailyReviewResponse> review(UUID userId, LocalDate date) {
        return reviews.findByUserIdAndReviewDate(userId, date).map(DailyReviewResponse::from);
    }

    /**
     * One review per user per day, enforced by a unique index — so this is an
     * upsert rather than a create. The reflection is something you come back to
     * through the evening, not a form you submit once.
     */
    @Transactional
    public DailyReviewResponse saveReview(UUID userId, LocalDate date, DailyReviewRequest request) {
        DailyReview review = reviews.findByUserIdAndReviewDate(userId, date)
                .orElseGet(() -> {
                    DailyReview fresh = new DailyReview();
                    fresh.setUserId(userId);
                    fresh.setReviewDate(date);
                    return reviews.save(fresh);
                });

        review.setSummary(request.summary());
        review.setWhatWentWell(request.whatWentWell());
        review.setWhatWentWrong(request.whatWentWrong());
        review.setWhatToImprove(request.whatToImprove());
        review.setRating(request.rating());
        review.setMood(request.mood());
        review.setEnergy(request.energy());

        return DailyReviewResponse.from(review);
    }

    private void apply(Note note, NoteRequest request) {
        note.setTitle(request.title());
        note.setContent(request.content());
        note.setNoteDate(request.noteDate());
        note.setGoalId(request.goalId());
        note.setTaskId(request.taskId());
        note.setRoutineId(request.routineId());
    }
}
