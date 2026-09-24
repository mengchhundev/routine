# Base images are pinned by digest as well as tag: a tag can be re-pointed at
# different contents, a digest cannot. Dependabot proposes digest updates.
#
# .mvn/maven.config makes every Maven run fail on a checksum mismatch, and the
# enforcer rules in pom.xml refuse repositories other than Maven Central.

# ---------------------------------------------------------------- build ----
FROM maven:3-eclipse-temurin-24@sha256:a137a467ec89b5713d0be817b55bdba6b4d6ef16e3d05565a79bc08d8e775a1c AS build
WORKDIR /build

# Dependencies are their own layer so source edits do not re-download Maven Central.
COPY pom.xml .
COPY .mvn .mvn
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -DskipTests package

# ----------------------------------------------------------------- run -----
FROM eclipse-temurin:21-jre@sha256:6cbdfc89c9657478bc5abea638030310f6c0267404e98a5808097bb1925932f1 AS runtime
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
