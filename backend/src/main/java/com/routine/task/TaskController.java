package com.routine.task;

import com.routine.auth.AuthPrincipal;
import com.routine.task.dto.TaskRequest;
import com.routine.task.dto.TaskResponse;
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
@RequestMapping("/api/v1/tasks")
public class TaskController {

    private final TaskService taskService;
    private final UserContext userContext;

    public TaskController(TaskService taskService, UserContext userContext) {
        this.taskService = taskService;
        this.userContext = userContext;
    }

    /**
     * {@code ?date=} for one day, {@code ?from=&to=} for a range, {@code ?scope=}
     * for the Tasks screen's slices. With none of them, the answer is the user's
     * today — the question the product is built around.
     */
    @GetMapping
    public List<TaskResponse> list(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) TaskScope scope,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) TaskPriority priority,
            @RequestParam(required = false) String q) {

        if (scope != null || status != null || priority != null || q != null) {
            return taskService.search(principal.id(), scope, status, priority, q);
        }
        if (from != null && to != null) {
            return taskService.inRange(principal.id(), from, to);
        }
        return taskService.onDate(principal.id(), date != null ? date : userContext.today(principal.id()));
    }

    @GetMapping("/{id}")
    public TaskResponse byId(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id) {
        return taskService.byId(principal.id(), id);
    }

    @PostMapping
    public ResponseEntity<TaskResponse> create(@AuthenticationPrincipal AuthPrincipal principal,
                                               @Valid @RequestBody TaskRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.create(principal.id(), request));
    }

    @PutMapping("/{id}")
    public TaskResponse update(@AuthenticationPrincipal AuthPrincipal principal,
                               @PathVariable UUID id,
                               @Valid @RequestBody TaskRequest request) {
        return taskService.update(principal.id(), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthPrincipal principal,
                                       @PathVariable UUID id) {
        taskService.delete(principal.id(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/complete")
    public TaskResponse complete(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id) {
        return taskService.complete(principal.id(), id);
    }

    @PostMapping("/{id}/skip")
    public TaskResponse skip(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id) {
        return taskService.skip(principal.id(), id);
    }

    @PostMapping("/{id}/reschedule")
    public TaskResponse reschedule(@AuthenticationPrincipal AuthPrincipal principal,
                                   @PathVariable UUID id,
                                   @Valid @RequestBody RescheduleRequest request) {
        return taskService.reschedule(principal.id(), id, request.dueDate());
    }

    public record RescheduleRequest(@jakarta.validation.constraints.NotNull LocalDate dueDate) {}

    @PostMapping("/{id}/reopen")
    public TaskResponse reopen(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id) {
        return taskService.reopen(principal.id(), id);
    }
}
