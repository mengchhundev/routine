package com.routine.note.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

public record NoteRequest(
        @Size(max = 200) String title,
        @NotBlank @Size(max = 20000) String content,
        /** The day this note belongs to. Null for a note attached only to a thing. */
        LocalDate noteDate,
        UUID goalId,
        UUID taskId,
        UUID routineId) {
}
