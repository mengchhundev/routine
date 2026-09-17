package com.routine.note;

import com.routine.common.UserOwnedRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

public interface NoteRepository extends UserOwnedRepository<Note> {

    Page<Note> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<Note> findByUserIdAndNoteDateOrderByCreatedAtDesc(UUID userId, LocalDate noteDate);

    List<Note> findByUserIdAndGoalIdOrderByCreatedAtDesc(UUID userId, UUID goalId);

    /**
     * Full-text search backed by ix_notes_content_fts. Written as native SQL
     * because JPQL has no vocabulary for PostgreSQL's tsvector operators.
     */
    @Query(value = """
            SELECT * FROM notes
            WHERE user_id = :userId
              AND to_tsvector('simple', coalesce(title, '') || ' ' || content)
                  @@ plainto_tsquery('simple', :query)
            ORDER BY created_at DESC
            """,
           countQuery = """
            SELECT count(*) FROM notes
            WHERE user_id = :userId
              AND to_tsvector('simple', coalesce(title, '') || ' ' || content)
                  @@ plainto_tsquery('simple', :query)
            """,
           nativeQuery = true)
    Page<Note> search(UUID userId, String query, Pageable pageable);
}
