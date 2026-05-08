// src/app/user_management/components/TeamsTab.js
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Edit2, Trash2, X, UserPlus, UserMinus,
  Crown, AlertCircle, Search, Check, Loader2, LogOut, AlertTriangle, Shield
} from 'lucide-react';

// ─── Utilities ───────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

// ─── Toast System ────────────────────────────────────────────────────
const TOAST_CONFIG = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', Icon: Check },
  error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', Icon: AlertCircle },
};

function Toast({ toast, onDismiss }) {
  const { bg, border, text, Icon } = TOAST_CONFIG[toast.type] || TOAST_CONFIG.error;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`${bg} ${border} ${text} border rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 animate-[slideIn_200ms_ease-out]`}>
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium">{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} className="ml-auto opacity-60 hover:opacity-100 transition-opacity">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  return { toasts, addToast, dismissToast };
}

// ─── Reusable Primitives ────────────────────────────────────────────
function Avatar({ name, size = 'md', color, icon: IconComp }) {
  const sizeMap = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' };
  const iconSizeMap = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' };
  const cls = `${sizeMap[size]} ${color || getAvatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`;

  return IconComp
    ? <div className={cls}><IconComp className={iconSizeMap[size]} /></div>
    : <div className={cls}>{getInitials(name)}</div>;
}

function Badge({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-gray-100 text-gray-600',
    admin: 'bg-violet-100 text-violet-700',
    lead: 'bg-amber-100 text-amber-700',
    member: 'bg-blue-100 text-blue-700',
    you: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ml-2 ${variants[variant]}`}>
      {children}
    </span>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-gray-100 mb-4">
        <Icon className="h-7 w-7 text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 max-w-xs mx-auto">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function SpinnerButton({ children, loading, disabled, variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'px-4 py-2.5 text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    danger: 'px-4 py-2.5 text-white bg-red-600 hover:bg-red-700 focus:ring-red-500',
    secondary: 'px-4 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-gray-400',
    warning: 'px-4 py-2.5 text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 focus:ring-amber-400',
  };

  return (
    <button disabled={disabled || loading} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ─── Base Modal ──────────────────────────────────────────────────────
function Modal({ isOpen, onClose, title, subtitle, maxWidth = 'max-w-md', maxHeight = 'max-h-[85vh]', children, icon }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-2xl w-full ${maxWidth} ${maxHeight} overflow-hidden flex flex-col animate-[modalIn_200ms_ease-out]`}>
        <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
                {subtitle && <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>}
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>
  );
}

// ─── Team Form Modal (Create / Edit) ────────────────────────────────
function TeamFormModal({ mode, formData, setFormData, onSubmit, onClose, isSubmitting, error }) {
  const isEdit = mode === 'edit';
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(e); };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? 'Edit Team' : 'Create New Team'}
      subtitle={isEdit ? 'Update team details' : 'Add a new team to organize your members'}
      icon={<Users className="h-5 w-5 text-white" />}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Team Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400"
            placeholder="e.g. Engineering Team"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400 resize-none"
            placeholder="What does this team do? (optional)"
            rows={3}
          />
        </div>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <SpinnerButton variant="secondary" onClick={onClose} loading={false} disabled={isSubmitting}>
            Cancel
          </SpinnerButton>
          <SpinnerButton type="submit" loading={isSubmitting} disabled={!formData.name.trim()}>
            {isEdit ? 'Save Changes' : 'Create Team'}
          </SpinnerButton>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete Confirm Modal ────────────────────────────────────────────
function DeleteConfirmModal({ teamName, onConfirm, onClose, isDeleting }) {
  return (
    <Modal isOpen onClose={onClose} title="Delete Team" maxWidth="max-w-sm">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900">&ldquo;{teamName}&rdquo;</span>?
              This action cannot be undone and all members will be unassigned.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <SpinnerButton variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </SpinnerButton>
          <SpinnerButton variant="danger" onClick={onConfirm} loading={isDeleting}>
            Delete Team
          </SpinnerButton>
        </div>
      </div>
    </Modal>
  );
}

// ─── Transfer Lead Confirmation Modal ────────────────────────────────
function TransferLeadModal({ team, selectedNewLead, onConfirm, onClose, isProcessing }) {
  const currentLeadName = team.lead?.username || 'Current Lead';
  const newLeadName = selectedNewLead?.username || 'New Lead';

  return (
    <Modal isOpen onClose={onClose} title="Transfer Team Lead" maxWidth="max-w-md">
      <div className="p-5 space-y-4">
        {/* Warning */}
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-medium">This action will transfer leadership</p>
            <p className="text-amber-700 mt-0.5">
              The new lead will have full control over this team.
            </p>
          </div>
        </div>

        {/* Transfer visualization */}
        <div className="flex items-center justify-center gap-4 py-3">
          <div className="flex flex-col items-center gap-1.5">
            <Avatar name={currentLeadName} size="md" color="bg-gray-400" />
            <div className="text-center">
              <p className="text-xs font-medium text-gray-900 truncate max-w-[100px]">{currentLeadName}</p>
              <Badge variant="lead">Current</Badge>
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-8 h-0.5 bg-gray-300" />
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
              <Crown className="h-3 w-3 text-blue-600" />
            </div>
            <div className="w-8 h-0.5 bg-blue-400" />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <Avatar name={newLeadName} size="md" color="bg-amber-500" />
            <div className="text-center">
              <p className="text-xs font-medium text-gray-900 truncate max-w-[100px]">{newLeadName}</p>
              <Badge variant="you">New</Badge>
            </div>
          </div>
        </div>

        {/* Confirmation message */}
        <p className="text-xs text-gray-600 text-center">
          Confirm transfer from <span className="font-semibold">{currentLeadName}</span> to <span className="font-semibold text-amber-700">{newLeadName}</span>?
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <SpinnerButton variant="secondary" onClick={onClose} disabled={isProcessing} className="!px-3 !py-2 !text-xs">
            Cancel
          </SpinnerButton>
          <SpinnerButton variant="warning" onClick={onConfirm} loading={isProcessing} className="!px-3 !py-2 !text-xs">
            <Crown className="h-3.5 w-3.5" /> Transfer
          </SpinnerButton>
        </div>
      </div>
    </Modal>
  );
}

// ─── Leave Team Confirmation Modal ────────────────────────────────
function LeaveTeamModal({ team, currentUser, isTeamLead, onConfirm, onClose, isProcessing }) {
  const canLeave = !isTeamLead; // Only non-leads can leave directly

  return (
    <Modal isOpen onClose={onClose} title="Leave Team" maxWidth="max-w-md">
      <div className="p-5 space-y-4">
        {isTeamLead ? (
          // Team lead cannot leave directly
          <>
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-800">
                <p className="font-medium">You are the Team Lead</p>
                <p className="text-red-700 mt-0.5">
                  You must first transfer leadership to another member before you can leave.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              Go to team settings and use &ldquo;Transfer Lead&rdquo; to assign a new leader first.
            </p>
            <div className="flex justify-end">
              <SpinnerButton variant="secondary" onClick={onClose} disabled={isProcessing} className="!px-3 !py-2 !text-xs">
                Close
              </SpinnerButton>
            </div>
          </>
        ) : (
          // Regular member can leave
          <>
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <LogOut className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-medium">Leaving the team</p>
                <p className="text-blue-700 mt-0.5">
                  You will no longer have access to this team&apos;s resources or be listed as a member.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600 text-center">
              Confirm leaving <span className="font-semibold text-gray-900">&ldquo;{team.name}&rdquo;</span>?
            </p>
            <div className="flex justify-end gap-2">
              <SpinnerButton variant="secondary" onClick={onClose} disabled={isProcessing} className="!px-3 !py-2 !text-xs">
                Cancel
              </SpinnerButton>
              <SpinnerButton variant="danger" onClick={onConfirm} loading={isProcessing} className="!px-3 !py-2 !text-xs">
                <LogOut className="h-3.5 w-3.5" /> Leave
              </SpinnerButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── Members Management Modal ────────────────────────────────────────
function MembersModal({
  team,
  currentUser,
  isAdmin,
  canManage,
  availableUsers,
  onAddMember,
  onRemoveMember,
  onChangeLead,
  onLeaveTeam,
  onClose,
  isProcessing,
  onSelectNewLead,
  onOpenLeaveModal
}) {
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [showLeadSelector, setShowLeadSelector] = useState(false);
  const [selectedNewLeadId, setSelectedNewLeadId] = useState('');

  const currentUserId = currentUser?.id || currentUser?._id;
  const isCurrentUserLead = team.lead?._id === currentUserId || team.lead?._id?.toString() === currentUserId;
  const isCurrentUserMember = team.members?.some(m => m._id === currentUserId || m._id?.toString() === currentUserId);

  // Admins who are members but not lead can leave
  const canLeaveTeam = isAdmin && isCurrentUserMember && !isCurrentUserLead;

  const filteredMembers = team.members?.filter(m =>
    m.username?.toLowerCase().includes(memberSearch.toLowerCase())
  ) || [];

  const availableToAdd = availableUsers?.filter(
    u => !team.members?.some(m => m._id === u._id)
  ) || [];

  // Members who can become lead (excluding current lead)
  const potentialLeads = team.members?.filter(m => m._id !== team.lead?._id) || [];

  const handleLeadSelect = () => {
    if (selectedNewLeadId) {
      const newLead = potentialLeads.find(m => m._id === selectedNewLeadId);
      if (newLead) {
        onSelectNewLead(newLead);
      }
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={team.name}
      subtitle={team.description || 'Manage team members'}
      maxWidth="max-w-2xl"
      icon={<Users className="h-5 w-5 text-white" />}
    >
      {/* Scrollable content area */}
      <div className="p-6 space-y-5">
        {/* Team Lead Section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5 text-amber-500" /> Team Lead
          </h3>
          {team.lead ? (
            <div className="p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={team.lead.username} size="sm" color="bg-amber-500" />
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-1">
                      <span className="text-sm font-semibold text-gray-900 truncate">{team.lead.username}</span>
                      <Badge variant={team.lead.role?.includes('Admin') ? 'admin' : 'lead'}>
                        {team.lead.role}
                      </Badge>
                      {(team.lead._id === currentUserId || team.lead._id?.toString() === currentUserId) && (
                        <Badge variant="you">You</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Has full control over team</p>
                  </div>
                </div>
                {canManage && potentialLeads.length > 0 && (
                  <button
                    onClick={() => setShowLeadSelector(!showLeadSelector)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    Transfer
                  </button>
                )}
              </div>

              {/* Lead transfer selector */}
              {showLeadSelector && potentialLeads.length > 0 && (
                <div className="mt-3 p-3 bg-white border border-amber-200 rounded-lg animate-[slideIn_200ms_ease-out]">
                  <p className="text-xs text-gray-600 mb-2">
                    Select a member to become the new team lead:
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={selectedNewLeadId}
                      onChange={(e) => setSelectedNewLeadId(e.target.value)}
                      className="flex-1 px-2.5 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      disabled={isProcessing}
                    >
                      <option value="">Choose new lead...</option>
                      {potentialLeads.map(m => (
                        <option key={m._id} value={m._id}>
                          {m.username} — {m.role}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleLeadSelect}
                      disabled={!selectedNewLeadId || isProcessing}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Crown className="h-3.5 w-3.5" />
                      Next
                    </button>
                  </div>
                  <button
                    onClick={() => { setShowLeadSelector(false); setSelectedNewLeadId(''); }}
                    className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 italic">
              No lead assigned
            </div>
          )}
        </div>

        {/* Members List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Members ({team.members?.length || 0})
            </h3>
            {(team.members?.length || 0) > 5 && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-6 pr-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-32"
                />
              </div>
            )}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto -mx-1 px-1">
            {filteredMembers.map(member => {
              const isLead = member._id === team.lead?._id;
              const isYou = member._id === currentUserId || member._id?.toString() === currentUserId;
              return (
                <div key={member._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={member.username} size="sm" color={isLead ? 'bg-amber-500' : undefined} />
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-1">
                        <span className="text-xs font-medium text-gray-900 truncate">{member.username}</span>
                        {isLead && <Badge variant="lead">Lead</Badge>}
                        {isYou && !isLead && <Badge variant="you">You</Badge>}
                        {!isLead && !isYou && <Badge variant="member">{member.role}</Badge>}
                      </div>
                    </div>
                  </div>
                  {canManage && !isLead && !isYou && (
                    <button
                      onClick={() => onRemoveMember(member._id)}
                      disabled={isProcessing}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                      title="Remove member"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No members found</p>
            )}
          </div>
        </div>

        {/* Add Member Section */}
        {canManage && (
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Add New Member
            </h3>
            {availableToAdd.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex-1 px-2.5 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  disabled={isProcessing}
                >
                  <option value="">Select a user...</option>
                  {availableToAdd.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.username} — {u.role}{u.department ? ` (${u.department})` : ''}
                    </option>
                  ))}
                </select>
                <SpinnerButton
                  onClick={() => { if (selectedUserId) { onAddMember(selectedUserId); setSelectedUserId(''); } }}
                  disabled={!selectedUserId}
                  loading={isProcessing}
                  className="!px-3 !py-2 !text-xs"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add
                </SpinnerButton>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">All users are already in this team</p>
            )}
          </div>
        )}

        {/* Leave Team Section (for admins who are members but not lead) */}
        {canLeaveTeam && (
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-gray-200 flex items-center justify-center">
                  <LogOut className="h-3.5 w-3.5 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900">Leave this team</p>
                  <p className="text-xs text-gray-500">You will be removed from the member list</p>
                </div>
              </div>
              <button
                onClick={() => onOpenLeaveModal()}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fixed footer */}
      <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center flex-shrink-0">
        <p className="text-xs text-gray-500 truncate">
          {canManage ? 'You can manage members and transfer lead' : 'View only — contact admin or lead for changes'}
        </p>
        <SpinnerButton variant="secondary" onClick={onClose} className="!px-3 !py-1.5 !text-xs">Close</SpinnerButton>
      </div>
    </Modal>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function TeamsTab({ currentUser, onRefresh }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  // Modal controllers
  const [activeModal, setActiveModal] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedNewLead, setSelectedNewLead] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [availableUsers, setAvailableUsers] = useState([]);

  const { toasts, addToast, dismissToast } = useToast();
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Console admin';
  const currentUserId = currentUser?.id || currentUser?._id;

  // ── API helper ──
  const apiCall = useCallback(async (url, options = {}) => {
    const isBody = options.body !== undefined;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(isBody ? { 'Content-Type': 'application/json' } : {}),
        'x-user-role': currentUser?.role,
        'x-user-id': currentUserId,
        ...options.headers,
      },
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return response;
  }, [currentUser, currentUserId]);

  // ── Data fetching ──
  useEffect(() => {
    if (!currentUser) return;
    fetchTeams();
    if (isAdmin) fetchAvailableUsers();
  }, [currentUser]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const data = await (await apiCall('/api/teams')).json();
      setTeams(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const data = await (await apiCall('/api/users')).json();
      setAvailableUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const refreshTeamDetail = async (teamId) => {
    const updated = await (await apiCall(`/api/teams/${teamId}`)).json();
    setSelectedTeam(updated);
    return updated;
  };

  // ── Modal helpers ──
  const openModal = (type, team = null) => {
    setError(null);
    if (team) {
      setSelectedTeam(team);
      if (type === 'edit') setFormData({ name: team.name, description: team.description || '' });
    }
    if (type === 'create') setFormData({ name: '', description: '' });
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedTeam(null);
    setSelectedNewLead(null);
    setFormData({ name: '', description: '' });
    setError(null);
  };

  const openTransferLeadModal = (team, newLead) => {
    setSelectedTeam(team);
    setSelectedNewLead(newLead);
    setActiveModal('transferLead');
  };

  const openLeaveTeamModal = (team) => {
    setSelectedTeam(team);
    setActiveModal('leaveTeam');
  };

  // ── Action handlers ──
  const withLoading = async (key, fn) => {
    try {
      setActionLoading(prev => ({ ...prev, [key]: true }));
      await fn();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    await withLoading('create', async () => {
      await apiCall('/api/teams', { method: 'POST', body: JSON.stringify(formData) });
      await fetchTeams();
      closeModal();
      addToast('Team created successfully');
    });
  };

  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    await withLoading('edit', async () => {
      await apiCall(`/api/teams/${selectedTeam._id}`, { method: 'PUT', body: JSON.stringify(formData) });
      await fetchTeams();
      closeModal();
      addToast('Team updated successfully');
    });
  };

  const handleDeleteTeam = async () => {
    await withLoading('delete', async () => {
      await apiCall(`/api/teams/${selectedTeam._id}`, { method: 'DELETE' });
      await fetchTeams();
      closeModal();
      addToast('Team deleted successfully');
    });
  };

  const handleAddMember = async (userId) => {
    await withLoading('memberAction', async () => {
      await apiCall(`/api/teams/${selectedTeam._id}/members`, {
        method: 'POST', body: JSON.stringify({ userId }),
      });
      await refreshTeamDetail(selectedTeam._id);
      await fetchTeams();
      addToast('Member added successfully');
    }).catch(() => addToast(error || 'Failed to add member', 'error'));
  };

  const handleRemoveMember = async (userId) => {
    await withLoading('memberAction', async () => {
      await apiCall(`/api/teams/${selectedTeam._id}/members?userId=${userId}`, { method: 'DELETE' });
      await refreshTeamDetail(selectedTeam._id);
      await fetchTeams();
      addToast('Member removed');
    }).catch(() => addToast(error || 'Failed to remove member', 'error'));
  };

  const handleTransferLead = async () => {
    if (!selectedNewLead) return;
    await withLoading('transferLead', async () => {
      await apiCall(`/api/teams/${selectedTeam._id}`, {
        method: 'PUT', body: JSON.stringify({ lead: selectedNewLead._id }),
      });
      await refreshTeamDetail(selectedTeam._id);
      await fetchTeams();
      closeModal();
      addToast(`Leadership transferred to ${selectedNewLead.username}`);
    }).catch(() => addToast(error || 'Failed to transfer lead', 'error'));
  };

  const handleLeaveTeam = async () => {
    await withLoading('leaveTeam', async () => {
      await apiCall(`/api/teams/${selectedTeam._id}/members?userId=${currentUserId}`, {
        method: 'DELETE',
        headers: { 'x-remove-self': 'true' }
      });
      await fetchTeams();
      closeModal();
      addToast('You have left the team');
    }).catch(() => addToast(error || 'Failed to leave team', 'error'));
  };

  // ── Permissions ──
  const canManageTeam = (team) => {
    if (isAdmin) return true;
    return team.lead?._id === currentUserId || team.lead?._id?.toString() === currentUserId;
  };

  const isUserTeamLead = (team) => {
    return team.lead?._id === currentUserId || team.lead?._id?.toString() === currentUserId;
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          <p className="text-sm text-gray-500">Loading teams...</p>
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <>
      {/* Inject keyframe animations */}
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-9 py-2.5 w-full rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors placeholder:text-gray-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={() => openModal('create')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" /> Create Team
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && !activeModal && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Table / Empty States */}
        {teams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No teams yet"
            description={isAdmin ? 'Get started by creating your first team.' : 'You are not part of any teams yet.'}
            action={isAdmin ? (
              <button onClick={() => openModal('create')} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="h-4 w-4" /> Create Team
              </button>
            ) : null}
          />
        ) : filteredTeams.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No results found"
            description={`No teams match "${searchTerm}". Try a different search term.`}
            action={
              <button onClick={() => setSearchTerm('')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Clear search
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50/70">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Members</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTeams.map(team => {
                  const isLead = isUserTeamLead(team);
                  return (
                  <tr key={team._id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <Avatar name={team.name} icon={Users} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{team.name}</p>
                          <p className="text-sm text-gray-500 truncate max-w-[220px]">{team.description || 'No description'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {team.lead ? (
                        <div className="flex items-center gap-2.5">
                          <Avatar name={team.lead.username} size="sm" color={isLead ? 'bg-amber-500' : undefined} />
                          <span className="text-sm text-gray-900">{team.lead.username}</span>
                          {isLead && <Badge variant="you">You</Badge>}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-700 font-medium">
                          {team.memberCount || team.members?.length || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">{formatDate(team.createdAt)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openModal('members', team)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Manage Members"
                        >
                          <Users className="h-4 w-4" />
                        </button>
                        {canManageTeam(team) && (
                          <>
                            <button
                              onClick={() => openModal('edit', team)}
                              className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit Team"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openModal('delete', team)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Team"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {activeModal === 'create' && (
        <TeamFormModal
          mode="create"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleCreateTeam}
          onClose={closeModal}
          isSubmitting={actionLoading.create}
          error={error}
        />
      )}

      {activeModal === 'edit' && selectedTeam && (
        <TeamFormModal
          mode="edit"
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleUpdateTeam}
          onClose={closeModal}
          isSubmitting={actionLoading.edit}
          error={error}
        />
      )}

      {activeModal === 'delete' && selectedTeam && (
        <DeleteConfirmModal
          teamName={selectedTeam.name}
          onConfirm={handleDeleteTeam}
          onClose={closeModal}
          isDeleting={actionLoading.delete}
        />
      )}

      {activeModal === 'members' && selectedTeam && (
        <MembersModal
          team={selectedTeam}
          currentUser={currentUser}
          isAdmin={isAdmin}
          canManage={canManageTeam(selectedTeam)}
          availableUsers={availableUsers}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          onChangeLead={handleTransferLead}
          onLeaveTeam={handleLeaveTeam}
          onClose={closeModal}
          isProcessing={actionLoading.memberAction}
          onSelectNewLead={(newLead) => openTransferLeadModal(selectedTeam, newLead)}
          onOpenLeaveModal={() => openLeaveTeamModal(selectedTeam)}
        />
      )}

      {activeModal === 'transferLead' && selectedTeam && selectedNewLead && (
        <TransferLeadModal
          team={selectedTeam}
          selectedNewLead={selectedNewLead}
          onConfirm={handleTransferLead}
          onClose={() => {
            setActiveModal('members');
            setSelectedNewLead(null);
          }}
          isProcessing={actionLoading.transferLead}
        />
      )}

      {activeModal === 'leaveTeam' && selectedTeam && (
        <LeaveTeamModal
          team={selectedTeam}
          currentUser={currentUser}
          isTeamLead={isUserTeamLead(selectedTeam)}
          onConfirm={handleLeaveTeam}
          onClose={closeModal}
          isProcessing={actionLoading.leaveTeam}
        />
      )}
    </>
  );
}