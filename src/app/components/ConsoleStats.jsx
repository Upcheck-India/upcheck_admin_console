// src/app/components/ConsoleStats.jsx
import React, { useState, useEffect } from 'react';
import { Users, MessageSquare, CheckSquare, Bell } from 'lucide-react';

const ConsoleStats = () => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalPosts: 0,
    openTasks: 2,
    notifications: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/stats/users');
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch statistics');
        }

        setStats(prevStats => ({
          ...prevStats,
          totalMembers: data.usersCount || 0,
          totalPosts: data.postsCount || 0
        }));
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('Failed to load statistics. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((_, index) => (
          <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-24"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-8">
        <p className="text-sm mt-1">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-md transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const statsData = [
    { label: 'Total members', value: stats.totalMembers, icon: Users },
    { label: 'Total posts', value: stats.totalPosts, icon: MessageSquare },
    { label: 'Open Tasks', value: stats.openTasks, icon: CheckSquare },
    { label: 'Notifications', value: stats.notifications, icon: Bell }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {statsData.map((stat, index) => (
        <div 
          key={index} 
          className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-center gap-2 mb-2">
            <stat.icon className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600 text-sm">{stat.label}</span>
          </div>
          <div className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConsoleStats;