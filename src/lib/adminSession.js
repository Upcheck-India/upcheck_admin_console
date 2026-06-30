// Shared helper for issuing an internal admin session.
//
// The console authenticates internal users with an httpOnly `admin_token`
// cookie whose value is a random session token also stored on the user's
// `admin_users` document (see src/app/api/auth/route.js). Passwordless flows
// (passkey / backup code login) must create exactly the same kind of session so
// the rest of the app continues to work unchanged.

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { sendEmail, EMAIL_TYPES } from './emailService.js';

export const ADMIN_SESSION_MAX_AGE = 7200; // seconds (2 hours) - matches password login

function getClientIP(request) {
  if (!request) return 'unknown';
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIP) return realIP;
  return 'unknown';
}

function getDeviceType(ua) {
  if (!ua) return 'unknown';
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

function parseUserAgent(ua) {
  if (!ua) return 'Unknown Device';
  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/expo/i.test(ua)) browser = 'Expo App';

  return `${browser} on ${os}`;
}

async function getLocation(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') {
    return 'Localhost';
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success') {
        return `${data.city || ''}, ${data.country || ''}`.trim().replace(/^,\s*/, '') || 'Unknown Location';
      }
    }
  } catch (e) {
    // ignore
  }
  return 'Unknown Location';
}

export async function createSession(db, userId, request = null) {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const user = await db.collection('admin_users').findOne({ _id: userId });
  if (!user) throw new Error('User not found');

  const ip = getClientIP(request);
  const userAgent = request ? (request.headers.get('user-agent') || '') : '';
  const deviceType = getDeviceType(userAgent);
  const deviceName = parseUserAgent(userAgent);
  const location = await getLocation(ip);

  // Check if this is a new device or new location
  const existingSessions = await db.collection('admin_sessions')
    .find({ userId })
    .toArray();

  const isNewDevice = existingSessions.length > 0 && !existingSessions.some(
    s => s.name.toLowerCase() === deviceName.toLowerCase()
  );
  
  const isNewLocation = existingSessions.length > 0 && !existingSessions.some(
    s => s.location.toLowerCase() === location.toLowerCase()
  );

  const shouldSendAlert = (isNewDevice || isNewLocation) && user.emailAlertsOnNewLogin !== false && user.email;

  if (shouldSendAlert) {
    sendEmail({
      to: user.email,
      subject: `🛡️ Security Alert: New Login Detected for ${user.username}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 48px;">🛡️</span>
            <h2 style="color: #0f172a; margin-top: 12px; margin-bottom: 4px; font-size: 20px; font-weight: 700;">New Login Alert</h2>
            <p style="color: #64748b; font-size: 14px; margin: 0;">We detected a sign-in from a new device or location.</p>
          </div>
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #f1f5f9;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
              <tr>
                <td style="padding: 6px 0; font-weight: 600; width: 120px;">Username:</td>
                <td style="padding: 6px 0; color: #0f172a;">${user.username}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600;">Device:</td>
                <td style="padding: 6px 0; color: #0f172a;">${deviceName} ${isNewDevice ? '<span style="color: #ef4444; font-weight: bold; font-size: 12px; background: #fee2e2; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">NEW</span>' : ''}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600;">Location:</td>
                <td style="padding: 6px 0; color: #0f172a;">${location} ${isNewLocation ? '<span style="color: #ef4444; font-weight: bold; font-size: 12px; background: #fee2e2; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">NEW</span>' : ''}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600;">IP Address:</td>
                <td style="padding: 6px 0; color: #0f172a; font-family: monospace;">${ip}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: 600;">Time:</td>
                <td style="padding: 6px 0; color: #0f172a;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>
          <p style="color: #475569; font-size: 13px; line-height: 1.6; margin-bottom: 24px;">
            If this login was you, no action is needed. If you do not recognize this login, please <strong>log in immediately</strong> and revoke the session from your Security Manager panel.
          </p>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
              You received this alert because login notification settings are enabled for your account. You can disable this setting in your Security / Devices tab anytime.
            </p>
          </div>
        </div>
      `,
      type: EMAIL_TYPES.LOGIN_ALERT
    }).catch(err => console.error('Failed to send login alert email:', err));
  }

  // Enforce concurrent session limit if exceeded
  const maxSessions = user.maxConcurrentSessions !== undefined ? user.maxConcurrentSessions : 1;
  if (existingSessions.length >= maxSessions) {
    const removeCount = existingSessions.length - maxSessions + 1;
    const toRemove = existingSessions.slice(0, removeCount);
    const toRemoveTokens = toRemove.map(s => s.token);
    
    // Delete from admin_sessions
    await db.collection('admin_sessions').deleteMany({
      _id: { $in: toRemove.map(s => s._id) }
    });

    // Pull from user's sessionToken array
    await db.collection('admin_users').updateOne(
      { _id: userId },
      { $pull: { sessionToken: { $in: toRemoveTokens } } }
    );
  }

  // Create new session document
  const newSession = {
    userId,
    token: sessionToken,
    ip,
    userAgent: userAgent.substring(0, 300),
    deviceType,
    name: deviceName,
    location,
    createdAt: new Date(),
    lastUsedAt: new Date()
  };
  await db.collection('admin_sessions').insertOne(newSession);

  // Update user's sessionToken array
  const currentToken = user.sessionToken;
  let updatedTokens = [];
  if (Array.isArray(currentToken)) {
    updatedTokens = [...currentToken, sessionToken];
  } else if (typeof currentToken === 'string' && currentToken) {
    updatedTokens = [currentToken, sessionToken];
  } else {
    updatedTokens = [sessionToken];
  }

  // Keep only the valid active tokens matching admin_sessions
  const activeSessions = await db.collection('admin_sessions').find({ userId }).toArray();
  const activeTokens = activeSessions.map(s => s.token);
  updatedTokens = updatedTokens.filter(t => activeTokens.includes(t));

  await db.collection('admin_users').updateOne(
    { _id: userId },
    { 
      $set: { 
        sessionToken: updatedTokens,
        lastLogin: new Date() 
      } 
    }
  );

  return sessionToken;
}

// Persist a fresh session token on the user document and return it.
export async function issueAdminSessionToken(db, userId, request = null) {
  return await createSession(db, userId, request);
}

// Write the admin_token cookie for the current response.
export async function setAdminSessionCookie(sessionToken) {
  const cookieStore = await cookies();
  cookieStore.set('admin_token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
  });
}
