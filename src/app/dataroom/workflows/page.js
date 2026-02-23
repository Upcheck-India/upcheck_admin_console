'use client';

import { useState, useEffect } from 'react';
import DataRoomNav from '../../components/dataroom/DataRoomNav';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, GitBranch, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'sequential',
    steps: [{ approverEmail: '', order: 1 }],
    resourceType: 'document',
    resourceId: ''
  });

  useEffect(() => {
    fetchWorkflows();
  }, []);

  async function fetchWorkflows() {
    try {
      const response = await fetch('/api/dataroom/workflows');
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data.workflows || []);
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    }
  }

  async function handleCreate() {
    try {
      const response = await fetch('/api/dataroom/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({ name: '', type: 'sequential', steps: [{ approverEmail: '', order: 1 }], resourceType: 'document', resourceId: '' });
        fetchWorkflows();
      }
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  }

  async function handleApprove(workflowId, stepId) {
    try {
      const response = await fetch(`/api/dataroom/workflows/${workflowId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
      });

      if (response.ok) {
        fetchWorkflows();
      }
    } catch (error) {
      console.error('Failed to approve workflow:', error);
    }
  }

  function addStep() {
    setFormData({
      ...formData,
      steps: [...formData.steps, { approverEmail: '', order: formData.steps.length + 1 }]
    });
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <DataRoomNav />
      <div className="flex-1 ml-64">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dataroom')} className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Approval Workflows</h1>
                <p className="text-sm text-slate-500">Manage document approval processes</p>
              </div>
            </div>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>New Workflow</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {workflows.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <GitBranch className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No workflows</h3>
            <p className="text-slate-500">Create approval workflows for your documents</p>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <div key={workflow._id} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <GitBranch className="w-5 h-5 text-blue-600 mt-1" />
                    <div>
                      <h3 className="font-semibold text-slate-900">{workflow.name}</h3>
                      <p className="text-sm text-slate-500">{workflow.type} workflow</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    workflow.status === 'completed' ? 'bg-green-100 text-green-700' :
                    workflow.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    workflow.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {workflow.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">Progress</span>
                    <span className="font-medium text-slate-900">{workflow.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${workflow.progress || 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Approval Steps */}
                <div className="space-y-2">
                  {workflow.steps?.map((step, index) => (
                    <div key={step._id || index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          step.status === 'approved' ? 'bg-green-100' :
                          step.status === 'rejected' ? 'bg-red-100' :
                          step.status === 'pending' ? 'bg-blue-100' :
                          'bg-slate-200'
                        }`}>
                          {step.status === 'approved' ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                           step.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-600" /> :
                           <Clock className="w-4 h-4 text-slate-600" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            Step {step.order}: {step.approverEmail}
                          </p>
                          {step.approvedAt && (
                            <p className="text-xs text-slate-500">
                              Approved on {formatDate(step.approvedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                      {step.status === 'pending' && workflow.status === 'in_progress' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApprove(workflow._id, step._id)}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Approval Workflow</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Workflow Name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              >
                <option value="sequential">Sequential (one after another)</option>
                <option value="parallel">Parallel (all at once)</option>
              </select>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Approval Steps</label>
                  <button onClick={addStep} className="text-sm text-blue-600 hover:underline">+ Add Step</button>
                </div>
                {formData.steps.map((step, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <span className="text-sm text-slate-600 w-16">Step {index + 1}</span>
                    <input
                      type="email"
                      placeholder="Approver email"
                      value={step.approverEmail}
                      onChange={(e) => {
                        const newSteps = [...formData.steps];
                        newSteps[index].approverEmail = e.target.value;
                        setFormData({...formData, steps: newSteps});
                      }}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
          </div>
          <div className="flex space-x-3 mt-6">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
            <button onClick={handleCreate} disabled={!formData.name.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create Workflow</button>
          </div>
        </div>
      </div>
      <div className="absolute left-0 top-0 h-screen w-64 bg-white border-r border-slate-200">
        <nav className="py-6">
          <ul>
            <li className="py-2 px-4 hover:bg-slate-100">
              <a href="#" className="text-slate-600">Dashboard</a>
            </li>
            <li className="py-2 px-4 hover:bg-slate-100">
              <a href="#" className="text-slate-600">Workflows</a>
            </li>
            <li className="py-2 px-4 hover:bg-slate-100">
              <a href="#" className="text-slate-600">Documents</a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
