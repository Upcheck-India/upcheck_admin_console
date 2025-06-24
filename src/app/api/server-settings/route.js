import { MongoClient, ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import clientPromise from "../../../lib/mongodb";

// Middleware to check admin access
async function checkAdminAccess() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    
    if (!token) {
      return { hasAccess: false, error: 'Not authenticated' };
    }
    
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find user by session token
    const user = await db.collection('admin_users').findOne({ 
      sessionToken: token 
    });
    
    if (!user) {
      return { hasAccess: false, error: 'Invalid session' };
    }
    
    // Check if user has admin role
    const isAdmin = user.role === 'Admin' || user.role === 'Console admin';
    
    if (!isAdmin) {
      return { hasAccess: false, error: 'Insufficient permissions' };
    }
    
    return { hasAccess: true, user };
  } catch (error) {
    console.error('Error checking admin access:', error);
    return { hasAccess: false, error: 'Error verifying permissions' };
  }
}

// Database connection using the existing clientPromise
async function connectToDatabase() {
  try {
    const client = await clientPromise;
    const db = client.db("resources");
    const serverSettings = db.collection('server_settings');
    return { serverSettings };
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Failed to connect to database');
  }
}

// Helper function to get default settings
function getDefaultSettings() {
  return {
    _id: 'documentation_settings',
    allowInternUpload: false,
    allowInternDownload: true,
    allowedFileTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.png'],
    maxFileSize: 10, // in MB
    fileNameRegex: '.*',
    uploadDeadline: null,
    allowedProjectsForDownload: ['general'],
    allowedDocuments: {},
    updatedAt: new Date(),
    createdAt: new Date()
  };
}

// GET handler - Fetch current settings
export async function GET(request) {
  try {
    // Check for basic authentication (any logged-in user can read settings)
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;
    
    if (!token) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Not authenticated' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    // Verify the token is valid
    const client = await clientPromise;
    const db = client.db("resources");
    const user = await db.collection('admin_users').findOne({ 
      sessionToken: token 
    });
    
    if (!user) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid session' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const { serverSettings } = await connectToDatabase();
    let settings = await serverSettings.findOne({ _id: 'documentation_settings' });

    if (!settings) {
      // Initialize with default settings if not found
      settings = getDefaultSettings();
      await serverSettings.insertOne(settings);
    }

    // Return the settings with a consistent structure
    return new Response(JSON.stringify({ 
      success: true, 
      data: {
        allowInternUpload: settings.allowInternUpload,
        allowInternDownload: settings.allowInternDownload,
        allowedFileTypes: settings.allowedFileTypes,
        maxFileSize: settings.maxFileSize,
        fileNameRegex: settings.fileNameRegex,
        uploadDeadline: settings.uploadDeadline,
        allowedProjectsForDownload: settings.allowedProjectsForDownload || ['general'],
        allowedDocuments: settings.allowedDocuments || {},
        updatedAt: settings.updatedAt,
        _id: settings._id
      }
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch settings',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

// POST handler - Update settings
export async function POST(request) {
  try {
    const { hasAccess, error } = await checkAdminAccess();
    
    if (!hasAccess) {
      return new Response(JSON.stringify({ 
        success: false,
        error: error || 'Unauthorized' 
      }), { 
        status: error === 'Insufficient permissions' ? 403 : 401,
        headers: { 'Content-Type': 'application/json' } 
      });
    }
    
    const data = await request.json();
    
    if (!data) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No data provided' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const { 
      allowInternUpload, 
      allowInternDownload,
      allowedFileTypes, 
      maxFileSize, 
      fileNameRegex, 
      uploadDeadline,
      allowedProjectsForDownload,
      allowedDocuments
    } = data;

    // Validate input
    if (typeof allowInternUpload !== 'boolean' || 
        (allowInternDownload !== undefined && typeof allowInternDownload !== 'boolean') ||
        !Array.isArray(allowedFileTypes) ||
        typeof maxFileSize !== 'number' || maxFileSize <= 0 || maxFileSize > 100 ||
        typeof fileNameRegex !== 'string' ||
        (uploadDeadline && isNaN(new Date(uploadDeadline).getTime())) ||
        (allowedProjectsForDownload && !Array.isArray(allowedProjectsForDownload)) ||
        (allowedDocuments && typeof allowedDocuments !== 'object')) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid input data',
        details: {
          allowInternUpload: typeof allowInternUpload,
          allowInternDownload: typeof allowInternDownload,
          allowedFileTypes: Array.isArray(allowedFileTypes) ? 'array' : typeof allowedFileTypes,
          maxFileSize: typeof maxFileSize,
          fileNameRegex: typeof fileNameRegex,
          uploadDeadline: uploadDeadline ? 'valid date' : 'missing or invalid',
          allowedProjectsForDownload: allowedProjectsForDownload ? 'array' : 'missing',
          allowedDocuments: allowedDocuments ? 'object' : 'missing'
        }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Ensure allowedProjectsForDownload is an array of strings
    const validProjects = Array.isArray(allowedProjectsForDownload) 
      ? allowedProjectsForDownload
          .filter(id => id && typeof id === 'string')
          .map(id => id.toLowerCase().trim())
          .filter(id => id.length > 0)
      : ['general']; // Default to 'general' if invalid
      
    // Ensure 'general' is always included
    if (!validProjects.includes('general')) {
      validProjects.unshift('general');
    }

    const { serverSettings } = await connectToDatabase();
    
    // Prepare the update data
    const updateData = {
      allowInternUpload,
      allowInternDownload: allowInternDownload !== undefined ? allowInternDownload : true,
      allowedFileTypes: allowedFileTypes.filter(type => 
        typeof type === 'string' && type.startsWith('.')
      ),
      maxFileSize: Math.min(Math.max(1, maxFileSize), 100), // Clamp between 1-100MB
      fileNameRegex,
      updatedAt: new Date(),
      allowedProjectsForDownload: validProjects,
      allowedDocuments: {}
    };
    
    // Process allowedDocuments if provided
    if (allowedDocuments && typeof allowedDocuments === 'object') {
      // Only include documents that belong to allowed projects
      Object.entries(allowedDocuments).forEach(([projectId, docs]) => {
        const normalizedProjectId = projectId.toLowerCase().trim();
        if (validProjects.includes(normalizedProjectId) && 
            docs && 
            typeof docs === 'object' && 
            !Array.isArray(docs)) {
          
          // Only include document IDs that are strings and have a truthy value
          updateData.allowedDocuments[normalizedProjectId] = Object.entries(docs).reduce((acc, [docId, isAllowed]) => {
            if (typeof docId === 'string' && docId.trim() && isAllowed) {
              acc[docId.trim()] = true;
            }
            return acc;
          }, {});
        }
      });
    }

    // Handle upload deadline
    if (uploadDeadline) {
      updateData.uploadDeadline = new Date(uploadDeadline);
    } else {
      updateData.uploadDeadline = null;
    }
    
    // Clean up allowedDocuments to only include allowed projects
    if (updateData.allowedDocuments) {
      const allowedProjects = new Set(updateData.allowedProjectsForDownload || []);
      const cleanedDocs = {};
      
      Object.entries(updateData.allowedDocuments).forEach(([projectId, docs]) => {
        if (allowedProjects.has(projectId) && docs && typeof docs === 'object') {
          cleanedDocs[projectId] = docs;
        }
      });
      
      updateData.allowedDocuments = cleanedDocs;
    }

    // Update or insert the settings
    const result = await serverSettings.updateOne(
      { _id: 'documentation_settings' },
      { 
        $set: { 
          ...updateData,
          updatedAt: new Date() 
        },
        $setOnInsert: { 
          _id: 'documentation_settings',
          createdAt: new Date() 
        } 
      },
      { upsert: true }
    );

    // Get the updated settings to return
    const updatedSettings = await serverSettings.findOne({ _id: 'documentation_settings' });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Settings saved successfully',
      data: {
        allowInternUpload: updatedSettings.allowInternUpload,
        allowInternDownload: updatedSettings.allowInternDownload,
        allowedFileTypes: updatedSettings.allowedFileTypes,
        maxFileSize: updatedSettings.maxFileSize,
        fileNameRegex: updatedSettings.fileNameRegex,
        uploadDeadline: updatedSettings.uploadDeadline,
        allowedProjectsForDownload: updatedSettings.allowedProjectsForDownload,
        allowedDocuments: updatedSettings.allowedDocuments || {},
        updatedAt: updatedSettings.updatedAt,
        _id: updatedSettings._id
      }
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error('Error in server-settings API:', error);
    
    // Handle specific error types
    let statusCode = 500;
    let errorMessage = 'An unexpected error occurred';
    let errorDetails = undefined;
    
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = 'Validation failed';
      errorDetails = error.message;
    } else if (error.name === 'MongoError') {
      statusCode = 503; // Service Unavailable
      errorMessage = 'Database error occurred';
      errorDetails = process.env.NODE_ENV === 'development' ? error.message : undefined;
    } else if (error.statusCode) {
      statusCode = error.statusCode;
      errorMessage = error.message || errorMessage;
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage,
      ...(process.env.NODE_ENV === 'development' ? { 
        details: errorDetails || error.message,
        stack: error.stack 
      } : {})
    }), { 
      status: statusCode,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}