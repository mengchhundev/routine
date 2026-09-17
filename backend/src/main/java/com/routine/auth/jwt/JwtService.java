package com.routine.auth.jwt;

import com.routine.auth.AuthPrincipal;
import com.routine.config.AuthProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

/** Issues and verifies the short-lived access token. */
@Service
public class JwtService {

    private final SecretKey key;
    private final String issuer;
    private final Duration accessTokenTtl;

    public JwtService(AuthProperties properties) {
        // Keys.hmacShaKeyFor rejects anything under 256 bits, so a weak secret
        // fails at startup rather than silently weakening every token.
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(properties.jwtSecret()));
        this.issuer = properties.issuer();
        this.accessTokenTtl = properties.accessTokenTtl();
    }

    public String issueAccessToken(UUID userId, String email) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(issuer)
                .subject(userId.toString())
                .claim("email", email)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTokenTtl)))
                .signWith(key)
                .compact();
    }

    public Duration accessTokenTtl() {
        return accessTokenTtl;
    }

    /**
     * @return the principal for a valid, unexpired, correctly-issued token, or
     *         empty for anything else. Callers must not distinguish the reasons:
     *         a malformed token and an expired one are both simply unauthenticated.
     */
    public Optional<AuthPrincipal> verify(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(issuer)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.of(new AuthPrincipal(
                    UUID.fromString(claims.getSubject()),
                    claims.get("email", String.class)));
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
