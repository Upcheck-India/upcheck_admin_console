import { cookies } from 'next/headers';
import clientPromise from '@/lib/mongodb';

export async function GET(request) {
  // Get the current user's session
  const sessionToken = cookies().get('admin_token')?.value;
  if (!sessionToken) {
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
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if GitHub is connected
    const githubToken = user.oauth?.github?.accessToken;
    if (!githubToken) {
      return new Response(JSON.stringify({ error: 'GitHub not connected' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('q') || '';

    try {
      // Fetch user's GitHub repositories
      const apiUrl = searchTerm 
        ? `https://api.github.com/search/repositories?q=${encodeURIComponent(searchTerm)}+user:${user.oauth.github.login}&sort=updated&per_page=10`
        : `https://api.github.com/user/repos?sort=updated&per_page=10`;

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API responded with status ${response.status}`);
      }

      let repositories = [];
      if (searchTerm) {
        const data = await response.json();
        repositories = data.items || [];
      } else {
        repositories = await response.json();
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
        details: error.message 
      }), {
        status: 500,
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
