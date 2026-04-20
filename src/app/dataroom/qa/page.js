'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import SecureLoading from '../../components/SecureLoading';
import DataRoomNav from '../../components/dataroom/DataRoomNav';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, MessageSquare, Send, CheckCircle } from 'lucide-react';

export default function QAPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [questions, setQuestions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [formData, setFormData] = useState({
    question: '',
    documentId: null
  });

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [selectedRoom]);

  async function fetchRooms() {
    try {
      const response = await fetch('/api/dataroom/rooms');
      if (response.ok) {
        const data = await response.json();
        const roomsList = data.items || data.rooms || [];
        setRooms(roomsList);
        if (roomsList.length > 0 && !selectedRoom) {
          setSelectedRoom(roomsList[0]._id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  }

  async function fetchQuestions() {
    try {
      let url = '/api/dataroom/qa';
      if (selectedRoom) {
        url += `?roomId=${selectedRoom}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.items || data.questions || []);
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  }

  async function handleSubmit() {
    if (!selectedRoom) {
      alert('Please select a room first');
      return;
    }
    try {
      const response = await fetch('/api/dataroom/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          roomId: selectedRoom,
          isPrivate: false
        }),
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({ question: '', documentId: null });
        fetchQuestions();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to submit question');
      }
    } catch (error) {
      console.error('Failed to submit question:', error);
    }
  }

  function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  if (authLoading) {
    return <SecureLoading />;
  }

  if (!isAuthenticated) {
    return null;
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
                  <h1 className="text-xl font-bold text-slate-900">Q&A Center</h1>
                  <p className="text-sm text-slate-500">Ask questions and get answers</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                >
                  <option value="" disabled>Select a Room...</option>
                  {rooms.map(room => (
                    <option key={room._id} value={room._id}>{room.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowModal(true)}
                  disabled={!selectedRoom}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ask Question</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!selectedRoom ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Select a Room</h3>
              <p className="text-slate-500 mb-4">You need to select a data room to view and ask questions.</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No questions yet</h3>
              <p className="text-slate-500 mb-4">Be the first to ask a question in this room</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q._id} className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-3 flex-1">
                      <MessageSquare className="w-5 h-5 text-blue-600 mt-1" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 mb-1">{q.question}</p>
                        <div className="flex items-center space-x-3 text-xs text-slate-500">
                          <span>{q.submittedBy?.email || q.submittedBy?.username || 'Unknown'}</span>
                          <span>•</span>
                          <span>{formatDate(q.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${q.status === 'answered' || q.status === 'published' ? 'bg-green-100 text-green-700' :
                        q.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                      }`}>
                      {q.status}
                    </span>
                  </div>

                  {q.answer && (
                    <div className="mt-4 pl-8 border-l-2 border-blue-200 bg-blue-50 p-4 rounded-r-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-slate-700">Answer</span>
                      </div>
                      <p className="text-sm text-slate-700">{q.answer}</p>
                      {q.answeredBy && (
                        <p className="text-xs text-slate-500 mt-2">
                          Answered by {q.answeredBy?.name || q.answeredBy?.email || 'admin'} on {formatDate(q.answeredAt)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Ask a Question</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Your Question</label>
                  <textarea
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    placeholder="Enter your question here..."
                    rows="6"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
                <button onClick={handleSubmit} disabled={!formData.question.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2">
                  <Send className="w-4 h-4" />
                  <span>Submit Question</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
