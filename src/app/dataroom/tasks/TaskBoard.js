'use client';

import { useMemo } from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, AlertCircle, User } from 'lucide-react';

// Columns mirror the dataroom task statuses (see /api/dataroom/tasks).
const COLUMNS = [
  { id: 'pending', title: 'To Do', dot: 'bg-slate-400' },
  { id: 'in_progress', title: 'In Progress', dot: 'bg-blue-500' },
  { id: 'completed', title: 'Completed', dot: 'bg-green-500' },
];

const STATUS_IDS = COLUMNS.map((c) => c.id);

const priorityStyles = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isOverdue(dueDate) {
  return new Date(dueDate) < new Date();
}

function TaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  const overdue = task.dueDate && isOverdue(task.dueDate) && task.status !== 'completed';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-3 cursor-grab active:cursor-grabbing touch-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          className={`text-sm font-semibold flex-1 ${
            task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-900'
          }`}
        >
          {task.title}
        </h4>
        {task.priority && (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
              priorityStyles[task.priority] || 'bg-slate-100 text-slate-700'
            }`}
          >
            {task.priority}
          </span>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-slate-600 mt-1.5 line-clamp-3">{task.description}</p>
      )}

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        {(task.assignedToName || task.assignedToEmail || task.assignedTo) ? (
          <span className="flex items-center gap-1 truncate max-w-[55%]">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {task.assignedToName || task.assignedToEmail || task.assignedTo?.email || task.assignedTo}
            </span>
          </span>
        ) : (
          <span className="italic text-slate-400">Unassigned</span>
        )}

        {task.dueDate && (
          <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
            <Clock className="w-3 h-3" />
            {formatDate(task.dueDate)}
            {overdue && <AlertCircle className="w-3 h-3" />}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({ column, tasks }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border p-3 min-h-[200px] transition-colors ${
        isOver ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 bg-slate-100/70'
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${column.dot}`} />
          <h3 className="text-sm font-semibold text-slate-700">{column.title}</h3>
        </div>
        <span className="text-xs font-medium bg-white text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>

      <SortableContext
        id={column.id}
        items={tasks.map((t) => t._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2.5 flex-grow">
          {tasks.map((task) => (
            <TaskCard key={task._id} task={task} />
          ))}
          {tasks.length === 0 && (
            <div className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-lg">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/**
 * Kanban board for dataroom tasks. Built on @dnd-kit (already used by the
 * project-management board) so styling and behavior stay uniform across the app.
 *
 * Props:
 *   tasks  - array of task objects ({ _id, status, ... })
 *   onMove - (taskId, newStatus) => void; called when a card is dropped in a new column
 */
export default function TaskBoard({ tasks, onMove }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const grouped = useMemo(() => {
    const map = { pending: [], in_progress: [], completed: [] };
    tasks.forEach((t) => {
      const key = map[t.status] ? t.status : 'pending';
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  function handleDragEnd({ active, over }) {
    if (!over) return;

    const activeTask = tasks.find((t) => t._id === active.id);
    if (!activeTask) return;

    // Drop target is either a column id or another task's id.
    let newStatus = over.id;
    if (!STATUS_IDS.includes(newStatus)) {
      const overTask = tasks.find((t) => t._id === over.id);
      if (!overTask) return;
      newStatus = overTask.status;
    }

    if (newStatus && newStatus !== activeTask.status) {
      onMove(activeTask._id, newStatus);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((column) => (
          <Column key={column.id} column={column} tasks={grouped[column.id]} />
        ))}
      </div>
    </DndContext>
  );
}
