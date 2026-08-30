/**
 * The single authorisation gate for every data room API route.
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this wrapper, `getUserFromToken` was copy-pasted into 53 route files
 * in five mutually incompatible variants, and 55 of 60 routes performed no
 * permission check at all — they verified only that *a* session existed. Room
 * expiry and IP whitelisting were enforced on two routes out of sixty, and no
 * route accepted a Bearer token, so the mobile app could not reach the data
 * room at all.
 *
 * Centralising the decision here makes "did we forget a check?" a grep instead
 * of an audit, and lets room-level controls be enforced somewhere they cannot
 * be forgotten.
 *
 * DEFAULT-DENY
 * ------------
 * A route that declares neither `requires` nor `roles` admits only
 * Admin / Console admin. Forgetting to declare a permission fails closed, not
 * open. List endpoints that filter their own results opt out explicitly with
 * `selfScoped: true`, which documents the intent at the call site.
 *
 * USAGE
 * -----
 *   export const GET = withDataroomAuth(
 *     async (request, { user, db, room, resource }) => { ... },
 *     { requires: 'download', resource: { type: 'document', param: 'id' } },
 *   );
 *
 *   export const GET = withDataroomAuth(handler, { selfScoped: true });
 *   export const POST = withDataroomAuth(handler, { roles: ADMIN_ROLES });
 */

import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import clientPromise from '../mongodb';
import { getAuthUserResult } from '../auth';
import { hasPermission, PERMISSION_TYPES } from './permission-checker';
import { logAudit } from './audit-logger';
import { validateIpWhitelist, isRoomExpired, getClientIp } from './security';
import { resolveShareSession, shareCovers } from './share-links';

export const ADMIN_ROLES = ['Admin', 'Console admin'];

/**
 * Capabilities reported to handlers (and onward to the viewer UI) for the
 * resource under request.
 *
 * PRINT AND DOWNLOAD ARE NOW SEPARABLE, BUT NOT AIRTIGHT. The viewer no
 * longer hands the raw file to the browser's PDF plugin — it rasterises pages
 * to canvas and prints those — so `print` without `download` yields a
 * watermarked raster rather than the source file. What it does not stop is a
 * determined viewer reassembling the streamed bytes: the file still crosses
 * the wire to render it.
 *
 * Phase 6 closes that by rendering pages server-side, so the source file never
 * reaches the browser at all. Until then `printImpliesEgress` stays true and
 * says so, rather than letting callers assume the control is airtight.
 */
const CAPABILITY_PERMISSIONS = ['view', 'comment', 'edit', 'download', 'print'];

/** Collection holding each resource type, and the field pointing at its room. */
const RESOURCE_COLLECTIONS = {
  room: { collection: 'dataroom_rooms', roomField: '_id' },
  folder: { collection: 'dataroom_folders', roomField: 'roomId' },
  document: { collection: 'dataroom_documents', roomField: 'roomId' },
};

function json(body, status) {
  return NextResponse.json(body, { status });
}

/**
 * Resolve every capability the user holds on a resource, in one pass, so a
 * handler never has to fan out its own hasPermission calls to decide what to
 * show. Only computed when a route asks for it (`capabilities: true`), since
 * it costs one permission resolution per verb.
 */
async function resolveCapabilities(user, ref, roomId, room) {
  const caps = {};
  await Promise.all(
    CAPABILITY_PERMISSIONS.map(async (permission) => {
      caps[`can${permission[0].toUpperCase()}${permission.slice(1)}`] = await hasPermission({
        user,
        resourceType: ref.type,
        resourceId: ref.id,
        permission,
        roomId,
      });
    }),
  );

  // A room-wide download switch overrides an individual grant.
  if (room?.settings?.allowDownload === false && !ADMIN_ROLES.includes(user.role)) {
    caps.canDownload = false;
  }

  // See CAPABILITY_PERMISSIONS: printing is an egress path until the in-app
  // viewer lands, so a caller that trusts canPrint should know that.
  caps.printImpliesEgress = true;

  return caps;
}

function isAdminRole(user) {
  return !!user && ADMIN_ROLES.includes(user.role);
}

/**
 * getAuthUserResult returns the whole admin_users document, where the previous
 * per-route helpers projected down to four fields. Handlers occasionally echo
 * the user object back in a response, so strip the credential material here
 * rather than trusting 60 routes to remember.
 */
function stripSecrets(user) {
  if (!user) return user;
  const {
    password,
    sessionToken,
    webauthn,
    backupCodes,
    groqApiKey,
    reauthAt,
    reauthExpires,
    ...safe
  } = user;
  return safe;
}

/**
 * Resolve an authenticated external (counterparty) user from the
 * `external_user_token` cookie.
 *
 * The session expiry stored on the user document was previously checked only
 * by /api/dataroom/external-auth/me — the seven other routes that read this
 * cookie honoured the token indefinitely. It is enforced here for all of them.
 */
async function resolveExternalUser(request, db) {
  const token = request.cookies.get('external_user_token')?.value;
  if (!token) return null;

  const external = await db.collection('dataroom_external_users').findOne(
    { sessionToken: token },
    { projection: { passwordHash: 0 } },
  );
  if (!external) return null;

  if (external.sessionExpiry && new Date() > new Date(external.sessionExpiry)) {
    return null;
  }
  if (external.status && external.status !== 'active') return null;

  return {
    _id: external._id,
    id: external._id.toString(),
    email: external.email,
    username: external.name,
    name: external.name,
    company: external.company,
    role: external.role || 'External User',
    isExternal: true,
  };
}

/**
 * Work out which resource this request is acting on, from the route options.
 * Returns { type, id } or null when the route is not resource-scoped.
 */
async function resolveResourceRef({ resource, resolve }, request, params) {
  if (typeof resolve === 'function') {
    return (await resolve(request, params)) || null;
  }
  if (!resource) return null;

  const { type, param, query, body: bodyKey } = resource;

  let id = null;
  if (param) id = params?.[param] ?? null;
  if (!id && query) id = new URL(request.url).searchParams.get(query);
  if (!id && bodyKey) {
    // Reading the body here would consume the stream the handler needs, so
    // body-sourced ids must be resolved by the route itself via `resolve`.
    throw new Error(
      'resource.body is not supported — use `resolve` and pass the id explicitly',
    );
  }

  if (!id) return null;
  return { type, id: String(id) };
}

/** Load the room a resource belongs to, so room-level controls can be applied. */
async function loadRoomForResource(db, ref, fallbackRoomId) {
  let roomId = fallbackRoomId || null;

  if (ref) {
    const spec = RESOURCE_COLLECTIONS[ref.type];
    // An unrecognised type must fail closed. Letting it through would run the
    // permission check against a resourceType nothing was ever granted on,
    // which denies by accident rather than by design — and would silently skip
    // the room controls below.
    if (!spec) return { room: null, roomId: null, invalid: true };
    if (!ObjectId.isValid(ref.id)) return { room: null, roomId: null, invalid: true };

    if (ref.type === 'room') {
      roomId = ref.id;
    } else {
      const doc = await db
        .collection(spec.collection)
        .findOne({ _id: new ObjectId(ref.id) }, { projection: { roomId: 1, isDeleted: 1 } });
      if (!doc || doc.isDeleted) return { room: null, roomId: null, missing: true };
      roomId = doc.roomId?.toString() || null;
    }
  }

  if (!roomId || !ObjectId.isValid(roomId)) return { room: null, roomId: null, missing: false };

  const room = await db.collection('dataroom_rooms').findOne({ _id: new ObjectId(roomId) });
  return { room, roomId, missing: !room };
}

/**
 * Build a `resolve` function for routes scoped to a secondary entity — a task,
 * Q&A thread, workflow, viewer group, metadata template, share record.
 *
 * Grants are only ever stored against a room, folder or document, so
 * permission on one of these entities means permission on its room. This looks
 * the entity up by id and hands the wrapper the room it belongs to.
 *
 *   resolve: roomOf('dataroom_tasks', 'id')
 */
export function roomOf(collection, param = 'id', field = 'roomId') {
  return async function resolveRoomOf(request, params) {
    const id = params?.[param];
    if (!id || !ObjectId.isValid(id)) return null;

    const client = await clientPromise;
    const db = client.db('resources');
    const doc = await db
      .collection(collection)
      .findOne({ _id: new ObjectId(id) }, { projection: { [field]: 1 } });

    const roomId = doc?.[field];
    return roomId ? { type: 'room', id: roomId.toString() } : null;
  };
}

/**
 * Build a `resolve` function for routes whose target arrives in a JSON body.
 * Reads a clone so the handler can still consume the request stream, and
 * returns null for non-JSON bodies (multipart uploads must not be parsed
 * twice — those routes use `selfScoped` and check inline instead).
 */
export function resourceFromBody(typeKey, idKey, fixedType = null) {
  return async function resolveFromBody(request) {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    const body = await request.clone().json().catch(() => null);
    if (!body) return null;

    const type = fixedType || body[typeKey];
    const id = body[idKey];
    return type && id ? { type: String(type), id: String(id) } : null;
  };
}

/**
 * Wrap a data room route handler with identity, room and permission checks.
 *
 * @param {Function} handler  (request, ctx) => Response
 * @param {Object}   options
 * @param {string|string[]} [options.requires]  permission(s) from PERMISSION_TYPES
 * @param {string[]} [options.roles]            hard role gate, independent of grants
 * @param {Object}  [options.resource]          { type: 'document'|'folder'|'room', param?, query? }
 * @param {Function} [options.resolve]          async (request, params) => { type, id }
 * @param {string}  [options.roomQuery]         query param naming the room, when not resource-scoped
 * @param {boolean} [options.allowExternal]     admit external users (default false)
 * @param {boolean} [options.allowShare]        admit share-link sessions (default false)
 * @param {boolean} [options.selfScoped]        route filters its own results; skips the resource check
 * @param {boolean} [options.skipRoomChecks]    skip expiry/IP enforcement (rare; say why at the call site)
 */
export function withDataroomAuth(handler, options = {}) {
  const {
    requires,
    roles,
    resource,
    resolve,
    roomQuery = 'roomId',
    allowExternal = false,
    allowShare = false,
    selfScoped = false,
    skipRoomChecks = false,
    capabilities = false,
  } = options;

  const requiredPermissions = requires
    ? (Array.isArray(requires) ? requires : [requires])
    : [];

  for (const p of requiredPermissions) {
    if (!PERMISSION_TYPES.includes(p)) {
      throw new Error(
        `withDataroomAuth: unknown permission "${p}". Expected one of ${PERMISSION_TYPES.join(', ')}`,
      );
    }
  }

  // Default-deny: a route declaring no gate at all is admin-only. `selfScoped`
  // is an explicit, greppable acknowledgement that the handler scopes itself.
  const declaresNothing =
    requiredPermissions.length === 0 && !roles && !selfScoped;

  return async function guardedRoute(request, context = {}) {
    try {
      const params = context.params ? await context.params : {};

      const client = await clientPromise;
      const db = client.db('resources');

      // ── Identity ────────────────────────────────────────────────────────
      let user = null;

      const internal = await getAuthUserResult(request);
      if (internal.status === 'db_unavailable') {
        // A database blip is not an authentication failure and must not be
        // reported as one, or a transient outage logs everybody out.
        return json({ error: 'Service temporarily unavailable' }, 503);
      }
      if (internal.status === 'ok') user = stripSecrets(internal.user);

      if (!user && allowExternal) {
        user = await resolveExternalUser(request, db);
      }

      // A share-link session is an identity of last resort: it is consulted
      // only when nobody is signed in, so a staff member following a link
      // keeps their own (usually wider) access rather than being narrowed to
      // the link's.
      let shareContext = null;
      if (!user && allowShare) {
        shareContext = await resolveShareSession(request, db);
        if (shareContext) {
          const { session, share } = shareContext;
          user = {
            _id: session._id,
            id: session._id.toString(),
            email: session.email,
            username: session.email || 'Share link visitor',
            name: session.email || 'Share link visitor',
            role: 'Share link',
            isShare: true,
            shareId: share._id,
          };
        }
      }

      if (!user) return json({ error: 'Unauthorized' }, 401);

      if (user.isExternal && !allowExternal) {
        return json({ error: 'Forbidden' }, 403);
      }

      if (!user.isExternal && (user.employmentStatus === 'suspended' || user.employmentStatus === 'terminated')) {
        return json({ error: 'Your account is no longer active' }, 403);
      }

      // A share visitor is never an administrator, whatever the link says.
      const admin = !shareContext && isAdminRole(user);

      // ── Role gate ───────────────────────────────────────────────────────
      if (roles && !roles.includes(user.role)) {
        return json({ error: 'Forbidden' }, 403);
      }

      if (declaresNothing && !admin) {
        console.warn(
          `[withDataroomAuth] ${new URL(request.url).pathname} declares no permission ` +
            'and is therefore admin-only. Add `requires` or `selfScoped: true`.',
        );
        return json({ error: 'Forbidden' }, 403);
      }

      // ── Resource + room resolution ──────────────────────────────────────
      const ref = await resolveResourceRef({ resource, resolve }, request, params);

      const fallbackRoomId = new URL(request.url).searchParams.get(roomQuery);
      const { room, roomId, missing, invalid } = await loadRoomForResource(
        db,
        ref,
        fallbackRoomId,
      );

      if (invalid) return json({ error: 'Invalid resource id' }, 400);
      if (missing) return json({ error: 'Not found' }, 404);

      // ── Room-level controls ─────────────────────────────────────────────
      // Enforced here rather than per-route: previously only 2 of 60 routes
      // applied them, so an expired or IP-restricted room stayed readable
      // through every other endpoint.
      if (room && !skipRoomChecks) {
        if (room.isDeleted) return json({ error: 'Not found' }, 404);

        if (isRoomExpired(room) && !admin) {
          return json({ error: 'This room has expired' }, 403);
        }

        const clientIp = getClientIp(request);
        if (!validateIpWhitelist(clientIp, room.ipWhitelist)) {
          await logAudit({
            action: 'IP_WHITELIST_VIOLATION',
            resourceType: ref?.type || 'room',
            resourceId: ref?.id || roomId,
            roomId: room._id,
            user,
            details: { clientIp, deniedAccess: true, path: new URL(request.url).pathname },
            request,
          }).catch(() => {});
          return json({ error: 'Access denied: IP not whitelisted' }, 403);
        }
      }

      // ── Share-link gate ─────────────────────────────────────────────────
      // A share visitor holds exactly what the link grants, on exactly what
      // the link covers. Both halves are load-bearing: without the coverage
      // check a link to one document would authenticate its holder for every
      // document in the room, because the gate would see a valid identity
      // carrying `view` and stop there.
      if (shareContext) {
        const { share } = shareContext;

        if (!requiredPermissions.length || !ref) {
          // A route that scopes itself (`selfScoped`) or names no resource
          // cannot be bounded to the link's scope, so it is not reachable
          // through a link at all.
          return json({ error: 'Access denied' }, 403);
        }

        const covered = await shareCovers(db, share, ref, roomId);
        const granted = requiredPermissions.every((p) => share.permissions.includes(p));

        if (!covered || !granted) {
          await logAudit({
            action: 'SHARE_ACCESS_DENIED',
            resourceType: ref.type,
            resourceId: ref.id,
            roomId: room?._id || null,
            user,
            details: {
              shareId: share._id?.toString(),
              permission: requiredPermissions.join(','),
              reason: covered ? 'permission_not_granted' : 'outside_share_scope',
              path: new URL(request.url).pathname,
            },
            request,
          }).catch(() => {});
          return json({ error: 'Access denied' }, 403);
        }
      }

      // ── Permission gate ─────────────────────────────────────────────────
      if (!shareContext && requiredPermissions.length && !selfScoped) {
        if (!ref) {
          console.warn(
            `[withDataroomAuth] ${new URL(request.url).pathname} requires ` +
              `${requiredPermissions.join(', ')} but no resource could be resolved.`,
          );
          return json({ error: 'Missing resource identifier' }, 400);
        }

        for (const permission of requiredPermissions) {
          const allowed = await hasPermission({
            user,
            resourceType: ref.type,
            resourceId: ref.id,
            permission,
            roomId,
          });

          if (!allowed) {
            await logAudit({
              action: 'PERMISSION_DENIED',
              resourceType: ref.type,
              resourceId: ref.id,
              roomId: room?._id || null,
              user,
              details: { permission, path: new URL(request.url).pathname },
              request,
            }).catch(() => {});
            return json({ error: 'Access denied' }, 403);
          }
        }
      }

      // A share visitor's capabilities are the link's permissions, not the
      // result of a grant lookup: the visitor holds no grants of their own, so
      // asking the permission checker would report nothing and the viewer
      // would hide every control the link actually allows.
      let caps = null;
      if (capabilities && ref) {
        caps = shareContext
          ? {
              canView: shareContext.share.permissions.includes('view'),
              canComment: shareContext.share.permissions.includes('comment'),
              canEdit: shareContext.share.permissions.includes('edit'),
              canDownload:
                shareContext.share.permissions.includes('download') &&
                room?.settings?.allowDownload !== false,
              canPrint: shareContext.share.permissions.includes('print'),
              printImpliesEgress: true,
            }
          : await resolveCapabilities(user, ref, roomId, room);
      }

      return await handler(request, {
        user,
        db,
        client,
        params,
        room,
        roomId,
        resource: ref,
        capabilities: caps,
        isAdmin: admin,
        isExternal: !!user.isExternal,
        share: shareContext?.share || null,
      });
    } catch (error) {
      console.error(`Data room route error (${request?.url}):`, error);
      return json({ error: 'Internal Server Error' }, 500);
    }
  };
}

export default withDataroomAuth;
