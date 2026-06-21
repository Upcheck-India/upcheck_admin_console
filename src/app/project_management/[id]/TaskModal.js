'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Loader2, FileText, File, Image, Video, Music, Archive, Link2, Search } from 'lucide-react';
import Select from 'react-select';

// ── Priority options ──────────────────────────────────────────────────────────
const priorityOptions = [
  { value: 'Urgent', label: '🔴 Urgent' },
  { value: 'High',   label: '🟠 High'   },
  { value: 'Medium', label: '🟡 Medium' },
  { value: 'Low',    label: '🟢 Low'    },
  { value: 'None',   label: '⚪ None'   },
];

// ── Mime-type → icon helper ───────────────────────────────────────────────────
function getMimeIcon(mimeType = '') {
  if (mimeType.startsWith('image/'))       return <Image  className="h-4 w-4 text-purple-500" />;
  if (mimeType.startsWith('video/'))       return <Video  className="h-4 w-4 text-blue-500"   />;
  if (mimeType.startsWith('audio/'))       return <Music  className="h-4 w-4 text-green-500"  />;
  if (mimeType.includes('pdf'))            return <FileText className="h-4 w-4 text-red-500"  />;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar'))
                                           return <Archive className="h-4 w-4 text-yellow-600"/>;
  return <File className="h-4 w-4 text-gray-500" />;
}

// ── Activity icon helper ──────────────────────────────────────────────────────
function getActivityIcon(type) {
  switch (type) {
    case 'status_change':   return '🔄';
    case 'assignee_change': return '👤';
    case 'update':          return '✏️';
    default:                return '📋';
  }
}

function getActivityLabel(entry) {
  switch (entry.type) {
    case 'status_change':
      return `Moved from ${entry.from || '?'} to ${entry.to || '?'}`;
    case 'assignee_change':
      return 'Assignees updated';
    case 'update':
      return 'Task updated';
    default:
      return entry.description || 'Activity';
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const TaskModal = ({
  task,
  assignableUsers,
  onClose,
  onSave,
  projectId,
  sprints = [],
  defaultSprintId = null,
  projectLabels = [],   // [{ name: String, color: String }]
}) => {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    title:       '',
    description: '',
    assignees:   [],
    reporter:    '',
    dueDate:     '',
    status:      'Backlog',
    type:        'Feature',
    sprintId:    defaultSprintId,
    subtasks:    [],
    // New fields
    priority:     'Medium',
    storyPoints:  0,
    labels:       [],        // array of label names (strings)
    linkedFiles:  [],        // [{ fileId, fileName, mimeType }]
  });

  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [error, setError]                     = useState(null);

  // ── Comments & activity ─────────────────────────────────────────────────────
  const [comments, setComments]               = useState([]);
  const [newCommentText, setNewCommentText]   = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // ── Linked-file search panel ────────────────────────────────────────────────
  const [showFileSearch, setShowFileSearch]   = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileResults, setFileResults]         = useState([]);
  const [isFetchingFiles, setIsFetchingFiles] = useState(false);
  const fileSearchRef                         = useRef(null);

  // ── User options for react-select ───────────────────────────────────────────
  const userOptions = useMemo(() =>
    assignableUsers.map(user => {
      const teamNames  = user.teams?.map(t => t.name).join(', ');
      const teamSuffix = teamNames ? ` | Teams: ${teamNames}` : '';
      return {
        value: user._id,
        label: `${user.username} (${user.role}${teamSuffix})`,
      };
    }),
    [assignableUsers]
  );

  // ── Label options for react-select ──────────────────────────────────────────
  const labelOptions = useMemo(() =>
    projectLabels.map(lbl => ({
      value: lbl.name,
      label: lbl.name,
      color: lbl.color || '#6b7280',
    })),
    [projectLabels]
  );

  const formatLabelOption = ({ label, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        display: 'inline-block',
        width: 10, height: 10,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }} />
      <span>{label}</span>
    </div>
  );

  // ── Populate form from existing task ────────────────────────────────────────
  useEffect(() => {
    if (task) {
      setFormData({
        title:       task.title       || '',
        description: task.description || '',
        assignees:   task.assignees   || [],
        reporter:    task.reporter    || '',
        dueDate:     task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        status:      task.status      || 'Backlog',
        type:        task.type        || 'Feature',
        sprintId:    task.sprintId    || defaultSprintId || null,
        subtasks:    task.subtasks    || [],
        priority:    task.priority    || 'Medium',
        storyPoints: task.storyPoints ?? 0,
        labels:      task.labels      || [],
        linkedFiles: task.linkedFiles || [],
      });
      setComments(task.comments || []);
    } else {
      setFormData({
        title:       '',
        description: '',
        assignees:   [],
        reporter:    '',
        dueDate:     '',
        status:      'Backlog',
        type:        'Feature',
        sprintId:    defaultSprintId || null,
        subtasks:    [],
        priority:    'Medium',
        storyPoints: 0,
        labels:      [],
        linkedFiles: [],
      });
    }
  }, [task, defaultSprintId]);

  // ── Generic change handlers ─────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type: inputType } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: inputType === 'number' ? Number(value) : value,
    }));
  };

  const handleSelectChange = (name, selectedOption) => {
    if (Array.isArray(selectedOption)) {
      setFormData(prev => ({ ...prev, [name]: selectedOption.map(opt => opt.value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: selectedOption ? selectedOption.value : '' }));
    }
  };

  // ── Subtask helpers ─────────────────────────────────────────────────────────
  const addSubtask = () => {
    setFormData(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, { id: Date.now().toString(), title: '', isCompleted: false }],
    }));
  };

  const updateSubtask = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map(st => st.id === id ? { ...st, [field]: value } : st),
    }));
  };

  const removeSubtask = (id) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(st => st.id !== id),
    }));
  };

  // ── Linked-file helpers ─────────────────────────────────────────────────────
  const fetchFiles = async (query = '') => {
    setIsFetchingFiles(true);
    try {
      const url = `/api/resources?projectId=${projectId}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      // Expect data to be an array or { resources: [...] }
      setFileResults(Array.isArray(data) ? data : (data.resources || []));
    } catch {
      setFileResults([]);
    } finally {
      setIsFetchingFiles(false);
    }
  };

  // Open file panel and load initial results
  const openFileSearch = () => {
    setShowFileSearch(true);
    setFileSearchQuery('');
    fetchFiles('');
  };

  // Debounced search on query change
  useEffect(() => {
    if (!showFileSearch) return;
    const t = setTimeout(() => fetchFiles(fileSearchQuery), 300);
    return () => clearTimeout(t);
  }, [fileSearchQuery, showFileSearch]);

  // Close panel on outside click
  useEffect(() => {
    if (!showFileSearch) return;
    const handler = (e) => {
      if (fileSearchRef.current && !fileSearchRef.current.contains(e.target)) {
        setShowFileSearch(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFileSearch]);

  const linkFile = (file) => {
    const alreadyLinked = formData.linkedFiles.some(f => f.fileId === (file._id || file.fileId));
    if (alreadyLinked) return;
    setFormData(prev => ({
      ...prev,
      linkedFiles: [
        ...prev.linkedFiles,
        {
          fileId:   file._id   || file.fileId,
          fileName: file.name  || file.fileName || 'Unknown',
          mimeType: file.mimeType || '',
        },
      ],
    }));
    setShowFileSearch(false);
  };

  const removeLinkedFile = (fileId) => {
    setFormData(prev => ({
      ...prev,
      linkedFiles: prev.linkedFiles.filter(f => f.fileId !== fileId),
    }));
  };

  // ── Form submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const isEdit = !!(task && task._id);
      const url    = isEdit
        ? `/api/projects/${projectId}/tasks/${task._id}`
        : `/api/projects/${projectId}/tasks`;
      const method = isEdit ? 'PUT' : 'POST';

      const token = localStorage.getItem('token');

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
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

  // ── Comment submit — Fix #6: do NOT call onSave, just update local state ────
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !task || !task._id) return;

    setIsSubmittingComment(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${projectId}/tasks/${task._id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ text: newCommentText, mentions: [] }),
      });

      if (!res.ok) throw new Error('Failed to post comment');

      const data = await res.json();
      // Only update local comments state — modal stays open, no onSave call
      setComments(prev => [...prev, data.comment]);
      setNewCommentText('');
    } catch (err) {
      console.error(err);
      alert('Failed to post comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // ── Activity feed — unified timeline ────────────────────────────────────────
  const activityFeed = useMemo(() => {
    const commentEntries = comments.map(c => ({
      _type:     'comment',
      createdAt: c.createdAt,
      data:      c,
    }));
    const activityEntries = (task?.activity || []).map(a => ({
      _type:     'activity',
      createdAt: a.createdAt,
      data:      a,
    }));
    return [...commentEntries, ...activityEntries].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
  }, [comments, task?.activity]);

  // ── react-select custom styles ──────────────────────────────────────────────
  const customStyles = {
    control: (provided) => ({
      ...provided,
      borderColor: '#d1d5db',
      '&:hover': { borderColor: '#a5b4fc' },
      boxShadow: 'none',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999,
    }),
  };

  // ── Keyboard / backdrop handlers ────────────────────────────────────────────
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl relative flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* ── Header ── */}
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white rounded-t-lg z-10">
          <h2 className="text-xl font-bold">
            {task && task._id ? 'Edit Task' : 'Add New Task'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* ── Form body ── */}
        <form id="task-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-grow">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Title */}
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

          {/* Description */}
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

          {/* Sub-tasks */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Sub-tasks</label>
              <button
                type="button"
                onClick={addSubtask}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-2 py-1 rounded"
              >
                + Add Item
              </button>
            </div>
            {formData.subtasks && formData.subtasks.length > 0 && (
              <div className="space-y-2 mb-4">
                {formData.subtasks.map((st, index) => (
                  <div key={st.id || index} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={st.isCompleted}
                      onChange={(e) => updateSubtask(st.id, 'isCompleted', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <input
                      type="text"
                      value={st.title}
                      onChange={(e) => updateSubtask(st.id, 'title', e.target.value)}
                      placeholder="Sub-task title"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeSubtask(st.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignees */}
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

          {/* Reporter */}
          <div>
            <label htmlFor="reporter" className="block text-sm font-medium text-gray-700 mb-1">
              Reporter
            </label>
            <Select
              isClearable
              name="reporter"
              options={userOptions}
              value={userOptions.find(o => o.value === formData.reporter) || null}
              onChange={option => handleSelectChange('reporter', option)}
              className="mt-1"
              styles={customStyles}
              placeholder="Select reporter..."
            />
          </div>

          {/* Sprint */}
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

          {/* Status & Type — 2-col */}
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

          {/* ── Feature 1 & 2: Priority + Story Points — 2-col ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <Select
                name="priority"
                value={priorityOptions.find(o => o.value === formData.priority) || priorityOptions[2]}
                onChange={option => setFormData(prev => ({ ...prev, priority: option ? option.value : 'Medium' }))}
                options={priorityOptions}
                styles={customStyles}
                className="mt-1"
                placeholder="Select priority..."
              />
            </div>
            <div>
              <label htmlFor="storyPoints" className="block text-sm font-medium text-gray-700 mb-1">
                Story Points
              </label>
              <input
                type="number"
                name="storyPoints"
                id="storyPoints"
                min="0"
                max="100"
                step="1"
                value={formData.storyPoints}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* ── Feature 3: Labels ── */}
          {labelOptions.length > 0 && (
            <div>
              <label htmlFor="labels" className="block text-sm font-medium text-gray-700 mb-1">
                Labels
              </label>
              <Select
                isMulti
                name="labels"
                options={labelOptions}
                value={labelOptions.filter(o => formData.labels.includes(o.value))}
                onChange={options => handleSelectChange('labels', options || [])}
                formatOptionLabel={formatLabelOption}
                styles={customStyles}
                className="mt-1"
                placeholder="Add labels..."
              />
            </div>
          )}

          {/* ── Feature 4: Linked Files ── */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                <Link2 className="inline h-4 w-4 mr-1 text-gray-500" />
                Linked Files
              </label>
              <button
                type="button"
                onClick={openFileSearch}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-2 py-1 rounded"
              >
                + Link File
              </button>
            </div>

            {/* Linked file chips */}
            {formData.linkedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.linkedFiles.map(f => (
                  <span
                    key={f.fileId}
                    className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-700"
                  >
                    {getMimeIcon(f.mimeType)}
                    <span className="max-w-[160px] truncate">{f.fileName}</span>
                    <button
                      type="button"
                      onClick={() => removeLinkedFile(f.fileId)}
                      className="ml-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* File search panel */}
            {showFileSearch && (
              <div
                ref={fileSearchRef}
                className="border border-gray-200 rounded-md bg-white shadow-lg p-3 space-y-2"
              >
                <div className="flex items-center gap-2 border border-gray-300 rounded-md px-2 py-1">
                  <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={fileSearchQuery}
                    onChange={e => setFileSearchQuery(e.target.value)}
                    placeholder="Search files..."
                    className="flex-1 text-sm outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-gray-100">
                  {isFetchingFiles && (
                    <div className="flex items-center gap-2 py-3 justify-center text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  )}
                  {!isFetchingFiles && fileResults.length === 0 && (
                    <p className="text-sm text-gray-500 italic py-3 text-center">No files found.</p>
                  )}
                  {!isFetchingFiles && fileResults.map(file => {
                    const alreadyLinked = formData.linkedFiles.some(
                      f => f.fileId === (file._id || file.fileId)
                    );
                    return (
                      <button
                        key={file._id || file.fileId}
                        type="button"
                        disabled={alreadyLinked}
                        onClick={() => linkFile(file)}
                        className={`w-full flex items-center gap-2 px-2 py-2 text-sm text-left hover:bg-blue-50 transition-colors ${alreadyLinked ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {getMimeIcon(file.mimeType)}
                        <span className="truncate">{file.name || file.fileName}</span>
                        {alreadyLinked && (
                          <span className="ml-auto text-xs text-gray-400 flex-shrink-0">linked</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Due Date */}
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

        {/* ── Feature 5: Activity feed (replaces Comments section) ── */}
        {task && task._id && (
          <div className="px-6 pb-6 pt-2 border-t border-gray-100 bg-gray-50 flex-shrink-0">
            <h3 className="text-sm font-bold text-gray-800 mb-3">
              Activity ({activityFeed.length})
            </h3>
            <div className="space-y-2 mb-4 max-h-52 overflow-y-auto pr-1">
              {activityFeed.length === 0 && (
                <p className="text-sm text-gray-500 italic">No activity yet. Be the first to start the discussion!</p>
              )}
              {activityFeed.map((entry, index) => {
                if (entry._type === 'comment') {
                  const c = entry.data;
                  return (
                    <div key={`comment-${index}`} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base leading-none">💬</span>
                        <span className="font-bold text-blue-600">{c.authorName}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap pl-6">{c.text}</p>
                    </div>
                  );
                } else {
                  const a = entry.data;
                  return (
                    <div key={`activity-${index}`} className="flex items-start gap-2 px-2 py-1.5 text-sm text-gray-600">
                      <span className="text-base leading-none mt-0.5 flex-shrink-0">
                        {getActivityIcon(a.type)}
                      </span>
                      <div>
                        <span>{getActivityLabel(a)}</span>
                        {a.createdAt && (
                          <span className="ml-2 text-xs text-gray-400">
                            {new Date(a.createdAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
            <form onSubmit={handleCommentSubmit} className="flex gap-2">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Type your comment… (Use @ to mention)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <button
                type="submit"
                disabled={isSubmittingComment || !newCommentText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmittingComment ? '...' : 'Post'}
              </button>
            </form>
          </div>
        )}

        {/* ── Footer ── */}
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