import { X, Calendar, DollarSign, Building2, User, Mail, FileText, Tag } from 'lucide-react';

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
              <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-${statusDef.color}-50 text-${statusDef.color}-700 border border-${statusDef.color}-200`}>
                <Icon className="w-4 h-4" />
                {statusDef.label}
              </span>
              {application.receivedToOrg && (
                <span className="text-sm px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Received to Organization
                </span>
              )}
              {application.transferred && (
                <span className="text-sm px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  Transferred
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
              ₹{application.amount.toLocaleString()}
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
                {application.applicationDate && (
                  <div>
                    <div className="text-xs text-slate-500">Application Date</div>
                    <div className="font-medium text-slate-900">
                      {new Date(application.applicationDate).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                )}
                {application.deadline && (
                  <div>
                    <div className="text-xs text-slate-500">Deadline</div>
                    <div className="font-medium text-slate-900">
                      {new Date(application.deadline).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
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
