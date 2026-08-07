# Upcheck ERP Data OAuth

A secure, versioned, **read-only** data API that lets approved first-party apps read
non-sensitive Upcheck ERP data — an internal ecosystem. Third-party access is a
later scope. Phase 1 exposes the **HR module** (directory, roster, departments,
holidays & leave types).

- **Auth model:** OAuth 2.0 **Authorization Code + PKCE**. Every connection is
  approved by a portal admin on a consent screen.
- **API version:** `v1` (in the URL path). Breaking changes ship under a new
  version; `v1` stays stable.
- **Branding:** "Upcheck ERP Data OAuth" — rebrandable (it is only a display name;
  no code depends on it).

> This document is also available in-app at **`/organization/api/docs`**.

---

## 1. Concepts

| Term | Meaning |
|------|---------|
| **Application (client)** | A first-party app registered in the Developer console. Has a `client_id` + `client_secret`. |
| **Scope** | A read permission, e.g. `hr.employees:read`. There are no write scopes. |
| **Grant / connection** | An app the org has authorized. Revoking it kills the app's tokens instantly. |
| **Access token** | Opaque bearer token, valid 1 hour. Sent as `Authorization: Bearer …`. |
| **Refresh token** | Opaque, valid 30 days, **rotated** on each use. |

The authorization server lives under `/api/oauth/v1/*`; the resource (data) server
under `/api/data/v1/*`. The admin console + consent UI live under
`/organization/api/*`.

---

## 2. Registering an application (admin)

1. Go to **Organization → API / Developer** (`/organization/api`). Requires an
   Admin / Console-admin role, or the `api.manage` permission.
2. Click **Register application** and provide:
   - **Name** and description.
   - **Redirect URIs** — the exact URLs users return to after authorizing.
     Rules (enforced): **https** only (`http` allowed only for `localhost`), no
     URL fragment (`#…`), no embedded credentials (`user:pass@`), no wildcards.
     Matched **exactly** at authorize/token time.
   - **Scopes** — the minimum your app needs.
3. You receive a **`client_id`** and a **`client_secret`**. The secret is shown
   **once** and stored only as a hash — save it in your app's server-side secrets.
4. The app starts in **`pending`**. An admin must **Verify** it before it can
   obtain any token. Apps can later be **suspended**, have their secret
   **rotated**, or be **revoked** — each takes effect immediately.

---

## 3. Scopes (Phase 1)

| Scope | Grants (read-only) |
|-------|--------------------|
| `hr.employees:read` | Employee directory: name, work email, job title, department, employment type & status, manager, start/end dates, location, timezone, avatar. |
| `hr.people:read` | People roster: employee ID, type, status, department, job title, manager, join date. |
| `hr.departments:read` | Department list with headcount (org structure). |
| `hr.calendar:read` | Holiday calendar and leave-type catalogue. |
| `hr.compensation:read` | **Sensitive.** Employee compensation: salary/CTC amount, currency, pay frequency, effective date. Served only via the dedicated compensation endpoint. Grant only to apps that genuinely need payroll data. |

**Never exposed by any scope:** bank details, PAN/Aadhaar/UAN/PF/ESI, personal
phone/email, address, date of birth, gender/marital/blood group, emergency
contacts, HR notes / exit reasons / timeline, employee documents, login
credentials/session tokens, and the portal permission `role`. (Salary is the one
gated exception — reachable only under the sensitive `hr.compensation:read` scope
above.)

---

## 4. The flow

### 4.0 PKCE (required)

Generate a random `code_verifier` (43–128 chars, unreserved set) and derive:

```
code_challenge = BASE64URL( SHA256( code_verifier ) )
code_challenge_method = S256
```

`plain` is **not** accepted.

### 4.1 Authorization request

Send the user's browser to:

```
GET /api/oauth/v1/authorize
    ?response_type=code
    &client_id=YOUR_CLIENT_ID
    &redirect_uri=https://app.example.com/oauth/callback
    &scope=hr.employees:read%20hr.departments:read
    &state=RANDOM_CSRF_VALUE
    &code_challenge=CODE_CHALLENGE
    &code_challenge_method=S256
```

A logged-in admin reviews the consent screen and approves. The browser is
redirected to your `redirect_uri`:

```
https://app.example.com/oauth/callback?code=AUTH_CODE&state=RANDOM_CSRF_VALUE
```

Always verify `state` equals what you sent. On denial/error you receive
`?error=access_denied&error_description=…&state=…` instead.

### 4.2 Token exchange

```
POST /api/oauth/v1/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=authorization_code
&code=AUTH_CODE
&redirect_uri=https://app.example.com/oauth/callback
&code_verifier=YOUR_CODE_VERIFIER
```

(You may also pass `client_id`/`client_secret` in the body instead of Basic auth,
and send JSON instead of form-encoding.)

```json
200 OK
{
  "access_token": "…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "…",
  "scope": "hr.employees:read hr.departments:read"
}
```

### 4.3 Calling the data API

```
GET /api/data/v1/hr/employees?limit=50&offset=0
Authorization: Bearer ACCESS_TOKEN
```

```json
{
  "data": [ { "id": "…", "fullName": "…", "workEmail": "…", "department": "…", … } ],
  "page": { "total": 128, "limit": 50, "offset": 0, "count": 50, "hasMore": true }
}
```

### 4.4 Refresh

```
POST /api/oauth/v1/token
grant_type=refresh_token&refresh_token=REFRESH_TOKEN
Authorization: Basic base64(client_id:client_secret)
```

Each refresh returns a **new** refresh token — discard the old one. Presenting a
already-rotated refresh token is treated as theft and **revokes the whole grant**.

### 4.5 Revoke (RFC 7009)

```
POST /api/oauth/v1/revoke
token=ACCESS_OR_REFRESH_TOKEN
Authorization: Basic base64(client_id:client_secret)
```

---

## 5. Endpoints

**Authorization server** (`/api/oauth/v1`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/metadata` | Discovery document |
| GET | `/authorize` | Start authorization (browser) |
| POST | `/token` | Code exchange & refresh |
| POST | `/revoke` | Revoke a token (RFC 7009) |
| POST | `/introspect` | Inspect a token (RFC 7662) |

**Resource server** (`/api/data/v1`) — all require `Authorization: Bearer` + scope

| Method | Path | Scope |
|--------|------|-------|
| GET | `/me` | any valid token |
| GET | `/hr/employees`, `/hr/employees/:id` | `hr.employees:read` |
| GET | `/hr/employees/:id/compensation` | `hr.compensation:read` **(sensitive)** |
| GET | `/hr/people` | `hr.people:read` |
| GET | `/hr/departments` | `hr.departments:read` |
| GET | `/hr/holidays`, `/hr/leave-types` | `hr.calendar:read` |

List endpoints accept `?limit=` (capped) and `?offset=`, plus resource-specific
filters (`department`, `status`, `type`, `year`, `q`). They return `{ data, page }`.

---

## 6. Errors

Errors use the OAuth format and correct HTTP status:

```json
{ "error": "invalid_grant", "error_description": "Authorization code has expired" }
```

| HTTP | `error` | When |
|------|---------|------|
| 400 | `invalid_request` | Malformed / missing parameters |
| 400 | `invalid_grant` | Bad/expired/replayed code or refresh token, PKCE mismatch, redirect mismatch |
| 400 | `unsupported_grant_type` | Unknown `grant_type` |
| 400 | `invalid_scope` | Requested scope not permitted for the app |
| 401 | `invalid_client` | Client authentication failed |
| 401 | `invalid_token` | Access token invalid / expired / revoked |
| 403 | `insufficient_scope` | Token lacks the required scope |
| 403 | `unauthorized_client` | App not verified / suspended / revoked |
| 403 | `access_denied` | Admin denied the consent |
| 429 | `temporarily_unavailable` | Rate limited — honor `Retry-After` |

Resource-server 401/403 responses also set the `WWW-Authenticate: Bearer …` header.

---

## 7. Security model

- **PKCE S256 mandatory** — `plain` rejected; codes are single-use, 5-minute TTL,
  and replay revokes the grant's tokens.
- **Exact redirect-URI matching** on the canonical form (no prefix/wildcard).
- **Opaque tokens, hashed at rest** — a DB dump reveals no usable credential;
  revocation is instant.
- **Refresh rotation + reuse detection** — a leaked refresh token is contained.
- **Client secrets** are high-entropy, hashed, and shown once. Keep them
  server-side — never ship a secret in a browser or mobile bundle.
- **Least privilege data** — responses are built from a field **allowlist**;
  sensitive HR data is structurally unreachable, except salary, which is gated
  behind the dedicated, admin-granted `hr.compensation:read` scope and its own
  endpoint.
- **Full audit trail** in `oauth_audit_log` (register, verify, consent, issue,
  refresh, revoke).
- **Rate limiting** on `authorize` and `token`.

### Server configuration

The service works with **no configuration**. For defense-in-depth you may set an
optional secret used to key the at-rest token/secret fingerprints:

```
OAUTH_TOKEN_SECRET = <any long random string>
```

Generate one with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If set, do **not** change it after tokens/secrets exist, or existing tokens and
client secrets will stop verifying (clients would simply re-authenticate / rotate).

---

## 8. Versioning

The version is the `v1` path segment. Additive changes (new fields, new endpoints,
new scopes) ship within `v1`. Breaking changes ship as `v2` while `v1` continues to
run. The discovery document (`/api/oauth/v1/metadata`) always reflects the current
capabilities.
