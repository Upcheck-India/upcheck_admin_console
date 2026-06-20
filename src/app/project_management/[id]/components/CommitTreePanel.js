'use client';

import React, { useState, useEffect } from 'react';
import { GitCommit, GitMerge, ExternalLink, GitBranch, AlertTriangle } from 'lucide-react';

export default function CommitTreePanel({ projectId }) {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchCommits = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/github?endpoint=commits&per_page=50`);
        const data = await res.json();
        
        if (!isMounted) return;
        
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load Commits for Tree');
        }
        
        setCommits(data.data || []);
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCommits();
    return () => { isMounted = false; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 mt-0.5" />
        <div>
          <h3 className="font-semibold">Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900">No Commits</h3>
        <p className="text-gray-500 text-sm mt-1">Repository history is empty.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-indigo-600" />
          Commit History Tree
        </h3>
      </div>
      
      <div className="relative border border-slate-200 bg-white rounded-2xl p-4 shadow-sm overflow-hidden">
        {/* Background line */}
        <div className="absolute top-8 bottom-8 left-9 w-0.5 bg-slate-200 z-0"></div>

        <div className="space-y-6 relative z-10">
          {commits.map((commit, index) => {
            const isMerge = commit.parents && commit.parents.length > 1;
            const shortSha = commit.sha.substring(0, 7);
            const msg = commit.commit.message.split('\n')[0];
            
            return (
              <div key={commit.sha} className="flex gap-4 group">
                {/* Node visualizer */}
                <div className="relative flex flex-col items-center pt-1.5 w-10">
                  <div className={`w-3.5 h-3.5 rounded-full z-10 ring-4 ring-white transition-transform duration-200 group-hover:scale-125 ${
                    isMerge ? 'bg-purple-500 ring-purple-50' : 'bg-blue-500 ring-blue-50'
                  }`}></div>
                  
                  {/* Branch arc if merge */}
                  {isMerge && (
                    <svg className="absolute top-2 left-1/2 w-8 h-12 -z-10 opacity-40 text-purple-400" viewBox="0 0 32 48" fill="none">
                      <path d="M 0 0 C 16 16, 24 32, 24 48" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
                    </svg>
                  )}
                </div>

                {/* Commit info card */}
                <div className={`flex-1 p-3 rounded-xl border transition-all duration-200 hover:shadow-md ${
                  isMerge ? 'bg-purple-50/30 border-purple-100 hover:border-purple-300' : 'bg-slate-50/50 border-slate-100 hover:border-blue-200'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {isMerge ? (
                        <GitMerge className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      ) : (
                        <GitCommit className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                      <a 
                        href={commit.html_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`text-sm font-bold truncate max-w-sm hover:underline ${
                          isMerge ? 'text-purple-900' : 'text-slate-900'
                        }`}
                        title={msg}
                      >
                        {msg}
                      </a>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <a
                        href={commit.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs bg-white border border-slate-200 px-2 py-0.5 rounded text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1"
                      >
                        {shortSha}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                    <div className="flex items-center gap-1.5">
                      {commit.author?.avatar_url ? (
                        <img src={commit.author.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="w-2.5 h-2.5 text-slate-400" />
                        </div>
                      )}
                      <span className="font-semibold text-slate-700">{commit.commit.author.name}</span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold">
                      {new Date(commit.commit.author.date).toLocaleString(undefined, { 
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                      })}
                    </span>
                    
                    {isMerge && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-md font-mono text-[9px] uppercase tracking-wider font-bold flex items-center gap-1">
                        <GitMerge className="w-3 h-3" /> Merge
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
