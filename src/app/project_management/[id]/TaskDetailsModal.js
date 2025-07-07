'use client';

import React, { useMemo } from 'react';
import { X } from 'lucide-react';

const UserAvatar = ({ user }) => (
  <div
    className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold text-gray-600 border-2 border-white"
    title={user?.username || 'Unknown'}
  >
    {user ? user.username.charAt(0).toUpperCase() : '?'}
  </div>
);

const TaskDetailsModal = ({ task, onClose, userMap = new Map(), sprints = [] }) => {
  const sprintName = useMemo(() => {
    if (!task?.sprintId) return 'Product Board';
    const sprint = sprints.find((s) => s._id === task.sprintId);
    return sprint ? sprint.name : 'Unknown Sprint';
  }, [task, sprints]);

  const assigneeUsers = useMemo(() => task?.assignees?.map((id) => userMap.get(id)).filter(Boolean) || [], [task, userMap]);
  const reporterUser = useMemo(() => (task?.reporter ? userMap.get(task.reporter) : null), [task, userMap]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl relative flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white rounded-t-lg z-10">
          <h2 className="text-xl font-bold truncate pr-4">{task.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-grow">
          {task.description && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">Description</h3>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Type</h4>
              <p className="text-sm text-gray-800">{task.type}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Status</h4>
              <p className="text-sm text-gray-800">{task.status}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Sprint / Board</h4>
              <p className="text-sm text-gray-800">{sprintName}</p>
            </div>
            {task.dueDate && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">Due Date</h4>
                <p className="text-sm text-gray-800">{new Date(task.dueDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-1">Assignees</h4>
            {assigneeUsers.length > 0 ? (
              <div className="flex items-center space-x-2">
                {assigneeUsers.map((user) => (
                  <UserAvatar key={user._id} user={user} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-800 italic">Unassigned</p>
            )}
          </div>

          {reporterUser && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">Reporter</h4>
              <div className="flex items-center space-x-2">
                <UserAvatar user={reporterUser} />
                <span className="text-sm text-gray-800">{reporterUser.username}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal;
