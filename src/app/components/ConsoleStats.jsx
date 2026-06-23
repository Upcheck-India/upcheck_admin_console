// src/app/components/ConsoleStats.jsx
import React, { useState, useEffect } from "react";
import { Users, MessageSquare, CheckSquare, Bell, X, ExternalLink } from "lucide-react";
import Link from "next/link";

const ConsoleStats = () => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalPosts: 0,
    openTasks: 0,
    notifications: 0,
    openTasksList: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTasksModal, setShowTasksModal] = useState(false);

  // Get username from localStorage
  const username = localStorage.getItem("username");

  useEffect(() => {
    const fetchStats = async () => {
      if (!username) {
        setError("No username found in localStorage.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/stats/users", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "username": username, // Pass username in headers
          },
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch statistics");
        }

        setStats((prevStats) => ({
          ...prevStats,
          totalMembers: data.usersCount || 0,
          totalPosts: data.postsCount || 0,
          openTasks: data.tasksCount || 0,
          notifications: data.notifsCount || 0,
          openTasksList: data.openTasksList || [],
        }));
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError("Failed to load statistics. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [username]);

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
    { label: "Total members", value: stats.totalMembers, icon: Users, clickable: false },
    { label: "Total posts", value: stats.totalPosts, icon: MessageSquare, clickable: false },
    {
      label: "Open Tasks",
      value: stats.openTasks,
      icon: CheckSquare,
      clickable: true,
      onClick: () => setShowTasksModal(true),
    },
    { label: "Notifications", value: stats.notifications, icon: Bell, clickable: false },
  ];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statsData.map((stat, index) => (
          <div
            key={index}
            onClick={stat.onClick}
            className={`bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-250 ${
              stat.clickable
                ? "cursor-pointer hover:border-teal-500/30 border border-transparent"
                : ""
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-5 h-5 text-gray-400" />
              <span className="text-gray-600 text-sm">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent flex items-center justify-between">
              <span>{stat.value}</span>
              {stat.clickable && stat.value > 0 && (
                <span className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100 transition-all">
                  View List
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Open Tasks Modal */}
      {showTasksModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-150 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-teal-600" />
                Active Open Tasks ({stats.openTasksList.length})
              </h3>
              <button
                onClick={() => setShowTasksModal(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              {stats.openTasksList.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  You have no active open tasks assigned to you.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {stats.openTasksList.map((task) => (
                    <div
                      key={task._id}
                      className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-800 leading-snug">
                          {task.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-gray-400">Project:</span>
                          <Link
                            href={`/project_management/${task.projectId}`}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5"
                          >
                            {task.projectName}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            task.status === "In Progress"
                              ? "bg-blue-50 text-blue-600 border border-blue-100"
                              : task.status === "To Do"
                              ? "bg-amber-50 text-amber-600 border border-amber-100"
                              : "bg-gray-50 text-gray-600 border border-gray-100"
                          }`}
                        >
                          {task.status}
                        </span>
                        {task.dueDate && (
                          <span className="text-[10px] text-gray-400">
                            Due:{" "}
                            {new Date(task.dueDate).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-gray-50/50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowTasksModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConsoleStats;