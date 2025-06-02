'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export default function TextQuestion({ question, onChange, onDelete, index }) {
  // Initialize state only once with the provided question or default values
  // We don't need to track changes to the question prop after initial render
  const [localQuestion, setLocalQuestion] = useState(() => question || {
    id: `q_${Date.now()}`,
    type: 'text',
    text: '',
    required: true,
    maxLength: 1000,
    points: 10
  });

  // No useEffect hooks to avoid circular dependencies
  
  const handleChange = (field, value) => {
    const updatedQuestion = { ...localQuestion, [field]: value };
    setLocalQuestion(updatedQuestion);
    onChange(updatedQuestion);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center">
          <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full mr-2">
            Text Answer
          </span>
          <span className="text-gray-500 text-sm">Question {index + 1}</span>
        </div>
        <button 
          onClick={() => onDelete(localQuestion.id)}
          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
          aria-label="Delete question"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor={`question-${localQuestion.id}`} className="block text-sm font-medium text-gray-700 mb-1">
            Question Text
          </label>
          <textarea
            id={`question-${localQuestion.id}`}
            value={localQuestion.text}
            onChange={(e) => handleChange('text', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your question here..."
            rows="2"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor={`required-${localQuestion.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Required
            </label>
            <select
              id={`required-${localQuestion.id}`}
              value={localQuestion.required ? 'yes' : 'no'}
              onChange={(e) => handleChange('required', e.target.value === 'yes')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div>
            <label htmlFor={`maxLength-${localQuestion.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Max Length (characters)
            </label>
            <input
              type="number"
              id={`maxLength-${localQuestion.id}`}
              value={localQuestion.maxLength}
              onChange={(e) => handleChange('maxLength', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="10000"
            />
          </div>

          <div>
            <label htmlFor={`points-${localQuestion.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Points
            </label>
            <input
              type="number"
              id={`points-${localQuestion.id}`}
              value={localQuestion.points}
              onChange={(e) => handleChange('points', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              max="100"
            />
          </div>
        </div>

        <div>
          <label htmlFor={`hint-${localQuestion.id}`} className="block text-sm font-medium text-gray-700 mb-1">
            Hint (Optional)
          </label>
          <input
            type="text"
            id={`hint-${localQuestion.id}`}
            value={localQuestion.hint || ''}
            onChange={(e) => handleChange('hint', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add a hint for the candidate..."
          />
        </div>
      </div>
    </div>
  );
}
