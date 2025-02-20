'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ListTodo, Plus, Search, Filter, Clock, User, AlertTriangle,
  Calendar, CheckSquare, XSquare, Edit2, Trash2, X, ChevronDown,
  Info, History, Loader2
} from 'lucide-react';

const ProjectManagement = () => {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedTask, setSelectedTask] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    assignee: ''
  });
  const [formData, setFormData] = useState({
    task_name: '',
    description: '',
    assigned_for: [],
    due_time: '',
    status: 'Planned',
    priority: 'Normal',
    subtasks: []
  });
  const [formErrors, setFormErrors] = useState({});
  const [newSubtask, setNewSubtask] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    checkAuthAndFetchData();

    // Cleanup function
    return () => {
      setTasks([]);
      setUsers([]);
      setLoading(false);
      setError(null);
    };
  }, []);

  const validateForm = () => {
    const errors = {};
    if (!formData.task_name.trim()) {
      errors.task_name = 'Task name is required';
    }
    if (!formData.due_time) {
      errors.due_time = 'Due date is required';
    } else {
      const dueDate = new Date(formData.due_time);
      const today = new Date();
      if (dueDate < today) {
        errors.due_time = 'Due date cannot be in the past';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkAuthAndFetchData = async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok) throw new Error('Authentication failed');
      
      const data = await response.json();
      
      if (!data?.user) {
        router.push('/login');
        return;
      }

      setCurrentUser(data.user);
      await Promise.all([
        fetchTasks(data.user.role),
        fetchUsers(data.user.role)
      ]);
    } catch (err) {
      console.error('Auth check failed:', err);
      setError('Authentication failed. Please try logging in again.');
      router.push('/login');
    }
  };

  const fetchTasks = async (userRole) => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks', {
        headers: {
          'x-user-role': userRole || currentUser?.role || ''
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch tasks');
      
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid tasks data received');
      
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (userRole) => {
    try {
      const response = await fetch('/api/users', {
        headers: {
          'x-user-role': userRole || currentUser?.role || ''
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid users data received');
      
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load user list. Some features may be limited.');
    }
  };

  const updateUserNotifications = async (assignees, action, taskName) => {
    try {
      const operations = assignees.map(username => {
        const user = users.find(u => u.username === username);
        if (!user) return null;
  
        const notifChange = action === 'add' ? 1 : -1;
        const notifTitle = action === 'add' 
          ? `New task assigned: ${taskName}`
          : `Task completed/deleted: ${taskName}`;
  
        return fetch(`/api/users/${user._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentUser?.role || ''
          },
          body: JSON.stringify({
            notifs: (user.notifs || 0) + notifChange,
            notifTitle
          })
        });
      });
  
      await Promise.all(operations.filter(op => op !== null));
    } catch (error) {
      console.error('Error updating notifications:', error);
      throw new Error('Failed to update notifications');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      const url = modalMode === 'add' ? '/api/tasks' : `/api/tasks/${selectedTask._id}`;
      const method = modalMode === 'add' ? 'POST' : 'PUT';
      
      const status = formData.assigned_for.length === 0 ? 'Planned' : 
                    (formData.status === 'Planned' ? 'Assigned' : formData.status);
      
      const taskData = {
        ...formData,
        status,
        created_by: modalMode === 'add' ? currentUser.username : selectedTask.created_by,
        modified_by: currentUser.username,
        action: modalMode === 'add' ? 'Created task' : 'Updated task'
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role || ''
        },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Operation failed');
      }

      if (modalMode === 'add') {
        await updateUserNotifications(taskData.assigned_for, 'add', taskData.task_name);
      } else {
        const oldAssignees = selectedTask.assigned_for || [];
        const newAssignees = taskData.assigned_for;
        
        const removedAssignees = oldAssignees.filter(user => !newAssignees.includes(user));
        await updateUserNotifications(removedAssignees, 'remove', taskData.task_name);
        
        const addedAssignees = newAssignees.filter(user => !oldAssignees.includes(user));
        await updateUserNotifications(addedAssignees, 'add', taskData.task_name);
      }

      await fetchTasks(currentUser?.role);
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      setSubmitting(true);
      const task = tasks.find(t => t._id === taskId);
      if (task) {
        await updateUserNotifications(task.assigned_for, 'remove', task.task_name);
      }

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': currentUser?.role || ''
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete task');
      }

      await fetchTasks(currentUser?.role);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      task_name: '',
      description: '',
      assigned_for: [],
      due_time: '',
      status: 'Planned',
      priority: 'Normal',
      subtasks: []
    });
    setFormErrors({});
    setNewSubtask('');
    setSelectedTask(null);
    setShowHistory(false);
  };

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'normal':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'in progress':
        return 'text-blue-600 bg-blue-100';
      case 'assigned':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !filters.search || 
      task.task_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(filters.search.toLowerCase()));
    const matchesStatus = !filters.status || task.status === filters.status;
    const matchesPriority = !filters.priority || task.priority === filters.priority;
    const matchesAssignee = !filters.assignee || task.assigned_for.includes(filters.assignee);
    
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center">
            <ListTodo className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">Project Management</h1>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-grow md:flex-grow-0 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="pl-10 pr-4 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Search tasks"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center"
              aria-expanded={showFilters}
              aria-controls="filters-panel"
            >
              <Filter className="h-5 w-5 mr-2" />
              Filters
              <ChevronDown className={`h-4 w-4 ml-2 transform transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            
            <button
              onClick={() => {
                setModalMode('add');
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Task
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div 
            id="filters-panel"
            className="mb-6 p-4 bg-white rounded-lg shadow"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="status-filter">
                  Status
                </label>
                <select
                  id="status-filter"
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Status</option>
                  <option value="New">New</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="priority-filter">
                  Priority</label>
                <select
                  id="priority-filter"
                  value={filters.priority}
                  onChange={(e) => setFilters({...filters, priority: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Normal">Normal</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="assignee-filter">
                  Assignee
                </label>
                <select
                  id="assignee-filter"
                  value={filters.assignee}
                  onChange={(e) => setFilters({...filters, assignee: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Assignees</option>
                  {users.map(user => (
                    <option key={user._id} value={user.username}>{user.username}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center" role="alert">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-700 hover:text-red-900"
              aria-label="Dismiss error"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* No Tasks Message */}
        {filteredTasks.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-500">
              {tasks.length === 0 ? "No tasks found. Create your first task!" : "No tasks match your filters."}
            </div>
          </div>
        )}

        {/* Tasks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map(task => (
            <div 
              key={task._id} 
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6"
              role="article"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900 leading-tight">{task.task_name}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedTask(task);
                      setModalMode('edit');
                      setFormData({
                        task_name: task.task_name,
                        description: task.description || '',
                        assigned_for: task.assigned_for || [],
                        due_time: new Date(task.due_time).toISOString().split('T')[0],
                        status: task.status,
                        priority: task.priority,
                        subtasks: task.subtasks || []
                      });
                      setIsModalOpen(true);
                    }}
                    className="text-gray-400 hover:text-blue-600"
                    aria-label={`Edit task: ${task.task_name}`}
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(task._id)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label={`Delete task: ${task.task_name}`}
                    disabled={submitting}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {task.description && (
                <p className="text-gray-600 mb-4 line-clamp-2">{task.description}</p>
              )}

              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Clock className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">
                    Due: {new Date(task.due_time).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center text-sm">
                  <User className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">
                    Assigned to: {task.assigned_for.join(', ') || 'Unassigned'}
                  </span>
                </div>

                {task.subtasks.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Subtasks:</div>
                    <div className="pl-2">
                      {task.subtasks.map((subtask, index) => (
                        <div key={index} className="flex items-center text-sm text-gray-600">
                          <CheckSquare className="h-4 w-4 text-gray-400 mr-2" />
                          {subtask}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                  {task.status}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Task Modal */}
        {isModalOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
            role="dialog"
            aria-labelledby="modal-title"
            aria-modal="true"
          >
            <div className="bg-white rounded-lg w-full max-w-3xl my-8">
              <div className="max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex justify-between items-center">
                  <h2 id="modal-title" className="text-xl font-bold text-gray-900">
                    {modalMode === 'add' ? 'Add New Task' : 'Edit Task'}
                  </h2>
                  <div className="flex items-center gap-4">
                    {modalMode === 'edit' && (
                      <button
                        type="button"
                        onClick={() => setShowHistory(!showHistory)}
                        className="text-gray-600 hover:text-gray-800"
                        aria-label="Toggle history"
                      >
                        <History className="h-5 w-5" />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setIsModalOpen(false);
                        resetForm();
                      }} 
                      className="text-gray-500 hover:text-gray-700"
                      aria-label="Close modal"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {showHistory && selectedTask?.modified_history && (
                    <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Modification History</h3>
                      <div className="space-y-2">
                        {selectedTask.modified_history.map((history, index) => (
                          <div key={index} className="text-sm text-gray-600 flex items-start gap-2">
                            <Info className="h-4 w-4 mt-0.5" />
                            <div>
                              <span className="font-medium">{history.modified_by}</span>
                              {' - '}
                              {history.action}
                              {' on '}
                              {new Date(history.modified_at).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="task-name">
                        Task Name
                      </label>
                      <input
                        id="task-name"
                        type="text"
                        value={formData.task_name}
                        onChange={(e) => setFormData({...formData, task_name: e.target.value})}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          formErrors.task_name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        required
                        aria-invalid={!!formErrors.task_name}
                        aria-describedby={formErrors.task_name ? "task-name-error" : undefined}
                      />
                      {formErrors.task_name && (
                        <p id="task-name-error" className="mt-1 text-sm text-red-600">
                          {formErrors.task_name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">
                        Description
                      </label>
                      <textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="assigned-for">
                        Assign To
                      </label>
                      <select
                        id="assigned-for"
                        multiple
                        value={formData.assigned_for}
                        onChange={(e) => setFormData({
                          ...formData,
                          assigned_for: Array.from(e.target.selectedOptions, option => option.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        size={4}
                      >
                        {users.map(user => (
                          <option key={user._id} value={user.username}>{user.username}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="due-date">
                        Due Date
                      </label>
                      <input
                        id="due-date"
                        type="date"
                        value={formData.due_time}
                        onChange={(e) => setFormData({...formData, due_time: e.target.value})}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          formErrors.due_time ? 'border-red-500' : 'border-gray-300'
                        }`}
                        required
                        aria-invalid={!!formErrors.due_time}
                        aria-describedby={formErrors.due_time ? "due-date-error" : undefined}
                      />
                      {formErrors.due_time && (
                        <p id="due-date-error" className="mt-1 text-sm text-red-600">
                          {formErrors.due_time}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="status">
                          Status
                        </label>
                        <select
                          id="status"
                          value={formData.status}
                          onChange={(e) => setFormData({...formData, status: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="New">New</option>
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="priority">
                          Priority
                        </label>
                        <select
                          id="priority"
                          value={formData.priority}
                          onChange={(e) => setFormData({...formData, priority: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="High">High</option>
                          <option value="Normal">Normal</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subtasks
                      </label>
                      <div className="space-y-2">
                        {formData.subtasks.map((subtask, index) => (
                          <div key={index} className="flex items-center">
                            <input
                              type="text"
                              value={subtask}
                              onChange={(e) => {
                                const newSubtasks = [...formData.subtasks];
                                newSubtasks[index] = e.target.value;
                                setFormData({...formData, subtasks: newSubtasks});
                              }}
                              className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              aria-label={`Subtask ${index + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newSubtasks = formData.subtasks.filter((_, i) => i !== index);
                                setFormData({...formData, subtasks: newSubtasks});
                              }}
                              className="ml-2 text-red-600 hover:text-red-700"
                              aria-label={`Remove subtask ${index + 1}`}
                            >
                              <XSquare className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center">
                          <input
                            type="text"
                            value={newSubtask}
                            onChange={(e) => setNewSubtask(e.target.value)}
                            placeholder="Add a subtask..."
                            className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            aria-label="New subtask"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (newSubtask.trim()) {
                                setFormData({
                                  ...formData,
                                  subtasks: [...formData.subtasks, newSubtask.trim()]
                                });
                                setNewSubtask('');
                              }
                            }}
                            className="ml-2 text-blue-600 hover:text-blue-700"
                            aria-label="Add subtask"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-200 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          resetForm();
                        }}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
                        disabled={submitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        disabled={submitting}
                      >
                        {submitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                        {modalMode === 'add' ? 'Create Task' : 'Update Task'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectManagement;