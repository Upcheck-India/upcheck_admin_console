import { WebSocketServer } from 'ws';
import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { ObjectId } from 'mongodb';

// Store active connections
const connections = new Map();

// Create WebSocket server
const wss = new WebSocketServer({
  noServer: true,
  clientTracking: true
});

// Handle new connections
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  // Handle initial message with user ID
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'init' && data.userId) {
        const userId = data.userId;
        
        // Store connection
        connections.set(userId, ws);
        
        // Update user status
        await updateUserStatus(userId, true);
        
        // Send initial online status
        ws.send(JSON.stringify({
          type: 'online_status',
          users: await getOnlineUsers()
        }));
      }
    } catch (error) {
      console.error('Error processing initial message:', error);
      ws.close(4000, 'Invalid initialization message');
    }
  });

  // Handle regular messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'online_status') {
        await broadcastOnlineStatus();
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log('WebSocket connection closed');
    // Clean up connection
    connections.forEach((conn, userId) => {
      if (conn === ws) {
        connections.delete(userId);
        updateUserStatus(userId, false);
      }
    });
    broadcastOnlineStatus();
  });
});

// Update user status in database
const updateUserStatus = async (userId, isOnline) => {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    await db.collection('admin_users').updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          lastSeen: isOnline ? new Date() : null,
          isOnline: isOnline
        }
      }
    );
  } catch (error) {
    console.error('Error updating user status:', error);
  }
};

// Get online users
const getOnlineUsers = async () => {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    return await db.collection('admin_users').find({
      lastSeen: { $gt: new Date(Date.now() - 5 * 60 * 1000) }
    }).toArray();
  } catch (error) {
    console.error('Error getting online users:', error);
    return [];
  }
};

// Broadcast online status to all clients
const broadcastOnlineStatus = async () => {
  try {
    const onlineUsers = await getOnlineUsers();
    
    connections.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'online_status',
          users: onlineUsers.map(user => ({
            _id: user._id.toString(),
            username: user.username,
            role: user.role,
            avatar: user.avatar,
            isOnline: user.isOnline
          }))
        }));
      }
    });
  } catch (error) {
    console.error('Error broadcasting online status:', error);
  }
};

// Handle HTTP upgrade requests
export const GET = async (req) => {
  try {
    const { socket } = req;
    
    // Handle WebSocket upgrade
    wss.handleUpgrade(req, socket, () => {
      wss.emit('connection', socket);
    });

    return new NextResponse(null, { status: 101 });
  } catch (error) {
    console.error('Error handling WebSocket upgrade:', error);
    return new NextResponse(null, { status: 500 });
  }
};
