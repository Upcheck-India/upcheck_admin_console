import { X, Calendar, DollarSign, Building2, User, Mail, FileText, Tag, Paperclip, ListChecks } from 'lucide-react';
import { formatBusinessDate } from '../../../../lib/finance/dates';

// Static class strings (dynamic `bg-${...}` templates are purged by Tailwind).
const MILESTONE_CHIP = {
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
};

function isMilestoneOverdue(m) {
  if (!m || m.status === 'done' || !m.dueDate) return false;
  const due = new Date(m.dueDate);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

export default function GrantApplicationDetails({ application, onClose, statusOptions }) {
  if (!application) return null;

  const statusDef = statusOptions.find(s => s.value === application.status) || statusOptions[0];
  const Icon = statusDef.icon;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-start justify-between shrink-0">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{application.programName}</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border ${statusDef.badgeClass}`}>
                <Icon className="w-4 h-4" />
                {statusDef.label}
              </span>
              {/* Unified received-to-org state (the legacy `transferred` flag is
                  folded into receivedToOrg by the API, so one badge suffices). */}
              {application.receivedToOrg && (
                <span className="text-sm px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Received to Organization
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Amount Section */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 mb-6 border border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-700 mb-2">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm font-medium">Grant Amount</span>
            </div>
            <div className="text-3xl font-bold text-emerald-900">
              ₹{(application.amount || 0).toLocaleString('en-IN')}
            </div>
          </div>

          {/* Organization Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <Building2 className="w-4 h-4" />
                <span className="text-sm font-semibold">Organization Details</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-slate-500">Funding Organization</div>
                  <div className="font-medium text-slate-900">{application.organizationName}</div>
                </div>
                {application.category && (
                  <div>
                    <div className="text-xs text-slate-500">Category</div>
                    <div className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded bg-slate-100 text-slate-700">
                      <Tag className="w-3 h-3" />
                      {application.category}
                    </div>
                  </div>
                )}
                {application.fundingPeriod && (
                  <div>
                    <div className="text-xs text-slate-500">Funding Period</div>
                    <div className="font-medium text-slate-900">{application.fundingPeriod}</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-semibold">Important Dates</span>
              </div>
              <div className="space-y-2">
                {/* formatBusinessDate renders the stored calendar date in IST —
                    a plain toLocaleDateString shifted the day for IST users. */}
                {application.applicationDate && (
                  <div>
                    <div className="text-xs text-slate-500">Application Date</div>
                    <div className="font-medium text-slate-900">
                      {formatBusinessDate(application.applicationDate)}
                    </div>
                  </div>
                )}
                {application.deadline && (
                  <div>
                    <div className="text-xs text-slate-500">Deadline</div>
                    <div className="font-medium text-slate-900">
                      {formatBusinessDate(application.deadline)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          {(application.contactPerson || application.contactEmail) && (
            <div className="mb-6">
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <User className="w-4 h-4" />
                <span className="text-sm font-semibold">Contact Information</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                {application.contactPerson && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{application.contactPerson}</span>
                  </div>
                )}
                {application.contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <a href={`mailto:${application.contactEmail}`} className="text-indigo-600 hover:underline">
                      {application.contactEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attachments */}
          {(application.attachments || []).length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <Paperclip className="w-4 h-4" />
                <span className="text-sm font-semibold">Attachments</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                {application.attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline truncate"
                    >
                      {a.name || a.url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones / reporting requirements */}
          {(application.milestones || []).length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <ListChecks className="w-4 h-4" />
                <span className="text-sm font-semibold">Milestones &amp; Reporting</span>
              </div>
              <div className="space-y-2">
                {application.milestones.map((m, i) => {
                  const overdue = isMilestoneOverdue(m);
                  const chip = m.status === 'done' ? MILESTONE_CHIP.done : overdue ? MILESTONE_CHIP.overdue : MILESTONE_CHIP.pending;
                  return (
                    <div key={i} className={`rounded-lg border p-3 ${overdue ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${overdue ? 'text-red-700' : 'text-slate-900'}`}>{m.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${chip}`}>
                          {m.status === 'done' ? 'Done' : overdue ? 'Overdue' : 'Pending'}
                        </span>
                        {m.dueDate && (
                          <span className={`text-xs ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
                            Due {formatBusinessDate(m.dueDate)}
                          </span>
                        )}
                        {m.status === 'done' && m.doneAt && (
                          <span className="text-xs text-emerald-600">Completed {formatBusinessDate(m.doneAt)}</span>
                        )}
                      </div>
                      {m.notes && <div className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{m.notes}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {application.notes && (
            <div className="mb-6">
              <div className="flex items-center gap-2 text-slate-600 mb-3">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-semibold">Notes</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-slate-700 whitespace-pre-wrap">
                {application.notes}
              </div>
            </div>
          )}

          {/* Audit Info */}
          <div className="border-t pt-4">
            <div className="text-xs text-slate-500 space-y-1">
              {application.createdAt && (
                <div>
                  Created: {new Date(application.createdAt).toLocaleString('en-IN')}
                  {application.createdBy?.username && ` by ${application.createdBy.username}`}
                </div>
              )}
              {application.updatedAt && (
                <div>
                  Last updated: {new Date(application.updatedAt).toLocaleString('en-IN')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
