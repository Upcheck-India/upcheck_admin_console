import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(request.url);
  const searchTerm = searchParams.get('q') || '';
  const accessToken = session.user?.accessToken;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'GitHub not connected' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Fetch user's GitHub repositories
    const apiUrl = searchTerm 
      ? `https://api.github.com/search/repositories?q=${encodeURIComponent(searchTerm)}+user:${session.user.githubUsername}&sort=updated&per_page=10`
      : `https://api.github.com/user/repos?sort=updated&per_page=10`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch GitHub repositories');
    }

    const data = await response.json();
    const repositories = searchTerm ? data.items : data;

    // Format the response to only include necessary data
    const formattedRepos = repositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
      private: repo.private,
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
}
