'use client';

import { useState, useEffect, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import CreatableSelect from 'react-select/creatable';
import { 
  Calendar, 
  Clock, 
  Users, 
  AlertTriangle, 
  Save, 
  X, 
  Trash2,
  AlertCircle,
  Info
} from 'lucide-react';

const InstanceEditor = ({ 
  instanceId,
  seriesId,
  onSave,
  onCancel,
  onDelete,
  onClose,
  initialData = null
}) => {
  const [instance, setInstance] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: null,
    duration: 60,
    participants: []
  });
  const [editScope, setEditScope] = useState('this'); // 'this' or 'future'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [users, setUsers] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch instance data
  useEffect(() => {
    const fetchInstance = async () => {
      if (initialData) {
        setInstance(initialData);
        setFormData({
          title: initialData.title || '',
          description: initialData.description || '',
          startTime: new Date(initialData.startTime),
          duration: initialData.duration || 60,
          participants: initialData.participants || []
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/events/${instanceId}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch meeting instance');
        }
        
        const data = await response.json();
        setInstance(data);
        setFormData({
          title: data.title || '',
          description: data.description || '',
          startTime: new Date(data.startTime),
          duration: data.duration || 60,
          participants: data.participants || []
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInstance();
  }, [instanceId, initialData]);

  // Fetch users for participant selection
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setUsers(data.map(user => ({ 
            value: user.email, 
            label: `${user.username} (${user.email})` 
          })));
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };

    fetchUsers();
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [fieldErrors]);

  const handleDateChange = useCallback((date) => {
    setFormData(prev => ({ ...prev, startTime: date }));
    
    if (fieldErrors.startTime) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.startTime;
        return newErrors;
      });
    }
  }, [fieldErrors]);

  const handleParticipantsChange = useCallback((selectedOptions) => {
    setFormData(prev => ({ ...prev, participants: selectedOptions || [] }));
  }, []);

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title?.trim()) {
      errors.title = 'Meeting title is required';
    }
    
    if (!formData.description?.trim()) {
      errors.description = 'Meeting description is required';
    }
    
    if (!formData.startTime) {
      errors.startTime = 'Start time is required';
    } else if (new Date(formData.startTime) < new Date()) {
      errors.startTime = 'Start time must be in the future';
    }
    
    if (!formData.duration || formData.duration < 1) {
      errors.duration = 'Duration must be at least 1 minute';
    }
    
    if (formData.participants.length === 0) {
      errors.participants = 'At least one participant is required';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setError('Please fix the errors above before saving.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        participants: formData.participants.map(p => p.value),
        editScope
      };

      await onSave?.(instanceId, payload);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete?.(instanceId, editScope);
      onClose?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async () => {
    try {
      await onCancel?.(instanceId);
      onClose?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const participantOptions = users.concat(
    formData.participants
      .filter(p => !users.some(u => u.value === p.value))
      .map(p => ({ value: p.value || p, label: p.label || p }))
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading meeting details...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Meeting Instance</h2>
            <p className="text-sm text-gray-500 mt-1">
              {instance?.recurrenceInstance?.originalDate && (
                <>Originally scheduled for {new Date(instance.recurrenceInstance.originalDate).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                <span className="text-red-800 font-medium">Error</span>
              </div>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Edit Scope Selection */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Info className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="text-sm font-medium text-blue-900">Edit Scope</h3>
            </div>
            
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="editScope"
                  value="this"
                  checked={editScope === 'this'}
                  onChange={(e) => setEditScope(e.target.value)}
                  className="mr-3 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-blue-900">This occurrence only</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="editScope"
                  value="future"
                  checked={editScope === 'future'}
                  onChange={(e) => setEditScope(e.target.value)}
                  className="mr-3 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-blue-900">This and all future occurrences</span>
              </label>
            </div>
            
            <p className="text-xs text-blue-700 mt-2">
              {editScope === 'this' 
                ? 'Changes will only affect this specific meeting instance.'
                : 'Changes will affect this meeting and all future meetings in the series.'
              }
            </p>
          </div>

          {/* Meeting Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meeting Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  fieldErrors.title ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter meeting title"
              />
              {fieldErrors.title && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.title}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  fieldErrors.description ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter meeting description"
              />
              {fieldErrors.description && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  selected={formData.startTime}
                  onChange={handleDateChange}
                  showTimeSelect
                  dateFormat="MMMM d, yyyy h:mm aa"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    fieldErrors.startTime ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  minDate={new Date()}
                />
                {fieldErrors.startTime && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.startTime}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  min="1"
                  max="480"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                    fieldErrors.duration ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.duration && (
                  <p className="text-red-600 text-sm mt-1">{fieldErrors.duration}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Participants <span className="text-red-500">*</span>
              </label>
              <CreatableSelect
                isMulti
                value={formData.participants}
                onChange={handleParticipantsChange}
                options={participantOptions}
                className={fieldErrors.participants ? 'border-red-300' : ''}
                placeholder="Select or add participants..."
                formatCreateLabel={(inputValue) => `Add external: ${inputValue}`}
                isValidNewOption={(inputValue) => {
                  const email = inputValue.trim();
                  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  return emailRe.test(email);
                }}
                onCreateOption={(inputValue) => {
                  const email = inputValue.trim();
                  const option = { value: email, label: email };
                  setFormData(prev => ({
                    ...prev,
                    participants: [...prev.participants, option]
                  }));
                }}
              />
              {fieldErrors.participants && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.participants}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-lg hover:bg-red-200 focus:ring-2 focus:ring-red-500"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </button>
            
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 border border-yellow-300 rounded-lg hover:bg-yellow-200 focus:ring-2 focus:ring-yellow-500"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel Meeting
            </button>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500"
            >
              Close
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">Confirm Deletion</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this meeting? This action cannot be undone.
                {editScope === 'future' && (
                  <span className="block mt-2 font-medium text-red-600">
                    This will delete this meeting and all future occurrences in the series.
                  </span>
                )}
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700"
                >
                  Delete Meeting
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstanceEditor;