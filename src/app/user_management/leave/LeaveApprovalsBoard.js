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
import { Calendar } from 'lucide-react';

// Columns map to the leave_request statuses. Only `pending` cards are
// draggable — approved/rejected are terminal (the API only transitions
// forward from pending), so they render static.
const COLUMNS = [
  { id: 'pending', title: 'Pending', dot: 'bg-amber-500' },
  { id: 'approved', title: 'Approved', dot: 'bg-green-500' },
  { id: 'rejected', title: 'Rejected', dot: 'bg-red-500' },
];

const STATUS_IDS = COLUMNS.map((c) => c.id);

const fmt = (d) =>
  new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function Card({ request, draggable }) {
  const sortable = useSortable({ id: request._id, disabled: !draggable });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      className={`bg-white rounded-lg border border-gray-200 shadow-sm p-3 ${
        draggable ? 'cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow touch-none' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">{request.employeeName}</h4>
          {request.department && <p className="text-xs text-gray-400 truncate">{request.department}</p>}
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
          {request.leaveTypeName}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
        <Calendar className="w-3 h-3 shrink-0" />
        <span>
          {fmt(request.startDate)}
          {request.startDate !== request.endDate ? ` – ${fmt(request.endDate)}` : ''}
          {request.halfDay ? ' (half)' : ''}
        </span>
        <span className="text-gray-400">·</span>
        <span className="font-medium text-gray-700">{request.days} day(s)</span>
      </div>

      {request.reason && (
        <p className="mt-1.5 text-xs text-gray-500 line-clamp-2" title={request.reason}>
          {request.reason}
        </p>
      )}

      {request.reviewNote && (
        <p className="mt-1.5 text-xs text-gray-400 border-t border-gray-100 pt-1.5">
          Note: {request.reviewNote}
        </p>
      )}
    </div>
  );
}

function Column({ column, requests }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const draggable = column.id === 'pending';

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border p-3 min-h-[220px] transition-colors ${
        isOver ? 'border-blue-400 bg-blue-50/60' : 'border-gray-200 bg-gray-100/70'
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${column.dot}`} />
          <h3 className="text-sm font-semibold text-gray-700">{column.title}</h3>
        </div>
        <span className="text-xs font-medium bg-white text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">
          {requests.length}
        </span>
      </div>

      <SortableContext
        id={column.id}
        items={requests.map((r) => r._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2.5 flex-grow">
          {requests.map((r) => (
            <Card key={r._id} request={r} draggable={draggable} />
          ))}
          {requests.length === 0 && (
            <div className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">
              {column.id === 'pending' ? 'Nothing awaiting review' : 'None'}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/**
 * Kanban board for leave approvals. Built on @dnd-kit (consistent with the rest
 * of the app's boards). Drag a Pending request to Approved (approves it) or to
 * Rejected (opens the reject-note modal). Approved/Rejected are terminal.
 *
 * Props:
 *   requests  - all-status leave requests (view=all)
 *   onApprove - (id) => void
 *   onReject  - (request) => void   (opens the existing reject modal)
 */
export default function LeaveApprovalsBoard({ requests, onApprove, onReject }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const grouped = useMemo(() => {
    const map = { pending: [], approved: [], rejected: [] };
    requests.forEach((r) => {
      if (map[r.status]) map[r.status].push(r);
    });
    return map;
  }, [requests]);

  function handleDragEnd({ active, over }) {
    if (!over) return;
    const activeReq = requests.find((r) => r._id === active.id);
    if (!activeReq || activeReq.status !== 'pending') return;

    let target = over.id;
    if (!STATUS_IDS.includes(target)) {
      const overReq = requests.find((r) => r._id === over.id);
      if (!overReq) return;
      target = overReq.status;
    }

    if (target === 'approved') onApprove(activeReq._id);
    else if (target === 'rejected') onReject(activeReq);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((column) => (
          <Column key={column.id} column={column} requests={grouped[column.id]} />
        ))}
      </div>
    </DndContext>
  );
}
