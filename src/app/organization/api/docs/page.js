'use client';

// In-app documentation for "Upcheck ERP Data OAuth". Mirrors OAUTH_API.md.
// Intended for developers of first-party apps that will consume Upcheck ERP data.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { SCOPES } from '../../../../lib/oauth/scopes';
import { ArrowLeft, BookOpen } from 'lucide-react';

function Code({ children }) {
  return <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto my-3"><code>{children}</code></pre>;
}
function H({ children, id }) {
  return <h2 id={id} className="text-xl font-bold text-slate-900 mt-10 mb-3 scroll-mt-6">{children}</h2>;
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
