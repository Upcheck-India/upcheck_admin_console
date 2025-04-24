import { useState } from 'react';
import { X, Music, Video, ChevronRight, Sparkles, Star, Zap, Code } from 'lucide-react';

const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
      active
        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {children}
  </button>
);

const FeatureCard = ({ feature, accent }) => (
  <div className={`relative overflow-hidden bg-gradient-to-br from-${accent}-50 to-white rounded-xl p-5 border border-${accent}-100 hover:shadow-lg transition-all duration-300 group`}>
    <div className="flex items-start gap-4">
      <div className={`p-3 rounded-lg bg-${accent}-100 text-${accent}-600`}>
        {feature.icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          {feature.title}
          {feature.status && (
            <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full 
              ${feature.status === '✨ Updated' ? 'bg-green-100 text-green-700' : 
                feature.status === '🛠️ In Development' ? 'bg-blue-100 text-blue-700' :
                'bg-purple-100 text-purple-700'}`}>
              {feature.status}
            </span>
          )}
        </h3>
        <p className="mt-2 text-gray-600 text-sm leading-relaxed">
          {feature.description}
        </p>
      </div>
    </div>
    {feature.details && (
      <div className="mt-4 pl-16">
        <ul className="space-y-2">
          {feature.details.map((detail, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
              <ChevronRight className="w-4 h-4 text-gray-400" />
              {detail}
            </li>
          ))}
        </ul>
      </div>
    )}
    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-${accent}-200 to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-full transform translate-x-16 -translate-y-8`} />
  </div>
);

export default function WhatsNew({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('whats-new');

  if (!isOpen) return null;

  const currentFeatures = [
    {
      title: 'Better optimization',
      icon: <Zap className="w-5 h-5" />,
      description: 'Now Jovan is less likely to get into an error with processing',
      details: [
        'Optimized performance',
        'Quicker responses',
        'Error handling and retry mechanism',
      ],
      status: '✨ Updated'
    },
    {
      title: 'Enhanced Code-Gen',
      icon: <Code className="w-5 h-5" />,
      description: 'Better syntax highlighting and intelligent code suggestions across multiple programming languages.',
      details: [
        'Expanded language support',
        'Smarter code completion',
        'Code generation with a new look',
      ],
      status: '✨ Updated'
    },
    {
      title: 'Smart Context System',
      icon: <Star className="w-5 h-5" />,
      description: 'Advanced context retention for more relevant and personalized responses.',
      details: [
        'Conversation memory',
        'Personalized suggestions',
        'Contextual understanding'
      ],
      status: '✨ Updated'
    }
  ];

  const upcomingFeatures = [
    {
      title: 'Music Integration',
      icon: <Music className="w-5 h-5" />,
      description: 'Stream and manage music directly in your conversations.',
      details: [
        'Integrated music player',
        'Direct song streaming',
        'Music recommendations',
        'Download capabilities'
      ],
      status: '🛠️ In Development'
    },
    {
      title: 'Video Playback',
      icon: <Video className="w-5 h-5" />,
      description: 'Watch and control videos without leaving the chat interface.',
      details: [
        'Embedded video player',
        'Video control',
        'Smart Search',
        'Picture-in-picture mode',
      ],
      status: '🕑 Coming Soon'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl relative overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Sparkles className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Version 1.4
                </h2>
                <p className="text-sm text-gray-500">
                  Discover the latest features and upcoming improvements
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          <div className="flex space-x-4 mt-6">
            <TabButton
              active={activeTab === 'whats-new'}
              onClick={() => setActiveTab('whats-new')}
            >
              What's new
            </TabButton>
            <TabButton
              active={activeTab === 'coming-soon'}
              onClick={() => setActiveTab('coming-soon')}
            >
              What's next
            </TabButton>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
          <div className="space-y-6">
            {(activeTab === 'whats-new' ? currentFeatures : upcomingFeatures).map((feature, index) => (
              <FeatureCard
                key={index}
                feature={feature}
                accent={activeTab === 'whats-new' ? 'blue' : 'purple'}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-100">
          <p className="text-sm text-center bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 bg-clip-text text-transparent font-medium">
          Stay tuned for more updates!
          </p>
        </div>
      </div>
    </div>
  );
}