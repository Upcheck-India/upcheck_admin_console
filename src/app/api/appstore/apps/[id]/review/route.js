import { NextResponse } from 'next/server';
import { getAuthUser } from '../../../../../../lib/auth';
import { ObjectId } from 'mongodb';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, db } = auth;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid app ID' }, { status: 400 });
    }

    const app = await db.collection('appstore_apps').findOne({ _id: new ObjectId(id) });
    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    const body = await request.json();
    const { rating, comment } = body;

    const parsedRating = parseInt(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
    }

    const reviewerName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.username;

    const newReview = {
      userId: user._id.toString(),
      username: reviewerName,
      rating: parsedRating,
      comment: (comment || '').trim(),
      createdAt: new Date()
    };

    const ratings = app.ratings || [];
    // Remove existing review from this user if it exists
    const updatedRatings = ratings.filter(r => r.userId !== user._id.toString());
    updatedRatings.push(newReview);

    // Calculate new average rating
    const totalRating = updatedRatings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = parseFloat((totalRating / updatedRatings.length).toFixed(1));

    await db.collection('appstore_apps').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ratings: updatedRatings,
          averageRating: averageRating,
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      ratings: updatedRatings,
      averageRating
    });
  } catch (error) {
    console.error('App Store apps review error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
