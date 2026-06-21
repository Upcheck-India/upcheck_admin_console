'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import Select from 'react-select';

const TaskModal = ({ task, assignableUsers, onClose, onSave, projectId, sprints = [], defaultSprintId = null }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignees: [],
    reporter: '',
    dueDate: '',
    status: 'Backlog',
    type: 'Feature',
    sprintId: defaultSprintId,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const userOptions = useMemo(() => 
    assignableUsers.map(user => {
      const teamNames = user.teams?.map(t => t.name).join(', ');
      const teamSuffix = teamNames ? ` | Teams: ${teamNames}` : '';
      return {
        value: user._id,
        label: `${user.username} (${user.role}${teamSuffix})`,
      };
    }),
    [assignableUsers]
  );

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        assignees: task.assignees || [],
        reporter: task.reporter || '',
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        status: task.status || 'Backlog',
        type: task.type || 'Feature',
        sprintId: task.sprintId || defaultSprintId || null,
      });
    } else {
      setFormData({ 
        title: '', 
        description: '', 
        assignees: [], 
        reporter: '', 
        dueDate: '', 
        status: 'Backlog', 
        type: 'Feature', 
        sprintId: defaultSprintId || null 
      });
    }
  }, [task, defaultSprintId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, selectedOption) => {
    if (Array.isArray(selectedOption)) {
      setFormData(prev => ({ ...prev, [name]: selectedOption.map(opt => opt.value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: selectedOption ? selectedOption.value : '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const isEdit = !!(task && task._id);
      const url = isEdit ? `/api/projects/${projectId}/tasks/${task._id}` : `/api/projects/${projectId}/tasks`;
      const method = isEdit ? 'PUT' : 'POST';

      // Retrieve optional token from localStorage (older auth flow)
      const token = localStorage.getItem('token');

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include', // always send cookies for admin_token auth
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save task');
      }

      const savedTask = await response.json();
      onSave(savedTask);
      onClose();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const customStyles = {
    control: (provided) => ({
      ...provided,
      borderColor: '#d1d5db',
      '&:hover': {
        borderColor: '#a5b4fc',
      },
      boxShadow: 'none',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999, // Ensure dropdown is on top
    }),
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" 
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl relative flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white rounded-t-lg z-10">
          <h2 className="text-xl font-bold">{task && task._id ? 'Edit Task' : 'Add New Task'}</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Body */}
        <form id="task-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input 
              type="text" 
              name="title" 
              id="title" 
              value={formData.title} 
              onChange={handleChange} 
              required 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea 
              name="description" 
              id="description" 
              value={formData.description} 
              onChange={handleChange} 
              rows="3" 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter task description"
            />
          </div>

          <div>
            <label htmlFor="assignees" className="block text-sm font-medium text-gray-700 mb-1">
              Assignees
            </label>
            <Select
              isMulti
              name="assignees"
              options={userOptions}
              value={userOptions.filter(o => formData.assignees.includes(o.value))}
              onChange={options => handleSelectChange('assignees', options)}
              className="mt-1"
              styles={customStyles}
              placeholder="Select assignees..."
            />
          </div>

          <div>
            <label htmlFor="reporter" className="block text-sm font-medium text-gray-700 mb-1">
              Reporter
            </label>
            <Select
              isClearable
              name="reporter"
              options={userOptions}
              value={userOptions.find(o => o.value === formData.reporter)}
              onChange={option => handleSelectChange('reporter', option)}
              className="mt-1"
              styles={customStyles}
              placeholder="Select reporter..."
            />
          </div>

          {sprints.length > 0 && (
            <div>
              <label htmlFor="sprint" className="block text-sm font-medium text-gray-700 mb-1">
                Sprint
              </label>
              <Select
                name="sprint"
                value={(() => {
                  const spr = sprints.find(s => s._id === formData.sprintId);
                  return spr ? { value: spr._id, label: spr.name } : null;
                })()}
                onChange={opt => setFormData(prev => ({ ...prev, sprintId: opt ? opt.value : null }))}
                options={[{ value: null, label: 'Product Board' }, ...sprints.map(s => ({ value: s._id, label: s.name }))]}
                isClearable
                styles={customStyles}
                className="mt-1"
                placeholder="Select sprint..."
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select
                name="status"
                value={{ value: formData.status, label: formData.status }}
                onChange={option => handleSelectChange('status', option)}
                options={['Backlog', 'To Do', 'In Progress', 'Done'].map(s => ({ value: s, label: s }))}
                styles={customStyles}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <Select
                name="type"
                value={{ value: formData.type, label: formData.type }}
                onChange={option => handleSelectChange('type', option)}
                options={['Feature', 'Bug', 'Chore', 'Epic'].map(t => ({ value: t, label: t }))}
                styles={customStyles}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input 
              type="date" 
              name="dueDate" 
              id="dueDate" 
              value={formData.dueDate} 
              onChange={handleChange} 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex justify-end space-x-3 p-4 border-t sticky bottom-0 bg-white rounded-b-lg z-10">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="task-form" 
            disabled={isSubmitting} 
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
            {task && task._id ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;