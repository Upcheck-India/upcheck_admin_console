import { NextResponse } from 'next/server';
import clientPromise from '../../../../../../lib/mongodb';
import { validatePaginationParams, validateDateRangeParams } from '../../../../../../lib/validation/recurring';
import { ObjectId } from 'mongodb';

// Helper function to get user from token
async function getUserFromToken(token) {
    if (!token) return null;

    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne(
        { sessionToken: token },
        {
            projection: {
                _id: 1,
                email: 1,
                name: 1,
                role: 1,
            }
        }
    );
    return user;
}

// GET /api/events/recurring/[seriesId]/instances - Get all instances for a series
export async function GET(request, { params }) {
  try {
    const { seriesId } = await params;
    const token = request.cookies.get('admin_token')?.value;
    const user = await getUserFromToken(token);

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ObjectId.isValid(seriesId)) {
      return NextResponse.json({ error: 'Invalid series ID' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Verify series ownership
    const series = await db.collection('recurring_series').findOne({ 
      _id: new ObjectId(seriesId),
      hostId: user._id.toString()
    });

    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    
    // Validate pagination parameters
    const paginationValidation = validatePaginationParams(url);
    if (!paginationValidation.isValid) {
        return NextResponse.json({ 
          error: 'Invalid pagination parameters',
          details: paginationValidation.errors
        }, { status: 400 });
    }
    
    // Validate date range parameters
    const dateValidation = validateDateRangeParams(url);
    if (!dateValidation.isValid) {
        return NextResponse.json({ 
          error: 'Invalid date range parameters',
          details: dateValidation.errors
        }, { status: 400 });
    }

    const { limit, offset } = paginationValidation;
    const { startDate, endDate } = dateValidation;
    const status = url.searchParams.get('status'); // 'upcoming', 'past', 'cancelled'

    // Build query for events
    const query = { seriesId: new ObjectId(seriesId) };

    // Add status filters
    if (status === 'upcoming') {
      query.startTime = { $gte: new Date() };
      query['recurrenceInstance.isCancelled'] = { $ne: true };
    } else if (status === 'past') {
      query.startTime = { $lt: new Date() };
      query['recurrenceInstance.isCancelled'] = { $ne: true };
    } else if (status === 'cancelled') {
      query['recurrenceInstance.isCancelled'] = true;
    }

    // Add date range filters
    if (startDate || endDate) {
      query.startTime = query.startTime || {};
      if (startDate) {
        query.startTime.$gte = startDate;
      }
      if (endDate) {
        query.startTime.$lte = endDate;
      }
    }

    // Get instances
    const instances = await db.collection('events')
      .find(query)
      .sort({ startTime: 1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const totalCount = await db.collection('events').countDocuments(query);

    return NextResponse.json({
      instances,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + instances.length < totalCount
      }
    });

  } catch (error) {
    console.error('Error fetching series instances:', error);
    return NextResponse.json({ error: 'Failed to fetch series instances' }, { status: 500 });
  }
}