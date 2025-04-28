import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

export default function QuestionEditor({ questions = [], onChange }) {
  const [editingIndex, setEditingIndex] = useState(null);

  const handleAddQuestion = () => {
    const newQuestion = {
      id: Date.now().toString(),
      text: '',
      type: 'text',
      required: true,
      options: [],
      points: 10
    };
    onChange([...questions, newQuestion]);
    setEditingIndex(questions.length);
  };

  const handleDeleteQuestion = (index) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    onChange(newQuestions);
    setEditingIndex(null);
  };

  const handleMoveQuestion = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) {
      return;
    }

    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newQuestions[index];
    newQuestions[index] = newQuestions[newIndex];
    newQuestions[newIndex] = temp;
    onChange(newQuestions);
    setEditingIndex(newIndex);
  };

  const handleUpdateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index] = {
      ...newQuestions[index],
      [field]: value
    };
    onChange(newQuestions);
  };

  const handleAddOption = (index) => {
    const newQuestions = [...questions];
    if (!newQuestions[index].options) {
      newQuestions[index].options = [];
    }
    newQuestions[index].options.push({
      id: Date.now().toString(),
      text: '',
      isCorrect: false
    });
    onChange(newQuestions);
  };

  const handleUpdateOption = (questionIndex, optionIndex, field, value) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex] = {
      ...newQuestions[questionIndex].options[optionIndex],
      [field]: value
    };

    // For multiple choice, only one option can be correct
    if (field === 'isCorrect' && value === true && questions[questionIndex].type === 'multiple') {
      newQuestions[questionIndex].options.forEach((option, idx) => {
        if (idx !== optionIndex) {
          option.isCorrect = false;
        }
      });
    }

    onChange(newQuestions);
  };

  const handleDeleteOption = (questionIndex, optionIndex) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options.splice(optionIndex, 1);
    onChange(newQuestions);
  };

  return (
    <div className="space-y-6">
      {questions.map((question, index) => (
        <div
          key={question.id}
          className={`p-4 border rounded-lg ${
            editingIndex === index ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question Text
                </label>
                <textarea
                  value={question.text}
                  onChange={(e) => handleUpdateQuestion(index, 'text', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  rows="2"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={question.type}
                    onChange={(e) => handleUpdateQuestion(index, 'type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="text">Text</option>
                    <option value="multiple">Multiple Choice</option>
                    <option value="checkbox">Multiple Select</option>
                    <option value="code">Code</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={question.points}
                    onChange={(e) => handleUpdateQuestion(index, 'points', parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(e) => handleUpdateQuestion(index, 'required', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Required</span>
                  </label>
                </div>
              </div>

              {(question.type === 'multiple' || question.type === 'checkbox') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Options
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddOption(index)}
                      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option
                    </button>
                  </div>

                  <div className="space-y-2">
                    {question.options?.map((option, optionIndex) => (
                      <div key={option.id} className="flex items-center space-x-2">
                        <input
                          type={question.type === 'multiple' ? 'radio' : 'checkbox'}
                          name={`question-${question.id}`}
                          checked={option.isCorrect}
                          onChange={(e) => handleUpdateOption(index, optionIndex, 'isCorrect', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <input
                          type="text"
                          value={option.text}
                          onChange={(e) => handleUpdateOption(index, optionIndex, 'text', e.target.value)}
                          placeholder="Option text"
                          className="flex-1 px-3 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteOption(index, optionIndex)}
                          className="p-1 text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="ml-4 flex flex-col space-y-2">
              <button
                type="button"
                onClick={() => handleMoveQuestion(index, 'up')}
                disabled={index === 0}
                className={`p-1 ${
                  index === 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditingIndex(index)}
                className="p-1 text-blue-600 hover:text-blue-900"
              >
                <span className="sr-only">Edit</span>
                {editingIndex === index ? '✓' : '✎'}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteQuestion(index)}
                className="p-1 text-red-600 hover:text-red-900"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveQuestion(index, 'down')}
                disabled={index === questions.length - 1}
                className={`p-1 ${
                  index === questions.length - 1
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={handleAddQuestion}
        className="w-full flex justify-center items-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Plus className="h-5 w-5 mr-2" />
        Add Question
      </button>
    </div>
  );
}