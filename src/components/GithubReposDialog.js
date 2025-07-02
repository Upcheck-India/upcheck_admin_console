'use client';

import { useState, useEffect } from 'react';
import { X, ExternalLink, Star, GitFork, Loader2, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function GithubReposDialog({ 
  isOpen, 
  onClose, 
  githubUsername,
  onSelectRepo 
}) {
  const [repos, setRepos] = useState([]);
  const [filteredRepos, setFilteredRepos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && githubUsername) {
      fetchRepos();
    }
  }, [isOpen, githubUsername]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = repos.filter(repo => 
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredRepos(filtered);
    } else {
      setFilteredRepos(repos);
    }
  }, [searchTerm, repos]);

  const fetchRepos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/github/repos?username=${githubUsername}`);
      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }
      const data = await response.json();
      setRepos(data);
      setFilteredRepos(data);
    } catch (err) {
      console.error('Error fetching GitHub repos:', err);
      setError('Failed to load repositories. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {githubUsername}'s Public Repositories
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search repositories..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading repositories...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : filteredRepos.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No repositories found matching your search.' : 'No public repositories found.'}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRepos.map((repo) => (
                <div 
                  key={repo.id} 
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 group-hover:text-blue-600 flex items-center">
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {repo.name}
                          <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100" />
                        </a>
                      </h3>
                      {repo.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center mt-3 space-x-4 text-sm text-gray-500">
                        {repo.language && (
                          <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
                            <span>{repo.language}</span>
                          </div>
                        )}
                        <div className="flex items-center">
                          <Star className="w-3 h-3 mr-1" />
                          <span>{repo.stargazers_count || 0}</span>
                        </div>
                        <div className="flex items-center">
                          <GitFork className="w-3 h-3 mr-1" />
                          <span>{repo.forks_count || 0}</span>
                        </div>
                        {repo.updated_at && (
                          <span className="text-xs text-gray-400">
                            Updated {formatDistanceToNow(new Date(repo.updated_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <button
                        onClick={() => onSelectRepo(repo)}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t rounded-b-xl flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
          <a
            href={`https://github.com/${githubUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 inline-flex items-center"
          >
            View on GitHub
            <ExternalLink className="w-4 h-4 ml-2" />
          </a>
        </div>
      </div>
    </div>
  );
}
