package com.routine.reminder;

import com.routine.auth.AuthPrincipal;
import com.routine.reminder.dto.NotificationResponse;
import com.routine.reminder.dto.ReminderRequest;
import com.routine.reminder.dto.ReminderResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reminders")
public class ReminderController {

    private final ReminderService reminderService;

    public ReminderController(ReminderService reminderService) {
        this.reminderService = reminderService;
    }

    @GetMapping
    public List<ReminderResponse> list(@AuthenticationPrincipal AuthPrincipal principal,
                                       @RequestParam(required = false) ReminderScope scope) {
        return reminderService.list(principal.id(), scope);
    }

    /** What was actually delivered, so "did it send?" has an answer on the page. */
    @GetMapping("/history")
    public List<NotificationResponse> history(@AuthenticationPrincipal AuthPrincipal principal) {
        return reminderService.history(principal.id());
    }

    @GetMapping("/{id}")
    public ReminderResponse byId(@AuthenticationPrincipal AuthPrincipal principal,
                                 @PathVariable UUID id) {
        return reminderService.byId(principal.id(), id);
    }

    @PostMapping
    public ResponseEntity<ReminderResponse> create(@AuthenticationPrincipal AuthPrincipal principal,
                                                   @Valid @RequestBody ReminderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reminderService.create(principal.id(), request));
    }

    @PutMapping("/{id}")
    public ReminderResponse update(@AuthenticationPrincipal AuthPrincipal principal,
                                   @PathVariable UUID id,
                                   @Valid @RequestBody ReminderRequest request) {
        return reminderService.update(principal.id(), id, request);
    }

    /** Stop it firing but keep the record. Deleting is the other endpoint. */
    @PostMapping("/{id}/cancel")
    public ReminderResponse cancel(@AuthenticationPrincipal AuthPrincipal principal,
                                   @PathVariable UUID id) {
        return reminderService.cancel(principal.id(), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthPrincipal principal,
                                       @PathVariable UUID id) {
        reminderService.delete(principal.id(), id);
        return ResponseEntity.noContent().build();
    }
}
