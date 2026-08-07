'use client';

// In-app documentation for "Upcheck ERP Data OAuth". Mirrors OAUTH_API.md.
// Intended for developers of first-party apps that will consume Upcheck ERP data.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { SCOPES } from '../../../../lib/oauth/scopes';
import { ArrowLeft, BookOpen, Copy, Download, Bot, Check, FileText, FileCode } from 'lucide-react';

function Code({ children }) {
  return <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto my-3"><code>{children}</code></pre>;
}
function H({ children, id }) {
  return <h2 id={id} className="text-xl font-bold text-slate-900 mt-10 mb-3 scroll-mt-6">{children}</h2>;
}

// --- Exportable documentation, generated from the same source of truth ---

const scopeLines = () => SCOPES.map((s) => `| \`${s.id}\` | ${s.description} |`).join('\n');

// Full developer guide as Markdown (also usable as plain text).
function buildMarkdown(origin) {
  return `# Upcheck ERP Data OAuth — Developer Guide

A secure, versioned, **read-only** API that lets approved first-party apps read
non-sensitive Upcheck ERP data. Phase 1 exposes the HR module (directory, roster,
departments, holidays & leave types). Access uses the OAuth 2.0 **Authorization
Code + PKCE** flow; every connection is approved by an admin. Current version: \`v1\`.

Base URL: ${origin}

## 1. Register your application

In the Developer console (${origin}/organization/api) → **Register application**. Provide:

- **Name** & description.
- **Redirect URIs** — exact URLs users return to after authorizing. **https** only
  (http allowed for \`localhost\`), no fragments, no embedded credentials, no
  wildcards. Matched exactly.
- **Scopes** — the minimum your app needs.

You receive a \`client_id\` and a \`client_secret\` (shown **once** — store it
securely). An admin must then **verify** the app before it can obtain tokens.

## 2. Scopes

| Scope | Grants (read-only) |
|-------|--------------------|
${scopeLines()}

## 3. Authorization Code + PKCE flow

Generate a PKCE \`code_verifier\` (43–128 chars) and \`code_challenge = BASE64URL(SHA256(verifier))\`.

### Step 1 — send the user to the authorize endpoint
\`\`\`
GET ${origin}/api/oauth/v1/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://app.example.com/oauth/callback
  &scope=hr.employees:read hr.departments:read
  &state=RANDOM_CSRF_VALUE
  &code_challenge=CODE_CHALLENGE
  &code_challenge_method=S256
\`\`\`
An admin approves the consent screen. The browser is redirected to your
\`redirect_uri\` with \`?code=...&state=...\`. Verify \`state\` matches.

### Step 2 — exchange the code for tokens
\`\`\`
POST ${origin}/api/oauth/v1/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=authorization_code
&code=AUTH_CODE
&redirect_uri=https://app.example.com/oauth/callback
&code_verifier=YOUR_CODE_VERIFIER
\`\`\`
\`\`\`json
200 OK
{
  "access_token": "…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "…",
  "scope": "hr.employees:read hr.departments:read"
}
\`\`\`

### Step 3 — call the data API
\`\`\`
GET ${origin}/api/data/v1/hr/employees?limit=50
Authorization: Bearer ACCESS_TOKEN
\`\`\`

### Refresh (access tokens last 1h; refresh tokens rotate)
\`\`\`
POST ${origin}/api/oauth/v1/token
grant_type=refresh_token&refresh_token=REFRESH_TOKEN
\`\`\`
Each refresh returns a NEW refresh token; discard the old one. Reusing a rotated
refresh token revokes the whole grant (theft protection).

## 4. Endpoints

Authorization server (${origin}/api/oauth/v1):
- \`GET  /metadata\` — discovery document
- \`GET  /authorize\` — start authorization
- \`POST /token\` — code exchange & refresh
- \`POST /revoke\` — revoke a token (RFC 7009)
- \`POST /introspect\` — inspect a token (RFC 7662)

Resource server (${origin}/api/data/v1) — Bearer + scope required:
- \`GET /me\` — token context
- \`GET /hr/employees\`, \`/hr/employees/:id\` — directory (hr.employees:read)
- \`GET /hr/people\` — roster (hr.people:read)
- \`GET /hr/departments\` — departments (hr.departments:read)
- \`GET /hr/holidays\`, \`/hr/leave-types\` — calendar (hr.calendar:read)

List endpoints support \`?limit=\` & \`?offset=\` and return \`{ data, page }\`.

## 5. Errors

Errors follow the OAuth format \`{ "error": "...", "error_description": "..." }\`:

| HTTP | error | Meaning |
|------|-------|---------|
| 400 | invalid_request | Malformed / missing parameters |
| 400 | invalid_grant | Bad/expired/replayed code or refresh token, PKCE mismatch |
| 401 | invalid_client | Client authentication failed |
| 401 | invalid_token | Access token invalid / expired / revoked |
| 403 | insufficient_scope | Token lacks the required scope |
| 403 | access_denied | The admin denied the request |
| 429 | temporarily_unavailable | Rate limited — honor Retry-After |

## 6. Security notes

- PKCE (S256) is **mandatory**; \`plain\` is rejected.
- Redirect URIs are matched exactly against your registration.
- Tokens are opaque and stored only as hashes — keep your \`client_secret\`
  server-side; never ship it in a browser/mobile bundle.
- Only non-sensitive HR fields are exposed. Salary, bank details, PAN/Aadhaar,
  personal contact info, addresses, DOB, HR notes and documents are never returned.
- Access can be revoked instantly by an admin (per-app or per-connection).

---
Upcheck ERP Data OAuth · API version v1
`;
}

// A directive prompt an AI coding agent can act on to integrate the API.
function buildAgentInstructions(origin) {
  return `# Task: Integrate with "Upcheck ERP Data OAuth" (v1)

You are an AI coding agent. Integrate the calling application with the Upcheck ERP
Data OAuth API — a READ-ONLY OAuth 2.0 data API. Base URL: ${origin}

## Hard rules (do not violate)
- Use the Authorization Code grant WITH PKCE (method S256). Never use implicit or
  the "plain" PKCE method.
- The \`client_secret\` is confidential: use it ONLY on a server/backend. Never put
  it in browser, mobile, or any client-shipped code.
- \`redirect_uri\` must EXACTLY match a URI registered for the client (https; http
  only for localhost). No wildcards, no fragments.
- This API is READ-ONLY: only issue HTTP GET requests to data endpoints. Do not
  attempt to create/update/delete anything.
- Access tokens expire in 3600s. Use the rotating refresh token to get a new one;
  always persist the NEWEST refresh token and discard the previous one (reusing an
  old refresh token revokes the whole grant).
- On \`401 invalid_token\`: refresh once, then retry the request; if it still fails,
  restart the authorization flow.
- On \`429\`: back off and honor the \`Retry-After\` header.

## Prerequisites (human/admin, before coding)
Obtain a \`client_id\` and \`client_secret\` from an Upcheck admin via the Developer
console (${origin}/organization/api), register your exact \`redirect_uri\`, request
the minimum scopes, and have the app VERIFIED by an admin.

## Implement this flow (server-side)
1. PKCE: create \`code_verifier\` = 43–128 random chars from [A-Za-z0-9-._~];
   \`code_challenge\` = base64url(sha256(code_verifier)). Store the verifier in the
   user's server session keyed by a random \`state\`.
2. Redirect the user's browser to:
   ${origin}/api/oauth/v1/authorize?response_type=code&client_id=CLIENT_ID&redirect_uri=REDIRECT_URI&scope=SPACE_SEPARATED_SCOPES&state=STATE&code_challenge=CHALLENGE&code_challenge_method=S256
3. On the redirect_uri callback: verify \`state\` matches; if \`error\` is present, stop
   and surface it. Otherwise take \`code\`.
4. Exchange the code (server-to-server):
   POST ${origin}/api/oauth/v1/token
   Headers: Content-Type: application/x-www-form-urlencoded; Authorization: Basic base64("CLIENT_ID:CLIENT_SECRET")
   Body: grant_type=authorization_code&code=CODE&redirect_uri=REDIRECT_URI&code_verifier=VERIFIER
   Response JSON: { access_token, token_type:"Bearer", expires_in:3600, refresh_token, scope }.
5. Call data endpoints with header: Authorization: Bearer ACCESS_TOKEN.
6. Refresh when needed:
   POST ${origin}/api/oauth/v1/token
   Authorization: Basic base64("CLIENT_ID:CLIENT_SECRET")
   Body: grant_type=refresh_token&refresh_token=REFRESH_TOKEN

## Scopes (request least privilege)
${SCOPES.map((s) => `- ${s.id} — ${s.description}`).join('\n')}

## Data endpoints (HTTP GET, scope-gated)
- GET ${origin}/api/data/v1/me — token context (any valid token)
- GET ${origin}/api/data/v1/hr/employees[?department=&status=&q=&limit=&offset=] — scope hr.employees:read
- GET ${origin}/api/data/v1/hr/employees/:id — scope hr.employees:read
- GET ${origin}/api/data/v1/hr/people[?type=&status=&department=&q=&limit=&offset=] — scope hr.people:read
- GET ${origin}/api/data/v1/hr/departments — scope hr.departments:read
- GET ${origin}/api/data/v1/hr/holidays[?year=&type=&limit=&offset=] — scope hr.calendar:read
- GET ${origin}/api/data/v1/hr/leave-types — scope hr.calendar:read

## Response shape
List endpoints return: { "data": [ ... ], "page": { "total", "limit", "offset", "count", "hasMore" } }.
Paginate with ?limit= (capped server-side) and ?offset=.

## Errors
All errors are JSON: { "error", "error_description" }. Handle: invalid_request,
invalid_grant, invalid_client, invalid_token, insufficient_scope, access_denied,
temporarily_unavailable (429).

## Discovery
GET ${origin}/api/oauth/v1/metadata returns endpoints, supported scopes and PKCE methods.

## Reminder
Only non-sensitive HR fields are returned. Do not attempt to derive or request
salary, bank details, government IDs (PAN/Aadhaar), personal contact info,
addresses, dates of birth, HR notes, or documents — they are not exposed.
`;
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExportToolbar({ origin }) {
  const [flash, setFlash] = useState('');
  const ping = (label) => { setFlash(label); setTimeout(() => setFlash(''), 1600); };
  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); ping(label); }
    catch { ping('Copy failed'); }
  };
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6 p-3 rounded-xl bg-slate-50 border border-slate-200">
      <span className="text-xs font-medium text-slate-400 mr-1">Export:</span>
      <button className={btn} onClick={() => copy(buildMarkdown(origin), 'Markdown copied')}><Copy className="w-3.5 h-3.5" />Copy Markdown</button>
      <button className={btn} onClick={() => download('upcheck-erp-data-oauth.md', buildMarkdown(origin))}><FileCode className="w-3.5 h-3.5" />Download .md</button>
      <button className={btn} onClick={() => download('upcheck-erp-data-oauth.txt', buildMarkdown(origin))}><FileText className="w-3.5 h-3.5" />Download .txt</button>
      <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors" onClick={() => copy(buildAgentInstructions(origin), 'AI agent instructions copied')}>
        <Bot className="w-3.5 h-3.5" />Copy for AI agent
      </button>
      {flash && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Check className="w-3.5 h-3.5" />{flash}</span>}
    </div>
  );
}

export default function DocsPage() {
  const { isLoading } = useAuth(true);
  const [origin, setOrigin] = useState('https://your-portal.example.com');
  useEffect(() => { if (typeof window !== 'undefined') setOrigin(window.location.origin); }, []);
  if (isLoading) return <div className="min-h-screen bg-slate-50" />;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/organization/api" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><BookOpen className="w-5 h-5" /></div>
          <h1 className="text-2xl font-bold text-slate-900">Upcheck ERP Data OAuth — Developer Guide</h1>
        </div>

        <ExportToolbar origin={origin} />

        <p className="text-slate-600 leading-relaxed">
          A secure, versioned, <b>read-only</b> API that lets approved first-party apps read non-sensitive Upcheck ERP
          data. Phase 1 exposes the HR module (directory, roster, departments, holidays &amp; leave types). Access uses the
          OAuth 2.0 <b>Authorization Code + PKCE</b> flow; every connection is approved by an admin. Current version: <code>v1</code>.
        </p>

        <H id="register">1. Register your application</H>
        <p className="text-slate-600">In the <Link href="/organization/api" className="text-indigo-600 underline">Developer console</Link> → <b>Register application</b>. Provide:</p>
        <ul className="list-disc pl-6 text-slate-600 text-sm space-y-1 mt-2">
          <li><b>Name</b> &amp; description</li>
          <li><b>Redirect URIs</b> — exact URLs users return to after authorizing. <b>https</b> only (http allowed for <code>localhost</code>), no fragments, no wildcards. Matched exactly.</li>
          <li><b>Scopes</b> — the minimum your app needs.</li>
        </ul>
        <p className="text-slate-600 text-sm mt-2">You receive a <code>client_id</code> and a <code>client_secret</code> (shown <b>once</b> — store it securely). An admin must then <b>verify</b> the app before it can obtain tokens.</p>

        <H id="scopes">2. Scopes</H>
        <div className="overflow-x-auto"><table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Scope</th><th className="text-left px-3 py-2">Grants</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {SCOPES.map((s) => (<tr key={s.id}><td className="px-3 py-2 align-top"><code className="text-indigo-700 text-xs">{s.id}</code></td><td className="px-3 py-2 text-slate-600">{s.description}</td></tr>))}
          </tbody>
        </table></div>

        <H id="flow">3. Authorization Code + PKCE flow</H>
        <p className="text-slate-600 text-sm">Generate a PKCE <code>code_verifier</code> (43–128 chars) and its <code>code_challenge</code> = <code>BASE64URL(SHA256(verifier))</code>.</p>
        <p className="text-slate-600 text-sm mt-3"><b>Step 1 — send the user to the authorize endpoint:</b></p>
        <Code>{`GET ${origin}/api/oauth/v1/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://app.example.com/oauth/callback
  &scope=hr.employees:read hr.departments:read
  &state=RANDOM_CSRF_VALUE
  &code_challenge=CODE_CHALLENGE
  &code_challenge_method=S256`}</Code>
        <p className="text-slate-600 text-sm">An admin approves the consent screen. The browser is redirected to your <code>redirect_uri</code> with <code>?code=...&amp;state=...</code>. Verify <code>state</code> matches.</p>

        <p className="text-slate-600 text-sm mt-3"><b>Step 2 — exchange the code for tokens:</b></p>
        <Code>{`POST ${origin}/api/oauth/v1/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=authorization_code
&code=AUTH_CODE
&redirect_uri=https://app.example.com/oauth/callback
&code_verifier=YOUR_CODE_VERIFIER`}</Code>
        <Code>{`200 OK
{
  "access_token": "…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "…",
  "scope": "hr.employees:read hr.departments:read"
}`}</Code>

        <p className="text-slate-600 text-sm mt-3"><b>Step 3 — call the data API:</b></p>
        <Code>{`GET ${origin}/api/data/v1/hr/employees?limit=50
Authorization: Bearer ACCESS_TOKEN`}</Code>

        <p className="text-slate-600 text-sm mt-3"><b>Refresh</b> (access tokens last 1h; refresh tokens rotate):</p>
        <Code>{`POST ${origin}/api/oauth/v1/token
grant_type=refresh_token&refresh_token=REFRESH_TOKEN`}</Code>
        <p className="text-slate-500 text-xs">Each refresh returns a NEW refresh token; discard the old one. Reusing a rotated refresh token revokes the whole grant (theft protection).</p>

        <H id="endpoints">4. Endpoints</H>
        <ul className="text-sm text-slate-600 space-y-1">
          <li><code>GET  /api/oauth/v1/metadata</code> — discovery document</li>
          <li><code>GET  /api/oauth/v1/authorize</code> — start authorization</li>
          <li><code>POST /api/oauth/v1/token</code> — code exchange &amp; refresh</li>
          <li><code>POST /api/oauth/v1/revoke</code> — revoke a token (RFC 7009)</li>
          <li><code>POST /api/oauth/v1/introspect</code> — inspect a token (RFC 7662)</li>
          <li className="pt-2"><code>GET  /api/data/v1/me</code> — token context</li>
          <li><code>GET  /api/data/v1/hr/employees</code> · <code>/employees/:id</code> — directory</li>
          <li><code>GET  /api/data/v1/hr/people</code> — roster</li>
          <li><code>GET  /api/data/v1/hr/departments</code> — departments</li>
          <li><code>GET  /api/data/v1/hr/holidays</code> · <code>/leave-types</code> — calendar</li>
        </ul>
        <p className="text-slate-500 text-xs mt-2">List endpoints support <code>?limit=</code> &amp; <code>?offset=</code> and return <code>{'{ data, page }'}</code>.</p>

        <H id="errors">5. Errors</H>
        <p className="text-slate-600 text-sm">Errors follow the OAuth format <code>{'{ "error": "...", "error_description": "..." }'}</code>:</p>
        <div className="overflow-x-auto"><table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden mt-2">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">HTTP</th><th className="text-left px-3 py-2">error</th><th className="text-left px-3 py-2">Meaning</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            <tr><td className="px-3 py-2">400</td><td className="px-3 py-2"><code>invalid_request</code></td><td className="px-3 py-2">Malformed / missing parameters</td></tr>
            <tr><td className="px-3 py-2">400</td><td className="px-3 py-2"><code>invalid_grant</code></td><td className="px-3 py-2">Bad/expired/replayed code or refresh token, PKCE mismatch</td></tr>
            <tr><td className="px-3 py-2">401</td><td className="px-3 py-2"><code>invalid_client</code></td><td className="px-3 py-2">Client authentication failed</td></tr>
            <tr><td className="px-3 py-2">401</td><td className="px-3 py-2"><code>invalid_token</code></td><td className="px-3 py-2">Access token invalid / expired / revoked</td></tr>
            <tr><td className="px-3 py-2">403</td><td className="px-3 py-2"><code>insufficient_scope</code></td><td className="px-3 py-2">Token lacks the required scope</td></tr>
            <tr><td className="px-3 py-2">403</td><td className="px-3 py-2"><code>access_denied</code></td><td className="px-3 py-2">The admin denied the request</td></tr>
            <tr><td className="px-3 py-2">429</td><td className="px-3 py-2"><code>temporarily_unavailable</code></td><td className="px-3 py-2">Rate limited — honor <code>Retry-After</code></td></tr>
          </tbody>
        </table></div>

        <H id="security">6. Security notes</H>
        <ul className="list-disc pl-6 text-slate-600 text-sm space-y-1">
          <li>PKCE (S256) is <b>mandatory</b>; <code>plain</code> is rejected.</li>
          <li>Redirect URIs are matched exactly against your registration.</li>
          <li>Tokens are opaque and stored only as hashes — keep your <code>client_secret</code> server-side; never ship it in a browser/mobile bundle.</li>
          <li>Only non-sensitive HR fields are exposed. Salary, bank details, PAN/Aadhaar, personal contact info, addresses, DOB, HR notes and documents are never returned.</li>
          <li>Access can be revoked instantly by an admin (per-app or per-connection).</li>
        </ul>

        <p className="text-slate-400 text-xs mt-10 border-t border-slate-100 pt-4">Upcheck ERP Data OAuth · API version v1 · Contact your Upcheck administrator to register or verify an application.</p>
      </div>
    </div>
  );
}
