package com.routine.common;

import org.springframework.http.HttpStatus;

public class NotFoundException extends ApiException {

    public NotFoundException(String code, String message) {
        super(HttpStatus.NOT_FOUND, code, message);
    }

    /** e.g. {@code NotFoundException.of("TASK")} -> code TASK_NOT_FOUND. */
    public static NotFoundException of(String resource) {
        String label = resource.charAt(0) + resource.substring(1).toLowerCase();
        return new NotFoundException(resource.toUpperCase() + "_NOT_FOUND", label + " was not found");
    }
}
