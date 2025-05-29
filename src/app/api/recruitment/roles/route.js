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

    // Check if role ID already exists (for new roles)
    const existingRole = await db.collection('recruitment_roles').findOne({ id });
    if (existingRole && !existingRole._id) {
      return NextResponse.json(
        { message: 'Role ID already exists' },
        { status: 400 }
      );
    }

    // Validate questions format
    const isValidQuestions = questions.every(q => {
      if (!q.text || !q.type || !['text', 'multiple-choice'].includes(q.type)) {
        return false;
      }

      if (q.type === 'text') {
        return Array.isArray(q.expectedKeywords) && q.expectedKeywords.length > 0;
      }

      if (q.type === 'multiple-choice') {
        return Array.isArray(q.options) && 
               q.options.length >= 2 &&
               typeof q.correctAnswer === 'number' &&
               q.correctAnswer >= 0 &&
               q.correctAnswer < q.options.length;
      }

      return false;
    });

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
          questions: questions.map(q => ({
            text: q.text,
            type: q.type,
            difficulty: q.difficulty || 'medium',
            options: q.options || [],
            correctAnswer: q.correctAnswer,
            expectedKeywords: q.expectedKeywords || [],
            updatedAt: new Date()
          }))
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: existingRole ? 'Role updated successfully' : 'Role created successfully'
    });
  } catch (error) {
    console.error('Error creating/updating role:', error);
    return NextResponse.json(
      { message: 'Failed to create/update role' },
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

    // Check if role exists
    const role = await db.collection('recruitment_roles').findOne({ id });
    if (!role) {
      return NextResponse.json(
        { message: 'Role not found' },
        { status: 404 }
      );
    }

    // Check if there are any applicants assigned to this role
    const hasApplicants = await db.collection('applicants').findOne({ role: id });
    if (hasApplicants) {
      return NextResponse.json(
        { message: 'Cannot delete role with assigned applicants' },
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