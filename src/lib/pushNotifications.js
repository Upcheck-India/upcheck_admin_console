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
    console.log('[Push Notification] Sent:', receipt);
  } catch (error) {
    console.error('[Push Notification Error]', error);
  }
}
