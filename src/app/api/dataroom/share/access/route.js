// @public-route exchanges a share token (plus whatever the link demands) for a scoped session
import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { sendEmail } from '../../../../../lib/emailService';
import { getAuthUserResult } from '../../../../../lib/auth';
import {
  SHARE_COOKIE,
  SHARE_SESSION_MS,
  audienceAdmits,
  consumeVerificationCode,
  issueVerificationCode,
  linkUnusableReason,
  mintShareSession,
  normalizeShare,
  requirementFor,
} from '../../../../../lib/dataroom/share-links';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Who is at the other end, if anyone is already signed in. */
async function currentIdentity(request, db) {
  const internal = await getAuthUserResult(request);
  if (internal.status === 'ok') return internal.user;

  const token = request.cookies.get('external_user_token')?.value;
  if (!token) return null;

  const external = await db
    .collection('dataroom_external_users')
    .findOne({ sessionToken: token }, { projection: { passwordHash: 0 } });

  if (!external) return null;
  if (external.sessionExpiry && new Date() > new Date(external.sessionExpiry)) return null;
  if (external.status && external.status !== 'active') return null;

  return { ...external, isExternal: true };
}

/**
 * POST /api/dataroom/share/access
 *
 * Body: { token, email?, code?, requestCode? }
 *
 * Turns a share link into a session cookie the authorisation gate accepts,
 * having first satisfied both of the link's independent conditions: its
 * protection (how much the visitor must prove) and its audience (whether this
 * visitor is admitted at all).
 *
 * Failures are deliberately uniform. Telling an unauthenticated caller "that
 * address is not on the list" turns the endpoint into an oracle for who has
 * been granted access to what.
 */
export async function POST(request) {
  try {
    const { token, email, code, requestCode } = await request.json().catch(() => ({}));

    if (!token) {
      return NextResponse.json({ error: 'Share token required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('resources');

    const share = normalizeShare(
      await db.collection('dataroom_shares').findOne({ shareToken: token }),
    );

    const unusable = linkUnusableReason(share);
    if (unusable) {
      return NextResponse.json({ error: unusable }, { status: share ? 403 : 404 });
    }

    const need = requirementFor(share);
    const signedIn = await currentIdentity(request, db);

    // ── Protection ──────────────────────────────────────────────────────
    let visitorEmail = null;

    if (need.needsExternalAccount) {
      if (!signedIn?.isExternal) {
        return NextResponse.json(
          {
            error: 'This link requires a registered external account.',
            needsExternalAccount: true,
          },
          { status: 401 },
        );
      }
      visitorEmail = signedIn.email;
    } else if (need.needsEmail) {
      const addr = String(email || '').toLowerCase().trim();
      if (!EMAIL_RE.test(addr)) {
        return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
      }
      visitorEmail = addr;

      if (need.needsCode) {
        // Sending the code is a separate round-trip on the same endpoint, so
        // the client never has to know two URLs for one flow.
        if (requestCode || !code) {
          // The audience is checked before a code is sent, so a restricted
          // link cannot be used to send mail to arbitrary addresses.
          if (!audienceAdmits(share, { email: visitorEmail, user: signedIn })) {
            return NextResponse.json(
              { error: 'This link is not available to that address.' },
              { status: 403 },
            );
          }

          const issued = await issueVerificationCode(db, share, visitorEmail);
          await sendEmail({
            to: visitorEmail,
            subject: 'Your Upcheck data room access code',
            html:
              `<p>Your access code is <strong style="font-size:20px;letter-spacing:3px">${issued}</strong>.</p>` +
              '<p>It expires in 15 minutes. If you did not request it, you can ignore this email.</p>',
          }).catch((err) => console.error('Share code email failed:', err));

          return NextResponse.json({ codeSent: true });
        }

        const ok = await consumeVerificationCode(db, share, visitorEmail, code);
        if (!ok) {
          return NextResponse.json(
            { error: 'That code is not valid or has expired.' },
            { status: 403 },
          );
        }
      }
    } else if (signedIn) {
      // An open link still records who the visitor was when it can tell.
      visitorEmail = signedIn.email || null;
    }

    // ── Audience ────────────────────────────────────────────────────────
    if (!audienceAdmits(share, { email: visitorEmail, user: signedIn })) {
      return NextResponse.json(
        { error: 'This link is not available to that address.' },
        { status: 403 },
      );
    }

    const sessionToken = await mintShareSession(db, share, {
      email: visitorEmail,
      user: signedIn,
      request,
    });

    const response = NextResponse.json({
      success: true,
      resourceType: share.resourceType,
      resourceId: share.resourceId.toString(),
      permissions: share.permissions,
    });

    response.cookies.set(SHARE_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SHARE_SESSION_MS / 1000,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('POST /api/dataroom/share/access error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/dataroom/share/access - end a share session
export async function DELETE(request) {
  const token = request.cookies.get(SHARE_COOKIE)?.value;

  if (token) {
    const client = await clientPromise;
    await client.db('resources').collection('dataroom_share_sessions').deleteOne({ token });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SHARE_COOKIE);
  return response;
}
