'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Trophy, Award, Plus, Sparkles, User, Settings, Info, Loader2, 
  Trash2, ShieldCheck, CheckSquare, MessageSquare, Flame, Star, Check,
  Edit, X, HelpCircle
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
  const [newBadgeExclusive, setNewBadgeExclusive] = useState(false);
  
  const [grantUsername, setGrantUsername] = useState('');
  const [grantBadgeId, setGrantBadgeId] = useState('');

  // Expand admin section
  const [showAdminConsole, setShowAdminConsole] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [editingCustomBadge, setEditingCustomBadge] = useState(null);
  const [selectedUserForBadges, setSelectedUserForBadges] = useState(null);

  const colors = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#ef4444', label: 'Red' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#6b7280', label: 'Gray' }
  ];

  const fetchLeaderboard = useCallback(async () => {
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
  }, [projectId, grantUsername, grantBadgeId]);

  useEffect(() => {
    if (projectId) {
      fetchLeaderboard();
    }
  }, [projectId, fetchLeaderboard]);

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
          color: newBadgeColor,
          projectExclusive: newBadgeExclusive
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create badge');
      }

      setNewBadgeName('');
      setNewBadgeDesc('');
      setNewBadgeIcon('🎖️');
      setNewBadgeExclusive(false);
      
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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
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

  const handleDeleteCustomBadge = async (badgeId) => {
    if (!confirm('Are you sure you want to delete this custom badge? This will revoke it from all earners and delete the definition.')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/leaderboard`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ badgeId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete badge');
      }
      await fetchLeaderboard();
    } catch (err) {
      alert(`Error deleting badge: ${err.message}`);
    }
  };

  const handleUpdateCustomBadge = async (e) => {
    e.preventDefault();
    if (!editingCustomBadge.name || !editingCustomBadge.description) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/leaderboard`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          badgeId: editingCustomBadge.id,
          name: editingCustomBadge.name,
          description: editingCustomBadge.description,
          icon: editingCustomBadge.icon,
          color: editingCustomBadge.color,
          projectExclusive: editingCustomBadge.projectExclusive === true
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update badge');
      }
      setEditingCustomBadge(null);
      await fetchLeaderboard();
    } catch (err) {
      alert(`Error updating badge: ${err.message}`);
    }
  };

  const handleDirectGrantBadge = async (username, badgeId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/leaderboard/grant`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ username, badgeId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to grant badge');
      }
      await fetchLeaderboard();
    } catch (err) {
      alert(`Error granting badge: ${err.message}`);
      throw err;
    }
  };

  const handleDirectRevokeBadge = async (username, badgeId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/leaderboard/grant`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ username, badgeId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke badge');
      }
      await fetchLeaderboard();
    } catch (err) {
      alert(`Error revoking badge: ${err.message}`);
      throw err;
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
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <HelpCircle className="w-4 h-4" />
            Rules Guide
          </button>
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

              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newBadgeExclusive}
                    onChange={e => setNewBadgeExclusive(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <span>Project Exclusive Badge (only available in this project)</span>
                </label>
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
                        {isManager && (
                          <button
                            onClick={() => setSelectedUserForBadges(row.username)}
                            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                            title="Manage Badges"
                          >
                            <Award className="h-3.5 w-3.5 text-gray-500 hover:text-blue-600" />
                          </button>
                        )}
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm cursor-help hover:scale-105 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
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
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-2xl">{cb.icon}</span>
                    <h4 className="font-bold text-sm" style={{ color: cb.color }}>
                      {cb.name}
                    </h4>
                    
                    <div className="flex items-center gap-1.5 ml-auto">
                      {cb.projectExclusive && (
                        <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded animate-pulse" title="Only available in this project">
                          Exclusive
                        </span>
                      )}
                      {cb.projectId && cb.projectId !== projectId && (
                        <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded" title="Shared from another project">
                          Shared
                        </span>
                      )}
                      
                      {isManager && (!cb.projectId || cb.projectId === projectId) ? (
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => setEditingCustomBadge(cb)}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                            title="Edit Badge"
                          >
                            <Edit className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomBadge(cb.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                            title="Delete Badge"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border bg-white" style={{ color: cb.color, borderColor: `${cb.color}30` }}>
                          Custom
                        </span>
                      )}
                    </div>
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

      {/* Leaderboard Guide Modal */}
      {showGuide && (
        <LeaderboardGuideModal onClose={() => setShowGuide(false)} />
      )}

      {/* Edit Badge Modal */}
      {editingCustomBadge && (
        <EditBadgeModal
          badge={editingCustomBadge}
          colors={colors}
          onSave={handleUpdateCustomBadge}
          onChange={(fields) => setEditingCustomBadge(prev => ({ ...prev, ...fields }))}
          onClose={() => setEditingCustomBadge(null)}
        />
      )}

      {/* Manage Badges Modal */}
      {selectedUserForBadges && (
        <ManageBadgesModal
          username={selectedUserForBadges}
          customBadges={customBadges}
          userBadges={leaderboard.find(u => u.username === selectedUserForBadges)?.badges || []}
          onGrant={handleDirectGrantBadge}
          onRevoke={handleDirectRevokeBadge}
          onClose={() => setSelectedUserForBadges(null)}
        />
      )}

    </div>
  );
}

// Sub-components

const LeaderboardGuideModal = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('points');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-150 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-955 text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500 animate-pulse" />
              Gamification & Leaderboard Guide
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Rules, points system, loophole safeguards, and automatic achievements</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-150 px-4 bg-gray-50/20 text-sm">
          <button
            onClick={() => setActiveTab('points')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${activeTab === 'points' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Points System
          </button>
          <button
            onClick={() => setActiveTab('loopholes')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${activeTab === 'loopholes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Safeguards
          </button>
          <button
            onClick={() => setActiveTab('badges')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${activeTab === 'badges' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Badges Criteria
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm text-gray-700 leading-relaxed">
          {activeTab === 'points' && (
            <div className="space-y-4 animate-fadeIn">
              <p>
                Points are recalculated in real-time. When tasks are moved to the <strong>Done</strong> column, points are distributed among the assigned members.
              </p>

              {/* Point Allocation Grid */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4 text-right">Points Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs md:text-sm">
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-900">Task Completion (Low priority)</td>
                      <td className="py-2 px-4 text-right text-emerald-600 font-bold">+5 pts</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-900">Task Completion (Medium priority)</td>
                      <td className="py-2 px-4 text-right text-emerald-600 font-bold">+10 pts</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-900">Task Completion (High priority)</td>
                      <td className="py-2 px-4 text-right text-emerald-600 font-bold">+15 pts</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-900">Task Completion (Urgent priority)</td>
                      <td className="py-2 px-4 text-right text-emerald-600 font-bold">+20 pts</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-900">Complexity Multiplier (Story Points)</td>
                      <td className="py-2 px-4 text-right text-emerald-600 font-bold">+2 pts <span className="text-gray-400 font-normal">per point</span></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-900">Bug Fixing Bonus</td>
                      <td className="py-2 px-4 text-right text-emerald-600 font-bold">+2 pts <span className="text-gray-400 font-normal">for Bug tasks</span></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-900">Early Task Completion</td>
                      <td className="py-2 px-4 text-right text-emerald-600 font-bold">+10 pts <span className="text-gray-400 font-normal">(&gt;= 24h early)</span></td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-900">Speed Combo Completion Bonus</td>
                      <td className="py-2 px-4 text-right text-emerald-600 font-bold">
                        <span className="block font-semibold">+1 for 2nd, +3 for 3rd, +4 for 4th, +5 for 5th+</span>
                        <span className="text-[10px] text-gray-400 font-normal">tasks completed within a rolling 24h window</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-900">Discussion Comments</td>
                      <td className="py-2 px-4 text-right text-emerald-600 font-bold">
                        <span className="block">+2 pts <span className="text-gray-400 font-normal">for collaborating on others&apos; tasks</span></span>
                        <span className="block">+1 pt <span className="text-gray-400 font-normal">on self-assigned tasks</span></span>
                      </td>
                    </tr>
                    <tr className="bg-red-50/30">
                      <td className="py-2 px-4 font-medium text-red-950">Task Reopened Penalty</td>
                      <td className="py-2 px-4 text-right text-red-600 font-bold">-4 pts <span className="text-red-400 font-normal">(penalized to assignees)</span></td>
                    </tr>
                    <tr className="bg-red-50/30">
                      <td className="py-2 px-4 font-medium text-red-950">Overdue Task Penalty</td>
                      <td className="py-2 px-4 text-right text-red-600 font-bold">-5 pts <span className="text-red-400 font-normal">(uncompleted past due date)</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'loopholes' && (
            <div className="space-y-4 animate-fadeIn">
              <h4 className="font-bold text-gray-900">Anti-Gaming Safeguards</h4>
              <p>
                To maintain a fair, high-quality environment and prevent points farming, the system implements the following logic loops:
              </p>
              <div className="space-y-3.5">
                <div className="flex gap-2.5 items-start p-3 bg-gray-50 border rounded-xl">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0 mt-0.5">1</div>
                  <div>
                    <h5 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Comment Cooldown & Validation</h5>
                    <p className="text-xs text-gray-600 mt-1">
                      Comments must be at least <strong>10 characters long</strong> to earn points. Furthermore, a global <strong>5-minute cooldown</strong> is checked across the project; you cannot earn points for a comment if it is posted within 5 minutes of your last points-earning comment. A maximum of 3 comments per task can earn points.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start p-3 bg-gray-50 border rounded-xl">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0 mt-0.5">2</div>
                  <div>
                    <h5 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Self-Assignment Safeguard</h5>
                    <p className="text-xs text-gray-600 mt-1">
                      If a contributor is the reporter *and* the assignee of a completed task, all positive points earned for that task (base, story points, bug fix, and combo bonuses) are <strong>halved (rounded)</strong>. This discourages users from writing and completing fake tasks. (Project managers and super managers are exempt).
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start p-3 bg-gray-50 border rounded-xl">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0 mt-0.5">3</div>
                  <div>
                    <h5 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Zero points for Task Updates</h5>
                    <p className="text-xs text-gray-600 mt-1">
                      Editing fields, changing titles/descriptions, and other standard activities earn 0 points to prevent users from spamming simple detail updates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'badges' && (
            <div className="space-y-4 animate-fadeIn">
              <h4 className="font-bold text-gray-900">Automatic Badge Criteria</h4>
              <p>
                The system dynamically computes and awards these special badges based on performance:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-yellow-250 bg-yellow-50/15 rounded-xl p-3">
                  <span className="font-bold text-yellow-800 text-xs">🌟 Star Performer</span>
                  <p className="text-xs text-gray-500 mt-1">Has the highest overall points on the leaderboard (minimum 15 pts).</p>
                </div>
                <div className="border border-blue-250 bg-blue-50/15 rounded-xl p-3">
                  <span className="font-bold text-blue-800 text-xs">🚀 Early Bird</span>
                  <p className="text-xs text-gray-500 mt-1">Completed 3+ tasks at least 24 hours before their specified due date.</p>
                </div>
                <div className="border border-amber-255 bg-amber-50/15 rounded-xl p-3">
                  <span className="font-bold text-amber-800 text-xs">🏆 Task Crusher</span>
                  <p className="text-xs text-gray-500 mt-1">Completed 10+ tasks on the project board.</p>
                </div>
                <div className="border border-red-250 bg-red-50/15 rounded-xl p-3">
                  <span className="font-bold text-red-800 text-xs">⚡ Velocity Master</span>
                  <p className="text-xs text-gray-500 mt-1">Completed tasks carrying a cumulative total of 30+ story points.</p>
                </div>
                <div className="border border-emerald-250 bg-emerald-50/15 rounded-xl p-3">
                  <span className="font-bold text-emerald-800 text-xs">💬 Conversation Starter</span>
                  <p className="text-xs text-gray-500 mt-1">Wrote 15+ comments on tasks.</p>
                </div>
                <div className="border border-pink-250 bg-pink-50/15 rounded-xl p-3">
                  <span className="font-bold text-pink-800 text-xs">🎯 Perfectionist</span>
                  <p className="text-xs text-gray-500 mt-1">Completed 5+ tasks with a 100% on-time completion success rate.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-150 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

const EditBadgeModal = ({ badge, colors, onSave, onChange, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <form onSubmit={onSave} className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-150 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-150 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-955 text-lg flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Edit Badge Definition
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Modify properties of the &quot;{badge.name}&quot; badge</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Badge Name</label>
            <input
              type="text"
              value={badge.name}
              onChange={e => onChange({ name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-300 outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description / Criteria</label>
            <textarea
              value={badge.description}
              onChange={e => onChange({ description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-300 outline-none transition-all resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Emoji Icon</label>
              <input
                type="text"
                value={badge.icon}
                onChange={e => onChange({ icon: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-300 text-center text-lg outline-none"
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
                    onClick={() => onChange({ color: c.value })}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${badge.color === c.value ? 'border-black scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={badge.projectExclusive === true}
                onChange={e => onChange({ projectExclusive: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span>Project Exclusive Badge (only available in this project)</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-150 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

const ManageBadgesModal = ({ username, customBadges, userBadges, onGrant, onRevoke, onClose }) => {
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const grantedCustom = userBadges.filter(b => b.type === 'custom');
  const availableToGrant = customBadges.filter(cb => !grantedCustom.some(gc => gc.id === cb.id));

  const handleGrant = async () => {
    if (!selectedBadgeId) return;
    setSubmitting(true);
    setError(null);
    try {
      await onGrant(username, selectedBadgeId);
      setSelectedBadgeId('');
    } catch (err) {
      setError(err.message || 'Failed to grant badge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (badgeId) => {
    setSubmitting(true);
    setError(null);
    try {
      await onRevoke(username, badgeId);
    } catch (err) {
      setError(err.message || 'Failed to revoke badge');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-gray-150 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-955 text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" />
              Manage Badges
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Configure custom achievements for @{username}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-150 rounded-lg text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Current Badges */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Currently Awarded Custom Badges</h4>
            {grantedCustom.length === 0 ? (
              <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center border border-dashed border-gray-200">
                No custom badges granted yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {grantedCustom.map((badge, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-150 hover:bg-gray-100/70 transition-colors">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-lg flex-shrink-0" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{badge.icon || '🎖️'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: badge.color }}>{badge.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{badge.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(badge.id)}
                      disabled={submitting}
                      className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-md font-semibold transition-colors flex-shrink-0"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grant New Badge */}
          <div className="pt-5 border-t border-gray-150">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Grant a Custom Badge</h4>
            {availableToGrant.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center p-2">
                All custom badges have been granted to this member.
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedBadgeId}
                  onChange={(e) => setSelectedBadgeId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={submitting}
                >
                  <option value="">Select a badge...</option>
                  {availableToGrant.map((badge) => (
                    <option key={badge.id} value={badge.id}>
                      {badge.icon} {badge.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleGrant}
                  disabled={submitting || !selectedBadgeId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Award
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
