// src/app/api/stats/users/route.js
import { NextResponse } from "next/server";
import clientPromise from "../../../../lib/mongodb";

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

    // Get counts from collections and notifications count
    const [usersCount, postsCount,tasksCount, notifsCount] = await Promise.all([
      db.collection("admin_users").countDocuments(),
      db.collection("web").countDocuments(),
      db.collection("tasks").countDocuments(),
      (async () => {
        const user = await db.collection("admin_users").findOne({ username });
        return user && user.notifs ? parseInt(user.notifs) : 0;
      })(),
    ]);

    return NextResponse.json({
      usersCount,
      postsCount,
      tasksCount,
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