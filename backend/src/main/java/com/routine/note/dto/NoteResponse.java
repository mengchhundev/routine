package com.routine.note.dto;

import com.routine.note.Note;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record NoteResponse(
        UUID id,
        String title,
        String content,
        LocalDate noteDate,
        UUID goalId,
        UUID taskId,
        UUID routineId,
        Instant updatedAt) {

    public static NoteResponse from(Note note) {
        return new NoteResponse(
                note.getId(),
                note.getTitle(),
                note.getContent(),
                note.getNoteDate(),
                note.getGoalId(),
                note.getTaskId(),
                note.getRoutineId(),
                note.getUpdatedAt());
    }
}
