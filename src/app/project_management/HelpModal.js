'use client';
import React, { useState } from 'react';
import { X, HelpCircle, Workflow, Users, GitBranch, MessageCircle, ChevronDown, ChevronRight } from 'lucide-react';

const HelpModal = ({ open, onClose }) => {
  const [activeTab, setActiveTab] = useState('guide');
  const [expandedFaq, setExpandedFaq] = useState(null);

  if (!open) return null;

  const faqs = [
    {
      id: 1,
      question: "What is a Product Backlog?",
      answer: "The Product Backlog is a centralized space where all future planned tasks are stored. It serves as your project's repository of ideas, features, and requirements. You can organize tasks here before moving them to specific sprints for execution."
    },
    {
      id: 2,
      question: "How many sprints can I have?",
      answer: "You can create as many sprints as needed for your project. However, it's recommended to plan them carefully - typically 1-4 week iterations work best. By default, you'll start with no sprints, but you can easily add your first sprint to get started."
    },
    {
      id: 3,
      question: "What is a Sprint?",
      answer: "A Sprint is a planned set of tasks that your team commits to completing within a specific timeframe (usually 1-4 weeks). It's a focused work cycle that helps teams deliver value incrementally and maintain a steady development pace."
    },
    {
      id: 4,
      question: "How many people can I assign to a task?",
      answer: "You can assign as many team members as needed to a single task. Each task also has one reporter - the person responsible for reporting progress and updates on that specific task."
    },
    {
      id: 5,
      question: "What types of tasks can I create?",
      answer: "You can create four types of tasks: Bug (fixing issues), Feature (new functionality), Chore (maintenance work), and Epic (large features broken down into smaller tasks)."
    },
    {
      id: 6,
      question: "Can I move tasks between sprints?",
      answer: "Yes! You can easily move tasks between the Product Backlog and active sprints, or between different sprints using drag & drop functionality. This flexibility helps you adapt to changing priorities."
    },
    {
      id: 7,
      question: "What happens when a sprint is completed?",
      answer: "When a sprint is completed, you can archive it to keep your workspace clean. Completed tasks remain in the system for tracking purposes, and you can create new sprints for upcoming work."
    },
    {
      id: 8,
      question: "How do I track task progress?",
      answer: "Tasks move through four stages: Backlog (not started), To Do (ready to work), In Progress (actively being worked on), and Done (completed). Simply drag tasks between columns to update their status."
    }
  ];

  const toggleFaq = (faqId) => {
    setExpandedFaq(expandedFaq === faqId ? null : faqId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-fade-in">
      <div className="relative bg-white max-w-2xl w-full p-6 rounded-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <HelpCircle className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Project Management Help</h2>
          </div>
          <button onClick={onClose} aria-label="Close help" className="text-gray-500 hover:text-gray-800 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'guide' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Workflow className="h-4 w-4 inline mr-2" />
            Quick Guide
          </button>
          <button
            onClick={() => setActiveTab('faqs')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'faqs' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <MessageCircle className="h-4 w-4 inline mr-2" />
            FAQs
          </button>
        </div>

        {/* Content */}
        <div className="text-sm text-gray-700 leading-relaxed">
          {activeTab === 'guide' && (
            <div className="space-y-6">
              <section>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Workflow className="h-4 w-4 mr-2 text-blue-600"/> 
                  Boards, Sprints & Tasks
                </h3>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                  <p className="text-blue-800"><strong>Quick Tip:</strong> Think of the Product Backlog as your project's wishlist, and Sprints as your focused work periods!</p>
                </div>
                <ul className="list-disc ml-5 space-y-2">
                  <li>Switch between <b>Product Backlog</b> and individual <b>Sprints</b> using the tabs at the top of the board.</li>
                  <li>Create or edit tasks by clicking the <b>+ New Task</b> button or the edit icon on a task card.</li>
                  <li><b>Drag & drop</b> tasks across columns to update their status (Backlog, To Do, In Progress, Done).</li>
                  <li>Click the <b>eye</b> icon on a task card to open a detailed, read-only view of the task.</li>
                  <li>Use <b>task types</b> (Bug, Feature, Chore, Epic) to categorize your work effectively.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Users className="h-4 w-4 mr-2 text-blue-600"/> 
                  Roles & Permissions
                </h3>
                <ul className="list-disc ml-5 space-y-2">
                  <li><b>Super Manager</b> – Complete control over the project, members, and settings. Only one per project.</li>
                  <li><b>Project Manager</b> – Manage tasks, sprints, and team members. Can have multiple per project.</li>
                  <li><b>Contributor</b> – View boards and update assigned tasks. Can have unlimited contributors.</li>
                  <li>Interface elements automatically adjust based on your role and permissions.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <GitBranch className="h-4 w-4 mr-2 text-blue-600"/> 
                  GitHub Integration
                </h3>
                <ul className="list-disc ml-5 space-y-2">
                  <li>Project managers can link <b>public or private</b> GitHub repositories from Project Settings.</li>
                  <li>Linked repositories appear under the project title for quick access.</li>
                  <li><i>Coming soon:</i> Advanced branch & PR tracking, automatic commit linking.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <HelpCircle className="h-4 w-4 mr-2 text-blue-600"/> 
                  Roadmap & Coming Soon
                </h3>
                <ul className="list-disc ml-5 space-y-2">
                  <li>AI assistance for sprint planning and automatic task suggestions.</li>
                  <li>Integrated daily stand-up calls and online meetings.</li>
                  <li>Advanced analytics & task tracking dashboards.</li>
                  <li>Time tracking and burndown charts for sprints.</li>
                  <li>Custom workflow automation and integrations.</li>
                </ul>
              </section>
            </div>
          )}

          {activeTab === 'faqs' && (
            <div className="space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <p className="text-gray-600 text-sm">
                  <strong>Need more help?</strong> These frequently asked questions should help you get started. 
                  If you can't find what you're looking for, contact your project administrator.
                </p>
              </div>
              
              {faqs.map((faq) => (
                <div key={faq.id} className="border border-gray-200 rounded-lg">
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-900">{faq.question}</span>
                    {expandedFaq === faq.id ? (
                      <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    )}
                  </button>
                  {expandedFaq === faq.id && (
                    <div className="px-4 pb-4 text-gray-600 border-t border-gray-100">
                      <p className="pt-3">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            Need more help? Contact your project administrator.
          </div>
          <button 
            onClick={onClose} 
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;