'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';

const UserAvatar = ({ user }) => (
  <div
    className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold text-gray-600 border-2 border-white"
    title={user?.username || 'Unknown'}
  >
    {user ? user.username.charAt(0).toUpperCase() : '?'}
  </div>
);

const TaskDetailsModal = ({ task, onClose, userMap = new Map(), sprints = [], onUpdateTask }) => {
  const { id: projectId } = useParams();
  const [togglingId, setTogglingId] = useState(null);

  const sprintName = useMemo(() => {
    if (!task?.sprintId) return 'Product Board';
    const sprint = sprints.find((s) => s._id === task.sprintId);
    return sprint ? sprint.name : 'Unknown Sprint';
  }, [task, sprints]);

  const assigneeUsers = useMemo(() => task?.assignees?.map((id) => userMap.get(id)).filter(Boolean) || [], [task, userMap]);
  const reporterUser = useMemo(() => (task?.reporter ? userMap.get(task.reporter) : null), [task, userMap]);

  const handleToggleSubtask = async (subtaskId) => {
    if (!task?.subtasks) return;
    setTogglingId(subtaskId);
    const updatedSubtasks = task.subtasks.map(st => 
      (st.id === subtaskId || st._id === subtaskId) ? { ...st, isCompleted: !st.isCompleted } : st
    );

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...task,
          subtasks: updatedSubtasks
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subtask');
      }

      const updatedTask = await response.json();
      if (onUpdateTask) {
        onUpdateTask(updatedTask);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update subtask. Please try again.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-border-default rounded-lg shadow-xl w-full max-w-xl relative flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-default sticky top-0 bg-surface rounded-t-lg z-10">
          <h2 className="text-xl font-bold truncate pr-4 text-text-primary">{task.title}</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-grow">
          {task.description && (
            <div>
              <h3 className="font-semibold text-text-secondary mb-1">Description</h3>
              <p className="text-sm text-text-primary whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-text-tertiary">Type</h4>
              <p className="text-sm text-text-primary">{task.type}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-text-tertiary">Status</h4>
              <p className="text-sm text-text-primary">{task.status}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-text-tertiary">Sprint / Board</h4>
              <p className="text-sm text-text-primary">{sprintName}</p>
            </div>
            {task.dueDate && (
              <div>
                <h4 className="text-sm font-medium text-text-tertiary">Due Date</h4>
                <p className="text-sm text-text-primary">{new Date(task.dueDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-text-tertiary mb-1">Assignees</h4>
            {assigneeUsers.length > 0 ? (
              <div className="flex items-center space-x-2">
                {assigneeUsers.map((user) => (
                  <UserAvatar key={user._id} user={user} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-primary italic">Unassigned</p>
            )}
          </div>

          {reporterUser && (
            <div>
              <h4 className="text-sm font-medium text-text-tertiary mb-1">Reporter</h4>
              <div className="flex items-center space-x-2">
                <UserAvatar user={reporterUser} />
                <span className="text-sm text-text-primary">{reporterUser.username}</span>
              </div>
            </div>
          )}

          {task.subtasks && task.subtasks.length > 0 && (
            <div className="pt-4 border-t border-border-default space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-text-secondary">Subtasks</h4>
                <div className="flex items-center space-x-2 text-xs text-text-tertiary font-medium">
                  <span>{task.subtasks.filter(st => st.isCompleted).length} completed</span>
                  <span>•</span>
                  <span>{task.subtasks.filter(st => !st.isCompleted).length} to be completed</span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${(task.subtasks.filter(st => st.isCompleted).length / task.subtasks.length) * 100}%` }}
                />
              </div>

              <div className="pl-3 border-l-2 border-border-default space-y-2.5 mt-2">
                {task.subtasks.map((st) => {
                  const sId = st.id || st._id;
                  const isToggling = togglingId === sId;
                  return (
                    <div key={sId} className="flex items-start space-x-3 py-0.5 group">
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input
                          type="checkbox"
                          checked={!!st.isCompleted}
                          disabled={isToggling}
                          onChange={() => handleToggleSubtask(sId)}
                          className="h-4 w-4 rounded border-border-default text-blue-600 focus:ring-blue-500 bg-surface/50 cursor-pointer disabled:opacity-50"
                        />
                        {isToggling && (
                          <div className="absolute inset-0 bg-surface/80 flex items-center justify-center rounded">
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                          </div>
                        )}
                      </div>
                      <span className={`text-sm leading-relaxed text-text-primary ${st.isCompleted ? 'line-through text-text-tertiary' : ''}`}>
                        {st.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal;
