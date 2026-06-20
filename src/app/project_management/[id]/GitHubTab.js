'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { 
  Github, GitFork, Star, Eye, Code, Terminal, Monitor, Sparkles, Download, ExternalLink,
  Copy, GitBranch, GitCommit, FileText, Folder, Check, AlertTriangle, ChevronRight, CornerDownRight, Clock, User, X, GitMerge, GitPullRequest
} from 'lucide-react';
import CommitTreePanel from './components/CommitTreePanel';
import PullRequestsPanel from './components/PullRequestsPanel';

// Common Language Colors
const languageColors = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Shell: '#89e051',
  'C++': '#f34b7d',
  C: '#555555'
};

export default function GitHubTab({ project, projectId }) {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('overview');
  
  // Settings checks
  const settings = project.settings?.github || {};
  const showFileBrowser = settings.showFileBrowser !== false;
  const showCommits = settings.showCommits !== false;
  const showBranches = settings.showBranches !== false;
  const showContributors = settings.showContributors !== false;
  const showPullRequests = settings.showPullRequests !== false;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Github },
    ...(showBranches ? [{ id: 'branches', label: 'Branches', icon: GitBranch }] : []),
    ...(showCommits ? [{ id: 'commits', label: 'Commits', icon: GitCommit }] : []),
    { id: 'commit_tree', label: 'Commit Tree', icon: GitMerge },
    ...(showPullRequests ? [{ id: 'pull_requests', label: 'Pull Requests', icon: GitPullRequest }] : []),
    ...(showFileBrowser ? [{ id: 'files', label: 'Files', icon: Folder }] : [])
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navigation Pill Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-max">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
              activeSubTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {activeSubTab === 'overview' && <OverviewPanel projectId={projectId} project={project} showContributors={showContributors} />}
        {activeSubTab === 'branches' && showBranches && <BranchesPanel projectId={projectId} />}
        {activeSubTab === 'commits' && showCommits && <CommitsPanel projectId={projectId} />}
        {activeSubTab === 'commit_tree' && <CommitTreePanel projectId={projectId} />}
        {activeSubTab === 'pull_requests' && showPullRequests && <PullRequestsPanel projectId={projectId} />}
        {activeSubTab === 'files' && showFileBrowser && <FilesPanel projectId={projectId} project={project} user={user} />}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// OVERVIEW PANEL
// -------------------------------------------------------------
function OverviewPanel({ projectId, project, showContributors }) {
  const [data, setData] = useState({ repo: null, languages: null, contributors: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedAction, setCopiedAction] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchOverviewData = async () => {
      setLoading(true);
      try {
        const [repoRes, langRes, contRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/github?endpoint=repo`).then(r => r.json()),
          fetch(`/api/projects/${projectId}/github?endpoint=languages`).then(r => r.json()),
          showContributors ? fetch(`/api/projects/${projectId}/github?endpoint=contributors`).then(r => r.json()) : Promise.resolve({ data: [] })
        ]);

        if (!isMounted) return;

        if (repoRes.error) throw new Error(repoRes.error);

        setData({
          repo: repoRes.data,
          languages: langRes.data || {},
          contributors: contRes.data || []
        });
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOverviewData();
    return () => { isMounted = false; };
  }, [projectId, showContributors]);

  const copyToClipboard = (text, actionId) => {
    navigator.clipboard.writeText(text);
    setCopiedAction(actionId);
    setTimeout(() => setCopiedAction(null), 2000);
  };

  if (loading) return <SkeletonLoader type="overview" />;
  if (error) return <ErrorDisplay message={error} />;
  if (!data.repo) return null;

  const repo = data.repo;
  const owner = repo.owner?.login;
  const repoName = repo.name;
  
  const totalLangBytes = Object.values(data.languages).reduce((a, b) => a + b, 0);

  const quickActions = [
    { id: 'open', label: 'Open on GitHub', icon: ExternalLink, action: () => window.open(repo.html_url, '_blank') },
    { id: 'https', label: 'Clone HTTPS', icon: Copy, action: () => copyToClipboard(`git clone ${repo.clone_url}`, 'https') },
    { id: 'ssh', label: 'Clone SSH', icon: Copy, action: () => copyToClipboard(`git clone ${repo.ssh_url}`, 'ssh') },
    { id: 'cli', label: 'GitHub CLI', icon: Terminal, action: () => copyToClipboard(`gh repo clone ${repo.full_name}`, 'cli') },
    { id: 'vscode', label: 'Open in VS Code', icon: Monitor, action: () => copyToClipboard(`code --folder-uri vscode://vscode.git/clone?url=${repo.clone_url}`, 'vscode') },
    { id: 'cursor', label: 'Open in Cursor', icon: Sparkles, action: () => copyToClipboard(`cursor://clone?url=${repo.clone_url}`, 'cursor') },
    { id: 'dev', label: 'Open in GitHub.dev', icon: Code, action: () => window.open(`https://github.dev/${repo.full_name}`, '_blank') },
    { id: 'zip', label: 'Download ZIP', icon: Download, action: () => window.open(`https://github.com/${repo.full_name}/archive/refs/heads/${repo.default_branch}.zip`, '_blank') },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Repo Info Card */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            {repo.full_name}
          </h2>
          <p className="text-gray-600 mt-1">{repo.description || 'No description provided.'}</p>
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
          <div className="flex items-center"><Star className="w-4 h-4 mr-1 text-yellow-500" /> {repo.stargazers_count}</div>
          <div className="flex items-center"><GitFork className="w-4 h-4 mr-1 text-blue-500" /> {repo.forks_count}</div>
          <div className="flex items-center"><Eye className="w-4 h-4 mr-1 text-gray-500" /> {repo.watchers_count}</div>
        </div>
      </div>

      {/* Languages Bar */}
      {totalLangBytes > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Languages</h3>
          <div className="h-2 w-full flex rounded-full overflow-hidden bg-gray-100">
            {Object.entries(data.languages).map(([lang, bytes]) => (
              <div 
                key={lang} 
                style={{ width: `${(bytes / totalLangBytes) * 100}%`, backgroundColor: languageColors[lang] || '#8b8b8b' }}
                title={`${lang}: ${((bytes / totalLangBytes) * 100).toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap mt-3 gap-4">
            {Object.entries(data.languages).slice(0, 5).map(([lang, bytes]) => (
              <div key={lang} className="flex items-center text-xs text-gray-600">
                <div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: languageColors[lang] || '#8b8b8b' }} />
                <span className="font-medium mr-1">{lang}</span>
                <span className="text-gray-400">{((bytes / totalLangBytes) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map(action => (
            <button
              key={action.id}
              onClick={action.action}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm transition-all duration-300 group relative"
            >
              <action.icon className="w-6 h-6 text-gray-500 group-hover:text-blue-500 mb-2 transition-colors" />
              <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700 text-center">{action.label}</span>
              
              {/* Copied Tooltip */}
              {copiedAction === action.id && (
                <div className="absolute -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg flex items-center animate-in fade-in slide-in-from-bottom-2">
                  <Check className="w-3 h-3 mr-1 text-green-400" /> Copied!
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contributors */}
      {showContributors && data.contributors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
            <User className="w-4 h-4 mr-1.5 text-gray-500" /> Top Contributors
          </h3>
          <div className="flex flex-wrap gap-3">
            {data.contributors.slice(0, 10).map(user => (
              <a 
                key={user.id} 
                href={user.html_url} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-full pr-3 pl-1 py-1 hover:border-blue-300 hover:shadow-sm transition-all"
                title={`${user.login}: ${user.contributions} commits`}
              >
                <img src={user.avatar_url} alt={user.login} className="w-6 h-6 rounded-full" />
                <span className="text-xs font-medium text-gray-700">{user.login}</span>
                <span className="text-[10px] text-gray-400 bg-white px-1.5 rounded-full border">{user.contributions}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// BRANCHES PANEL
// -------------------------------------------------------------
function BranchesPanel({ projectId }) {
  const [branches, setBranches] = useState([]);
  const [repo, setRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedAction, setCopiedAction] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [repoRes, branchesRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/github?endpoint=repo`).then(r => r.json()),
          fetch(`/api/projects/${projectId}/github?endpoint=branches`).then(r => r.json())
        ]);
        if (!isMounted) return;
        if (repoRes.error) throw new Error(repoRes.error);
        if (branchesRes.error) throw new Error(branchesRes.error);
        
        setRepo(repoRes.data);
        setBranches(branchesRes.data);
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [projectId]);

  const copyToClipboard = (text, actionId) => {
    navigator.clipboard.writeText(text);
    setCopiedAction(actionId);
    setTimeout(() => setCopiedAction(null), 2000);
  };

  if (loading) return <SkeletonLoader type="list" />;
  if (error) return <ErrorDisplay message={error} />;

  const filteredBranches = branches.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Sort so default branch is first
  if (repo) {
    filteredBranches.sort((a, b) => {
      if (a.name === repo.default_branch) return -1;
      if (b.name === repo.default_branch) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="relative">
        <input 
          type="text" 
          placeholder="Search branches..." 
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <GitBranch className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
        {filteredBranches.map(branch => {
          const isDefault = repo && branch.name === repo.default_branch;
          return (
            <div key={branch.name} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3 mb-3 sm:mb-0">
                <GitBranch className="w-5 h-5 text-gray-400" />
                <div>
                  <span className="font-semibold text-gray-800">{branch.name}</span>
                  {isDefault && (
                    <span className="ml-2 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-700 bg-blue-100 rounded-full uppercase">Default</span>
                  )}
                  <div className="text-xs text-gray-500 mt-1 flex items-center">
                    <GitCommit className="w-3 h-3 mr-1" />
                    {branch.commit.sha.substring(0, 7)}
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2 w-full sm:w-auto">
                <button 
                  onClick={() => copyToClipboard(`git checkout ${branch.name}`, `co-${branch.name}`)}
                  className="flex-1 sm:flex-none text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 transition-colors relative"
                >
                  Checkout
                  {copiedAction === `co-${branch.name}` && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-10">Copied!</span>}
                </button>
                <button 
                  onClick={() => copyToClipboard(`git pull origin ${branch.name}`, `pull-${branch.name}`)}
                  className="flex-1 sm:flex-none text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 transition-colors relative"
                >
                  Pull
                  {copiedAction === `pull-${branch.name}` && <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs whitespace-nowrap z-10">Copied!</span>}
                </button>
                <a 
                  href={`https://github.com/${repo?.full_name}/tree/${branch.name}`}
                  target="_blank" rel="noreferrer"
                  className="p-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 transition-colors"
                  title="View on GitHub"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
        {filteredBranches.length === 0 && (
          <div className="p-8 text-center text-gray-500">No branches found matching "{searchTerm}"</div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// COMMITS PANEL
// -------------------------------------------------------------
function CommitsPanel({ projectId }) {
  const [commits, setCommits] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [repo, setRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch branches first to populate dropdown
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const [repoRes, branchesRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/github?endpoint=repo`).then(r => r.json()),
          fetch(`/api/projects/${projectId}/github?endpoint=branches`).then(r => r.json())
        ]);
        if (!isMounted) return;
        if (repoRes.error) throw new Error(repoRes.error);
        if (branchesRes.error) throw new Error(branchesRes.error);
        
        setRepo(repoRes.data);
        setBranches(branchesRes.data);
        if (repoRes.data?.default_branch) {
          setSelectedBranch(repoRes.data.default_branch);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      }
    };
    initData();
    return () => { isMounted = false; };
  }, [projectId]);

  // Fetch commits when branch or page changes
  useEffect(() => {
    if (!selectedBranch) return;
    let isMounted = true;
    const fetchCommits = async () => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      
      try {
        const res = await fetch(`/api/projects/${projectId}/github?endpoint=commits&branch=${encodeURIComponent(selectedBranch)}&page=${page}&per_page=20`);
        const json = await res.json();
        
        if (!isMounted) return;
        if (json.error) throw new Error(json.error);
        
        if (json.data.length < 20) setHasMore(false);
        
        if (page === 1) {
          setCommits(json.data);
        } else {
          setCommits(prev => [...prev, ...json.data]);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };
    fetchCommits();
    return () => { isMounted = false; };
  }, [projectId, selectedBranch, page]);

  const handleBranchChange = (e) => {
    setSelectedBranch(e.target.value);
    setPage(1);
    setHasMore(true);
  };

  const timeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff/60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)} hours ago`;
    if (diff < 2592000) return `${Math.floor(diff/86400)} days ago`;
    return date.toLocaleDateString();
  };

  const copySHA = (sha) => {
    navigator.clipboard.writeText(sha);
    // Simple visual feedback could be added here
  };

  if (error) return <ErrorDisplay message={error} />;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <GitBranch className="w-5 h-5 text-gray-500" />
          <select 
            value={selectedBranch}
            onChange={handleBranchChange}
            className="border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            disabled={loading && page === 1}
          >
            {branches.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && page === 1 ? (
        <SkeletonLoader type="timeline" />
      ) : (
        <div className="relative border-l-2 border-gray-200 ml-3 pl-6 space-y-8">
          {commits.map((commit, i) => {
            const messageParts = commit.commit.message.split('\n\n');
            const title = messageParts[0];
            const body = messageParts.slice(1).join('\n\n');
            
            return (
              <div key={commit.sha} className="relative group">
                {/* Timeline dot */}
                <div className="absolute -left-[31px] bg-white border-2 border-gray-300 rounded-full w-4 h-4 mt-1.5 group-hover:border-blue-500 transition-colors"></div>
                
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-800 text-sm md:text-base pr-4 line-clamp-2">{title}</h4>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button 
                        onClick={() => copySHA(commit.sha)}
                        className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors flex items-center"
                        title="Copy SHA"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        {commit.sha.substring(0, 7)}
                      </button>
                      <a 
                        href={commit.html_url}
                        target="_blank" rel="noreferrer"
                        className="text-gray-400 hover:text-gray-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  
                  {body && (
                    <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap line-clamp-3 bg-gray-50 p-2 rounded-md">
                      {body}
                    </p>
                  )}
                  
                  <div className="flex items-center text-xs text-gray-500 mt-3">
                    {commit.author?.avatar_url ? (
                      <img src={commit.author.avatar_url} alt="" className="w-5 h-5 rounded-full mr-2" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-200 mr-2 flex items-center justify-center">
                        <User className="w-3 h-3 text-gray-500" />
                      </div>
                    )}
                    <span className="font-medium text-gray-700 mr-2">{commit.commit.author.name}</span>
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {timeAgo(commit.commit.author.date)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && commits.length > 0 && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={loadingMore}
            className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors disabled:opacity-50 flex items-center"
          >
            {loadingMore ? 'Loading...' : 'Load Older Commits'}
          </button>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// FILES PANEL (TREE BROWSER & EDITOR)
// -------------------------------------------------------------
function FilesPanel({ projectId, project, user }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [repo, setRepo] = useState(null);
  
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [fileContent, setFileContent] = useState(null); // When viewing a specific file
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth check for editing
  const isSuperManager = project.superManager === user?.username;
  const isProjectManager = project.members?.find(m => m.username === user?.username)?.role === 'Project Manager';
  const canEdit = isSuperManager || isProjectManager;

  // Initialize
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const [repoRes, branchesRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/github?endpoint=repo`).then(r => r.json()),
          fetch(`/api/projects/${projectId}/github?endpoint=branches`).then(r => r.json())
        ]);
        if (!isMounted) return;
        if (repoRes.error) throw new Error(repoRes.error);
        if (branchesRes.error) throw new Error(branchesRes.error);
        
        setRepo(repoRes.data);
        setBranches(branchesRes.data);
        if (repoRes.data?.default_branch) {
          setSelectedBranch(repoRes.data.default_branch);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      }
    };
    initData();
    return () => { isMounted = false; };
  }, [projectId]);

  // Fetch contents when path or branch changes
  useEffect(() => {
    if (!selectedBranch) return;
    
    let isMounted = true;
    const fetchContents = async () => {
      setLoading(true);
      setError(null);
      setFileContent(null);
      setIsEditing(false);
      
      try {
        const res = await fetch(`/api/projects/${projectId}/github?endpoint=contents&branch=${encodeURIComponent(selectedBranch)}&path=${encodeURIComponent(currentPath)}`);
        const json = await res.json();
        
        if (!isMounted) return;
        if (json.error) throw new Error(json.error);
        
        // GitHub API returns an array for directories, and an object for files
        if (Array.isArray(json.data)) {
          // Sort: folders first, then alphabetically
          const sorted = json.data.sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
          });
          setFiles(sorted);
        } else {
          // It's a file
          let contentStr = '';
          if (json.data.content) {
             contentStr = decodeURIComponent(escape(atob(json.data.content)));
          }
          setFileContent({
            ...json.data,
            decodedContent: contentStr
          });
          setEditContent(contentStr);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchContents();
    return () => { isMounted = false; };
  }, [projectId, selectedBranch, currentPath]);

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      alert("Please enter a commit message.");
      return;
    }
    if (!confirm(`Are you sure you want to commit this change to ${selectedBranch}? This cannot be undone.`)) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/github`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: fileContent.path,
          message: commitMessage,
          content: editContent,
          branch: selectedBranch,
          sha: fileContent.sha
        })
      });
      
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to commit');
      
      // Success! Reload the file
      alert("Changes committed successfully!");
      setIsEditing(false);
      setCommitMessage('');
      // Trigger a re-fetch of the current path
      const current = currentPath;
      setCurrentPath('__temp__'); // Hack to force re-fetch
      setTimeout(() => setCurrentPath(current), 10);
      
    } catch (err) {
      alert(`Error committing changes: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const breadcrumbs = currentPath ? currentPath.split('/') : [];

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (error) {
    return (
      <div className="space-y-4">
        {/* Navigation bar even on error */}
        <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <button 
              onClick={() => setCurrentPath('')} 
              className="text-blue-600 hover:underline text-sm font-medium mx-2"
            >
              {repo?.name || 'repo'}
            </button>
          </div>
        </div>
        <ErrorDisplay message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300 flex flex-col" style={{ minHeight: '500px' }}>
      
      {/* Toolbar / Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200 gap-2">
        <div className="flex items-center flex-wrap text-sm overflow-hidden">
          <select 
            value={selectedBranch}
            onChange={(e) => { setSelectedBranch(e.target.value); setCurrentPath(''); }}
            className="border-gray-300 rounded-md text-xs py-1 pl-2 pr-6 focus:ring-blue-500 focus:border-blue-500 shadow-sm mr-3 bg-white"
            disabled={loading}
          >
            {branches.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>

          <button 
            onClick={() => setCurrentPath('')} 
            className="text-gray-700 hover:text-blue-600 hover:underline font-medium flex items-center"
          >
            <Github className="w-4 h-4 mr-1.5" />
            {repo?.name || 'repo'}
          </button>
          
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            const pathUpToHere = breadcrumbs.slice(0, idx + 1).join('/');
            return (
              <React.Fragment key={pathUpToHere}>
                <span className="text-gray-400 mx-1">/</span>
                <button 
                  onClick={() => !isLast && setCurrentPath(pathUpToHere)}
                  className={`${isLast ? 'text-gray-900 font-semibold cursor-default' : 'text-gray-700 hover:text-blue-600 hover:underline'}`}
                  disabled={isLast}
                >
                  {crumb}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {loading ? (
        <SkeletonLoader type="fileBrowser" />
      ) : fileContent ? (
        // FILE VIEWER / EDITOR
        <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 flex flex-col shadow-sm">
          {/* File Header */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex justify-between items-center">
            <div className="flex items-center text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4 mr-2 text-gray-500" />
              {fileContent.name}
              <span className="text-gray-400 ml-4 text-xs font-normal border-l border-gray-300 pl-4">{formatSize(fileContent.size)}</span>
            </div>
            
            {!isEditing ? (
              <div className="flex space-x-2">
                <button 
                  onClick={() => navigator.clipboard.writeText(fileContent.decodedContent)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                  title="Copy content"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <a 
                  href={fileContent.html_url}
                  target="_blank" rel="noreferrer"
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                  title="View on GitHub"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                {canEdit && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="ml-2 px-3 py-1 bg-white border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50 transition-colors flex items-center shadow-sm"
                  >
                    <Code className="w-3 h-3 mr-1" /> Edit File
                  </button>
                )}
              </div>
            ) : (
              <div className="flex space-x-2">
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(fileContent.decodedContent);
                    setCommitMessage('');
                  }}
                  className="px-3 py-1 bg-white border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Editor Mode Warning */}
          {isEditing && (
            <div className="bg-red-50 border-b border-red-200 p-3 flex items-start text-red-800 text-sm">
              <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="font-semibold">WARNING: Direct Repository Edit</p>
                <p>You are editing this file directly on the <span className="font-mono bg-red-100 px-1 rounded">{selectedBranch}</span> branch. This bypasses PR reviews and CI checks. Proceed with extreme caution.</p>
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-auto bg-white min-h-[400px] relative">
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-full min-h-[400px] p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                spellCheck={false}
              />
            ) : (
              <pre className="p-4 text-sm font-mono overflow-auto m-0 bg-gray-50/50">
                <code dangerouslySetInnerHTML={{ __html: highlightCode(fileContent.decodedContent, fileContent.name) }} />
              </pre>
            )}
          </div>

          {/* Editor Footer / Commit Area */}
          {isEditing && (
            <div className="bg-gray-50 border-t border-gray-200 p-4">
              <div className="max-w-2xl">
                <label className="block text-sm font-medium text-gray-700 mb-1">Commit Message</label>
                <input 
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Update file.js"
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm mb-3"
                  disabled={isSubmitting}
                />
                <button
                  onClick={handleCommit}
                  disabled={isSubmitting || !commitMessage.trim() || editContent === fileContent.decodedContent}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {isSubmitting ? 'Committing...' : 'Commit Changes to GitHub'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // DIRECTORY LISTING
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm flex-1">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-4 p-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="col-span-8 md:col-span-9 pl-2">Name</div>
            <div className="col-span-4 md:col-span-3 text-right pr-2">Size</div>
          </div>
          
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {/* Go Up directory item (if not at root) */}
            {currentPath && (
              <div 
                className="grid grid-cols-12 gap-4 p-3 hover:bg-blue-50 cursor-pointer transition-colors items-center text-sm"
                onClick={() => {
                  const parts = currentPath.split('/');
                  parts.pop();
                  setCurrentPath(parts.join('/'));
                }}
              >
                <div className="col-span-8 md:col-span-9 flex items-center text-blue-600 font-medium pl-2">
                  <CornerDownRight className="w-4 h-4 mr-3 text-gray-400 rotate-180" />
                  ..
                </div>
                <div className="col-span-4 md:col-span-3 text-right text-gray-400 text-xs pr-2"></div>
              </div>
            )}

            {/* Files & Folders */}
            {files.map(file => (
              <div 
                key={file.sha} 
                className="grid grid-cols-12 gap-4 p-3 hover:bg-gray-50 cursor-pointer transition-colors items-center text-sm group"
                onClick={() => {
                  if (file.type === 'dir') setCurrentPath(file.path);
                  else setCurrentPath(file.path); // Will fetch file content
                }}
              >
                <div className="col-span-8 md:col-span-9 flex items-center truncate pl-2">
                  {file.type === 'dir' ? (
                    <Folder className="w-5 h-5 mr-3 text-blue-400 fill-blue-100 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 mr-3 text-gray-400 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                  )}
                  <span className={`truncate ${file.type === 'dir' ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                    {file.name}
                  </span>
                </div>
                <div className="col-span-4 md:col-span-3 text-right text-gray-500 text-xs pr-2 whitespace-nowrap">
                  {file.type === 'file' ? formatSize(file.size) : ''}
                </div>
              </div>
            ))}
            
            {files.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-500">This directory is empty</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// HELPERS & UI COMPONENTS
// -------------------------------------------------------------

function highlightCode(code, filename) {
  if (!code) return '';
  const ext = filename.split('.').pop().toLowerCase();
  
  // Map extensions to highlight.js language aliases
  const langMap = {
    js: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python',
    sh: 'bash', bash: 'bash',
    json: 'json',
    css: 'css',
    xml: 'xml', html: 'xml', svg: 'xml'
  };
  
  const lang = langMap[ext];
  
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    // Fallback to auto-detection
    return hljs.highlightAuto(code).value;
  } catch (e) {
    // If highlight fails, escape HTML and return raw
    return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

function ErrorDisplay({ message }) {
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start">
      <AlertTriangle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="text-sm font-semibold text-red-800">GitHub Integration Error</h3>
        <p className="text-sm text-red-700 mt-1">{message}</p>
        {message.includes('429') || message.includes('rate limit') && (
          <p className="text-xs text-red-600 mt-2 font-medium">
            GitHub API rate limit exceeded. Add a Personal Access Token in Project Settings to increase your limit from 60 to 5000 requests per hour.
          </p>
        )}
      </div>
    </div>
  );
}

function SkeletonLoader({ type }) {
  if (type === 'overview') return (
    <div className="animate-pulse space-y-8">
      <div className="flex justify-between">
        <div>
          <div className="h-8 bg-gray-200 rounded w-64 mb-3"></div>
          <div className="h-4 bg-gray-100 rounded w-96"></div>
        </div>
        <div className="h-10 bg-gray-100 rounded w-48"></div>
      </div>
      <div>
        <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
        <div className="h-2 bg-gray-100 rounded w-full mb-3"></div>
        <div className="flex gap-2"><div className="h-4 w-16 bg-gray-100 rounded"></div><div className="h-4 w-16 bg-gray-100 rounded"></div></div>
      </div>
      <div>
        <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-24 bg-gray-50 rounded-xl border border-gray-100"></div>)}
        </div>
      </div>
    </div>
  );
  
  if (type === 'list') return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="p-4 border-b border-gray-100 flex justify-between">
            <div className="flex items-center space-x-3"><div className="w-5 h-5 bg-gray-200 rounded"></div><div><div className="h-5 bg-gray-200 rounded w-32 mb-2"></div><div className="h-3 bg-gray-100 rounded w-20"></div></div></div>
            <div className="flex space-x-2"><div className="w-16 h-8 bg-gray-100 rounded"></div><div className="w-16 h-8 bg-gray-100 rounded"></div></div>
          </div>
        ))}
      </div>
    </div>
  );

  if (type === 'timeline') return (
    <div className="animate-pulse ml-3 pl-6 border-l-2 border-gray-100 space-y-8 mt-6">
      {[1,2,3,4].map(i => (
        <div key={i} className="relative">
          <div className="absolute -left-[31px] bg-gray-200 border-2 border-white rounded-full w-4 h-4 mt-1.5"></div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <div className="flex justify-between mb-3"><div className="h-5 bg-gray-200 rounded w-3/4"></div><div className="h-6 w-16 bg-gray-200 rounded"></div></div>
            <div className="h-16 bg-gray-100 rounded w-full mb-3"></div>
            <div className="flex items-center"><div className="w-5 h-5 bg-gray-200 rounded-full mr-2"></div><div className="h-4 bg-gray-200 rounded w-24"></div></div>
          </div>
        </div>
      ))}
    </div>
  );

  if (type === 'fileBrowser') return (
    <div className="animate-pulse border border-gray-100 rounded-lg overflow-hidden">
      <div className="h-10 bg-gray-100 border-b border-gray-200"></div>
      {[1,2,3,4,5,6,7].map(i => (
        <div key={i} className="grid grid-cols-12 gap-4 p-3 border-b border-gray-50">
          <div className="col-span-9 flex items-center"><div className="w-5 h-5 bg-gray-200 rounded mr-3"></div><div className="h-4 bg-gray-200 rounded w-48"></div></div>
          <div className="col-span-3 flex justify-end"><div className="h-3 bg-gray-100 rounded w-12 mt-0.5"></div></div>
        </div>
      ))}
    </div>
  );
  
  return null;
}
