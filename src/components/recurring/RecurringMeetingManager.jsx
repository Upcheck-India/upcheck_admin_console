'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Calendar, 
  Users, 
  Clock, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  Mail,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { getPatternDescription } from '../../lib/recurrence';

const RecurringMeetingManager = ({ 
  onEdit, 
  onDelete, 
  onToggleActive, 
  onSendNotification,
  onRefresh 
}) => {
  const [series, setSeries] = useState([]);
  const [expandedSeries, setExpandedSeries] = useState(new Set());
  const [selectedSeries, setSelectedSeries] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(new Set());

  // Fetch recurring series
  const fetchSeries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/events/recurring', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch recurring series');
      }
      
      const data = await response.json();
      setSeries(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  // Toggle series expansion
  const toggleExpanded = (seriesId) => {
    setExpandedSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seriesId)) {
        newSet.delete(seriesId);
      } else {
        newSet.add(seriesId);
      }
      return newSet;
    });
  };

  // Toggle series selection
  const toggleSelected = (seriesId) => {
    setSelectedSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seriesId)) {
        newSet.delete(seriesId);
      } else {
        newSet.add(seriesId);
      }
      return newSet;
    });
  };

  // Select all series
  const selectAll = () => {
    if (selectedSeries.size === series.length) {
      setSelectedSeries(new Set());
    } else {
      setSelectedSeries(new Set(series.map(s => s._id)));
    }
  };

  // Handle individual actions
  const handleAction = async (action, seriesId) => {
    setActionLoading(prev => new Set(prev).add(seriesId));
    
    try {
      switch (action) {
        case 'edit':
          onEdit?.(seriesId);
          break;
        case 'delete':
          await onDelete?.(seriesId);
          await fetchSeries(); // Refresh list
          break;
        case 'toggle':
          await onToggleActive?.(seriesId);
          await fetchSeries(); // Refresh list
          break;
        case 'notify':
          await onSendNotification?.(seriesId);
          break;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(seriesId);
        return newSet;
      });
    }
  };

  // Handle bulk actions
  const handleBulkAction = async (action) => {
    if (selectedSeries.size === 0) return;
    
    const seriesIds = Array.from(selectedSeries);
    
    try {
      switch (action) {
        case 'delete':
          await Promise.all(seriesIds.map(id => onDelete?.(id)));
          break;
        case 'activate':
          await Promise.all(seriesIds.map(id => onToggleActive?.(id, true)));
          break;
        case 'deactivate':
          await Promise.all(seriesIds.map(id => onToggleActive?.(id, false)));
          break;
      }
      
      setSelectedSeries(new Set());
      await fetchSeries();
    } catch (err) {
      setError(err.message);
    }
  };

  const StatusBadge = ({ isActive, totalInstances, completedInstances }) => {
    if (!isActive) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <Pause className="w-3 h-3 mr-1" />
          Paused
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Play className="w-3 h-3 mr-1" />
        Active
      </span>
    );
  };

  const InstanceRow = ({ instance, isLast }) => (
    <div className={`flex items-center justify-between py-3 px-4 ${!isLast ? 'border-b border-gray-100' : ''}`}>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          {instance.isCancelled ? (
            <XCircle className="w-4 h-4 text-red-500" />
          ) : instance.isCompleted ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <Calendar className="w-4 h-4 text-gray-400" />
          )}
          <span className={`text-sm ${instance.isCancelled ? 'text-red-600 line-through' : 'text-gray-900'}`}>
            {new Date(instance.startTime).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </span>
        </div>
        
        {instance.isModified && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            Modified
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-500">
          {instance.participants?.length || 0} participants
        </span>
        <button
          onClick={() => onEdit?.(instance._id, 'instance')}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          <Edit className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mr-2" />
        <span className="text-gray-600">Loading recurring meetings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
          <span className="text-red-800 font-medium">Error loading recurring meetings</span>
        </div>
        <p className="text-red-700 text-sm mt-1">{error}</p>
        <button
          onClick={fetchSeries}
          className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900">Recurring Meeting Series</h2>
          <span className="text-sm text-gray-500">({series.length} series)</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {selectedSeries.size > 0 && (
            <div className="flex items-center space-x-2 mr-4">
              <span className="text-sm text-gray-600">{selectedSeries.size} selected</span>
              <button
                onClick={() => handleBulkAction('activate')}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Activate
              </button>
              <button
                onClick={() => handleBulkAction('deactivate')}
                className="text-sm text-yellow-600 hover:text-yellow-700 font-medium"
              >
                Pause
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Delete
              </button>
            </div>
          )}
          
          <button
            onClick={fetchSeries}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {series.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No recurring meetings</h3>
          <p className="text-gray-500">Create your first recurring meeting series to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Select all checkbox */}
          <div className="flex items-center space-x-3 pb-2 border-b border-gray-200">
            <input
              type="checkbox"
              checked={selectedSeries.size === series.length && series.length > 0}
              onChange={selectAll}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-gray-700">Select all</span>
          </div>

          {/* Series list */}
          {series.map((seriesItem) => (
            <div key={seriesItem._id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Series header */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedSeries.has(seriesItem._id)}
                      onChange={() => toggleSelected(seriesItem._id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    
                    <button
                      onClick={() => toggleExpanded(seriesItem._id)}
                      className="flex items-center space-x-2 text-left"
                    >
                      {expandedSeries.has(seriesItem._id) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <div>
                        <h3 className="font-medium text-gray-900">{seriesItem.title}</h3>
                        <p className="text-sm text-gray-500">
                          {getPatternDescription(seriesItem.recurrencePattern)}
                        </p>
                      </div>
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <StatusBadge 
                      isActive={seriesItem.isActive}
                      totalInstances={seriesItem.totalInstances}
                      completedInstances={seriesItem.completedInstances}
                    />
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      <span>{seriesItem.participants?.length || 0}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>{seriesItem.totalInstances || 0} meetings</span>
                    </div>
                    
                    <div className="relative">
                      <button
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Toggle dropdown menu
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {/* Action buttons */}
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={() => handleAction('edit', seriesItem._id)}
                          className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                          title="Edit series"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleAction('toggle', seriesItem._id)}
                          className={`p-1 rounded ${
                            seriesItem.isActive 
                              ? 'text-gray-400 hover:text-yellow-600' 
                              : 'text-gray-400 hover:text-green-600'
                          }`}
                          title={seriesItem.isActive ? 'Pause series' : 'Activate series'}
                        >
                          {seriesItem.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        
                        <button
                          onClick={() => handleAction('notify', seriesItem._id)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="Send series notification"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleAction('delete', seriesItem._id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                          title="Delete series"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Series details */}
                <div className="mt-3 flex items-center space-x-6 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{seriesItem.duration} minutes</span>
                  </div>
                  
                  <div>
                    Created {new Date(seriesItem.createdAt).toLocaleDateString()}
                  </div>
                  
                  {seriesItem.nextGenerationDate && (
                    <div>
                      Next generation: {new Date(seriesItem.nextGenerationDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Expanded instances */}
              {expandedSeries.has(seriesItem._id) && (
                <div className="border-t border-gray-200 bg-gray-50">
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Meeting Instances</h4>
                    
                    {seriesItem.instances && seriesItem.instances.length > 0 ? (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        {seriesItem.instances.map((instance, index) => (
                          <InstanceRow 
                            key={instance._id} 
                            instance={instance}
                            isLast={index === seriesItem.instances.length - 1}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm">No instances generated yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Loading overlay for actions */}
              {actionLoading.has(seriesItem._id) && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringMeetingManager;