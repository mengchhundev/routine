# Authentication API

Base path `/api/v1`. All bodies are JSON.

## Token model

| Token | Lifetime | Storage | Revocable |
| --- | --- | --- | --- |
| Access (JWT, HS384) | 15 min | Sent as `Authorization: Bearer` | No — kept short instead |
| Refresh (opaque, 256-bit) | 30 days | `refresh_tokens`, SHA-256 digest only | Yes |

The refresh token **rotates on every use**: the presented token is revoked and a
new one returned. Presenting an already-revoked token is treated as evidence of
theft and revokes every session for that user.

Configure lifetimes with `ROUTINE_ACCESS_TOKEN_TTL` and
`ROUTINE_REFRESH_TOKEN_TTL` (ISO-8601 durations, e.g. `PT15M`, `P30D`).

---

## `POST /auth/register` — public

```json
{
  "email": "ada@example.com",
  "password": "correct-horse-battery",
  "displayName": "Ada Lovelace",
  "timezone": "Europe/London"
}
```

`password` must be 10–128 characters — length only, no composition rules.
`timezone` is optional and falls back to `UTC` if absent or not a valid IANA
zone id; the web client sends the browser's zone automatically.

**`201 Created`** returns an `AuthResponse` and signs the user in immediately.
**`409 EMAIL_ALREADY_REGISTERED`** if the address is taken (case-insensitively).
**`400 VALIDATION_FAILED`** with per-field `details`.

## `POST /auth/login` — public

```json
{ "email": "ada@example.com", "password": "correct-horse-battery" }
```

**`200 OK`** returns an `AuthResponse`.
**`401 INVALID_CREDENTIALS`** for a wrong password, an unknown account, or a
disabled one — deliberately the same code and message in every case. The bcrypt
comparison runs even when the account does not exist, so response time does not
disclose it either.

## `POST /auth/refresh` — public

```json
{ "refreshToken": "…" }
```

**`200 OK`** returns a new `AuthResponse` with a **new** refresh token.
**`401 INVALID_REFRESH_TOKEN`** if it is unknown, expired, or already used.

## `POST /auth/logout` — public

```json
{ "refreshToken": "…" }
```

**`204 No Content`**, always — an unknown or already-revoked token is still a
successful logout.

Public by design: this endpoint authenticates by possession of the refresh
token. Requiring a valid access token would make it impossible to end a session
whose access token had already expired, which is exactly when a user reaches for
"sign out".

---

## `AuthResponse`

```json
{
  "tokenType": "Bearer",
  "accessToken": "eyJhbGciOiJIUzM4NCJ9…",
  "refreshToken": "U60jark7miJVfMnDhH6RaVvFND_Va6iNvVLyn6Wkyrk",
  "expiresIn": 900,
  "user": {
    "id": "a0f11c16-4628-4413-b1e1-2afb8c205367",
    "email": "ada@example.com",
    "displayName": "Ada Lovelace",
    "timezone": "Europe/London",
    "emailVerified": false,
    "createdAt": "2026-09-05T08:48:19.068537852Z"
  }
}
```

`expiresIn` is seconds until `accessToken` expires, so a client can refresh
ahead of time rather than waiting for a 401.

---

## User endpoints — authenticated

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/users/me` | Profile |
| `PUT` | `/users/me` | Update `displayName`, `timezone` |
| `POST` | `/users/me/password` | Change password; revokes all sessions |
| `GET` | `/users/me/settings` | Reminder, review-time and theme preferences |
| `PUT` | `/users/me/settings` | Update them |

`PUT /users/me` returns **`400 INVALID_TIMEZONE`** for a zone id the JVM does not
recognise. `POST /users/me/password` returns **`401 INVALID_CREDENTIALS`** if the
current password is wrong, and on success revokes every refresh token for the
user — including the caller's, which must sign in again.

---

## Errors

Every endpoint returns the same shape:

```json
{
  "code": "TASK_NOT_FOUND",
  "message": "Task was not found",
  "timestamp": "2026-09-05T08:48:19.764483706Z"
}
```

Validation failures add `details`, mapping field name to message:

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "timestamp": "2026-09-05T08:47:10.299052476Z",
  "details": { "password": "size must be between 10 and 128" }
}
```

| Code | Status |
| --- | --- |
| `VALIDATION_FAILED` | 400 |
| `INVALID_TIMEZONE` | 400 |
| `UNAUTHENTICATED` | 401 |
| `INVALID_CREDENTIALS` | 401 |
| `INVALID_REFRESH_TOKEN` | 401 |
| `FORBIDDEN` | 403 |
| `*_NOT_FOUND` | 404 |
| `EMAIL_ALREADY_REGISTERED` | 409 |
| `INTERNAL_ERROR` | 500 |

Branch on `code`, never on `message` — messages are for humans and will change.

---

## How the web client uses this

The browser never calls these endpoints directly. It posts to Next.js route
handlers at `/api/auth/{register,login,logout}`, which call the API and store
both tokens as httpOnly, SameSite=Lax cookies (`routine_at`, `routine_rt`).

The access cookie's `Max-Age` matches the token's lifetime, so its *absence* is
the signal that a refresh is due — no JWT decoding on the client. `middleware.ts`
notices that, calls `/auth/refresh`, and writes the rotated pair onto the
response before the page renders.
