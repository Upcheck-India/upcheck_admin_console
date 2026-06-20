import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

// Simple in-memory cache
const cache = new Map();

function getCacheKey(projectId, endpoint, params) {
  return `${projectId}:${endpoint}:${JSON.stringify(params)}`;
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const branch = searchParams.get('branch');
    const path = searchParams.get('path') || '';
    const page = searchParams.get('page') || '1';
    const per_page = searchParams.get('per_page') || '20';

    // Auth check
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get project
    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Permission check
    const isSuperManager = project.superManager === user.username;
    const isMember = project.members?.some(m => m.username === user.username);
    if (!isSuperManager && !isMember) {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!project.githubRepoUrl) {
      return NextResponse.json({ error: 'GitHub repository not configured' }, { status: 400 });
    }

    // Extract owner/repo
    const match = project.githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      return NextResponse.json({ error: 'Invalid GitHub URL format' }, { status: 400 });
    }
    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');

    // Setup fetch options
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Upcheck-Admin-Console',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    const pat = project.settings?.github?.personalAccessToken;
    if (pat) {
      headers['Authorization'] = `Bearer ${pat.trim()}`;
    }

    // Check cache
    const cacheParams = { branch, path, page, per_page };
    const cacheKey = getCacheKey(id, endpoint, cacheParams);
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data);
      } else {
        cache.delete(cacheKey);
      }
    }

    let url = '';
    let ttl = 0;

    switch (endpoint) {
      case 'repo':
        url = `https://api.github.com/repos/${owner}/${cleanRepo}`;
        ttl = 5 * 60 * 1000;
        break;
      case 'branches':
        url = `https://api.github.com/repos/${owner}/${cleanRepo}/branches?per_page=100`;
        ttl = 5 * 60 * 1000;
        break;
      case 'commits':
        url = `https://api.github.com/repos/${owner}/${cleanRepo}/commits?per_page=${per_page}&page=${page}`;
        if (branch) url += `&sha=${branch}`;
        ttl = 2 * 60 * 1000;
        break;
      case 'contents':
        url = `https://api.github.com/repos/${owner}/${cleanRepo}/contents/${path}`;
        if (branch) url += `?ref=${branch}`;
        ttl = 10 * 60 * 1000;
        break;
      case 'languages':
        url = `https://api.github.com/repos/${owner}/${cleanRepo}/languages`;
        ttl = 30 * 60 * 1000;
        break;
      case 'contributors':
        url = `https://api.github.com/repos/${owner}/${cleanRepo}/contributors?per_page=30`;
        ttl = 15 * 60 * 1000;
        break;
      default:
        return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    const response = await fetch(url, { headers });
    
    // Pass along rate limit info
    const rateLimit = {
      limit: response.headers.get('x-ratelimit-limit'),
      remaining: response.headers.get('x-ratelimit-remaining'),
      reset: response.headers.get('x-ratelimit-reset')
    };

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({ 
        error: `GitHub API Error: ${response.status} ${response.statusText}`, 
        details: errorData,
        rateLimit
      }, { status: response.status === 403 && rateLimit.remaining === '0' ? 429 : response.status });
    }

    const data = await response.json();

    // Cache the successful response
    cache.set(cacheKey, {
      data: { data, rateLimit },
      expiresAt: Date.now() + ttl
    });

    return NextResponse.json({ data, rateLimit });
  } catch (error) {
    console.error('GitHub API Proxy Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { path, message, content, branch, sha } = body;

    if (!path || !message || content === undefined || !branch || !sha) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Auth check
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);

    const user = await db.collection('admin_users').findOne({ sessionToken: token });
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get project
    const project = await db.collection('projects').findOne({ _id: new ObjectId(id) });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Edit permission check: superManager or Project Manager
    const isSuperManager = project.superManager === user.username;
    const member = project.members?.find(m => m.username === user.username);
    const isProjectManager = member?.role === 'Project Manager';
    
    if (!isSuperManager && !isProjectManager) {
       return NextResponse.json({ error: 'Only Project Managers can edit files' }, { status: 403 });
    }

    const pat = project.settings?.github?.personalAccessToken;
    if (!pat) {
      return NextResponse.json({ error: 'GitHub Personal Access Token required for editing. Please configure it in Project Settings.' }, { status: 400 });
    }

    const match = project.githubRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      return NextResponse.json({ error: 'Invalid GitHub URL format' }, { status: 400 });
    }
    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');

    const url = `https://api.github.com/repos/${owner}/${cleanRepo}/contents/${path}`;
    
    // Content must be base64 encoded
    const base64Content = Buffer.from(content).toString('base64');

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Upcheck-Admin-Console',
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': `Bearer ${pat.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        content: base64Content,
        sha,
        branch
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({ 
        error: `GitHub API Error: ${response.status} ${response.statusText}`, 
        details: errorData 
      }, { status: response.status });
    }

    const data = await response.json();
    
    // Clear relevant caches
    for (const key of cache.keys()) {
      if (key.startsWith(`${id}:contents`) || key.startsWith(`${id}:commits`)) {
        cache.delete(key);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('GitHub API PUT Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
