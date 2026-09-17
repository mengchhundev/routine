package com.routine;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Routine starts as a modular monolith: one deployable, one database, packages
 * drawn on the module boundaries from ROUTINE-PROJECT-PLAN section 5 so that a
 * service can be extracted later if — and only if — real usage justifies it.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableJpaAuditing
// Reminders are delivered by a poll inside the application rather than an
// external scheduler: one deployable stays one deployable (see ReminderDispatcher).
@EnableScheduling
public class RoutineApplication {

    public static void main(String[] args) {
        SpringApplication.run(RoutineApplication.class, args);
    }
}
