// src/app/api/tasks/[id]/route.js
export async function PUT(req, { params }) {
    try {
      const client = await clientPromise;
      const db = client.db("resources");
      const body = await req.json();
      
      // Get existing task to compare assignees
      const existingTask = await db.collection('tasks').findOne({
        _id: new ObjectId(params.id)
      });
  
      if (!existingTask) {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }
  
      const updateData = {
        ...body,
        status: body.assigned_for?.length > 0 ? (body.status === 'Planned' ? 'Assigned' : body.status) : 'Planned',
        modified_history: [
          {
            modified_by: body.modified_by,
            modified_at: new Date(),
            action: body.action || 'Updated task'
          },
          ...(existingTask.modified_history || [])
        ]
      };
  
      // Handle notifications for assignee changes
      const oldAssignees = existingTask.assigned_for || [];
      const newAssignees = body.assigned_for || [];
      
      const removedAssignees = oldAssignees.filter(user => !newAssignees.includes(user));
      const addedAssignees = newAssignees.filter(user => !oldAssignees.includes(user));
  
      if (removedAssignees.length > 0) {
        await db.collection('admin_users').updateMany(
          { username: { $in: removedAssignees } },
          { 
            $inc: { notifs: -1 },
            $pull: { 
              notifTitles: { $regex: `^New task assigned: ${existingTask.task_name}` } 
            }
          }
        );
      }
  
      if (addedAssignees.length > 0) {
        await db.collection('admin_users').updateMany(
          { username: { $in: addedAssignees } },
          { 
            $inc: { notifs: 1 },
            $push: { 
              notifTitles: `New task assigned: ${body.task_name}`
            }
          }
        );
      }
  
      await db.collection('tasks').updateOne(
        { _id: new ObjectId(params.id) },
        { $set: updateData }
      );
  
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  }
  
  export async function DELETE(req, { params }) {
    try {
      const client = await clientPromise;
      const db = client.db("resources");
  
      // Get task before deletion to handle notifications
      const task = await db.collection('tasks').findOne({
        _id: new ObjectId(params.id)
      });
  
      if (task && task.assigned_for?.length > 0) {
        // Remove notifications for assigned users
        await db.collection('admin_users').updateMany(
          { username: { $in: task.assigned_for } },
          { 
            $inc: { notifs: -1 },
            $pull: { 
              notifTitles: { $regex: `^New task assigned: ${task.task_name}` } 
            }
          }
        );
      }
  
      await db.collection('tasks').deleteOne({
        _id: new ObjectId(params.id)
      });
  
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  }