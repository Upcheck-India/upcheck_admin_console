'use client';

import React, { useState, useEffect } from 'react';
import { GitPullRequest, GitMerge, CheckCircle, XCircle, ExternalLink, MessageCircle } from 'lucide-react';

export default function PullRequestsPanel({ projectId }) {
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPRs = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/github?endpoint=pulls`);
        const data = await res.json();
        
        if (!isMounted) return;
        
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load Pull Requests');
        }
        
        setPrs(data.data || []);
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPRs();
    return () => { isMounted = false; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start gap-3">
        <XCircle className="w-5 h-5 mt-0.5" />
        <div>
          <h3 className="font-semibold">Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <GitPullRequest className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900">No Pull Requests</h3>
        <p className="text-gray-500 text-sm mt-1">There are no open or closed pull requests for this repository.</p>
      </div>
    );
  }

  const getStatusStyle = (state, merged_at) => {
    if (merged_at) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (state === 'closed') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  const getStatusIcon = (state, merged_at) => {
    if (merged_at) return <GitMerge className="w-4 h-4" />;
    if (state === 'closed') return <XCircle className="w-4 h-4" />;
    return <GitPullRequest className="w-4 h-4" />;
  };

  const getStatusText = (state, merged_at) => {
    if (merged_at) return 'Merged';
    if (state === 'closed') return 'Closed';
    return 'Open';
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <GitPullRequest className="w-5 h-5 text-blue-600" />
        Pull Requests
      </h3>
      <div className="flex flex-col gap-3">
        {prs.map(pr => {
          const statusStyle = getStatusStyle(pr.state, pr.merged_at);
          
          return (
            <div key={pr.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`p-2 rounded-lg border ${statusStyle} flex-shrink-0 mt-1 md:mt-0`}>
                  {getStatusIcon(pr.state, pr.merged_at)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <a 
                      href={pr.html_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-md font-bold text-gray-900 hover:text-blue-600 truncate transition-colors flex items-center gap-1.5"
                    >
                      {pr.title}
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="font-mono text-gray-400">#{pr.number}</span>
                    <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${statusStyle}`}>
                      {getStatusText(pr.state, pr.merged_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      by <img src={pr.user?.avatar_url} alt="" className="w-4 h-4 rounded-full" /> 
                      <span className="font-medium text-gray-700">{pr.user?.login}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {pr.comments || 0} comments
                    </span>
                    <span>
                      updated {new Date(pr.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded inline-flex items-center gap-2 font-mono">
                    <span className="text-blue-600 truncate max-w-[150px]">{pr.head.ref}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-indigo-600 truncate max-w-[150px]">{pr.base.ref}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
