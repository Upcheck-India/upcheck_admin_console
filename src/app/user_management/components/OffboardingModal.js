'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Pause, Play, UserPlus, X, Loader2, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

const DEPARTMENTS = [
  'Development',
  'Testing',
  'QA',
  'Design',
  'Product',
  'Sales',
  'Content',
  'Marketing',
  'Operations',
  'HR',
  'Finance',
  'Unassigned',
];

const getTodayString = () => new Date().toISOString().split('T')[0];

const ACTION_CONFIG = {
  terminate: {
    label: 'Terminate / Offboard',
    description: 'Remove system access and record as alumni',
    icon: AlertTriangle,
    color: 'red',
    buttonLabel: 'Confirm Termination',
  },
  suspend: {
    label: 'Suspend',
    description: 'Temporarily suspend access',
    icon: Pause,
    color: 'yellow',
    buttonLabel: 'Suspend Employee',
  },
  reinstate: {
    label: 'Reinstate',
    description: 'Restore active status',
    icon: Play,
    color: 'green',
    buttonLabel: 'Reinstate Employee',
  },
  rehire: {
    label: 'Re-hire',
    description: 'Bring back as active employee',
    icon: UserPlus,
    color: 'blue',
    buttonLabel: 'Re-hire Employee',
  },
};

const colorClasses = {
  red: {
    border: 'border-red-500',
    bg: 'bg-red-50',
    hoverBorder: 'hover:border-red-400',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    dot: 'bg-red-500',
    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    text: 'text-red-700',
  },
  yellow: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-50',
    hoverBorder: 'hover:border-yellow-400',
    iconBg: 'bg-yellow-100',
    iconText: 'text-yellow-600',
    dot: 'bg-yellow-500',
    button: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400',
    text: 'text-yellow-700',
  },
  green: {
    border: 'border-green-500',
    bg: 'bg-green-50',
    hoverBorder: 'hover:border-green-400',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
    dot: 'bg-green-500',
    button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    text: 'text-green-700',
  },
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    hoverBorder: 'hover:border-blue-400',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    dot: 'bg-blue-500',
    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    text: 'text-blue-700',
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionCard({ actionKey, config, selected, onClick }) {
  const Icon = config.icon;
  const c = colorClasses[config.color];

  return (
    <button
      type="button"
      onClick={() => onClick(actionKey)}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150
        ${selected
          ? `${c.border} ${c.bg}`
          : `border-gray-200 bg-white ${c.hoverBorder} hover:bg-gray-50`
        }`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${c.iconBg}`}>
        <Icon size={20} className={c.iconText} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
          <span className={`font-semibold text-sm ${selected ? c.text : 'text-gray-800'}`}>
            {config.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 pl-4">{config.description}</p>
      </div>
      {selected && (
        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${c.dot}`}>
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

function FormLabel({ children }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${className}`}
      {...props}
    />
  );
}

function Textarea({ className = '', ...props }) {
  return (
    <textarea
      rows={3}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none ${className}`}
      {...props}
    />
  );
}

function Select({ children, className = '', ...props }) {
  return (
    <select
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function CheckboxRow({ id, checked, onChange, label, description }) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
      />
      <div>
        <span className="block text-sm font-medium text-gray-700">{label}</span>
        {description && (
          <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
        )}
      </div>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Action-specific form sections
// ---------------------------------------------------------------------------

function TerminateForm({ fields, onChange }) {
  return (
    <div className="space-y-4">
      {/* System access warning */}
      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-red-700 font-medium">
          ⚠️ System login access will be immediately revoked.
        </p>
      </div>

      {/* Exit Date */}
      <div>
        <FormLabel>
          Exit Date <span className="text-red-500">*</span>
        </FormLabel>
        <Input
          type="date"
          value={fields.exitDate}
          onChange={(e) => onChange('exitDate', e.target.value)}
          required
        />
      </div>

      {/* Exit Type */}
      <div>
        <FormLabel>
          Exit Type <span className="text-red-500">*</span>
        </FormLabel>
        <Select
          value={fields.exitType}
          onChange={(e) => onChange('exitType', e.target.value)}
          required
        >
          <option value="">— Select exit type —</option>
          <option value="resigned">Resigned</option>
          <option value="terminated">Terminated</option>
          <option value="contract_end">Contract End</option>
          <option value="internship_end">Internship End</option>
          <option value="retired">Retired</option>
        </Select>
      </div>

      {/* Exit Reason */}
      <div>
        <FormLabel>
          Exit Reason{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </FormLabel>
        <Textarea
          value={fields.exitReason}
          onChange={(e) => onChange('exitReason', e.target.value)}
          placeholder="Brief reason for exit..."
        />
      </div>

      {/* Re-hire eligibility */}
      <div className="space-y-3">
        <CheckboxRow
          id="reHireEligible"
          checked={fields.reHireEligible}
          onChange={(e) => onChange('reHireEligible', e.target.checked)}
          label="Eligible for re-hire"
          description="Mark this person as eligible to be rehired in the future"
        />
        {fields.reHireEligible && (
          <div className="pl-2">
            <FormLabel>
              Re-hire Notes{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </FormLabel>
            <Input
              type="text"
              value={fields.reHireNotes}
              onChange={(e) => onChange('reHireNotes', e.target.value)}
              placeholder="Any notes about future re-hire eligibility..."
            />
          </div>
        )}
      </div>

      {/* Email notification */}
      <div className="space-y-3">
        <CheckboxRow
          id="terminateSendEmail"
          checked={fields.sendEmail}
          onChange={(e) => onChange('sendEmail', e.target.checked)}
          label="Send exit notification email"
          description="Automatically email the employee about their exit"
        />
        {fields.sendEmail && (
          <div className="pl-2">
            <FormLabel>
              Custom Email Message{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </FormLabel>
            <Textarea
              value={fields.emailMessage}
              onChange={(e) => onChange('emailMessage', e.target.value)}
              placeholder="Personalize the exit email message..."
              rows={3}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SuspendForm({ fields, onChange }) {
  return (
    <div className="space-y-4">
      {/* Suspend Reason */}
      <div>
        <FormLabel>
          Suspension Reason <span className="text-red-500">*</span>
        </FormLabel>
        <Textarea
          value={fields.suspendReason}
          onChange={(e) => onChange('suspendReason', e.target.value)}
          placeholder="Describe the reason for suspension..."
          required
        />
      </div>

      {/* Expected Return Date */}
      <div>
        <FormLabel>
          Expected Return Date{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </FormLabel>
        <Input
          type="date"
          value={fields.expectedReturnDate}
          onChange={(e) => onChange('expectedReturnDate', e.target.value)}
          min={getTodayString()}
        />
      </div>

      {/* Email */}
      <CheckboxRow
        id="suspendSendEmail"
        checked={fields.sendEmail}
        onChange={(e) => onChange('sendEmail', e.target.checked)}
        label="Notify employee via email"
        description="Send an email to the employee about their suspension"
      />
    </div>
  );
}

function ReinstateForm({ fields, onChange }) {
  return (
    <div className="space-y-4">
      {/* Reinstate Note */}
      <div>
        <FormLabel>
          Reinstatement Notes{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </FormLabel>
        <Textarea
          value={fields.reinstateNote}
          onChange={(e) => onChange('reinstateNote', e.target.value)}
          placeholder="Notes about reinstatement..."
        />
      </div>

      {/* Email */}
      <CheckboxRow
        id="reinstateSendEmail"
        checked={fields.sendEmail}
        onChange={(e) => onChange('sendEmail', e.target.checked)}
        label="Send welcome back email"
        description="Notify the employee that their access has been restored"
      />
    </div>
  );
}

function RehireForm({ fields, onChange }) {
  return (
    <div className="space-y-4">
      {/* New Job Title */}
      <div>
        <FormLabel>
          New Job Title{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </FormLabel>
        <Input
          type="text"
          value={fields.newJobTitle}
          onChange={(e) => onChange('newJobTitle', e.target.value)}
          placeholder="e.g. Senior Developer"
        />
      </div>

      {/* New Department */}
      <div>
        <FormLabel>
          Department{' '}
          <span className="text-gray-400 font-normal">(optional)</span>
        </FormLabel>
        <Select
          value={fields.newDepartment}
          onChange={(e) => onChange('newDepartment', e.target.value)}
        >
          <option value="">— Same as before / Unassigned —</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>

      {/* New Join Date */}
      <div>
        <FormLabel>
          Re-join Date <span className="text-red-500">*</span>
        </FormLabel>
        <Input
          type="date"
          value={fields.newJoinDate}
          onChange={(e) => onChange('newJoinDate', e.target.value)}
          required
        />
      </div>

      {/* Email */}
      <CheckboxRow
        id="rehireSendEmail"
        checked={fields.sendEmail}
        onChange={(e) => onChange('sendEmail', e.target.checked)}
        label="Send welcome back email"
        description="Send the employee a welcome back notification"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default field state builders
// ---------------------------------------------------------------------------

const buildDefaultFields = () => ({
  terminate: {
    exitDate: getTodayString(),
    exitType: '',
    exitReason: '',
    reHireEligible: true,
    reHireNotes: '',
    sendEmail: true,
    emailMessage: '',
  },
  suspend: {
    suspendReason: '',
    expectedReturnDate: '',
    sendEmail: false,
  },
  reinstate: {
    reinstateNote: '',
    sendEmail: true,
  },
  rehire: {
    newJobTitle: '',
    newDepartment: '',
    newJoinDate: getTodayString(),
    sendEmail: true,
  },
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function OffboardingModal({
  isOpen,
  onClose,
  onSuccess,
  person,
  currentUser,
}) {
  const [selectedAction, setSelectedAction] = useState(null);
  const [fields, setFields] = useState(buildDefaultFields());
  const [loading, setLoading] = useState(false);

  // Reset state when modal opens or person changes
  useEffect(() => {
    if (isOpen) {
      setSelectedAction(null);
      setFields(buildDefaultFields());
      setLoading(false);
    }
  }, [isOpen, person?._id]);

  if (!isOpen || !person) return null;

  const personStatus = person.status;

  // Determine which actions are available for this person
  const availableActions = ['terminate', 'suspend'];
  if (personStatus === 'suspended') availableActions.push('reinstate');
  if (personStatus === 'alumni') availableActions.push('rehire');

  const handleFieldChange = (action, key, value) => {
    setFields((prev) => ({
      ...prev,
      [action]: { ...prev[action], [key]: value },
    }));
  };

  const makeFieldChanger = (action) => (key, value) =>
    handleFieldChange(action, key, value);

  // Client-side validation before submit
  const validate = () => {
    const f = fields[selectedAction];
    if (selectedAction === 'terminate') {
      if (!f.exitDate) {
        toast.error('Exit date is required.');
        return false;
      }
      if (!f.exitType) {
        toast.error('Exit type is required.');
        return false;
      }
    }
    if (selectedAction === 'suspend') {
      if (!f.suspendReason?.trim()) {
        toast.error('Suspension reason is required.');
        return false;
      }
    }
    if (selectedAction === 'rehire') {
      if (!f.newJoinDate) {
        toast.error('Re-join date is required.');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAction) {
      toast.error('Please select an action first.');
      return;
    }
    if (!validate()) return;

    setLoading(true);

    try {
      const f = fields[selectedAction];
      let body = {};

      if (selectedAction === 'terminate') {
        body = {
          status: 'alumni',
          exitDate: f.exitDate,
          exitType: f.exitType,
          exitReason: f.exitReason,
          reHireEligible: f.reHireEligible,
          reHireNotes: f.reHireNotes,
          sendEmail: f.sendEmail,
          emailMessage: f.emailMessage,
          addTimelineEvent: {
            event: 'exit',
            description: `${f.exitType}: ${f.exitReason || 'No reason provided'}`,
          },
        };
      } else if (selectedAction === 'suspend') {
        body = {
          status: 'suspended',
          suspendReason: f.suspendReason,
          expectedReturnDate: f.expectedReturnDate || null,
          sendEmail: f.sendEmail,
          addTimelineEvent: {
            event: 'suspended',
            description: f.suspendReason,
          },
        };
      } else if (selectedAction === 'reinstate') {
        body = {
          status: 'active',
          reinstateNote: f.reinstateNote,
          sendEmail: f.sendEmail,
          addTimelineEvent: {
            event: 'reinstated',
            description: f.reinstateNote || 'Reinstated to active',
          },
        };
      } else if (selectedAction === 'rehire') {
        body = {
          status: 'active',
          exitDate: null,
          exitType: null,
          exitReason: null,
          joinDate: f.newJoinDate,
          ...(f.newJobTitle && { jobTitle: f.newJobTitle }),
          ...(f.newDepartment && { department: f.newDepartment }),
          sendEmail: f.sendEmail,
          addTimelineEvent: {
            event: 're-hired',
            description: `Re-hired as ${f.newJobTitle || 'employee'}`,
          },
        };
      }

      // Primary API call — update people record
      const res = await fetch(`/api/people/${person._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || `Server error: ${res.status}`);
      }

      const updatedData = await res.json();

      // Revoke system access for termination if systemUserId exists
      if (selectedAction === 'terminate' && person.systemUserId) {
        try {
          await fetch(`/api/users/${person.systemUserId}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'x-user-role': currentUser?.role || '',
            },
          });
        } catch (revokeErr) {
          console.warn('Failed to revoke system access:', revokeErr);
          toast('Note: Could not revoke system access automatically.', {
            icon: '⚠️',
          });
        }
      }

      const successMessages = {
        terminate: 'Employee successfully offboarded.',
        suspend: 'Employee suspended.',
        reinstate: 'Employee reinstated to active.',
        rehire: 'Employee re-hired successfully.',
      };

      toast.success(successMessages[selectedAction]);
      onSuccess?.(updatedData);
      onClose?.();
    } catch (err) {
      console.error('Offboarding action failed:', err);
      toast.error(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const actionCfg = selectedAction ? ACTION_CONFIG[selectedAction] : null;
  const submitBtnColor = actionCfg
    ? colorClasses[actionCfg.color].button
    : 'bg-gray-300 cursor-not-allowed';

  const personDisplayName = [person.firstName, person.lastName]
    .filter(Boolean)
    .join(' ') || person.name || 'Employee';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="offboarding-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Fixed Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2
              id="offboarding-modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              Employee Status Change
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {personDisplayName}
              {person.jobTitle ? ` · ${person.jobTitle}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close modal"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body + Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Action Selection */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Select Action
              </h3>
              <div className="space-y-2">
                {availableActions.map((key) => (
                  <ActionCard
                    key={key}
                    actionKey={key}
                    config={ACTION_CONFIG[key]}
                    selected={selectedAction === key}
                    onClick={setSelectedAction}
                  />
                ))}
              </div>
            </div>

            {/* Dynamic Form Section */}
            {selectedAction && (
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  {ACTION_CONFIG[selectedAction].label} Details
                </h3>

                {selectedAction === 'terminate' && (
                  <TerminateForm
                    fields={fields.terminate}
                    onChange={makeFieldChanger('terminate')}
                  />
                )}
                {selectedAction === 'suspend' && (
                  <SuspendForm
                    fields={fields.suspend}
                    onChange={makeFieldChanger('suspend')}
                  />
                )}
                {selectedAction === 'reinstate' && (
                  <ReinstateForm
                    fields={fields.reinstate}
                    onChange={makeFieldChanger('reinstate')}
                  />
                )}
                {selectedAction === 'rehire' && (
                  <RehireForm
                    fields={fields.rehire}
                    onChange={makeFieldChanger('rehire')}
                  />
                )}
              </div>
            )}

            {/* Email indicator */}
            {selectedAction && (
              <div className="flex items-center gap-2 text-xs text-gray-400 pb-1">
                <Mail size={13} />
                <span>
                  {fields[selectedAction]?.sendEmail
                    ? 'An email notification will be sent.'
                    : 'No email notification will be sent.'}
                </span>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedAction}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${submitBtnColor}`}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing…
                </>
              ) : (
                actionCfg?.buttonLabel || 'Select an action'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
