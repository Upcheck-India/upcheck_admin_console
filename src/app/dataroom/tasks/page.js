'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import SecureLoading from '../../components/SecureLoading';
import DataRoomNav from '../../components/dataroom/DataRoomNav';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, CheckSquare, Clock, AlertCircle } from 'lucide-react';

export default function TasksPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    documentId: '',
    assignedTo: '',
    dueDate: '',
    priority: 'medium'
  });

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  async function fetchTasks() {
    try {
      const url = filter === 'all' ? '/api/dataroom/tasks' : `/api/dataroom/tasks?status=${filter}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  }

  async function handleCreate() {
    try {
      const response = await fetch('/api/dataroom/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({ title: '', description: '', documentId: '', assignedTo: '', dueDate: '', priority: 'medium' });
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  }

  async function updateStatus(taskId, newStatus) {
    try {
      const response = await fetch(`/api/dataroom/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function isOverdue(dueDate) {
    return new Date(dueDate) < new Date();
  }

  const filters = [
    { value: 'all', label: 'All Tasks', count: tasks.length },
    { value: 'pending', label: 'Pending', count: tasks.filter(t => t.status === 'pending').length },
    { value: 'in_progress', label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length },
    { value: 'completed', label: 'Completed', count: tasks.filter(t => t.status === 'completed').length },
  ];

  if (authLoading) {
    return <SecureLoading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DataRoomNav />
      <div className="flex-1 ml-64">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dataroom')} className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Task Management</h1>
                <p className="text-sm text-slate-500">Track document-related tasks</p>
              </div>
            </div>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex space-x-2 mb-6">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                filter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{f.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                filter === f.value ? 'bg-white/20' : 'bg-slate-100'
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Tasks List */}
        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <CheckSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No tasks</h3>
            <p className="text-slate-500">Create your first task to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task._id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={() => updateStatus(task._id, task.status === 'completed' ? 'pending' : 'completed')}
                      className="mt-1 w-5 h-5 text-blue-600 rounded"
                    />
                    <div className="flex-1">
                      <h3 className={`font-medium mb-1 ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center space-x-3 text-xs text-slate-500">
                        {task.assignedTo && (
                          <span>👤 {task.assignedTo.email || task.assignedTo}</span>
                        )}
                        {task.dueDate && (
                          <span className={`flex items-center space-x-1 ${isOverdue(task.dueDate) && task.status !== 'completed' ? 'text-red-600 font-medium' : ''}`}>
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(task.dueDate)}</span>
                            {isOverdue(task.dueDate) && task.status !== 'completed' && (
                              <AlertCircle className="w-3 h-3" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {task.priority}
                    </span>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      task.status === 'completed' ? 'bg-green-100 text-green-700' :
                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create New Task</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Task Title"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
              <textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="3"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  className="px-4 py-2 border border-slate-300 rounded-lg"
                />
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  className="px-4 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
              <button onClick={handleCreate} disabled={!formData.title.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create Task</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
