package com.routine.planner;

import com.routine.auth.AuthPrincipal;
import com.routine.common.ApiException;
import com.routine.routine.RoutineGenerator;
import com.routine.user.UserContext;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/planner")
public class PlannerController {

    private final PlannerService plannerService;
    private final RoutineGenerator generator;
    private final UserContext userContext;

    public PlannerController(PlannerService plannerService,
                             RoutineGenerator generator,
                             UserContext userContext) {
        this.plannerService = plannerService;
        this.generator = generator;
        this.userContext = userContext;
    }

    /** Omit {@code date} for the user's today — the screen's default question. */
    @GetMapping("/day")
    public DayResponse day(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        // A day is materialised as it is opened, in the reader's own timezone.
        // Done here rather than inside the service so the write stays outside
        // the read-only transaction that assembles the answer.
        generator.ensure(principal.id(), date);
        return plannerService.day(principal.id(), date);
    }

    /**
     * The week containing {@code date} — any day in it will do, so "next week"
     * is the current start plus seven rather than arithmetic the client has to
     * get right against the user's first-day-of-week setting.
     */
    @GetMapping("/week")
    public WeekResponse week(
            @AuthenticationPrincipal AuthPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        // Materialise before assembling, for the same reason as /day: the write
        // must not happen inside the read-only transaction that answers.
        LocalDate start = userContext.startOfWeek(principal.id(),
                date != null ? date : userContext.today(principal.id()));
        generator.ensureRange(principal.id(), start, start.plusDays(6));

        return plannerService.week(principal.id(), date);
    }

    /** @param month {@code YYYY-MM}; omit for the month the user is in. */
    @GetMapping("/month")
    public MonthResponse month(@AuthenticationPrincipal AuthPrincipal principal,
                               @RequestParam(required = false) String month) {
        YearMonth resolved = parseMonth(month);
        YearMonth target = resolved != null
                ? resolved
                : YearMonth.from(userContext.today(principal.id()));

        generator.ensureRange(principal.id(), target.atDay(1), target.atEndOfMonth());

        return plannerService.month(principal.id(), resolved);
    }

    /**
     * Parsed here rather than bound by the framework: Spring has no built-in
     * converter for {@link YearMonth}, and a 500 on a hand-edited URL is a worse
     * answer than a sentence saying what the parameter should look like.
     */
    private YearMonth parseMonth(String month) {
        if (month == null || month.isBlank()) {
            return null;
        }
        try {
            return YearMonth.parse(month);
        } catch (DateTimeParseException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MONTH",
                    "Month must be written as YYYY-MM, for example 2026-03.");
        }
    }
}
