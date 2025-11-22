'use client';

import { useState, useEffect, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, Clock, Repeat, AlertCircle } from 'lucide-react';
import { validateRecurrencePattern, generateOccurrences, getPatternDescription } from '../../lib/recurrence';

const RecurrencePatternSelector = ({ 
  value = null, 
  onChange, 
  startDate = new Date(),
  error = null 
}) => {
  const [pattern, setPattern] = useState(value || {
    type: 'weekly',
    interval: 1,
    daysOfWeek: [1], // Monday by default
    endCondition: {
      type: 'never'
    }
  });

  const [previewOccurrences, setPreviewOccurrences] = useState([]);
  const [validationError, setValidationError] = useState(null);

  // Update parent when pattern changes
  useEffect(() => {
    const validation = validateRecurrencePattern(pattern);
    if (validation.isValid) {
      setValidationError(null);
      onChange?.(pattern);
      
      // Generate preview occurrences
      try {
        const occurrences = generateOccurrences(pattern, startDate, 5);
        setPreviewOccurrences(occurrences);
      } catch (err) {
        setPreviewOccurrences([]);
      }
    } else {
      setValidationError(validation.errors[0]);
      setPreviewOccurrences([]);
    }
  }, [pattern, startDate, onChange]);

  const updatePattern = useCallback((updates) => {
    setPattern(prev => ({ ...prev, ...updates }));
  }, []);

  const updateEndCondition = useCallback((updates) => {
    setPattern(prev => ({
      ...prev,
      endCondition: { ...prev.endCondition, ...updates }
    }));
  }, []);

  const handleTypeChange = (newType) => {
    const basePattern = {
      type: newType,
      interval: 1,
      endCondition: pattern.endCondition
    };

    switch (newType) {
      case 'daily':
        updatePattern(basePattern);
        break;
      case 'weekly':
        updatePattern({
          ...basePattern,
          daysOfWeek: [new Date(startDate).getDay()]
        });
        break;
      case 'monthly':
        updatePattern({
          ...basePattern,
          dayOfMonth: new Date(startDate).getDate()
        });
        break;
      case 'custom':
        updatePattern(basePattern);
        break;
    }
  };

  const toggleDayOfWeek = (day) => {
    const currentDays = pattern.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();
    
    if (newDays.length > 0) {
      updatePattern({ daysOfWeek: newDays });
    }
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-6">
      {/* Pattern Type Selection */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Recurrence Pattern
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'custom', label: 'Custom' }
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTypeChange(value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                pattern.type === value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Interval Setting */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Every</label>
        <input
          type="number"
          min="1"
          max="99"
          value={pattern.interval}
          onChange={(e) => updatePattern({ interval: parseInt(e.target.value) || 1 })}
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <span className="text-sm text-gray-700">
          {pattern.type === 'daily' && (pattern.interval === 1 ? 'day' : 'days')}
          {pattern.type === 'weekly' && (pattern.interval === 1 ? 'week' : 'weeks')}
          {pattern.type === 'monthly' && (pattern.interval === 1 ? 'month' : 'months')}
          {pattern.type === 'custom' && (pattern.interval === 1 ? 'day' : 'days')}
        </span>
      </div>

      {/* Weekly Pattern - Days of Week */}
      {pattern.type === 'weekly' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            On these days
          </label>
          <div className="flex space-x-2">
            {dayNames.map((day, index) => (
              <button
                key={index}
                type="button"
                onClick={() => toggleDayOfWeek(index)}
                className={`w-12 h-12 text-sm font-medium rounded-full border transition-colors ${
                  pattern.daysOfWeek?.includes(index)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Pattern Options */}
      {pattern.type === 'monthly' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Monthly Options
          </label>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="radio"
                name="monthlyType"
                checked={pattern.dayOfMonth !== undefined}
                onChange={() => updatePattern({ 
                  dayOfMonth: new Date(startDate).getDate(),
                  weekOfMonth: undefined,
                  dayOfWeek: undefined
                })}
                className="mr-3 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">On day</span>
              <input
                type="number"
                min="1"
                max="31"
                value={pattern.dayOfMonth || new Date(startDate).getDate()}
                onChange={(e) => updatePattern({ 
                  dayOfMonth: parseInt(e.target.value) || 1,
                  weekOfMonth: undefined,
                  dayOfWeek: undefined
                })}
                className="ml-2 w-16 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700">of each month</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="radio"
                name="monthlyType"
                checked={pattern.weekOfMonth !== undefined}
                onChange={() => updatePattern({ 
                  dayOfMonth: undefined,
                  weekOfMonth: 1,
                  dayOfWeek: new Date(startDate).getDay()
                })}
                className="mr-3 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">On the</span>
              <select
                value={pattern.weekOfMonth || 1}
                onChange={(e) => updatePattern({ 
                  dayOfMonth: undefined,
                  weekOfMonth: parseInt(e.target.value),
                  dayOfWeek: pattern.dayOfWeek || new Date(startDate).getDay()
                })}
                className="ml-2 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={1}>first</option>
                <option value={2}>second</option>
                <option value={3}>third</option>
                <option value={4}>fourth</option>
                <option value={-1}>last</option>
              </select>
              <select
                value={pattern.dayOfWeek || new Date(startDate).getDay()}
                onChange={(e) => updatePattern({ 
                  dayOfMonth: undefined,
                  weekOfMonth: pattern.weekOfMonth || 1,
                  dayOfWeek: parseInt(e.target.value)
                })}
                className="ml-2 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {dayNames.map((day, index) => (
                  <option key={index} value={index}>{day}</option>
                ))}
              </select>
              <span className="ml-2 text-sm text-gray-700">of each month</span>
            </label>
          </div>
        </div>
      )}

      {/* End Condition */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          End Condition
        </label>
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="radio"
              name="endCondition"
              checked={pattern.endCondition.type === 'never'}
              onChange={() => updateEndCondition({ type: 'never' })}
              className="mr-3 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Never ends</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="radio"
              name="endCondition"
              checked={pattern.endCondition.type === 'date'}
              onChange={() => updateEndCondition({ 
                type: 'date',
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
              })}
              className="mr-3 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">End on</span>
            <DatePicker
              selected={pattern.endCondition.endDate}
              onChange={(date) => updateEndCondition({ 
                type: 'date',
                endDate: date
              })}
              minDate={new Date()}
              className="ml-2 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              dateFormat="MMM d, yyyy"
              placeholderText="Select end date"
            />
          </label>
          
          <label className="flex items-center">
            <input
              type="radio"
              name="endCondition"
              checked={pattern.endCondition.type === 'count'}
              onChange={() => updateEndCondition({ 
                type: 'count',
                occurrenceCount: 10
              })}
              className="mr-3 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">After</span>
            <input
              type="number"
              min="1"
              max="999"
              value={pattern.endCondition.occurrenceCount || 10}
              onChange={(e) => updateEndCondition({ 
                type: 'count',
                occurrenceCount: parseInt(e.target.value) || 1
              })}
              className="ml-2 w-20 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700">occurrences</span>
          </label>
        </div>
      </div>

      {/* Pattern Preview */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <Repeat className="w-4 h-4 text-gray-600 mr-2" />
          <h4 className="text-sm font-medium text-gray-900">Pattern Preview</h4>
        </div>
        
        {validationError ? (
          <div className="flex items-center text-sm text-red-600">
            <AlertCircle className="w-4 h-4 mr-2" />
            {validationError}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              {getPatternDescription(pattern)}
            </p>
            
            {previewOccurrences.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Next few meetings:</p>
                <div className="space-y-1">
                  {previewOccurrences.map((date, index) => (
                    <div key={index} className="flex items-center text-xs text-gray-600">
                      <Calendar className="w-3 h-3 mr-2" />
                      {date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  );
};

export default RecurrencePatternSelector;