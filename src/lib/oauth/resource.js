// src/lib/oauth/resource.js
//
// The resource-server layer for Phase 1 (read-only HR data). This module is the
// SINGLE SOURCE OF TRUTH for which HR fields leave the building. It works by
// ALLOWLIST — a Mongo projection that names only safe fields, plus a shaping
// function that re-emits a stable external contract. A field can only be exposed
// by being added here explicitly; nothing is exposed by omission. Sensitive data
// (PAN/Aadhaar, bank details, salary, personal contact info, address, DOB,
// emergency contacts, HR notes/exit reasons, credentials, and the portal
// permission `role`) is therefore structurally unreachable through this API.
import { NextResponse } from 'next/server';
import clientPromise from '../mongodb';
import { extractBearer, resolveBearer } from './service';
import { scopesSatisfy } from './scopes';
import { OAuthError, OAUTH_ERROR, oauthErrorResponse } from './errors';

// ---------------------------------------------------------------------------
// Allowlist projections (what we READ from Mongo)
// ---------------------------------------------------------------------------

// admin_users → employee directory. NOTE: the portal permission `role` is
// deliberately NOT included — it is access-control metadata (who is an admin),
// not HR data, and exposing it would help an attacker target privileged accounts.
export const EMPLOYEE_PROJECTION = {
  _id: 1,
  username: 1,
  email: 1,
  firstName: 1,
  lastName: 1,
  department: 1,
  jobTitle: 1,
  employmentType: 1,
  employmentStatus: 1,
  managerId: 1,
  startDate: 1,
  endDate: 1,
  location: 1,
  timezone: 1,
  avatar: 1,
  updatedAt: 1,
};

export const PEOPLE_PROJECTION = {
  _id: 1,
  employeeId: 1,
  type: 1,
  status: 1,
  firstName: 1,
  lastName: 1,
  email: 1,
  department: 1,
  jobTitle: 1,
  managerId: 1,
  joinDate: 1,
  createdAt: 1,
  updatedAt: 1,
};

// ---------------------------------------------------------------------------
// Shapers (what we WRITE to the response) — stable, versioned external contract
// ---------------------------------------------------------------------------

const str = (v) => (v == null ? null : String(v));
const iso = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const name = (f, l) => [f, l].filter(Boolean).join(' ').trim() || null;

export function shapeEmployee(doc) {
  if (!doc) return null;
  return {
    id: str(doc._id),
    username: doc.username || null,
    workEmail: doc.email || null,
    firstName: doc.firstName || null,
    lastName: doc.lastName || null,
    fullName: name(doc.firstName, doc.lastName) || doc.username || null,
    jobTitle: doc.jobTitle || null,
    department: doc.department || null,
    employmentType: doc.employmentType || null,
    employmentStatus: doc.employmentStatus || null,
    managerId: str(doc.managerId),
    startDate: iso(doc.startDate),
    endDate: iso(doc.endDate),
    location: doc.location || null,
    timezone: doc.timezone || null,
    avatarUrl: doc.avatar || null,
    updatedAt: iso(doc.updatedAt),
  };
}

export function shapePerson(doc) {
  if (!doc) return null;
  return {
    id: str(doc._id),
    employeeId: doc.employeeId || null,
    type: doc.type || null,
    status: doc.status || null,
    firstName: doc.firstName || null,
    lastName: doc.lastName || null,
    fullName: name(doc.firstName, doc.lastName) || null,
    workEmail: doc.email || null,
    department: doc.department || null,
    jobTitle: doc.jobTitle || null,
    managerId: str(doc.managerId),
    joinDate: iso(doc.joinDate),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export function shapeHoliday(doc) {
  if (!doc) return null;
  return {
    id: str(doc._id),
    name: doc.name || null,
    date: iso(doc.date),
    type: doc.type || null,
    recurring: !!doc.recurring,
    description: doc.description || '',
  };
}

export function shapeLeaveType(doc) {
  if (!doc) return null;
  return {
    id: str(doc._id),
    name: doc.name || null,
    code: doc.code || null,
    defaultAllocation: typeof doc.defaultAllocation === 'number' ? doc.defaultAllocation : null,
    paid: !!doc.paid,
    requiresApproval: doc.requiresApproval !== false,
    carryForward: !!doc.carryForward,
    active: doc.active !== false,
    color: doc.color || null,
  };
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export function parsePaging(searchParams, { defLimit = 50, maxLimit = 200 } = {}) {
  const rawLimit = parseInt(searchParams.get('limit'), 10);
  const rawOffset = parseInt(searchParams.get('offset'), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  return { limit, offset };
}

export function pageMeta({ total, limit, offset, count }) {
  return {
    total,
    limit,
    offset,
    count,
    hasMore: offset + count < total,
  };
}

// ---------------------------------------------------------------------------
// Bearer + scope guard for resource routes
// ---------------------------------------------------------------------------

/**
 * Authenticate a resource request and require a specific scope. Usage:
 *   const { ctx, db, response } = await requireScope(request, 'hr.employees:read');
 *   if (response) return response;
 * Returns { db, ctx: { client, grant, scopes, token }, response:null } on success,
 * or an RFC 6750-compliant error response otherwise.
 */
export async function requireScope(request, scope) {
  try {
    const bearer = extractBearer(request);
    const client = await clientPromise;
    const db = client.db('resources');
    const ctx = await resolveBearer(db, bearer);
    if (!scopesSatisfy(ctx.scopes, scope)) {
      throw new OAuthError(
        OAUTH_ERROR.INSUFFICIENT_SCOPE,
        `This endpoint requires the '${scope}' scope`,
        403
      );
    }
    return { db, ctx, response: null };
  } catch (err) {
    return { db: null, ctx: null, response: oauthErrorResponse(err, { bearer: true }) };
  }
}

/**
 * Authenticate a resource request with ANY valid bearer token (no specific scope
 * required). Used by /me. Same success/error shape as requireScope.
 */
export async function requireToken(request) {
  try {
    const bearer = extractBearer(request);
    const client = await clientPromise;
    const db = client.db('resources');
    const ctx = await resolveBearer(db, bearer);
    return { db, ctx, response: null };
  } catch (err) {
    return { db: null, ctx: null, response: oauthErrorResponse(err, { bearer: true }) };
  }
}

/** Escape a user string for literal use inside a $regex. */
export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wrap a successful resource payload with consistent envelope + no-store caching. */
export function dataResponse(payload) {
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'no-store', 'X-Api-Version': 'v1' },
  });
}
