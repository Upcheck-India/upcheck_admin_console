'use client';

import { useState } from 'react';
import { Trash2, Plus, X } from 'lucide-react';

export default function SingleQuestion({ question, onChange, onDelete, index }) {
  // Initialize state only once with the provided question or default values
  // We don't need to track changes to the question prop after initial render
  const [localQuestion, setLocalQuestion] = useState(() => question || {
    id: `q_${Date.now()}`,
    type: 'single',
    text: '',
    options: [
      { id: `opt_${Date.now()}_1`, text: '' },
      { id: `opt_${Date.now()}_2`, text: '' },
    ],
    correctOption: null,
    required: true,
    points: 10
  });

  // No useEffect hooks to avoid circular dependencies

  const handleChange = (field, value) => {
    const updatedQuestion = { ...localQuestion, [field]: value };
    setLocalQuestion(updatedQuestion);
    onChange(updatedQuestion);
  };

  const handleOptionChange = (optionId, value) => {
    const updatedOptions = localQuestion.options.map(option => 
      option.id === optionId ? { ...option, text: value } : option
    );
    handleChange('options', updatedOptions);
  };

  const handleCorrectOptionSelect = (optionId) => {
    handleChange('correctOption', optionId);
  };

  const addOption = () => {
    const newOption = { id: `opt_${Date.now()}`, text: '' };
    handleChange('options', [...localQuestion.options, newOption]);
  };

  const removeOption = (optionId) => {
    if (localQuestion.options.length <= 2) {
      alert('A single choice question must have at least 2 options.');
      return;
    }
    
    const updatedOptions = localQuestion.options.filter(option => option.id !== optionId);
    let updatedCorrectOption = localQuestion.correctOption;
    
    // If we're removing the correct option, reset it
    if (localQuestion.correctOption === optionId) {
      updatedCorrectOption = null;
    }
    
    setLocalQuestion(prev => ({
      ...prev,
      options: updatedOptions,
      correctOption: updatedCorrectOption
    }));
    
    onChange({
      ...localQuestion,
      options: updatedOptions,
      correctOption: updatedCorrectOption
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center">
          <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full mr-2">
            Single Choice
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

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Options (select the correct answer)
            </label>
            <button 
              type="button" 
              onClick={addOption}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Plus size={16} className="mr-1" />
              Add Option
            </button>
          </div>
          
          <div className="space-y-2">
            {localQuestion.options.map((option) => (
              <div key={option.id} className="flex items-center">
                <input
                  type="radio"
                  id={`option-${option.id}`}
                  name={`question-${localQuestion.id}-options`}
                  checked={localQuestion.correctOption === option.id}
                  onChange={() => handleCorrectOptionSelect(option.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mr-2"
                />
                <input
                  type="text"
                  value={option.text}
                  onChange={(e) => handleOptionChange(option.id, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Option text"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => removeOption(option.id)}
                  className="ml-2 p-1 text-gray-400 hover:text-red-600"
                  aria-label="Remove option"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          
          {!localQuestion.correctOption && (
            <p className="text-sm text-red-500 mt-1">
              Please select the correct answer.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
