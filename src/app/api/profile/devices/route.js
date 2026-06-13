import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import clientPromise from '../../../../lib/mongodb';

// Constants for security
const MAX_DEVICES_PER_USER = 10;
const DEVICE_NAME_MAX_LENGTH = 50;
const DEVICE_ID_MIN_LENGTH = 10;
const CLEANUP_THRESHOLD_DAYS = 90; // Remove devices not used for 90 days

// Rate limiting (simple in-memory store - use Redis in production)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

// Helper function to check rate limit
function checkRateLimit(userId) {
  const now = Date.now();
  const userKey = `${userId}`;
  
  if (!rateLimitStore.has(userKey)) {
    rateLimitStore.set(userKey, { count: 1, windowStart: now });
    return true;
  }
  
  const userData = rateLimitStore.get(userKey);
  
  // Reset window if expired
  if (now - userData.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(userKey, { count: 1, windowStart: now });
    return true;
  }
  
  // Check if limit exceeded
  if (userData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  // Increment count
  userData.count++;
  return true;
}

// Helper function to validate device ID
function validateDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') {
    return false;
  }
  
  // Check length
  if (deviceId.length < DEVICE_ID_MIN_LENGTH || deviceId.length > 128) {
    return false;
  }
  
  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validPattern = /^[a-zA-Z0-9\-_]+$/;
  return validPattern.test(deviceId);
}

// Helper function to validate device name
function validateDeviceName(deviceName) {
  if (!deviceName || typeof deviceName !== 'string') {
    return false;
  }
  
  const trimmed = deviceName.trim();
  return trimmed.length >= 2 && trimmed.length <= DEVICE_NAME_MAX_LENGTH;
}

// Helper function to sanitize device info
function sanitizeDeviceInfo(deviceInfo) {
  if (!deviceInfo || typeof deviceInfo !== 'object') {
    return {};
  }
  
  const sanitized = {};
  const allowedFields = ['browser', 'platform', 'language', 'timezone', 'screenResolution'];
  
  for (const field of allowedFields) {
    if (deviceInfo[field] && typeof deviceInfo[field] === 'string') {
      // Truncate long strings and remove potentially harmful characters
      sanitized[field] = deviceInfo[field]
        .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
        .substring(0, 100); // Limit length
    }
  }
  
  return sanitized;
}

// Helper function to get client IP
function getClientIP(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

// Helper function to hash IP for privacy
function hashIP(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

// Helper function to clean up old devices
async function cleanupOldDevices(db, userId) {
  const cutoffDate = new Date(Date.now() - (CLEANUP_THRESHOLD_DAYS * 24 * 60 * 60 * 1000));
  
  try {
    await db.collection('admin_users').updateOne(
      { _id: new ObjectId(userId) },
      {
        $pull: {
          trustedDevices: {
            lastUsed: { $lt: cutoffDate },
            addedAt: { $lt: cutoffDate }
          }
        }
      }
    );
  } catch (error) {
    console.error('Error cleaning up old devices:', error);
  }
}

// Get all trusted devices for the current user
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token');
    
    if (!adminToken?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find user and get devices
    const user = await db.collection('admin_users').findOne(
      { sessionToken: adminToken.value },
      { projection: { trustedDevices: 1, _id: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Clean up old devices in background
    cleanupOldDevices(db, user._id);

    // Sort devices by last used date (most recent first)
    const devices = (user.trustedDevices || []).sort((a, b) => {
      const aDate = new Date(b.lastUsed || b.addedAt);
      const bDate = new Date(a.lastUsed || a.addedAt);
      return aDate - bDate;
    });

    // Add security info for each device
    const enrichedDevices = devices.map(device => ({
      ...device,
      // Hide sensitive information
      id: device.id,
      name: device.name,
      deviceType: device.deviceType,
      addedAt: device.addedAt,
      lastUsed: device.lastUsed,
      deviceInfo: device.deviceInfo || {},
      // Add computed fields
      isActive: device.lastUsed && (Date.now() - new Date(device.lastUsed).getTime()) < (7 * 24 * 60 * 60 * 1000), // Active in last 7 days
      ipHash: device.ipHash // For tracking purposes
    }));

    return NextResponse.json({ 
      devices: enrichedDevices,
      meta: {
        totalDevices: enrichedDevices.length,
        maxDevices: MAX_DEVICES_PER_USER,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching trusted devices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Add a new trusted device
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token');
    
    if (!adminToken?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { deviceId, deviceName, deviceType, deviceInfo } = body;

    // Validate required fields
    if (!validateDeviceId(deviceId)) {
      return NextResponse.json({ error: 'Invalid device ID format' }, { status: 400 });
    }

    if (!validateDeviceName(deviceName)) {
      return NextResponse.json({ error: 'Invalid device name (2-50 characters required)' }, { status: 400 });
    }

    const validDeviceTypes = ['mobile', 'desktop', 'tablet', 'laptop', 'unknown'];
    if (!validDeviceTypes.includes(deviceType)) {
      return NextResponse.json({ error: 'Invalid device type' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find user first
    const user = await db.collection('admin_users').findOne(
      { sessionToken: adminToken.value },
      { projection: { trustedDevices: 1, _id: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check rate limiting
    if (!checkRateLimit(user._id.toString())) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Check if device already exists
    const existingDevices = user.trustedDevices || [];
    const deviceExists = existingDevices.some(device => device.id === deviceId);
    
    if (deviceExists) {
      return NextResponse.json({ error: 'Device already exists' }, { status: 409 });
    }

    // Check device limit
    if (existingDevices.length >= MAX_DEVICES_PER_USER) {
      return NextResponse.json({ 
        error: `Maximum number of trusted devices (${MAX_DEVICES_PER_USER}) reached. Please remove some devices first.` 
      }, { status: 400 });
    }

    // Check for duplicate device names
    const duplicateName = existingDevices.some(device => 
      device.name.toLowerCase() === deviceName.trim().toLowerCase()
    );
    
    if (duplicateName) {
      return NextResponse.json({ error: 'Device name already exists' }, { status: 409 });
    }

    // Get client information
    const clientIP = getClientIP(request);
    const hashedIP = hashIP(clientIP);
    const userAgent = request.headers.get('user-agent') || '';
    
    // Create new device object
    const newDevice = {
      id: deviceId,
      name: deviceName.trim(),
      deviceType,
      deviceInfo: sanitizeDeviceInfo(deviceInfo),
      addedAt: new Date(),
      lastUsed: new Date(),
      ipHash: hashedIP,
      userAgent: userAgent.substring(0, 200), // Limit user agent length
      // Security metadata
      addedFrom: {
        ip: hashedIP,
        userAgent: userAgent.substring(0, 100),
        timestamp: new Date()
      }
    };

    // Add the new device
    const result = await db.collection('admin_users').updateOne(
      { sessionToken: adminToken.value },
      { 
        $push: { trustedDevices: newDevice },
        $set: { 
          lastDeviceAdded: new Date(),
          // Update last activity
          lastActivity: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Failed to add device' }, { status: 500 });
    }

    // Log the device addition for security monitoring
    console.log(`Device added: User ${user._id}, Device ${deviceId}, IP Hash ${hashedIP}`);

    return NextResponse.json({ 
      success: true, 
      device: {
        id: newDevice.id,
        name: newDevice.name,
        deviceType: newDevice.deviceType,
        addedAt: newDevice.addedAt
      }
    });
  } catch (error) {
    console.error('Error adding trusted device:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Remove a trusted device
export async function DELETE(request) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token');
    
    if (!adminToken?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId } = body;

    if (!validateDeviceId(deviceId)) {
      return NextResponse.json({ error: 'Invalid device ID format' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find user and check if device exists
    const user = await db.collection('admin_users').findOne(
      { sessionToken: adminToken.value },
      { projection: { trustedDevices: 1, _id: 1 } }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check rate limiting
    if (!checkRateLimit(user._id.toString())) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const existingDevices = user.trustedDevices || [];
    const deviceToRemove = existingDevices.find(device => device.id === deviceId);
    
    if (!deviceToRemove) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Prevent removing the last device if it would lock the user out
    if (existingDevices.length === 1) {
      return NextResponse.json({ 
        error: 'Cannot remove the last trusted device. Add another device first.' 
      }, { status: 400 });
    }

    // Remove the device
    const result = await db.collection('admin_users').updateOne(
      { sessionToken: adminToken.value },
      { 
        $pull: { trustedDevices: { id: deviceId } },
        $set: { lastDeviceRemoved: new Date() }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Failed to remove device' }, { status: 500 });
    }

    // Log the device removal for security monitoring
    const clientIP = getClientIP(request);
    const hashedIP = hashIP(clientIP);
    console.log(`Device removed: User ${user._id}, Device ${deviceId}, IP Hash ${hashedIP}`);

    return NextResponse.json({ 
      success: true,
      removedDevice: {
        id: deviceToRemove.id,
        name: deviceToRemove.name
      }
    });
  } catch (error) {
    console.error('Error removing trusted device:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update device information (for updating last used time)
export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token');
    
    if (!adminToken?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId, action } = body;

    if (!validateDeviceId(deviceId)) {
      return NextResponse.json({ error: 'Invalid device ID format' }, { status: 400 });
    }

    if (action !== 'update_last_used') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("resources");
    
    // Update the device's last used time
    const result = await db.collection('admin_users').updateOne(
      { 
        sessionToken: adminToken.value,
        'trustedDevices.id': deviceId
      },
      { 
        $set: { 
          'trustedDevices.$.lastUsed': new Date(),
          'trustedDevices.$.ipHash': hashIP(getClientIP(request))
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Device not found or failed to update' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating device:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Clean up rate limit store periodically (basic cleanup)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now - value.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);