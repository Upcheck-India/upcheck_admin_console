// src/app/api/clerk/webhook/route.js
// Clerk webhook to sync external user data to MongoDB

import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';
import crypto from 'crypto';

// Clerk webhook secret - get this from Clerk Dashboard > Webhooks > Choose webhook > Signing Secret
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

/**
 * Verify Clerk webhook signature manually without svix
 * Clerk uses HMAC-SHA256 to sign webhooks
 */
function verifyClerkSignature(payloadBody, headers, secret) {
  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing required svix headers');
  }

  // Parse the signature (format: "v1,signature")
  const signatureParts = svixSignature.split(',');
  const signatures = {};
  for (const part of signatureParts) {
    const [key, value] = part.split('=');
    if (key && value) {
      signatures[key] = value;
    }
  }

  const signedSignature = signatures['v1'];
  if (!signedSignature) {
    throw new Error('No v1 signature found');
  }

  // Create the message to sign: timestamp.id.payload
  const message = `${svixTimestamp}.${svixId}.${payloadBody}`;

  // Create HMAC-SHA256 signature
  // Clerk base64-decodes the secret before using it
  const secretBytes = new Uint8Array(
    atob(secret.replace(/^whsec_/, ''))
      .split('')
      .map(c => c.charCodeAt(0))
  );

  const hmac = crypto.createHmac('sha256', secretBytes);
  hmac.update(message);
  const expectedSignature = hmac.digest('hex');

  // Constant-time comparison to prevent timing attacks
  const providedSignatureBuf = Buffer.from(signedSignature, 'hex');
  const expectedSignatureBuf = Buffer.from(expectedSignature, 'hex');

  if (providedSignatureBuf.length !== expectedSignatureBuf.length) {
    throw new Error('Signature length mismatch');
  }

  let result = 0;
  for (let i = 0; i < providedSignatureBuf.length; i++) {
    result |= providedSignatureBuf[i] ^ expectedSignatureBuf[i];
  }

  if (result !== 0) {
    throw new Error('Signature verification failed');
  }

  // Check timestamp freshness (allow 5 minutes tolerance)
  const timestamp = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  const tolerance = 300; // 5 minutes

  if (Math.abs(now - timestamp) > tolerance) {
    throw new Error('Webhook timestamp is too old or from the future');
  }

  return true;
}

export async function POST(request) {
  try {
    // Get the headers
    const svix_id = request.headers.get('svix-id');
    const svix_timestamp = request.headers.get('svix-timestamp');
    const svix_signature = request.headers.get('svix-signature');

    // If there are no headers, this might not be a Clerk webhook
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json(
        { error: 'Missing svix headers - this endpoint is for Clerk webhooks only' },
        { status: 400 }
      );
    }

    // Get the raw body for signature verification
    const rawBody = await request.text();

    // Verify the webhook signature (only if secret is configured)
    if (WEBHOOK_SECRET) {
      try {
        verifyClerkSignature(rawBody, request.headers, WEBHOOK_SECRET);
      } catch (err) {
        console.error('Error verifying webhook signature:', err.message);
        return NextResponse.json(
          { error: 'Webhook signature verification failed' },
          { status: 401 }
        );
      }
    } else {
      console.warn('CLERK_WEBHOOK_SECRET not configured - skipping signature verification');
    }

    // Parse the JSON body
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventType = payload.type;
    const eventData = payload.data;

    console.log(`Clerk webhook received: ${eventType}`, {
      userId: eventData?.id,
      email: eventData?.email_addresses?.[0]?.email_address
    });

    const client = await clientPromise;
    const db = client.db('resources');
    const collection = db.collection('dataroom_external_users');

    // Handle different Clerk webhook events
    switch (eventType) {
      case 'user.created': {
        // New external user registered via Clerk
        const newUser = {
          clerkId: eventData.id,
          name: `${eventData.first_name || ''} ${eventData.last_name || ''}`.trim()
            || eventData.email_addresses?.[0]?.email_address?.split('@')[0]
            || 'Unknown',
          email: eventData.email_addresses?.[0]?.email_address || '',
          mobileNumber: eventData.phone_numbers?.[0]?.phone_number || '',
          company: eventData.public_metadata?.company
            || eventData.organization_members?.[0]?.organization?.name
            || '',
          designation: eventData.public_metadata?.designation || '',
          status: 'pending_approval', // Default to pending, admin must approve
          emailVerified: eventData.email_addresses?.[0]?.verified || false,
          imageUrl: eventData.image_url || '',
          createdAt: new Date(eventData.created_at),
          updatedAt: new Date(),
          lastLoginAt: null,
          purpose: eventData.public_metadata?.purpose || '',
          invitedBy: eventData.public_metadata?.invited_by || '',
        };

        // Check if user already exists (by clerkId or email)
        const existingUser = await collection.findOne({
          $or: [
            { clerkId: eventData.id },
            { email: newUser.email }
          ]
        });

        if (existingUser) {
          console.log('User already exists, skipping creation:', newUser.email);
          return NextResponse.json({
            success: true,
            message: 'User already exists',
            userId: existingUser._id,
          });
        }

        const result = await collection.insertOne(newUser);
        console.log('New external user created in MongoDB:', newUser.email);

        return NextResponse.json({
          success: true,
          message: 'User created successfully',
          userId: result.insertedId,
        });
      }

      case 'user.updated': {
        // External user details updated
        const updateData = {
          name: `${eventData.first_name || ''} ${eventData.last_name || ''}`.trim()
            || eventData.email_addresses?.[0]?.email_address?.split('@')[0]
            || 'Unknown',
          email: eventData.email_addresses?.[0]?.email_address || '',
          mobileNumber: eventData.phone_numbers?.[0]?.phone_number || '',
          company: eventData.public_metadata?.company
            || eventData.organization_members?.[0]?.organization?.name
            || '',
          designation: eventData.public_metadata?.designation || '',
          emailVerified: eventData.email_addresses?.[0]?.verified || false,
          imageUrl: eventData.image_url || '',
          updatedAt: new Date(),
          purpose: eventData.public_metadata?.purpose || '',
          invitedBy: eventData.public_metadata?.invited_by || '',
        };

        const result = await collection.updateOne(
          { clerkId: eventData.id },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          // User not found, create new record
          const newUser = {
            clerkId: eventData.id,
            ...updateData,
            status: 'pending_approval',
            createdAt: new Date(eventData.created_at),
            lastLoginAt: null,
          };
          await collection.insertOne(newUser);
          console.log('Updated user not found, created new record:', newUser.email);
        } else {
          console.log('External user updated in MongoDB:', updateData.email);
        }

        return NextResponse.json({
          success: true,
          message: 'User updated successfully',
        });
      }

      case 'user.deleted': {
        // External user deleted from Clerk
        const result = await collection.updateOne(
          { clerkId: eventData.id },
          {
            $set: {
              status: 'deleted',
              deletedAt: new Date(),
              updatedAt: new Date(),
            }
          }
        );

        console.log('External user marked as deleted:', eventData.id);

        return NextResponse.json({
          success: true,
          message: 'User deleted successfully',
        });
      }

      case 'session.created': {
        // User logged in - update last login
        await collection.updateOne(
          { clerkId: eventData.user_id },
          {
            $set: {
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            }
          }
        );

        return NextResponse.json({
          success: true,
          message: 'Last login updated',
        });
      }

      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
        break;
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
    });

  } catch (error) {
    console.error('Clerk webhook error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
