package com.routine.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "routine.cors")
public record CorsProperties(List<String> allowedOrigins) {
}
