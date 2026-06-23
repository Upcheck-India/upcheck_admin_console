// src/app/api/stats/users/route.js
import { NextResponse } from "next/server";
import clientPromise from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("resources");

    // Retrieve username from headers
    const username = req.headers.get("username");

    // Validate username
    if (!username) {
      return NextResponse.json(
        { error: "Username is required", success: false },
        { status: 400 }
      );
    }

    // Fetch user details first
    const user = await db.collection("admin_users").findOne({ username });
    if (!user) {
      return NextResponse.json(
        { error: "User not found", success: false },
        { status: 404 }
      );
    }

    const userIdStr = user._id.toString();

    // Get stats in parallel
    const [usersCount, postsCount, openTasks, notifsCount] = await Promise.all([
      db.collection("admin_users").countDocuments(),
      db.collection("web").countDocuments(),
      db.collection("project_tasks")
        .find({
          assignees: { $in: [user._id, userIdStr] },
          status: { $nin: ["Done", "Completed", "done", "completed"] }
        })
        .toArray(),
      Promise.resolve(user.notifs ? parseInt(user.notifs) : 0),
    ]);

    // Resolve project names for the open tasks
    const projectIds = [...new Set(openTasks.map(t => t.projectId?.toString()).filter(Boolean))];
    let projectMap = new Map();
    if (projectIds.length > 0) {
      const projects = await db.collection('projects')
        .find({ _id: { $in: projectIds.map(id => new ObjectId(id)) } }, { projection: { name: 1 } })
        .toArray();
      projectMap = new Map(projects.map(p => [p._id.toString(), p.name]));
    }

    const openTasksList = openTasks.map(t => ({
      _id: t._id.toString(),
      title: t.title,
      projectId: t.projectId?.toString(),
      projectName: projectMap.get(t.projectId?.toString()) || 'Unknown Project',
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null
    }));

    return NextResponse.json({
      usersCount,
      postsCount,
      tasksCount: openTasksList.length,
      openTasksList,
      notifsCount,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}