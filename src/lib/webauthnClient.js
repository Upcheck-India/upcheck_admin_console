// Browser-side WebAuthn helpers (no server imports). Handles the base64url <->
// ArrayBuffer conversions the native WebAuthn API requires and wraps the
// passkey assertion ceremony used for passwordless login.

export function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isWebAuthnSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

// Runs the full passkey login ceremony for `username`:
//   options -> navigator.credentials.get -> verify (which sets the session).
// Returns the parsed JSON from the verify endpoint. Throws on cancel/failure.
export async function authenticateWithPasskey(username) {
  const optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username }),
  });

  const options = await optionsRes.json();
  if (!optionsRes.ok) {
    const err = new Error(options.message || options.error || 'No passkey available');
    err.code = options.error;
    throw err;
  }

  const publicKey = {
    challenge: base64UrlToUint8Array(options.challenge),
    timeout: options.timeout,
    rpId: options.rpId,
    userVerification: options.userVerification || 'preferred',
    allowCredentials: (options.allowCredentials || []).map(cred => ({
      id: base64UrlToUint8Array(cred.id),
      type: cred.type || 'public-key',
      transports: cred.transports,
    })),
  };

  const assertion = await navigator.credentials.get({ publicKey });
  if (!assertion) throw new Error('No credential returned');

  const credential = {
    id: assertion.id,
    rawId: bufferToBase64Url(assertion.rawId),
    type: assertion.type,
    response: {
      authenticatorData: bufferToBase64Url(assertion.response.authenticatorData),
      clientDataJSON: bufferToBase64Url(assertion.response.clientDataJSON),
      signature: bufferToBase64Url(assertion.response.signature),
      userHandle: assertion.response.userHandle
        ? bufferToBase64Url(assertion.response.userHandle)
        : null,
    },
    clientExtensionResults: assertion.getClientExtensionResults?.() || {},
  };

  const verifyRes = await fetch('/api/auth/webauthn/authenticate/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, credential }),
  });

  const data = await verifyRes.json();
  if (!verifyRes.ok || !data.success) {
    throw new Error(data.message || data.error || 'Passkey authentication failed');
  }
  return data;
}
