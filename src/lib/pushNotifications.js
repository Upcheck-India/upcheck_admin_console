import clientPromise from './mongodb.js';
import { ObjectId } from 'mongodb';

/**
 * Sends an Expo push notification to a specific user.
 * 
 * @param {string | ObjectId} userId - The target user's ID
 * @param {string} title - The notification title
 * @param {string} body - The notification body text
 * @param {object} data - Optional extra data payload
 */
export async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    const user = await db.collection('admin_users').findOne({ _id: new ObjectId(userId) });

    if (!user || !user.expoPushToken) {
      console.log(`[Push Notification] No push token for user ${userId}`);
      return;
    }

    const message = {
      to: user.expoPushToken,
      sound: 'default',
      title,
      body,
      data,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const receipt = await response.json();
    if (receipt?.data?.status === 'error') {
      console.error('[Push Notification Error from Expo]', receipt.data);
    } else {
      console.log('[Push Notification] Sent:', receipt);
    }
  } catch (error) {
    console.error('[Push Notification Error]', error);
  }
}

/**
 * Helper to send notifications to an entire team (except sender)
 * (Actually, we handled team push logic inside the team-chat POST route,
 * so we can just export this for future use or omit it. Since I already 
 * implemented the team iteration in the route, I'll just leave this as is
 * but ensure exports are clean.)
 */

/**
 * Sends an Expo push notification to all registered users.
 * 
 * @param {string} title - The notification title
 * @param {string} body - The notification body text
 * @param {object} data - Optional extra data payload
 */
export async function sendPushNotificationToAll(title, body, data = {}) {
  try {
    const client = await clientPromise;
    const db = client.db('resources');
    // Fetch all users with active push tokens
    const users = await db.collection('admin_users').find({
      expoPushToken: { $exists: true, $ne: null, $regex: /^ExponentPushToken/ }
    }).toArray();

    if (users.length === 0) {
      console.log('[Push Notification All] No users with push tokens found');
      return;
    }

    const messages = users.map(user => ({
      to: user.expoPushToken,
      sound: 'default',
      title,
      body,
      data,
    }));

    // Expo push notifications endpoint allows batching up to 100 messages per request
    const chunkSize = 100;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const receipt = await response.json();
      console.log(`[Push Notification All] Sent chunk to ${chunk.length} users:`, receipt);
    }
  } catch (error) {
    console.error('[Push Notification All Error]', error);
  }
}
