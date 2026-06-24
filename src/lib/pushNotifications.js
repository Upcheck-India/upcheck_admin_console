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
