package com.routine.analytics;

import com.routine.auth.AuthPrincipal;
import com.routine.routine.RoutineGenerator;
import com.routine.user.UserContext;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final RoutineGenerator generator;
    private final UserContext userContext;

    public AnalyticsController(AnalyticsService analyticsService,
                               RoutineGenerator generator,
                               UserContext userContext) {
        this.analyticsService = analyticsService;
        this.generator = generator;
        this.userContext = userContext;
    }

    @GetMapping("/dashboard")
    public DashboardResponse dashboard(@AuthenticationPrincipal AuthPrincipal principal) {
        // The dashboard is a day view too. Without this, a user who only ever
        // opens the dashboard would never see their routines appear.
        generator.ensure(principal.id(), userContext.today(principal.id()));
        return analyticsService.dashboard(principal.id());
    }

    /**
     * The Analytics screen.
     *
     * @param days how far back to look; clamped to 7–365, default 30. No
     *             generation runs here — analytics reads history, and history
     *             is a record, not something a page view may add to.
     */
    @GetMapping("/summary")
    public SummaryResponse summary(@AuthenticationPrincipal AuthPrincipal principal,
                                   @RequestParam(required = false) Integer days) {
        return analyticsService.summary(principal.id(), days);
    }
}
