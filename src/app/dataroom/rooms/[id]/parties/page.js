'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../../../hooks/useAuth';
import SecureLoading from '../../../../components/SecureLoading';
import { ArrowLeft, Plus, Users, Trash2, Edit } from 'lucide-react';

export default function PartiesPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id;
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'bidder',
    description: '',
    members: []
  });

  useEffect(() => {
    fetchParties();
  }, [roomId]);

  if (authLoading) {
    return <SecureLoading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  async function fetchParties() {
    try {
      const response = await fetch(`/api/dataroom/rooms/${roomId}/parties`);
      if (response.ok) {
        const data = await response.json();
        setParties(data.parties || []);
      }
    } catch (error) {
      console.error('Failed to fetch parties:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    try {
      const response = await fetch(`/api/dataroom/rooms/${roomId}/parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({ name: '', type: 'bidder', description: '', members: [] });
        fetchParties();
      }
    } catch (error) {
      console.error('Failed to create party:', error);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push(`/dataroom/rooms/${roomId}`)} className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Party Management</h1>
                <p className="text-sm text-slate-500">Manage bidder groups and parties</p>
              </div>
            </div>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Add Party</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : parties.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No parties yet</h3>
            <p className="text-slate-500 mb-4">Create party groups to isolate bidder activity</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {parties.map((party) => (
              <div key={party._id} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${party.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {party.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{party.name}</h3>
                <p className="text-xs text-slate-500 mb-3">{party.type}</p>
                <p className="text-sm text-slate-600 mb-4">{party.description || 'No description'}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{party.statistics?.totalMembers || 0} members</span>
                  <span className="text-slate-600">{party.statistics?.documentsViewed || 0} docs viewed</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Party Group</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Party Name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              >
                <option value="bidder">Bidder</option>
                <option value="investor">Investor</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="auditor">Auditor</option>
              </select>
              <textarea
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="3"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
              <button onClick={handleCreate} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
