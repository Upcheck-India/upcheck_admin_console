import { cookies } from 'next/headers';
import clientPromise from '../../../../lib/mongodb';

export async function GET(request) {
  console.log('GitHub Repos API called');
  // Get the current user's session
  const sessionToken = cookies().get('admin_token')?.value;
  if (!sessionToken) {
    console.error('No session token found');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Find the current user
    const user = await db.collection('admin_users').findOne({ 
      sessionToken 
    });

    if (!user) {
      console.error('User not found for session token');
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Found user:', user.email);

    // Check if GitHub is connected
    const githubToken = user.oauth?.github?.accessToken;
    if (!githubToken) {
      console.error('GitHub not connected for user:', user.email);
      return new Response(JSON.stringify({ error: 'GitHub not connected' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    console.log('GitHub token found, fetching repositories...');

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('q') || '';

    try {
      // Fetch user's GitHub repositories
      const apiUrl = searchTerm 
        ? `https://api.github.com/search/repositories?q=${encodeURIComponent(searchTerm)}+user:${user.oauth.github.login}&sort=updated&per_page=10`
        : `https://api.github.com/user/repos?sort=updated&per_page=10`;

      console.log('Fetching from GitHub API:', apiUrl);
      console.log('Making GitHub API request to:', apiUrl);
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Upcheck-Admin-App',
        },
      });
      
      console.log('GitHub API response status:', response.status);
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      console.log('GitHub API rate limit remaining:', rateLimitRemaining);
      
      if (response.status === 403 && rateLimitRemaining === '0') {
        const resetTime = response.headers.get('x-ratelimit-reset');
        const resetDate = new Date(resetTime * 1000);
        console.error('GitHub API rate limit exceeded. Resets at:', resetDate);
        throw new Error(`GitHub API rate limit exceeded. Try again after ${resetDate.toLocaleTimeString()}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GitHub API error:', errorText);
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }

      let repositories = [];
      if (searchTerm) {
        const searchData = await response.json();
        console.log('GitHub search results:', searchData);
        repositories = searchData.items || [];
      } else {
        repositories = await response.json();
        console.log('GitHub repositories fetched:', repositories);
      }

      // Format the repositories
      const formattedRepos = repositories.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        updatedAt: repo.updated_at,
        private: repo.private,
        owner: {
          login: repo.owner?.login,
          avatar: repo.owner?.avatar_url,
          url: repo.owner?.html_url,
        },
      }));

      return new Response(JSON.stringify({ 
        repositories: formattedRepos 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('GitHub API Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch GitHub repositories',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }), {
        status: error.status || 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal Server Error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
