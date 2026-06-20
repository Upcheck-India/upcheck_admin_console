// src/app/api/resources/[id]/protect/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../../lib/mongodb";
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { canAccessProject, canWriteFile, canAccessGeneralSpace, getGeneralSpacePermissionLevel } from '../../../../../lib/projectPermissions';

// Helper to fetch user's teams for permission checking
async function getUserTeams(db, user) {
  const userIdStr = user._id?.toString();
  if (!userIdStr) return [];
  return await db.collection('teams')
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
 * PUT /api/resources/[id]/protect
 * Set or remove password protection for a resource
 *
 * Body:
 * - password: string (required for setting password)
 * - confirmPassword: string (required for setting password, must match password)
 * - removePassword: boolean (if true, removes password protection)
 */
export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { password, confirmPassword, removePassword } = body;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid resource ID" }, { status: 400 });
    }

    // Get the admin token from cookies for authentication
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Authenticate user
    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Find the resource
    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Fetch user teams for team-based permission checking
    const userTeams = await getUserTeams(db, user);

    // Check user permissions
    let canProtect = false;

    if (resource.projectId === 'general') {
      const generalPerms = await db.collection('general_space_permissions').findOne({ _id: 'general' });
      const permSettings = generalPerms?.permissionSettings;

      if (canAccessGeneralSpace(user, permSettings)) {
        const perms = getGeneralSpacePermissionLevel(user, permSettings);
        if (perms && perms.writeScope !== 'none') {
          if (perms.writeScope === 'all') {
            canProtect = true;
          } else if (perms.writeScope === 'own') {
            canProtect = resource.uploadedBy?.username === user.username;
          }
        }
      }
    } else if (resource.projectId) {
      const project = await db.collection('projects').findOne({ _id: new ObjectId(resource.projectId) });
      if (project && canAccessProject(user, project, userTeams)) {
        canProtect = canWriteFile(user, project, resource, userTeams);
      }
    }

    if (!canProtect) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    let updateData = {};

    // Remove password protection
    if (removePassword) {
      updateData = {
        isPasswordProtected: false,
        passwordHash: null
      };
    }
    // Set password protection
    else if (password) {
      // Validate password
      if (password.length < 4) {
        return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
      }

      if (password !== confirmPassword) {
        return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
      }

      // Hash the password before storing it
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      updateData = {
        isPasswordProtected: true,
        passwordHash: hashedPassword
      };
    } else {
      return NextResponse.json({ error: "Either password or removePassword must be provided" }, { status: 400 });
    }

    // Update the resource
    await db.collection('resources').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    return NextResponse.json({
      success: true,
      message: removePassword ? "Password protection removed" : "Password protection added",
      isPasswordProtected: !removePassword
    });
  } catch (error) {
    console.error('Password protection error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/resources/[id]/protect
 * Legacy support - handles isLocked parameter
 */
export async function POST(req, { params }) {
  try {
    const { id } = params;
    const { isLocked, password, oldPassword } = await req.json();

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid resource ID" }, { status: 400 });
    }

    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    const resource = await db.collection('resources').findOne({ _id: new ObjectId(id) });

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    let updateData = {};

    // If we're removing password protection
    if (!isLocked) {
      if (resource.isPasswordProtected && resource.passwordHash) {
        if (!oldPassword) {
          return NextResponse.json({ error: "Current password is required to remove protection" }, { status: 400 });
        }

        const isPasswordCorrect = await bcrypt.compare(oldPassword, resource.passwordHash);
        if (!isPasswordCorrect) {
          return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
        }

        updateData = {
          isPasswordProtected: false,
          passwordHash: null
        };
      } else {
        updateData = {
          isPasswordProtected: false,
          passwordHash: null
        };
      }
    }
    // If we're adding password protection
    else if (isLocked && password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      updateData = {
        isPasswordProtected: true,
        passwordHash: hashedPassword
      };
    } else {
      return NextResponse.json({ error: "Password is required when protecting a resource" }, { status: 400 });
    }

    await db.collection('resources').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    return NextResponse.json({
      success: true,
      message: isLocked ? "Resource password protection added" : "Resource password protection removed",
      isPasswordProtected: isLocked
    });
  } catch (error) {
    console.error('Password protection error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
