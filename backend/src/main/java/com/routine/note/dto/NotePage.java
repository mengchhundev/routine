package com.routine.note.dto;

import java.util.List;

/**
 * A page of notes.
 *
 * <p>Notes are the one thing in the product that only accumulates — nobody
 * deletes last month's reflection — so this list is paged from the start rather
 * than when somebody's account gets slow.
 *
 * @param hasMore cheaper for the client to act on than comparing counts, and
 *                the only thing a "load more" control actually needs
 */
public record NotePage(List<NoteResponse> notes, int page, int size, long total, boolean hasMore) {
}
