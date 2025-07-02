'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { 
  ExternalLink, 
  Star, 
  GitFork, 
  Loader2, 
  CheckCircle, 
  Edit2, 
  X, 
  Save,
  AlertCircle
} from 'lucide-react';

export default function GithubRepoManager({ userId }) {
  const [repos, setRepos] = useState([]);
  const [filteredRepos, setFilteredRepos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentRepo, setCurrentRepo] = useState(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch user's GitHub repositories
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/github/repos');
        if (!response.ok) throw new Error('Failed to fetch repositories');
        
        const data = await response.json();
        setRepos(data);
        setFilteredRepos(data);
        
        // Load current working repo and notes if any
        const profileResponse = await fetch(`/api/users/${userId}/github-profile`);
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          if (profileData.currentRepo) {
            setCurrentRepo(profileData.currentRepo);
            setNotes(profileData.notes || '');
          }
        }
      } catch (error) {
        console.error('Error fetching GitHub data:', error);
        toast.error('Failed to load GitHub data');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) fetchRepos();
  }, [userId]);

  // Filter repositories based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRepos(repos);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = repos.filter(
      repo => 
        repo.name.toLowerCase().includes(term) || 
        (repo.description && repo.description.toLowerCase().includes(term))
    );
    setFilteredRepos(filtered);
  }, [searchTerm, repos]);

  // Save current working repo and notes
  const saveCurrentRepo = async (repo) => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/users/${userId}/github-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentRepo: repo ? {
            id: repo.id,
            name: repo.name,
            html_url: repo.html_url,
            description: repo.description,
            language: repo.language,
            stargazers_count: repo.stargazers_count,
            forks_count: repo.forks_count,
            updated_at: repo.updated_at
          } : null,
          notes: repo ? notes : ''
        })
      });

      if (!response.ok) throw new Error('Failed to save repository');
      
      setCurrentRepo(repo);
      toast.success(repo ? 'Repository set as current!' : 'Repository unset');
    } catch (error) {
      console.error('Error saving repository:', error);
      toast.error('Failed to save repository');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle current repo
  const toggleCurrentRepo = (repo) => {
    if (currentRepo && currentRepo.id === repo.id) {
      saveCurrentRepo(null);
    } else {
      saveCurrentRepo(repo);
    }
  };

  // Handle notes change
  const handleNotesChange = (e) => {
    setNotes(e.target.value);
  };

  // Save notes
  const saveNotes = async () => {
    if (!currentRepo) return;
    await saveCurrentRepo(currentRepo);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading repositories...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Working Repo */}
      {currentRepo && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">Currently Working On</h3>
              </div>
              <div className="mt-2 pl-7">
                <div className="flex items-center">
                  <a
                    href={currentRepo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium flex items-center"
                  >
                    {currentRepo.name}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                  {currentRepo.private && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                      Private
                    </span>
                  )}
                </div>
                {currentRepo.description && (
                  <p className="text-sm text-gray-600 mt-1">{currentRepo.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  {currentRepo.language && (
                    <span className="flex items-center">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                      {currentRepo.language}
                    </span>
                  )}
                  <span className="flex items-center">
                    <Star className="w-3 h-3 mr-1" />
                    {currentRepo.stargazers_count?.toLocaleString() || '0'}
                  </span>
                  <span className="flex items-center">
                    <GitFork className="w-3 h-3 mr-1" />
                    {currentRepo.forks_count?.toLocaleString() || '0'}
                  </span>
                  {currentRepo.updated_at && (
                    <span>
                      Updated {formatDistanceToNow(new Date(currentRepo.updated_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => toggleCurrentRepo(currentRepo)}
              disabled={isSaving}
              className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Remove'}
            </button>
          </div>

          {/* Notes Section */}
          <div className="mt-4 pl-7">
            <label htmlFor="repo-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes about this project
            </label>
            <div className="flex">
              <input
                type="text"
                id="repo-notes"
                value={notes}
                onChange={handleNotesChange}
                placeholder="What are you working on? (e.g., 'Building the main dashboard')"
                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <button
                onClick={saveNotes}
                disabled={isSaving}
                className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 rounded-r-md"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repositories List */}
      <div className="mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search repositories..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredRepos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No repositories found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? 'Try a different search term' : 'No repositories available'}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredRepos.map((repo) => (
              <li key={repo.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {repo.name}
                          <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100" />
                        </a>
                        {repo.private && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                            Private
                          </span>
                        )}
                        {currentRepo?.id === repo.id && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Current
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{repo.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        {repo.language && (
                          <span className="flex items-center">
                            <span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                            {repo.language}
                          </span>
                        )}
                        <span className="flex items-center">
                          <Star className="w-3 h-3 mr-1" />
                          {repo.stargazers_count?.toLocaleString() || '0'}
                        </span>
                        <span className="flex items-center">
                          <GitFork className="w-3 h-3 mr-1" />
                          {repo.forks_count?.toLocaleString() || '0'}
                        </span>
                        {repo.updated_at && (
                          <span>
                            Updated {formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleCurrentRepo(repo)}
                        disabled={isSaving}
                        className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          currentRepo?.id === repo.id
                            ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200 focus:ring-blue-500'
                        }`}
                      >
                        {isSaving && currentRepo?.id === repo.id ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Saving...
                          </>
                        ) : currentRepo?.id === repo.id ? (
                          'Remove'
                        ) : (
                          'Set as Current'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
