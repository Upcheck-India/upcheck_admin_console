'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import TextQuestion from './QuestionTypes/TextQuestion';
import McqQuestion from './QuestionTypes/McqQuestion';
import SingleQuestion from './QuestionTypes/SingleQuestion';

export default function QuestionBuilder({ initialQuestions = [], onChange }) {
  // Initialize state only once on component mount
  const [questions, setQuestions] = useState(() => initialQuestions);
  const [showAddMenu, setShowAddMenu] = useState(false);
  
  // No useEffect hooks to avoid circular dependencies

  const addQuestion = (type) => {
    const newQuestion = {
      id: `q_${Date.now()}`,
      type,
      text: '',
      required: true,
      points: 10
    };

    // Add type-specific properties
    if (type === 'mcq') {
      newQuestion.options = [
        { id: `opt_${Date.now()}_1`, text: '' },
        { id: `opt_${Date.now()}_2`, text: '' }
      ];
      newQuestion.correctOptions = [];
    } else if (type === 'single') {
      newQuestion.options = [
        { id: `opt_${Date.now()}_1`, text: '' },
        { id: `opt_${Date.now()}_2`, text: '' }
      ];
      newQuestion.correctOption = null;
    } else if (type === 'text') {
      newQuestion.maxLength = 1000;
    }

    const updatedQuestions = [...questions, newQuestion];
    setQuestions(updatedQuestions);
    onChange(updatedQuestions); // Directly notify parent of change
    setShowAddMenu(false);
  };

  const updateQuestion = (updatedQuestion) => {
    const updatedQuestions = questions.map(q => 
      q.id === updatedQuestion.id ? updatedQuestion : q
    );
    setQuestions(updatedQuestions);
    onChange(updatedQuestions); // Directly notify parent of change
  };

  const deleteQuestion = (questionId) => {
    const updatedQuestions = questions.filter(q => q.id !== questionId);
    setQuestions(updatedQuestions);
    onChange(updatedQuestions); // Directly notify parent of change
  };

  const renderQuestionComponent = (question, index) => {
    const props = {
      question,
      onChange: updateQuestion,
      onDelete: deleteQuestion,
      index
    };

    switch (question.type) {
      case 'text':
        return <TextQuestion key={question.id} {...props} />;
      case 'mcq':
        return <McqQuestion key={question.id} {...props} />;
      case 'single':
        return <SingleQuestion key={question.id} {...props} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Test Questions</h3>
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center"
            >
              <Plus size={16} className="mr-1" />
              Add Question
            </button>
            
            {showAddMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                <div className="py-1">
                  <button
                    onClick={() => addQuestion('text')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Text Answer Question
                  </button>
                  <button
                    onClick={() => addQuestion('mcq')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Multiple Choice Question
                  </button>
                  <button
                    onClick={() => addQuestion('single')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Single Choice Question
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {questions.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <p className="text-gray-500">No questions added yet. Click "Add Question" to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question, index) => renderQuestionComponent(question, index))}
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-center">
        <div>
          <span className="text-sm text-gray-500">{questions.length} question(s) added</span>
        </div>
        <div>
          <span className="text-sm text-gray-500">
            Total points: {questions.reduce((total, q) => total + (q.points || 0), 0)}
          </span>
        </div>
      </div>
    </div>
  );
}
