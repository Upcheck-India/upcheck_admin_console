import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, Loader2, AlertTriangle, Trash2, Edit, Eye, FileText, MoreVertical, X, Share2, ChevronUp, ChevronDown, MessageSquare, CheckSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TaskModal from './TaskModal';
import useOnlineUsers from '../../../hooks/useOnlineUsers';
import AvatarWithStatus from '../../../components/AvatarWithStatus';
import BurndownChart from './BurndownChart';
import TaskDetailsModal from './TaskDetailsModal';
import AddSprintModal from './AddSprintModal';
import ShareLinksModal from './ShareLinksModal';
import { useAuth } from '../../../hooks/useAuth';
import { getUserPermissionLevel, canAccessProject } from '../../../lib/projectPermissions';
import { 
  DndContext, 
  closestCenter, 
  PointerSensor, 
  TouchSensor, 
  useSensor, 
  useSensors, 
  useDroppable 
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const UserAvatar = ({ user, online = false }) => {
  const tooltipText = React.useMemo(() => {
    if (!user) return 'Unknown';
    const teamsStr = user.teams?.length > 0 
      ? ` - Teams: ${user.teams.map(t => t.name).join(', ')}` 
      : '';
    return `${user.username} (${user.role})${teamsStr}${online ? ' - Online' : ''}`;
  }, [user, online]);

  return (
    <div title={tooltipText}>
      <AvatarWithStatus 
        username={user?.username} 
        online={online} 
        className="w-8 h-8 text-xs border-2 border-white cursor-help shadow-sm hover:scale-105 transition-transform" 
      />
    </div>
  );
};

const typeColors = {
  Feature: 'bg-blue-100 text-blue-800',
  Bug: 'bg-red-100 text-red-800',
  Chore: 'bg-yellow-100 text-yellow-800',
  Epic: 'bg-purple-100 text-purple-800',
};

const TaskCard = ({ task, userMap, canEdit, canDelete, canDrag, onEdit, onDelete, onView, isFirst, isLast, onMoveUp, onMoveDown, onlineUsernames }) => {
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    transform, 
    transition, 
    isDragging 
  } = useSortable({ 
    id: task._id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  const handleView = (e) => {
    e.stopPropagation();
    onView(task);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(task);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(task._id);
  };

  const dateStatus = useMemo(() => {
    if (!task.dueDate || task.status === 'Done') return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return {
        label: 'Overdue',
        textClass: 'text-red-600 font-semibold',
        cardClass: 'border-red-200 bg-red-50/40 hover:bg-red-50/60',
        badgeClass: 'bg-red-100 text-red-800 border border-red-200',
      };
    } else if (diffDays <= 2) {
      return {
        label: 'Due Soon',
        textClass: 'text-amber-600 font-semibold',
        cardClass: 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/60',
        badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
      };
    }
    return null;
  }, [task.dueDate, task.status]);

  const priorityDotColor = useMemo(() => {
    switch (task.priority) {
      case 'Urgent': return 'bg-red-500';
      case 'High': return 'bg-orange-400';
      case 'Medium': return 'bg-yellow-400';
      case 'Low': return 'bg-green-500';
      default: return null;
    }
  }, [task.priority]);

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className={`bg-white p-3 rounded-lg shadow-sm border relative group touch-none ${dateStatus?.cardClass || 'border-gray-200'}`}
    >
      {/* Priority dot */}
      {priorityDotColor && (
        <span
          className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ${priorityDotColor}`}
          title={task.priority}
        />
      )}

      <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-75 rounded-md">
        {/* View button for all users */}
        <button 
          onClick={handleView} 
          className="text-gray-500 hover:text-blue-600 p-1"
          type="button"
          title="View task"
        >
          <Eye className="h-4 w-4" />
        </button>
        {canDrag && !isFirst && (
          <button 
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }} 
            className="text-gray-500 hover:text-blue-600 p-1"
            type="button"
            title="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        )}
        {canDrag && !isLast && (
          <button 
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }} 
            className="text-gray-500 hover:text-blue-600 p-1"
            type="button"
            title="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
        {canEdit && (
          <button 
            onClick={handleEdit} 
            className="text-gray-500 hover:text-blue-600 p-1"
            type="button"
            title="Edit task"
          >
            <Edit className="h-4 w-4" />
          </button>
        )}
        {canDelete && (
          <button 
            onClick={handleDelete} 
            className="text-gray-500 hover:text-red-600 p-1"
            type="button"
            title="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      
      <div className={`flex items-start justify-between ${priorityDotColor ? 'pl-4' : ''}`}>
        <h4 className="font-semibold text-gray-800 pr-4 text-sm flex-1">
          {task.title}
        </h4>
        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {dateStatus && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${dateStatus.badgeClass}`}>
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              {dateStatus.label}
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            typeColors[task.type] || 'bg-gray-100 text-gray-800'
          }`}>
            {task.type}
          </span>
        </div>
      </div>

      {/* Label chips */}
      {task.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {task.labels.map((label, idx) => (
            <span
              key={idx}
              style={{ backgroundColor: label.color }}
              className="text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      
      {task.description && (
        <p className="text-xs text-gray-600 mt-1.5">{task.description}</p>
      )}
      
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] ${dateStatus ? dateStatus.textClass : 'text-gray-500'}`}>
            Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
          </span>
          
          {(task.subtasks?.length > 0 || task.comments?.length > 0) && (
            <div className="flex items-center gap-2 text-[11px] text-gray-500 border-l border-gray-200 pl-2">
              {task.subtasks?.length > 0 && (
                <div className="flex items-center gap-1" title="Sub-tasks">
                  <CheckSquare className="w-3 h-3" />
                  <span>{task.subtasks.filter(st => st.isCompleted).length}/{task.subtasks.length}</span>
                </div>
              )}
              {task.comments?.length > 0 && (
                <div className="flex items-center gap-1" title="Comments">
                  <MessageSquare className="w-3 h-3" />
                  <span>{task.comments.length}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center -space-x-2">
          {task.assignees?.map(assigneeId => (
            <UserAvatar 
              key={assigneeId} 
              user={userMap.get(assigneeId)} 
              online={onlineUsernames?.has(userMap.get(assigneeId)?.username)}
            />
          ))}
          {(!task.assignees || task.assignees.length === 0) && (
            <div className="text-xs text-gray-400 italic">Unassigned</div>
          )}
        </div>
      </div>
      
      {task.reporter && (
        <div className="mt-2 text-xs text-gray-500 flex items-center">
          <span className="font-semibold mr-1">Reporter:</span>
          <span>{userMap.get(task.reporter)?.username || 'Unknown'}</span>
        </div>
      )}
    </div>
  );
};

const Column = ({ id, title, tasks, userMap, canEdit, canDelete, canDrag, onEdit, onDelete, onView, canCreate, onAddTask, onMoveUp, onMoveDown, onlineUsernames }) => {
  const { setNodeRef } = useDroppable({ 
    id,
    disabled: !canDrag
  });

  return (
    <div ref={setNodeRef} className="bg-gray-100 rounded-lg p-4 flex flex-col">
      <h3 className="font-semibold text-gray-700 mb-4 border-b pb-2 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <span>{title}</span>
          <span className="text-sm font-normal bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
        {canCreate && (
          <button
            onClick={() => onAddTask(id)}
            className="text-gray-500 hover:text-blue-600 p-1 rounded hover:bg-gray-200 transition-colors"
            type="button"
            title={`Add task to ${title}`}
          >
            <PlusCircle className="h-4 w-4" />
          </button>
        )}
      </h3>
      
      <SortableContext 
        id={id} 
        items={tasks.map(t => t._id)} 
        strategy={verticalListSortingStrategy}
        disabled={!canDrag}
      >
        <div className="space-y-4 overflow-y-auto flex-grow min-h-[100px]">
          {tasks.map((task, idx) => (
            <TaskCard 
              key={task._id} 
              task={task} 
              userMap={userMap} 
              canEdit={canEdit} 
              canDelete={canDelete}
              canDrag={canDrag}
              onEdit={onEdit} 
              onDelete={onDelete}
              onView={onView}
              isFirst={idx === 0}
              isLast={idx === tasks.length - 1}
              onMoveUp={() => onMoveUp(task._id)}
              onMoveDown={() => onMoveDown(task._id)}
              onlineUsernames={onlineUsernames}
            />
          ))}
          {tasks.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-4">
              No tasks here.
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

const TasksTab = ({ projectId, project, allUsers = [], allTeams = [] }) => {
  const { user: currentUser } = useAuth();
  const onlineUsers = useOnlineUsers();
  const onlineUsernames = useMemo(() => new Set(onlineUsers.map(u => u.username)), [onlineUsers]);

  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [currentSprintId, setCurrentSprintId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [detailsTask, setDetailsTask] = useState(null);
  const [isShareLinksModalOpen, setIsShareLinksModalOpen] = useState(false);

  // Filter state (must be before any early returns)
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterAssignee, setFilterAssignee] = useState('All');
  const [filterSearch, setFilterSearch] = useState('');

  // Sprint management state
  const [editingSprint, setEditingSprint] = useState(null);
  const [editSprintName, setEditSprintName] = useState('');
  const [sprintMenuOpen, setSprintMenuOpen] = useState(null); // Track which sprint menu is open
  const [sprintMenuPosition, setSprintMenuPosition] = useState({ x: 0, y: 0 });
  const [showDeleteSprintConfirm, setShowDeleteSprintConfirm] = useState(null); // Sprint to delete

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // Resolve user teams
  const userTeams = useMemo(() => {
    if (!currentUser || !allTeams) return [];
    const userId = currentUser.id;
    return allTeams.filter(team => 
      team.lead === userId || 
      (Array.isArray(team.members) && team.members.includes(userId))
    );
  }, [currentUser, allTeams]);

  // Permissions Level
  const perms = useMemo(() => {
    if (!currentUser || !project) return null;
    return getUserPermissionLevel(currentUser, project, userTeams);
  }, [currentUser, project, userTeams]);

  const hasFullPermission = perms && perms.level === 'full';
  const isContributor = perms && perms.level === 'write';

  const settings = project.settings || {};
  const allowContributorsUpdateTasks = settings.allowContributorsUpdateTasks !== false;
  const allowContributorsDeleteTasks = settings.allowContributorsDeleteTasks === true;

  const isManager = hasFullPermission;
  const canDrag = hasFullPermission || (isContributor && allowContributorsUpdateTasks);
  const canEdit = hasFullPermission || (isContributor && allowContributorsUpdateTasks);
  const canDelete = hasFullPermission || (isContributor && allowContributorsDeleteTasks);
  const canCreate = hasFullPermission || isContributor;

  // Check if user can access documentation (project members or admins can access)
  const canAccessDocumentation = useMemo(() => {
    if (!currentUser || !project) return false;
    // Admin and Console admin can access everything
    if (['Admin', 'Console admin'].includes(currentUser.role)) return true;
    // Project members can access
    return (
      project.superManager === currentUser.username ||
      project.members?.some(m => m.user === currentUser.username)
    );
  }, [currentUser, project]);

  // Map of userId -> user object
  const userMap = useMemo(() => {
    const map = new Map();
    if (!project || !allUsers.length) return map;
    
    const getTeamsForUser = (userId) => {
      const userIdStr = userId?.toString();
      return allTeams.filter(team => {
        const leadIdStr = team.lead?._id?.toString() || team.lead?.toString();
        const memberIdsStr = Array.isArray(team.members) 
          ? team.members.map(m => m?._id?.toString() || m?.toString() || m) 
          : [];
        return leadIdStr === userIdStr || memberIdsStr.includes(userIdStr);
      });
    };

    allUsers.forEach(user => {
      const uTeams = getTeamsForUser(user._id);
      if (canAccessProject(user, project, uTeams)) {
        const explicitMember = project.members?.find(m => m.user === user.username);
        let computedRole = explicitMember ? explicitMember.role : 'Team/Role Access';
        if (project.superManager === user.username) {
          computedRole = 'Super Manager';
        }
        map.set(user._id, { ...user, role: computedRole, teams: uTeams });
      }
    });
    
    return map;
  }, [project, allUsers, allTeams]);

  const assignableUsers = useMemo(() => Array.from(userMap.values()), [userMap]);

  // Derived: selected sprint
  const selectedSprint = sprints.find(s => s._id === currentSprintId);

  // Filtered tasks based on active filter bar state
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filterPriority && filterPriority !== 'All' && task.priority !== filterPriority) return false;
      if (filterAssignee && filterAssignee !== 'All' && !task.assignees?.includes(filterAssignee)) return false;
      if (filterSearch && !task.title?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterPriority, filterAssignee, filterSearch]);

  // Columns grouped by status (uses filteredTasks)
  const columns = useMemo(() => {
    // For Product Backlog board (no sprint selected), only show Backlog column
    if (currentSprintId === null) {
      return {
        'Backlog': filteredTasks.filter(t => t.status === 'Backlog'),
      };
    }
    // For sprint boards, show full workflow columns
    return {
      'Backlog': filteredTasks.filter(t => t.status === 'Backlog'),
      'To Do': filteredTasks.filter(t => t.status === 'To Do'),
      'In Progress': filteredTasks.filter(t => t.status === 'In Progress'),
      'Done': filteredTasks.filter(t => t.status === 'Done'),
    };
  }, [filteredTasks, currentSprintId]);

  // Fetch sprints
  useEffect(() => {
    if (!projectId) return;
    const fetchSprints = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/sprints`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!res.ok) throw new Error(`Failed to fetch sprints: ${res.status}`);
        const data = await res.json();
        setSprints(data);
        // We no longer auto-select the first sprint to allow viewing the product backlog
      } catch (e) {
        console.error('Error fetching sprints:', e);
        setError(e.message);
      }
    };
    fetchSprints();
  }, [projectId]);

  // Fetch tasks when project or sprint changes
  useEffect(() => {
    if (!projectId) return;
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        let url = `/api/projects/${projectId}/tasks`; 
        // Include sprintId param for accurate filtering. Null indicates backlog tasks (no sprint)
        if (currentSprintId !== null) {
          url += `?sprintId=${currentSprintId}`;
        } else {
          url += `?sprintId=null`;
        }
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to fetch tasks: ${res.status}`);
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Error fetching tasks:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [projectId, currentSprintId]);

  // Modal helpers
  const handleOpenModal = (task = null) => { 
    setCurrentTask(task); 
    setIsModalOpen(true); 
  };

  const handleOpenDetails = (task) => {
    setDetailsTask(task);
  };
  const handleCloseDetails = () => setDetailsTask(null);

  const handleCloseModal = () => { 
    setCurrentTask(null); 
    setIsModalOpen(false); 
  };

  const handleSaveTask = (savedTask) => {
    if (currentTask) {
      // Editing existing task
      setTasks(prevTasks => {
        // If task belongs to this sprint, update it; otherwise, remove it from list
        if (currentSprintId && savedTask.sprintId && savedTask.sprintId !== currentSprintId) {
          return prevTasks.filter(t => t._id !== savedTask._id);
        }
        if (!currentSprintId && savedTask.sprintId) {
          // We are viewing backlog (no sprint), but task now has sprint -> remove
          return prevTasks.filter(t => t._id !== savedTask._id);
        }
        return prevTasks.map(t => t._id === savedTask._id ? savedTask : t);
      });
    } else {
      // Creating new task
      const shouldAdd = (
        (currentSprintId && savedTask.sprintId === currentSprintId) ||
        (!currentSprintId && !savedTask.sprintId)
      );
      if (shouldAdd) {
        setTasks(prevTasks => [...prevTasks, savedTask]);
      }
    }
    handleCloseModal();
  };

  // Open add sprint modal
  const openSprintModal = () => setIsSprintModalOpen(true);
  const closeSprintModal = () => setIsSprintModalOpen(false);

  const handleSaveSprint = (sprint) => {
    setSprints((prev) => [...prev, sprint]);
    setCurrentSprintId(sprint._id);
    closeSprintModal();
  };

  // Sprint rename handlers
  const handleStartRenameSprint = (sprint) => {
    setEditingSprint(sprint);
    setEditSprintName(sprint.name);
    setSprintMenuOpen(null);
  };

  const handleRenameSprint = async () => {
    if (!editSprintName.trim()) {
      alert('Sprint name cannot be empty');
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          sprintId: editingSprint._id,
          name: editSprintName.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to rename sprint');
      }

      const updatedSprint = await res.json();
      setSprints(prev => prev.map(s => s._id === updatedSprint._id ? updatedSprint : s));
      setEditingSprint(null);
      setEditSprintName('');
    } catch (e) {
      console.error('Error renaming sprint:', e);
      alert(`Error renaming sprint: ${e.message}`);
    }
  };

  const handleCancelRename = () => {
    setEditingSprint(null);
    setEditSprintName('');
  };

  // Sprint delete handler
  const handleDeleteSprint = async (sprint) => {
    if (!window.confirm(`Are you sure you want to delete "${sprint.name}"? Tasks in this sprint will be moved to the Product Backlog.`)) {
      setShowDeleteSprintConfirm(null);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/sprints`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ sprintId: sprint._id }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete sprint');
      }

      setSprints(prev => prev.filter(s => s._id !== sprint._id));
      if (currentSprintId === sprint._id) {
        setCurrentSprintId(null); // Go back to product backlog
      }
      setShowDeleteSprintConfirm(null);
    } catch (e) {
      console.error('Error deleting sprint:', e);
      alert(`Error deleting sprint: ${e.message}`);
      setShowDeleteSprintConfirm(null);
    }
  };

  // Navigate to documentation
  const handleGoToDocumentation = () => {
    router.push(`/documentation/${projectId}`);
  };

  // Delete task function
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error(`Failed to delete task: ${res.status}`);
      setTasks(prevTasks => prevTasks.filter(t => t._id !== taskId));
    } catch (e) {
      console.error('Error deleting task:', e);
      alert(`Error deleting task: ${e.message}`);
    }
  };

  // Move task up/down inside its column
  const handleMoveTask = async (taskId, direction) => {
    const taskIndex = tasks.findIndex(t => t._id === taskId);
    if (taskIndex === -1) return;
    const task = tasks[taskIndex];
    
    // Find all tasks in the same column
    const columnTasks = tasks.filter(t => t.status === task.status);
    const inColIndex = columnTasks.findIndex(t => t._id === taskId);
    
    if (direction === 'up' && inColIndex > 0) {
      const prevTask = columnTasks[inColIndex - 1];
      const targetIndex = tasks.findIndex(t => t._id === prevTask._id);
      
      const newTasks = [...tasks];
      // Swap positions
      newTasks[taskIndex] = prevTask;
      newTasks[targetIndex] = task;
      setTasks(newTasks);
      
      await persistReorder(task, targetIndex, newTasks);
    } else if (direction === 'down' && inColIndex < columnTasks.length - 1) {
      const nextTask = columnTasks[inColIndex + 1];
      const targetIndex = tasks.findIndex(t => t._id === nextTask._id);
      
      const newTasks = [...tasks];
      // Swap positions
      newTasks[taskIndex] = nextTask;
      newTasks[targetIndex] = task;
      setTasks(newTasks);
      
      await persistReorder(task, targetIndex, newTasks);
    }
  };

  const persistReorder = async (activeTask, newIndex, newTasks) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${activeTask._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...activeTask,
          order: newIndex,
          tasks: newTasks.map(t => ({ _id: t._id, order: newTasks.indexOf(t) }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to reorder task: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to reorder task:', error);
      alert(`Failed to reorder task: ${error.message}`);
    }
  };

  // Drag and drop handler
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || !active) return;

    const activeTask = tasks.find(t => t._id === active.id);
    if (!activeTask) return;

    // Check if dropped on a column or a task
    const validStatuses = ['Backlog', 'To Do', 'In Progress', 'Done'];
    let newStatus = over.id;
    const isColumn = validStatuses.includes(newStatus);

    if (!isColumn) {
      // If dropped on another task, inherit its status
      const overTask = tasks.find(t => t._id === over.id);
      if (overTask) {
        newStatus = overTask.status;
      } else {
        console.warn('Invalid drop target', over.id);
        return;
      }
    }

    // Handle reordering within the same column
    if (activeTask.status === newStatus) {
      // Find the indices
      const oldIndex = tasks.findIndex(t => t._id === active.id);
      const newIndex = tasks.findIndex(t => t._id === over.id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        // Reorder tasks locally
        const newTasks = arrayMove(tasks, oldIndex, newIndex);
        setTasks(newTasks);

        // Update order on server
        try {
          const response = await fetch(`/api/projects/${projectId}/tasks/${active.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({
              ...activeTask,
              order: newIndex,
              tasks: newTasks.map(t => ({ _id: t._id, order: newTasks.indexOf(t) }))
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to reorder task: ${response.status}`);
          }
        } catch (error) {
          console.error('Failed to reorder task:', error);
          // Revert on error
          setTasks(tasks);
          alert(`Failed to reorder task: ${error.message}`);
        }
      }
      return;
    }

    // Handle moving to different column (status change)
    const updatedTask = { ...activeTask, status: newStatus };
    const originalTasks = [...tasks];

    // Optimistically update the UI
    setTasks(currentTasks =>
      currentTasks.map(t => t._id === active.id ? updatedTask : t)
    );

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${active.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(updatedTask),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update task: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      // Revert to original state on error
      setTasks(originalTasks);
      alert(`Failed to update task: ${error.message}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-center">
        <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
        <div>
          <h3 className="font-semibold text-red-800">Error Loading Tasks</h3>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isModalOpen && (
        <TaskModal
          task={currentTask}
          assignableUsers={assignableUsers}
          onClose={handleCloseModal}
          onSave={handleSaveTask}
          projectId={projectId}
          sprints={sprints}
          defaultSprintId={currentSprintId !== null ? currentSprintId : (sprints.length > 0 ? sprints[0]._id : null)}
          projectLabels={project?.settings?.labels || []}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="p-4 sm:p-6 bg-gray-50 min-h-full">
          <div className="flex flex-col mb-6">
            {/* Sprint Tabs */}
            <div className="flex items-center mb-3 space-x-2 overflow-x-auto sticky top-0 bg-gray-50 z-10 py-2">
              <button
                onClick={() => setCurrentSprintId(null)}
                className={`px-4 py-1.5 rounded-md text-sm whitespace-nowrap ${
                  currentSprintId === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                Product Board
              </button>
              {sprints.map(s => {
                const isEditing = editingSprint?._id === s._id;
                const isMenuOpen = sprintMenuOpen === s._id;

                return (
                  <div key={s._id} className="relative">
                    {isEditing ? (
                      <div className="flex items-center space-x-1 bg-white rounded-md border-2 border-blue-500 px-2 py-1">
                        <input
                          type="text"
                          value={editSprintName}
                          onChange={(e) => setEditSprintName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSprint();
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                          className="text-sm border-none outline-none focus:ring-0 min-w-[100px]"
                          autoFocus
                        />
                        <button
                          onClick={handleRenameSprint}
                          className="text-green-600 hover:text-green-700 p-0.5"
                          title="Save"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={handleCancelRename}
                          className="text-gray-500 hover:text-gray-700 p-0.5"
                          title="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <button
                          onClick={() => setCurrentSprintId(s._id)}
                          className={`px-4 py-1.5 rounded-md text-sm whitespace-nowrap ${
                            currentSprintId === s._id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          }`}
                        >
                          {s.name}
                        </button>
                        {isManager && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setSprintMenuPosition({ x: rect.left, y: rect.bottom + 4 });
                                setSprintMenuOpen(isMenuOpen ? null : s._id);
                              }}
                              className="ml-1 p-1 rounded hover:bg-gray-300 text-gray-500 hover:text-gray-700"
                              title="Sprint options"
                              type="button"
                            >
                              <MoreVertical className="h-3 w-3" />
                            </button>
                            {isMenuOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setSprintMenuOpen(null)}
                                />
                                <div
                                  className="fixed bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 min-w-[140px]"
                                  style={{ left: sprintMenuPosition.x, top: sprintMenuPosition.y }}
                                >
                                  <button
                                    onClick={() => {
                                      handleStartRenameSprint(s);
                                      setSprintMenuOpen(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                  >
                                    <Edit className="h-3 w-3 mr-2" />
                                    Rename
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowDeleteSprintConfirm(s);
                                      setSprintMenuOpen(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                                  >
                                    <Trash2 className="h-3 w-3 mr-2" />
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {isManager && (
                <button
                  onClick={openSprintModal}
                  className="flex items-center px-2 py-1.5 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                >
                  <PlusCircle className="h-4 w-4 mr-1" /> Add Sprint
                </button>
              )}
            </div>
            {sprints.length === 0 && (
              <div className="text-sm text-gray-500 ml-2">
                {isManager ? 'No sprints yet. Click "Add Sprint" to create the first sprint.' : 'No sprints available yet.'}
              </div>
          )}
        </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="All">All Priorities</option>
              <option value="Urgent">🔴 Urgent</option>
              <option value="High">🟠 High</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Low">🟢 Low</option>
            </select>

            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="All">All Assignees</option>
              {Array.from(userMap.values()).map(u => (
                <option key={u._id} value={u._id}>{u.username}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search tasks..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 flex-1 min-w-[160px]"
            />

            {(filterPriority !== 'All' || filterAssignee !== 'All' || filterSearch) && (
              <button
                type="button"
                onClick={() => { setFilterPriority('All'); setFilterAssignee('All'); setFilterSearch(''); }}
                className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-gray-800">Project Tasks</h2>
              {canAccessDocumentation && (
                <button
                  onClick={handleGoToDocumentation}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                  type="button"
                  title="View project documentation"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Documentation
                </button>
              )}
              {isManager && (
                <button
                  onClick={() => setIsShareLinksModalOpen(true)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                  type="button"
                  title="Share project"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Links
                </button>
              )}
            </div>
            {canCreate && (
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                type="button"
              >
                <PlusCircle className="h-5 w-5 mr-2" />
                Add New Task
              </button>
            )}
          </div>

          {/* Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {Object.entries(columns).map(([status, tasksInColumn]) => (
              <Column
                key={status}
                id={status}
                title={status}
                tasks={tasksInColumn}
                userMap={userMap}
                canEdit={canEdit}
                canDelete={canDelete}
                canDrag={canDrag}
                canCreate={canCreate}
                onEdit={handleOpenModal}
                onDelete={handleDeleteTask}
                onView={handleOpenDetails}
                onAddTask={(colStatus) => handleOpenModal({ status: colStatus })}
                onMoveUp={(taskId) => handleMoveTask(taskId, 'up')}
                onMoveDown={(taskId) => handleMoveTask(taskId, 'down')}
                onlineUsernames={onlineUsernames}
              />
            ))}
          </div>

          {/* Burndown Chart (collapsible, shown when sprint has dates - moved to bottom) */}
          {currentSprintId && selectedSprint?.startDate && selectedSprint?.endDate && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <BurndownChart sprint={selectedSprint} tasks={tasks} />
            </div>
          )}
        </div>
      </DndContext>

      {detailsTask && (
        <TaskDetailsModal task={detailsTask} onClose={handleCloseDetails} userMap={userMap} sprints={sprints} />
      )}

      {isSprintModalOpen && (
        <AddSprintModal
          projectId={projectId}
          onClose={closeSprintModal}
          onSave={handleSaveSprint}
        />
      )}

      {showDeleteSprintConfirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteSprintConfirm(null);
          }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
              <h3 className="text-lg font-bold text-gray-900">Delete Sprint</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete &quot;<strong>{showDeleteSprintConfirm.name}</strong>&quot;?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              All tasks in this sprint will be moved to the Product Backlog.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowDeleteSprintConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSprint(showDeleteSprintConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700"
              >
                Delete Sprint
              </button>
            </div>
          </div>
        </div>
      )}

      {isShareLinksModalOpen && (
        <ShareLinksModal
          projectId={projectId}
          onClose={() => setIsShareLinksModalOpen(false)}
        />
      )}
    </>
  );
};

export default TasksTab;