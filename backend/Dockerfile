# ---------------------------------------------------------------- build ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Dependencies are their own layer so source edits do not re-download Maven Central.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -DskipTests package

# ----------------------------------------------------------------- run -----
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# The Ubuntu base ships Canonical's Pebble service manager, built with its own
# Go toolchain and carrying that toolchain's CVEs. The container runs java as
# its entrypoint and never uses it.
RUN rm -f /usr/bin/pebble \
 && useradd --system --uid 10001 routine
USER routine

COPY --from=build /build/target/routine-api-0.1.0.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
