import { GridFSBucket, ObjectId } from 'mongodb';
import {
  canAccessGeneralSpace,
  canAccessProject,
  canReadFile,
  getGeneralSpacePermissionLevel,
} from '../projectPermissions';

/**
 * Bringing a Documentation-module file into a data room.
 *
 * THE WHOLE POINT OF THIS FILE IS THE PERMISSION RE-CHECK.
 *
 * Without it the bridge is a laundering machine: create a room you administer,
 * import a file you were never allowed to read, then read it out of the room
 * with the data room's own `view` grant. The importer must hold *both* sides —
 * read access to the source under Documentation's rules, and `edit` on the
 * destination room under the data room's. The second is enforced by the route
 * wrapper; the first is enforced here, by asking the same helpers the
 * Documentation routes ask, rather than by a simplified restatement of them
 * that would drift.
 *
 * WHY IT COPIES RATHER THAN LINKS.
 *
 * A pointer to the source's GridFS id would be free and always current, and it
 * would also break: saving a Documentation file deletes the previous GridFS
 * object outright (see files/[id] PUT). A room that lost its documents because
 * somebody fixed a typo upstream is worse than one that uses more storage. The
 * copy is also what makes the room stable for a counterparty — a document
 * under review must not change under them mid-review — and it lets the copy
 * live with whichever storage provider the data room is configured for.
 */

/** Documentation keeps its files in the default GridFS bucket. */
export function documentationBucket(db) {
  return new GridFSBucket(db);
}

async function userTeamsOf(db, user) {
  const userIdStr = user._id?.toString();
  if (!userIdStr) return [];
  return db
    .collection('teams')
    .find({
      $or: [
        { members: userIdStr },
        { lead: userIdStr },
        { members: user._id },
        { lead: user._id },
      ],
    })
    .toArray();
}

/**
 * May this user read this Documentation resource?
 *
 * Mirrors GET /api/documentation/files/[id] exactly, including the General
 * space's separate permission document and its `readScope: 'own'` case.
 */
export async function canReadDocumentationResource(db, user, resource, userTeams) {
  if (!resource) return false;

  const teams = userTeams || (await userTeamsOf(db, user));

  if (resource.projectId === 'general') {
    const generalPerms = await db
      .collection('general_space_permissions')
      .findOne({ _id: 'general' });
    const settings = generalPerms?.permissionSettings;

    if (!canAccessGeneralSpace(user, settings)) return false;

    const perms = getGeneralSpacePermissionLevel(user, settings);
    if (!perms || perms.readScope === 'none') return false;

    if (perms.readScope === 'own') {
      return (
        resource.createdBy === user.username ||
        resource.uploadedBy?.username === user.username
      );
    }
    return true;
  }

  if (!ObjectId.isValid(resource.projectId)) return false;

  const project = await db
    .collection('projects')
    .findOne({ _id: new ObjectId(resource.projectId) });

  // A resource whose project has been deleted is unreachable rather than
  // unrestricted. The Documentation route treats a missing project as "no
  // project rules to apply" and lets it through; that is the wrong default for
  // a bridge into a room that outside parties can be given access to.
  if (!project) return false;

  if (!canAccessProject(user, project, teams)) return false;
  return canReadFile(user, project, resource, teams);
}

/**
 * Why this resource cannot be imported, or null if it can — separate from
 * whether the user may read it, because these are properties of the file.
 */
export function unimportableReason(resource) {
  // Importing would strip the password: the copy lands in a room whose access
  // rules know nothing about it, and could then be handed to a counterparty
  // through a share link. Whoever set the password gets to decide that, not
  // whoever is building the room.
  if (resource.isPasswordProtected) {
    return 'password-protected files cannot be imported';
  }

  // Documentation can keep a file with an external provider instead of GridFS,
  // in which case there is no fileId and only an externalUrl. Copying from an
  // arbitrary URL server-side is a request-forgery surface, so it is refused
  // rather than attempted.
  if (!resource.fileId) {
    return resource.externalUrl
      ? 'file is stored externally and cannot be imported'
      : 'file has no stored content';
  }

  return null;
}

/** Filter a list of resources down to those this user may read. */
export async function readableResources(db, user, resources) {
  const teams = await userTeamsOf(db, user);
  const allowed = [];
  for (const resource of resources) {
    // Sequential rather than Promise.all: each check may load a project, and
    // fanning out an unbounded list of finds is how a browse endpoint becomes
    // a way to pin the database.
    if (await canReadDocumentationResource(db, user, resource, teams)) {
      allowed.push(resource);
    }
  }
  return allowed;
}

/** Projects this user can see in the Documentation module, plus General. */
export async function accessibleProjects(db, user) {
  const teams = await userTeamsOf(db, user);
  const projects = await db
    .collection('projects')
    .find({ isDeleted: { $ne: true } })
    .project({ name: 1, description: 1, permissionSettings: 1, members: 1, superManager: 1 })
    .limit(200)
    .toArray();

  const visible = projects
    .filter((p) => canAccessProject(user, p, teams))
    .map(({ _id, name, description }) => ({ _id, name, description }));

  const generalPerms = await db
    .collection('general_space_permissions')
    .findOne({ _id: 'general' });

  if (canAccessGeneralSpace(user, generalPerms?.permissionSettings)) {
    visible.unshift({ _id: 'general', name: 'General', description: 'Shared workspace' });
  }

  return visible;
}
