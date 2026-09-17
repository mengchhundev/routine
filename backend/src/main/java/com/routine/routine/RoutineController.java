package com.routine.routine;

import com.routine.auth.AuthPrincipal;
import com.routine.routine.dto.RoutineRequest;
import com.routine.routine.dto.RoutineResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/routines")
public class RoutineController {

    private final RoutineService routineService;

    public RoutineController(RoutineService routineService) {
        this.routineService = routineService;
    }

    @GetMapping
    public List<RoutineResponse> list(@AuthenticationPrincipal AuthPrincipal principal,
                                      @RequestParam(required = false) Boolean activeOnly) {
        return routineService.list(principal.id(), activeOnly);
    }

    @GetMapping("/{id}")
    public RoutineResponse byId(@AuthenticationPrincipal AuthPrincipal principal, @PathVariable UUID id) {
        return routineService.byId(principal.id(), id);
    }

    @PostMapping
    public ResponseEntity<RoutineResponse> create(@AuthenticationPrincipal AuthPrincipal principal,
                                                  @Valid @RequestBody RoutineRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(routineService.create(principal.id(), request));
    }

    @PutMapping("/{id}")
    public RoutineResponse update(@AuthenticationPrincipal AuthPrincipal principal,
                                  @PathVariable UUID id,
                                  @Valid @RequestBody RoutineRequest request) {
        return routineService.update(principal.id(), id, request);
    }

    /** Pause or resume. Its own endpoint so a toggle is not a whole-form save. */
    @PostMapping("/{id}/active")
    public RoutineResponse setActive(@AuthenticationPrincipal AuthPrincipal principal,
                                     @PathVariable UUID id,
                                     @Valid @RequestBody ActiveRequest request) {
        return routineService.setActive(principal.id(), id, request.active());
    }

    public record ActiveRequest(@jakarta.validation.constraints.NotNull Boolean active) {}

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthPrincipal principal,
                                       @PathVariable UUID id) {
        routineService.delete(principal.id(), id);
        return ResponseEntity.noContent().build();
    }
}
