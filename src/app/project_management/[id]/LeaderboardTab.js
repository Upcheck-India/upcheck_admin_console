'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, Award, Plus, Sparkles, User, Settings, Info, Loader2, 
  Trash2, ShieldCheck, CheckSquare, MessageSquare, Flame, Star, Check
} from 'lucide-react';
import AvatarWithStatus from '../../../components/AvatarWithStatus';
import useOnlineUsers from '../../../hooks/useOnlineUsers';

export default function LeaderboardTab({ project, projectId }) {
  const onlineUsers = useOnlineUsers();
  const onlineUsernames = useMemo(() => new Set(onlineUsers.map(u => u.username)), [onlineUsers]);

  const [leaderboard, setLeaderboard] = useState([]);
  const [customBadges, setCustomBadges] = useState([]);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Forms
  const [newBadgeName, setNewBadgeName] = useState('');
  const [newBadgeDesc, setNewBadgeDesc] = useState('');
  const [newBadgeIcon, setNewBadgeIcon] = useState('🎖️');
  const [newBadgeColor, setNewBadgeColor] = useState('#3b82f6');
  
  const [grantUsername, setGrantUsername] = useState('');
  const [grantBadgeId, setGrantBadgeId] = useState('');

  // Expand admin section
  const [showAdminConsole, setShowAdminConsole] = useState(false);

  const colors = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#ef4444', label: 'Red' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#6b7280', label: 'Gray' }
  ];

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/leaderboard`);
      if (!res.ok) {
        throw new Error('Failed to load leaderboard data');
      }
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
      setCustomBadges(data.customBadges || []);
      setIsManager(data.isManager || false);
      
      // Select defaults for grant form if lists are populated
      if (data.leaderboard?.length > 0 && !grantUsername) {
        setGrantUsername(data.leaderboard[0].username);
      }
      if (data.customBadges?.length > 0 && !grantBadgeId) {
        setGrantBadgeId(data.customBadges[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchLeaderboard();
    }
  }, [projectId]);

  // Handle create badge
  const handleCreateBadge = async (e) => {
    e.preventDefault();
    if (!newBadgeName || !newBadgeDesc) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBadgeName,
          description: newBadgeDesc,
          icon: newBadgeIcon,
          color: newBadgeColor
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create badge');
      }

      setNewBadgeName('');
      setNewBadgeDesc('');
      setNewBadgeIcon('🎖️');
      
      await fetchLeaderboard();
    } catch (err) {
      alert(`Error creating badge: ${err.message}`);
    }
  };

  // Handle grant badge
  const handleGrantBadge = async (e) => {
    e.preventDefault();
    if (!grantUsername || !grantBadgeId) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/leaderboard/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: grantUsername,
          badgeId: grantBadgeId
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to grant badge');
      }

      await fetchLeaderboard();
    } catch (err) {
      alert(`Error granting badge: ${err.message}`);
    }
  };

  // Handle revoke badge
  const handleRevokeBadge = async (username, badgeId) => {
    if (!confirm(`Are you sure you want to revoke this badge from ${username}?`)) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/leaderboard/grant`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          badgeId
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke badge');
      }

      await fetchLeaderboard();
    } catch (err) {
      alert(`Error revoking badge: ${err.message}`);
    }
  };

  // Calculate top 3 for podium
  const podium = useMemo(() => {
    const top3 = [];
    if (leaderboard.length > 0) top3[1] = leaderboard[0]; // 1st Place (Center)
    if (leaderboard.length > 1) top3[0] = leaderboard[1]; // 2nd Place (Left)
    if (leaderboard.length > 2) top3[2] = leaderboard[2]; // 3rd Place (Right)
    return top3;
  }, [leaderboard]);

  // Rest of the ranks
  const rankingTableData = useMemo(() => {
    return leaderboard;
  }, [leaderboard]);

  // Aggregate earned users for all badges
  const badgeEarners = useMemo(() => {
    const earnersMap = {};
    
    // Automatic badges
    leaderboard.forEach(user => {
      user.badges?.forEach(badge => {
        const key = badge.name;
        if (!earnersMap[key]) earnersMap[key] = [];
        earnersMap[key].push(user.username);
      });
    });

    return earnersMap;
  }, [leaderboard]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
        <p className="text-sm font-medium">Computing rankings & contributions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-red-500 max-w-md mx-auto">
        <Info className="h-12 w-12 mb-3" />
        <h3 className="font-semibold text-lg text-red-700">Error Loading Leaderboard</h3>
        <p className="text-sm text-gray-500 mt-1 mb-6">{error}</p>
        <button 
          onClick={fetchLeaderboard}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors shadow-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-2 md:p-4">
      
      {/* Gamification Header Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
          <div className="p-3.5 bg-blue-500 text-white rounded-2xl shadow-md border border-blue-400">
            <Trophy className="h-7 w-7 animate-bounce-slow" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg md:text-xl flex items-center justify-center md:justify-start gap-2">
              Teammate Leaderboard <Sparkles className="h-4.5 w-4.5 text-yellow-500" />
            </h3>
            <p className="text-sm text-gray-600 mt-1 max-w-xl">
              Earn points by completing tasks, estimations, and participating in tasks discussions. Complete tasks early for massive score boosters!
            </p>
          </div>
        </div>
        
        {isManager && (
          <button
            onClick={() => setShowAdminConsole(!showAdminConsole)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <Settings className="w-4 h-4" />
            {showAdminConsole ? 'Hide Management' : 'Manage Badges'}
          </button>
        )}
      </div>

      {/* Admin Panel (Custom Badges creation & granting) */}
      {isManager && showAdminConsole && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-md transition-all animate-fadeIn">
          <h3 className="font-bold text-gray-900 text-base border-b pb-2.5 mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" /> Manager Gamification Center
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-gray-150">
            
            {/* Form 1: Create Badge */}
            <form onSubmit={handleCreateBadge} className="space-y-4">
              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" /> Create Custom Achievement Badge
              </h4>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Badge Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bug Squasher, Review Master"
                  value={newBadgeName}
                  onChange={e => setNewBadgeName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description / Criteria</label>
                <textarea
                  placeholder="Describe how a teammate earns this badge..."
                  value={newBadgeDesc}
                  onChange={e => setNewBadgeDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-all resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Emoji Icon</label>
                  <input
                    type="text"
                    value={newBadgeIcon}
                    onChange={e => setNewBadgeIcon(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-300 text-center text-lg outline-none"
                    maxLength={2}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Theme Color</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {colors.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNewBadgeColor(c.value)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${newBadgeColor === c.value ? 'border-black scale-110' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all"
              >
                Create Badge
              </button>
            </form>

            {/* Form 2: Grant Badge */}
            <form onSubmit={handleGrantBadge} className="space-y-4 md:pl-8 pt-6 md:pt-0">
              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Award className="w-4 h-4 text-indigo-600" /> Award Custom Badge to Teammate
              </h4>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Select Teammate</label>
                <select
                  value={grantUsername}
                  onChange={e => setGrantUsername(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-300 outline-none transition-all"
                  required
                >
                  {leaderboard.map(item => (
                    <option key={item.username} value={item.username}>
                      {item.username} ({item.points} pts)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Select Badge</label>
                {customBadges.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                    No custom badges created yet. Create one first on the left panel.
                  </p>
                ) : (
                  <select
                    value={grantBadgeId}
                    onChange={e => setGrantBadgeId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-300 outline-none transition-all"
                    required
                  >
                    {customBadges.map(badge => (
                      <option key={badge.id} value={badge.id}>
                        {badge.icon} {badge.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="submit"
                disabled={customBadges.length === 0}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow transition-all"
              >
                Award Badge
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Podium Showcase (Top 3 ranks) */}
      {leaderboard.length > 0 && (
        <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-4 max-w-4xl mx-auto py-6">
          
          {/* 2nd Place (Left) */}
          {podium[0] && (
            <div className="flex flex-col items-center w-full md:w-64 order-2 md:order-1">
              <div className="relative mb-3 flex flex-col items-center">
                <AvatarWithStatus 
                  username={podium[0].username} 
                  online={onlineUsernames.has(podium[0].username)} 
                  className="h-16 w-16 text-lg ring-4 ring-slate-300 shadow-md" 
                />
                <span className="absolute -top-3.5 bg-slate-400 text-white border-2 border-white text-[10px] font-extrabold h-6 w-6 rounded-full flex items-center justify-center shadow">
                  2
                </span>
              </div>
              <h4 className="font-bold text-gray-800 text-sm">{podium[0].username}</h4>
              <p className="text-xs text-gray-500 font-medium">{podium[0].points} pts</p>
              
              {/* Podium Column */}
              <div className="w-full h-24 bg-gradient-to-t from-slate-200 to-slate-100/70 border border-slate-200/50 rounded-t-xl mt-4 flex flex-col items-center justify-center shadow-inner">
                <span className="text-xl font-black text-slate-400">SILVER</span>
                <span className="text-xs font-semibold text-slate-500 mt-1">{podium[0].tasksCompleted} Tasks Done</span>
              </div>
            </div>
          )}

          {/* 1st Place (Center - Elevated) */}
          {podium[1] && (
            <div className="flex flex-col items-center w-full md:w-68 order-1 md:order-2">
              <div className="relative mb-3.5 flex flex-col items-center scale-110">
                <div className="absolute -top-6 text-yellow-500 animate-pulse">
                  <Star className="h-6 w-6 fill-current" />
                </div>
                <AvatarWithStatus 
                  username={podium[1].username} 
                  online={onlineUsernames.has(podium[1].username)} 
                  className="h-20 w-20 text-xl ring-4 ring-yellow-400 shadow-lg" 
                />
                <span className="absolute -top-3 bg-yellow-400 text-white border-2 border-white text-xs font-extrabold h-6 w-6 rounded-full flex items-center justify-center shadow">
                  1
                </span>
              </div>
              <h4 className="font-extrabold text-gray-900 text-base">{podium[1].username}</h4>
              <p className="text-sm text-yellow-600 font-bold">{podium[1].points} pts</p>
              
              {/* Podium Column */}
              <div className="w-full h-32 bg-gradient-to-t from-yellow-100 to-yellow-50/70 border border-yellow-200/50 rounded-t-2xl mt-4 flex flex-col items-center justify-center shadow-md">
                <span className="text-2xl font-black text-yellow-600 tracking-wider">GOLD</span>
                <span className="text-xs font-bold text-yellow-700 mt-1">{podium[1].tasksCompleted} Tasks Done</span>
              </div>
            </div>
          )}

          {/* 3rd Place (Right) */}
          {podium[2] && (
            <div className="flex flex-col items-center w-full md:w-64 order-3">
              <div className="relative mb-3 flex flex-col items-center">
                <AvatarWithStatus 
                  username={podium[2].username} 
                  online={onlineUsernames.has(podium[2].username)} 
                  className="h-16 w-16 text-lg ring-4 ring-amber-500/40 shadow-md" 
                />
                <span className="absolute -top-3.5 bg-amber-600 text-white border-2 border-white text-[10px] font-extrabold h-6 w-6 rounded-full flex items-center justify-center shadow">
                  3
                </span>
              </div>
              <h4 className="font-bold text-gray-800 text-sm">{podium[2].username}</h4>
              <p className="text-xs text-gray-500 font-medium">{podium[2].points} pts</p>
              
              {/* Podium Column */}
              <div className="w-full h-20 bg-gradient-to-t from-amber-100/50 to-amber-50/30 border border-amber-200/30 rounded-t-xl mt-4 flex flex-col items-center justify-center shadow-inner">
                <span className="text-lg font-black text-amber-600/80">BRONZE</span>
                <span className="text-xs font-semibold text-amber-600 mt-1">{podium[2].tasksCompleted} Tasks Done</span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Rankings Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-gray-150 bg-gray-50/50">
          <h4 className="font-bold text-gray-800 text-sm">All Participant Stats</h4>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-bold text-gray-500 uppercase bg-gray-50/20">
                <th className="py-3 px-6 text-center w-16">Rank</th>
                <th className="py-3 px-6">Member</th>
                <th className="py-3 px-6 text-center">Score</th>
                <th className="py-3 px-6 text-center">Completed Tasks</th>
                <th className="py-3 px-6 text-center">Story Points</th>
                <th className="py-3 px-6 text-center">On-Time Rate</th>
                <th className="py-3 px-6">Badges Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {rankingTableData.map((row) => {
                const onTimeRate = row.totalTasksWithDueDate > 0 
                  ? Math.round((row.tasksCompletedOnTime / row.totalTasksWithDueDate) * 100)
                  : 100;
                
                return (
                  <tr key={row.username} className="hover:bg-gray-50/50 transition-colors">
                    {/* Rank */}
                    <td className="py-4 px-6 text-center font-extrabold text-gray-700">
                      {row.rank === 1 && '🥇'}
                      {row.rank === 2 && '🥈'}
                      {row.rank === 3 && '🥉'}
                      {row.rank > 3 && `#${row.rank}`}
                    </td>

                    {/* Member */}
                    <td className="py-4 px-6 font-semibold text-gray-900">
                      <div className="flex items-center gap-3">
                        <AvatarWithStatus 
                          username={row.username} 
                          online={onlineUsernames.has(row.username)} 
                          className="h-8 w-8 text-xs" 
                        />
                        <span>{row.username}</span>
                      </div>
                    </td>

                    {/* Score */}
                    <td className="py-4 px-6 text-center font-bold text-blue-600 bg-blue-50/20">
                      <div className="flex items-center justify-center gap-1">
                        <Flame className="w-3.5 h-3.5 fill-current text-orange-500" />
                        <span>{row.points}</span>
                      </div>
                    </td>

                    {/* Completed Tasks */}
                    <td className="py-4 px-6 text-center text-gray-700 font-medium">
                      <div className="flex items-center justify-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{row.tasksCompleted}</span>
                      </div>
                    </td>

                    {/* Story Points */}
                    <td className="py-4 px-6 text-center text-gray-700 font-semibold">
                      {row.storyPointsCompleted}
                    </td>

                    {/* On-Time Rate */}
                    <td className="py-4 px-6 text-center">
                      {row.totalTasksWithDueDate > 0 ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          onTimeRate >= 80 ? 'bg-emerald-50 text-emerald-700' :
                          onTimeRate >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {onTimeRate}%
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">N/A</span>
                      )}
                    </td>

                    {/* Badges */}
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1.5">
                        {row.badges?.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No badges earned</span>
                        ) : (
                          row.badges.map((badge, idx) => (
                            <span 
                              key={idx} 
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm cursor-help hover:scale-105 transition-transform"
                              style={{ 
                                backgroundColor: `${badge.color}15`, 
                                borderColor: `${badge.color}40`,
                                color: badge.color
                              }}
                              title={`${badge.name}: ${badge.description}`}
                            >
                              <span>{badge.icon}</span>
                              <span>{badge.name}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Badges Showcase List */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h3 className="font-bold text-gray-900 text-base border-b pb-2.5 mb-5 flex items-center gap-2">
          <Award className="h-5 w-5 text-indigo-600 animate-pulse" /> Badges Showcase & Earners
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Automatic Badges Showcase */}
          {/* 1. Star Performer */}
          <div className="border border-yellow-200 bg-yellow-50/10 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌟</span>
                <h4 className="font-bold text-yellow-800 text-sm">Star Performer</h4>
              </div>
              <p className="text-xs text-yellow-700/80 mt-1.5">
                Automatically unlocked by holds the highest total contribution points on the leaderboard.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-yellow-100 text-xs">
              <span className="font-bold text-yellow-800">Earners:</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(badgeEarners['Star Performer'] || []).length === 0 ? (
                  <span className="text-gray-400 italic">None yet</span>
                ) : (
                  badgeEarners['Star Performer'].map(u => (
                    <span key={u} className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-medium">{u}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 2. Early Bird */}
          <div className="border border-blue-200 bg-blue-50/10 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚀</span>
                <h4 className="font-bold text-blue-800 text-sm">Early Bird</h4>
              </div>
              <p className="text-xs text-blue-700/80 mt-1.5">
                Completed 3+ tasks at least 24 hours before their specified due date.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-blue-100 text-xs">
              <span className="font-bold text-blue-800">Earners:</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(badgeEarners['Early Bird'] || []).length === 0 ? (
                  <span className="text-gray-400 italic">None yet</span>
                ) : (
                  badgeEarners['Early Bird'].map(u => (
                    <span key={u} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">{u}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3. Task Crusher */}
          <div className="border border-amber-200 bg-amber-50/10 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <h4 className="font-bold text-amber-800 text-sm">Task Crusher</h4>
              </div>
              <p className="text-xs text-amber-700/80 mt-1.5">
                Completed 10+ tasks on the boards in this project.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-100 text-xs">
              <span className="font-bold text-amber-800">Earners:</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(badgeEarners['Task Crusher'] || []).length === 0 ? (
                  <span className="text-gray-400 italic">None yet</span>
                ) : (
                  badgeEarners['Task Crusher'].map(u => (
                    <span key={u} className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">{u}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 4. Velocity Master */}
          <div className="border border-red-200 bg-red-50/10 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                <h4 className="font-bold text-red-800 text-sm">Velocity Master</h4>
              </div>
              <p className="text-xs text-red-700/80 mt-1.5">
                Completed tasks carrying a cumulative total of 30+ story points.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-red-100 text-xs">
              <span className="font-bold text-red-800">Earners:</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(badgeEarners['Velocity Master'] || []).length === 0 ? (
                  <span className="text-gray-400 italic">None yet</span>
                ) : (
                  badgeEarners['Velocity Master'].map(u => (
                    <span key={u} className="bg-red-100 text-red-800 px-2 py-0.5 rounded font-medium">{u}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 5. Conversation Starter */}
          <div className="border border-emerald-200 bg-emerald-50/10 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">💬</span>
                <h4 className="font-bold text-emerald-800 text-sm">Conversation Starter</h4>
              </div>
              <p className="text-xs text-emerald-700/80 mt-1.5">
                Wrote 15+ task comments to discuss requirements and coordinate task implementation.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-emerald-100 text-xs">
              <span className="font-bold text-emerald-800">Earners:</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(badgeEarners['Conversation Starter'] || []).length === 0 ? (
                  <span className="text-gray-400 italic">None yet</span>
                ) : (
                  badgeEarners['Conversation Starter'].map(u => (
                    <span key={u} className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">{u}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 6. Perfectionist */}
          <div className="border border-pink-200 bg-pink-50/10 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <h4 className="font-bold text-pink-800 text-sm">Perfectionist</h4>
              </div>
              <p className="text-xs text-pink-700/80 mt-1.5">
                Completed 5+ tasks with a 100% on-time completion success rate.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-pink-100 text-xs">
              <span className="font-bold text-pink-800">Earners:</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {(badgeEarners['Perfectionist'] || []).length === 0 ? (
                  <span className="text-gray-400 italic">None yet</span>
                ) : (
                  badgeEarners['Perfectionist'].map(u => (
                    <span key={u} className="bg-pink-100 text-pink-800 px-2 py-0.5 rounded font-medium">{u}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Custom Badges Showcase */}
          {customBadges.map(cb => {
            const earners = badgeEarners[cb.name] || [];
            
            return (
              <div 
                key={cb.id} 
                className="border rounded-xl p-4 flex flex-col justify-between relative group shadow-sm hover:shadow transition-shadow"
                style={{ 
                  backgroundColor: `${cb.color}05`,
                  borderColor: `${cb.color}30`
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{cb.icon}</span>
                    <h4 className="font-bold text-sm" style={{ color: cb.color }}>
                      {cb.name}
                    </h4>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border bg-white ml-auto" style={{ color: cb.color, borderColor: `${cb.color}30` }}>
                      Custom
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    {cb.description}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 text-xs">
                  <span className="font-bold text-gray-700">Earners:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {earners.length === 0 ? (
                      <span className="text-gray-400 italic">None yet</span>
                    ) : (
                      earners.map(u => (
                        <span 
                          key={u} 
                          className="inline-flex items-center gap-1 border px-2 py-0.5 rounded font-medium shadow-inner"
                          style={{
                            backgroundColor: `${cb.color}15`,
                            borderColor: `${cb.color}30`,
                            color: cb.color
                          }}
                        >
                          <span>{u}</span>
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => handleRevokeBadge(u, cb.id)}
                              className="text-gray-400 hover:text-red-600 font-bold ml-1 hover:scale-110 transition-transform"
                              title="Revoke badge"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))
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
