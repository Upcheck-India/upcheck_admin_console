import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import { cookies } from 'next/headers';

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    const roles = await db.collection('recruitment_roles')
      .find({})
      .sort({ order: 1 })
      .toArray();
    
    // Remove question answers and sensitive data before sending to client
    const sanitizedRoles = roles.map(({ questions, ...role }) => ({
      ...role,
      questionCount: questions?.length || 0,
      isActive: role.isActive || false
    }));

    return NextResponse.json(sanitizedRoles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { message: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Check permissions
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { perms: 1 } }
    );

    if (!user?.perms?.includes('recruitment.manage')) {
      return NextResponse.json(
        { message: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id, name, description, isActive, questions } = await req.json();

    // Validate required fields
    if (!id || !name || !questions?.length) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate questions format
    const isValidQuestions = questions.every(q => 
      q.text && q.type && 
      (q.type === 'text' ? Array.isArray(q.expectedKeywords) : Array.isArray(q.options))
    );

    if (!isValidQuestions) {
      return NextResponse.json(
        { message: 'Invalid question format' },
        { status: 400 }
      );
    }

    // Update or create role
    await db.collection('recruitment_roles').updateOne(
      { id },
      { 
        $set: {
          name,
          description,
          isActive,
          questions,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Role updated successfully'
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { message: 'Failed to update role' },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const client = await clientPromise;
    const db = client.db("resources");

    // Check permissions
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { perms: 1 } }
    );

    if (!user?.perms?.includes('recruitment.manage')) {
      return NextResponse.json(
        { message: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { message: 'Role ID is required' },
        { status: 400 }
      );
    }

    await db.collection('recruitment_roles').deleteOne({ id });

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { message: 'Failed to delete role' },
      { status: 500 }
    );
  }
}