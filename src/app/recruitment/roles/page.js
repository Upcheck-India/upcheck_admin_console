'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, X, Trash } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import ErrorMessage from '../components/ErrorMessage';
import LoadingState from '../components/LoadingState';
import QuestionEditor from '../components/QuestionEditor';

export default function RolesManagement() {
  const [roles, setRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    isActive: false,
    questions: []
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { isLoading, isAuthenticated, hasPermission } = useAuth(true, 'recruitment.manage');

  useEffect(() => {
    if (isAuthenticated && hasPermission) {
      fetchRoles();
    }
  }, [isAuthenticated, hasPermission]);

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/recruitment/roles');
      if (!res.ok) throw new Error('Failed to fetch roles');
      const data = await res.json();
      setRoles(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (role) => {
    try {
      const res = await fetch(`/api/recruitment/roles/${role.id}`);
      if (!res.ok) throw new Error('Failed to fetch role details');
      const data = await res.json();
      
      setFormData({
        id: data.id,
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        questions: data.questions || []
      });
      setEditingRole(role);
      setIsModalOpen(true);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/recruitment/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }

      await fetchRoles();
      setIsModalOpen(false);
      setEditingRole(null);
      setFormData({
        id: '',
        name: '',
        description: '',
        isActive: false,
        questions: []
      });
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDelete = async (roleId) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const res = await fetch('/api/recruitment/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: roleId })
      });

      if (!res.ok) throw new Error('Failed to delete role');
      await fetchRoles();
    } catch (error) {
      setError(error.message);
    }
  };

  if (isLoading || loading) {
    return <LoadingState />;
  }

  if (!isAuthenticated || !hasPermission) {
    return <div>Unauthorized access</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Recruitment Roles
          </h1>
          <button
            onClick={() => {
              setEditingRole(null);
              setFormData({
                id: '',
                name: '',
                description: '',
                isActive: false,
                questions: []
              });
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Role
          </button>
        </div>

        <ErrorMessage message={error} onClose={() => setError('')} />

        <div className="bg-white shadow rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Questions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{role.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md">{role.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{role.questionCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        role.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {role.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleEdit(role)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        <Pencil className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(role.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingRole ? 'Edit Role' : 'Add New Role'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {editingRole ? 'Modify the role details and questions' : 'Create a new recruitment role'}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Role ID
                    </label>
                    <input
                      type="text"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      required
                      disabled={!!editingRole}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., content, technical, marketing"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Role Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Content Management"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="3"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Brief description of the role..."
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                      Active
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      Questions
                    </label>
                    <QuestionEditor
                      questions={formData.questions}
                      onChange={(questions) => setFormData({ ...formData, questions })}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium mb-2">Questions</h3>
                  <div className="space-y-4">
                    {formData.questions.map((q, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Question {index + 1}</span>
                          <div className="space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                const newQuestions = [...formData.questions];
                                newQuestions.splice(index, 1);
                                setFormData({ ...formData, questions: newQuestions });
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => {
                            const newQuestions = [...formData.questions];
                            newQuestions[index].text = e.target.value;
                            setFormData({ ...formData, questions: newQuestions });
                          }}
                          className="w-full border rounded p-2 mb-2"
                          placeholder="Question text"
                        />
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const newQuestions = [...formData.questions];
                            newQuestions[index].type = e.target.value;
                            setFormData({ ...formData, questions: newQuestions });
                          }}
                          className="w-full border rounded p-2 mb-2"
                        >
                          <option value="text">Text Answer</option>
                          <option value="multiple">Multiple Choice</option>
                        </select>
                        {q.type === 'multiple' ? (
                          <div className="space-y-2">
                            {q.options.map((opt, optIndex) => (
                              <div key={optIndex} className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const newQuestions = [...formData.questions];
                                    newQuestions[index].options[optIndex] = e.target.value;
                                    setFormData({ ...formData, questions: newQuestions });
                                  }}
                                  className="flex-1 border rounded p-2"
                                  placeholder={`Option ${optIndex + 1}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newQuestions = [...formData.questions];
                                    newQuestions[index].options.splice(optIndex, 1);
                                    setFormData({ ...formData, questions: newQuestions });
                                  }}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const newQuestions = [...formData.questions];
                                newQuestions[index].options.push('');
                                setFormData({ ...formData, questions: newQuestions });
                              }}
                              className="text-sm text-blue-500 hover:text-blue-700"
                            >
                              Add Option
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          questions: [...formData.questions, {
                            text: '',
                            type: 'text',
                            options: []
                          }]
                        });
                      }}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 text-gray-500 hover:text-gray-700"
                    >
                      Add Question
                    </button>
                  </div>
                </div>

                <div className="mt-5 sm:mt-6">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {editingRole ? 'Save Changes' : 'Create Role'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}