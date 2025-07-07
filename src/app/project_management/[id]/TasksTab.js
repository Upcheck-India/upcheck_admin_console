import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, Loader2, AlertTriangle, Trash2, Edit, Eye } from 'lucide-react';
import TaskModal from './TaskModal';
import TaskDetailsModal from './TaskDetailsModal';
import AddSprintModal from './AddSprintModal';
import { useAuth } from '../../../hooks/useAuth';
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
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const UserAvatar = ({ user }) => (
  <div 
    className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold text-gray-600 border-2 border-white" 
    title={user?.username || 'Unknown'}
  >
    {user ? user.username.charAt(0).toUpperCase() : '?'}
  </div>
);

const typeColors = {
  Feature: 'bg-blue-100 text-blue-800',
  Bug: 'bg-red-100 text-red-800',
  Chore: 'bg-yellow-100 text-yellow-800',
  Epic: 'bg-purple-100 text-purple-800',
};

const TaskCard = ({ task, userMap, isManager, onEdit, onDelete, onView }) => {
  const { 
    attributes, 
    listeners, 
    setNodeRef, 
    transform, 
    transition, 
    isDragging 
  } = useSortable({ 
    id: task._id,
    disabled: !isManager,
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

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className="bg-white p-3 rounded-lg shadow-sm border relative group touch-none"
    >
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
        {isManager && (
          <>
            <button 
              onClick={handleEdit} 
              className="text-gray-500 hover:text-blue-600 p-1"
              type="button"
              title="Edit task"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button 
              onClick={handleDelete} 
              className="text-gray-500 hover:text-red-600 p-1"
              type="button"
              title="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-gray-800 pr-4 text-sm flex-1">
          {task.title}
        </h4>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          typeColors[task.type] || 'bg-gray-100 text-gray-800'
        }`}>
          {task.type}
        </span>
      </div>
      
      {task.description && (
        <p className="text-xs text-gray-600 mt-1.5">{task.description}</p>
      )}
      
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-xs text-gray-500">
            Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
          </span>
        </div>
        <div className="flex items-center -space-x-2">
          {task.assignees?.map(assigneeId => (
            <UserAvatar key={assigneeId} user={userMap.get(assigneeId)} />
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

const Column = ({ id, title, tasks, userMap, isManager, onEdit, onDelete, onView }) => {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className="bg-gray-100 rounded-lg p-4 flex flex-col">
      <h3 className="font-semibold text-gray-700 mb-4 border-b pb-2 flex justify-between items-center">
        {title}
        <span className="text-sm font-normal bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </h3>
      
      <SortableContext 
        id={id} 
        items={tasks.map(t => t._id)} 
        strategy={verticalListSortingStrategy}
        disabled={!isManager}
      >
        <div className="space-y-4 overflow-y-auto flex-grow min-h-[100px]">
          {tasks.map(task => (
            <TaskCard 
              key={task._id} 
              task={task} 
              userMap={userMap} 
              isManager={isManager} 
              onEdit={onEdit} 
              onDelete={onDelete}
              onView={onView} 
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

const TasksTab = ({ projectId, project, allUsers = [] }) => {
  const { user: currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [currentSprintId, setCurrentSprintId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [detailsTask, setDetailsTask] = useState(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // Permissions
  const isManager = useMemo(() => {
    if (!currentUser || !project) return false;
    if (project.superManager === currentUser.username) return true;
    const memberInfo = project.members.find(m => m.user === currentUser.username);
    return memberInfo?.role === 'Project Manager';
  }, [currentUser, project]);

  // Map of userId -> user object
  const userMap = useMemo(() => {
    const map = new Map();
    if (!project || !allUsers.length) return map;
    
    project.members.forEach(member => {
      const user = allUsers.find(u => u.username === member.user);
      if (user) {
        map.set(user._id, { ...user, role: member.role });
      }
    });
    
    const superManagerUser = allUsers.find(u => u.username === project.superManager);
    if (superManagerUser && !map.has(superManagerUser._id)) {
      map.set(superManagerUser._id, { ...superManagerUser, role: 'Super Manager' });
    }
    
    return map;
  }, [project, allUsers]);

  const assignableUsers = useMemo(() => Array.from(userMap.values()), [userMap]);

  // Columns grouped by status
  const columns = useMemo(() => {
    // For Product Backlog board (no sprint selected), only show Backlog column
    if (currentSprintId === null) {
      return {
        'Backlog': tasks.filter(t => t.status === 'Backlog'),
      };
    }
    // For sprint boards, show full workflow columns
    return {
      'Backlog': tasks.filter(t => t.status === 'Backlog'),
      'To Do': tasks.filter(t => t.status === 'To Do'),
      'In Progress': tasks.filter(t => t.status === 'In Progress'),
      'Done': tasks.filter(t => t.status === 'Done'),
    };
  }, [tasks, currentSprintId]);

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

  // Drag and drop handler
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || !active) return;

    const activeTask = tasks.find(t => t._id === active.id);
    if (!activeTask) return;
    
    let newStatus = over.id;
    const validStatuses = ['Backlog', 'To Do', 'In Progress', 'Done'];
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

    if (activeTask.status === newStatus) return;

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
              {sprints.map(s => (
                <button
                  key={s._id}
                  onClick={() => setCurrentSprintId(s._id)}
                  className={`px-4 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    currentSprintId === s._id 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {s.name}
                </button>
              ))}
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

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Project Tasks</h2>
            {isManager && (
              <button 
                onClick={() => handleOpenModal()} 
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                isManager={isManager}
                onEdit={handleOpenModal}
                onDelete={handleDeleteTask}
                onView={handleOpenDetails}
              />
            ))}
          </div>
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
    </>
  );
};

export default TasksTab;