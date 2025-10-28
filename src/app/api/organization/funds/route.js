import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

async function getUserFromToken(request) {
  try {
    const token = request.cookies.get('admin_token')?.value;
    if (!token) return null;
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { _id: 1, email: 1, username: 1, role: 1 } }
    );
    return user;
  } catch {
    return null;
  }
}

function isAdminLike(user) {
  return user && (user.role === 'Admin' || user.role === 'Console admin');
}

export async function GET(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const client = await clientPromise;
    const db = client.db('resources');

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');
    const kind = searchParams.get('kind');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '500');
    const groupBy = searchParams.get('groupBy') || 'month'; // day|week|month|year
    const datePreset = searchParams.get('datePreset') || null; // today|last7|thisWeek|thisMonth|last30|thisQuarter|thisYear|custom
    const accountId = searchParams.get('accountId');
    const inflowType = searchParams.get('inflowType');
    const expenseType = searchParams.get('expenseType');

    // Require billing account
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Compute effective date range based on preset if start/end not provided
    let rangeStart = startDate ? new Date(startDate) : null;
    let rangeEnd = endDate ? new Date(endDate) : null;
    const now = new Date();
    if (!rangeStart && !rangeEnd && datePreset) {
      const d = new Date();
      const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
      const startOfWeek = (x) => {
        const day = x.getDay(); // 0 Sun
        const diff = (day + 6) % 7; // make Monday start
        const s = new Date(x);
        s.setDate(x.getDate() - diff);
        return startOfDay(s);
      };
      const startOfMonth = (x) => new Date(x.getFullYear(), x.getMonth(), 1);
      const startOfQuarter = (x) => new Date(x.getFullYear(), Math.floor(x.getMonth() / 3) * 3, 1);
      const startOfYear = (x) => new Date(x.getFullYear(), 0, 1);
      const endOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate(), 23, 59, 59, 999);
      switch (datePreset) {
        case 'today':
          rangeStart = startOfDay(d);
          rangeEnd = endOfDay(d);
          break;
        case 'last7':
          rangeStart = startOfDay(new Date(d.getTime() - 6 * 86400000));
          rangeEnd = endOfDay(d);
          break;
        case 'thisWeek':
          rangeStart = startOfWeek(d);
          rangeEnd = endOfDay(d);
          break;
        case 'thisMonth':
          rangeStart = startOfMonth(d);
          rangeEnd = endOfDay(d);
          break;
        case 'last30':
          rangeStart = startOfDay(new Date(d.getTime() - 29 * 86400000));
          rangeEnd = endOfDay(d);
          break;
        case 'thisQuarter':
          rangeStart = startOfQuarter(d);
          rangeEnd = endOfDay(d);
          break;
        case 'thisYear':
          rangeStart = startOfYear(d);
          rangeEnd = endOfDay(d);
          break;
        default:
          break;
      }
    }

    // Build filter
    const filter = {};
    if (rangeStart || rangeEnd) {
      filter.date = {};
      if (rangeStart) filter.date.$gte = rangeStart;
      if (rangeEnd) filter.date.$lte = rangeEnd;
    }
    if (category) filter.category = category;
    if (kind) filter.kind = kind;
    if (accountId) filter.accountId = accountId;
    if (inflowType) filter.inflowType = inflowType;
    if (expenseType) filter.expenseType = expenseType;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    // Get items
    const items = await db
      .collection('org_funds')
      .find(filter)
      .sort({ date: -1 })
      .limit(limit)
      .toArray();

    // Summary aggregation
    const summaryAgg = await db.collection('org_funds').aggregate([
      { $match: filter },
      { $group: { _id: null, 
        received: { $sum: { $cond: [{ $eq: ['$kind', 'in'] }, '$amount', 0] } },
        spent: { $sum: { $cond: [{ $eq: ['$kind', 'out'] }, '$amount', 0] } }
      } },
      { $project: { _id: 0, received: 1, spent: 1, balance: { $subtract: ['$received', '$spent'] } } }
    ]).toArray();

    const summary = summaryAgg[0] || { received: 0, spent: 0, balance: 0 };

    // Category breakdown
    const categoryBreakdown = await db.collection('org_funds').aggregate([
      { $match: filter },
      { $group: {
        _id: { 
          group: { $ifNull: ['$inflowType', { $ifNull: ['$expenseType', '$category'] }] },
          kind: '$kind' 
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      } },
      { $sort: { total: -1 } }
    ]).toArray();

    // Time trends based on groupBy within effective date range or default last 12 months
    const trendMatch = {};
    if (rangeStart || rangeEnd) {
      trendMatch.date = {};
      if (rangeStart) trendMatch.date.$gte = rangeStart;
      if (rangeEnd) trendMatch.date.$lte = rangeEnd;
    } else {
      trendMatch.date = { $gte: new Date(new Date().setMonth(now.getMonth() - 12)) };
    }

    let groupId;
    if (groupBy === 'day') {
      groupId = { year: { $year: '$date' }, month: { $month: '$date' }, day: { $dayOfMonth: '$date' }, kind: '$kind' };
    } else if (groupBy === 'week') {
      groupId = { isoWeekYear: { $isoWeekYear: '$date' }, isoWeek: { $isoWeek: '$date' }, kind: '$kind' };
    } else if (groupBy === 'year') {
      groupId = { year: { $year: '$date' }, kind: '$kind' };
    } else {
      // month default
      groupId = { year: { $year: '$date' }, month: { $month: '$date' }, kind: '$kind' };
    }

    const timeTrends = await db.collection('org_funds').aggregate([
      { $match: trendMatch },
      { $group: { _id: groupId, total: { $sum: '$amount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.isoWeekYear': 1, '_id.isoWeek': 1 } }
    ]).toArray();

    // Backward compatibility alias
    const monthlyTrends = timeTrends;

    return NextResponse.json({ items, summary, categoryBreakdown, monthlyTrends, timeTrends });
  } catch (e) {
    console.error('GET /api/organization/funds error', e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromToken(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json();
    const { kind, amount, title, date, notes, category, source, counterparty, reference, tags, accountId, inflowType, expenseType, fundRestriction, allocations } = body || {};

    if (!['in', 'out'].includes(kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }
    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const doc = {
      kind,
      amount: amt,
      title: title.trim(),
      date: date ? new Date(date) : new Date(),
      notes: notes || '',
      category: category || 'other',
      accountId: accountId || null,
      inflowType: kind === 'in' ? (inflowType || null) : null,
      expenseType: kind === 'out' ? (expenseType || null) : null,
      fundRestriction: kind === 'in' ? (fundRestriction || 'unrestricted') : undefined,
      allocations: Array.isArray(allocations) ? allocations.filter(a => a && (a.amount || a.percent)).slice(0, 50) : [],
      source: source || '',
      counterparty: counterparty || '',
      reference: reference || '',
      tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim()) : [],
      createdAt: new Date(),
      createdBy: { id: user._id?.toString?.() || null, email: user.email, username: user.username, role: user.role },
    };

    const client = await clientPromise;
    const db = client.db('resources');
    const res = await db.collection('org_funds').insertOne(doc);

    return NextResponse.json({ _id: res.insertedId, ...doc }, { status: 201 });
  } catch (e) {
    console.error('POST /api/organization/funds error', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
