'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Heart,
  Target,
  Users,
  Rocket,
  CheckCircle,
  Building2,
  Code,
  Lightbulb,
  GraduationCap,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  FileText,
  MessageSquare,
  ClipboardList,
  Briefcase,
  ChevronRight,
  SkipForward,
  PartyPopper,
  Star,
  Zap,
  Globe,
  BookOpen,
  Coffee
} from 'lucide-react';

// Onboarding steps configuration
const ONBOARDING_STEPS = [
  { id: 'welcome', title: 'Welcome', icon: Sparkles },
  { id: 'about', title: 'About Us', icon: Building2 },
  { id: 'values', title: 'Our Values', icon: Heart },
  { id: 'profile', title: 'Your Profile', icon: Users },
  { id: 'background', title: 'Background', icon: GraduationCap },
  { id: 'skills', title: 'Skills & Interests', icon: Code },
  { id: 'goals', title: 'Goals', icon: Target },
  { id: 'availability', title: 'Availability', icon: Calendar },
  { id: 'walkthrough', title: 'Getting Started', icon: Rocket },
  { id: 'complete', title: 'All Set!', icon: PartyPopper }
];

// Skill options for multi-select
const SKILL_OPTIONS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'React', 'Next.js', 'Node.js',
  'MongoDB', 'SQL', 'AWS', 'Docker', 'Git', 'HTML/CSS', 'Tailwind', 'GraphQL',
  'Machine Learning', 'Data Analysis', 'UI/UX Design', 'Mobile Development',
  'DevOps', 'Testing', 'Technical Writing', 'Project Management'
];

// Interest areas
const INTEREST_AREAS = [
  'Frontend Development', 'Backend Development', 'Full Stack', 'Mobile Apps',
  'Data Science', 'Machine Learning', 'DevOps', 'Cloud Computing',
  'UI/UX Design', 'Product Management', 'Research', 'Documentation',
  'Quality Assurance', 'Security', 'Open Source', 'Startups'
];

export default function InternOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [existingData, setExistingData] = useState({});
  const [onboardingData, setOnboardingData] = useState(null);
  const [isIntern, setIsIntern] = useState(false);

  // Form responses
  const [responses, setResponses] = useState({
    // Profile section (may be pre-filled)
    firstName: '',
    lastName: '',
    phone: '',
    location: '',
    linkedinProfile: '',
    alternateEmail: '',
    bio: '',
    
    // Background section
    education: '',
    educationLevel: '',
    major: '',
    graduationYear: '',
    previousExperience: '',
    
    // Skills section
    skills: [],
    interests: [],
    programmingLanguages: '',
    projectsWorkedOn: '',
    
    // Goals section
    learningGoals: '',
    careerGoals: '',
    whatExcitesYou: '',
    preferredWorkStyle: '',
    
    // Availability section
    availableHoursPerWeek: '',
    timezone: '',
    preferredCommunication: '',
    startDate: '',
    
    // Additional
    howDidYouHear: '',
    expectations: '',
    questions: ''
  });

  useEffect(() => {
    fetchOnboardingStatus();
  }, []);

  const fetchOnboardingStatus = async () => {
    try {
      const res = await fetch('/api/onboarding/intern');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch onboarding status');
      }

      const data = await res.json();
      setExistingData(data.existingData || {});
      setIsIntern(data.isIntern);

      // If not an intern, redirect to console
      if (!data.isIntern) {
        router.push('/console');
        return;
      }

      // If onboarding is complete, redirect to console
      if (data.isComplete) {
        router.push('/console');
        return;
      }

      // Pre-fill with existing data
      if (data.existingData) {
        setResponses(prev => ({
          ...prev,
          firstName: data.existingData.firstName || '',
          lastName: data.existingData.lastName || '',
          phone: data.existingData.phone || '',
          location: data.existingData.location || '',
          linkedinProfile: data.existingData.linkedinProfile || '',
          bio: data.existingData.bio || ''
        }));
      }

      // Restore previous progress
      if (data.onboarding) {
        setOnboardingData(data.onboarding);
        setCurrentStep(data.onboarding.currentStep || 0);
        if (data.onboarding.responses) {
          setResponses(prev => ({ ...prev, ...data.onboarding.responses }));
        }
      }

    } catch (error) {
      console.error('Error fetching onboarding status:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async (step, skipToEnd = false) => {
    try {
      setSaving(true);
      const res = await fetch('/api/onboarding/intern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStep: step,
          responses,
          status: skipToEnd ? 'skipped' : 'in_progress',
          skipped: skipToEnd
        })
      });

      if (!res.ok) throw new Error('Failed to save progress');
      
    } catch (error) {
      console.error('Error saving progress:', error);
    } finally {
      setSaving(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      setSaving(true);
      
      // Prepare profile updates
      const profileUpdates = {
        firstName: responses.firstName,
        lastName: responses.lastName,
        phone: responses.phone,
        location: responses.location,
        linkedinProfile: responses.linkedinProfile,
        bio: responses.bio,
        alternateEmail: responses.alternateEmail
      };

      const res = await fetch('/api/onboarding/intern', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses,
          profileUpdates
        })
      });

      if (!res.ok) throw new Error('Failed to complete onboarding');

      // Redirect to console
      router.push('/console?onboarding=complete');

    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveProgress(nextStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    await saveProgress(currentStep, true);
    router.push('/console?onboarding=skipped');
  };

  const handleInputChange = (field, value) => {
    setResponses(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field, item) => {
    setResponses(prev => {
      const current = prev[field] || [];
      const updated = current.includes(item)
        ? current.filter(i => i !== item)
        : [...current, item];
      return { ...prev, [field]: updated };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/80">Loading your onboarding...</p>
        </div>
      </div>
    );
  }

  // Render step content
  const renderStepContent = () => {
    switch (ONBOARDING_STEPS[currentStep].id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6 animate-fadeIn">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">
              Welcome to Upcheck, {existingData.firstName || existingData.username || 'Future Star'}! 🎉
            </h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              We're absolutely thrilled to have you join our team as an intern. 
              This is the beginning of an exciting journey!
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-xl mx-auto">
              <p className="text-white/90">
                In the next few minutes, we'll introduce you to our company, learn a bit about you, 
                and show you around the dashboard. Let's make this fun!
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-4">
              <Star className="w-6 h-6 text-yellow-400 animate-pulse" />
              <Star className="w-6 h-6 text-yellow-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <Star className="w-6 h-6 text-yellow-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-8">
              <Building2 className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white">About Upcheck</h2>
              <p className="text-white/70 mt-2">Get to know us better</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <Globe className="w-10 h-10 text-emerald-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Our Mission</h3>
                <p className="text-white/80">
                  We're building innovative solutions that make a real difference. 
                  Our goal is to empower organizations with cutting-edge technology 
                  while fostering a culture of learning and growth.
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <Users className="w-10 h-10 text-purple-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Our Team</h3>
                <p className="text-white/80">
                  We're a diverse team of passionate individuals who believe in 
                  collaboration, creativity, and continuous improvement. Everyone's 
                  voice matters here!
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <Lightbulb className="w-10 h-10 text-yellow-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Innovation First</h3>
                <p className="text-white/80">
                  We encourage experimentation and aren't afraid to try new things. 
                  Your fresh perspective as an intern is incredibly valuable to us!
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
                <Coffee className="w-10 h-10 text-orange-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Work Culture</h3>
                <p className="text-white/80">
                  We believe in work-life balance, open communication, and having 
                  fun while we build great things together. Welcome to the family!
                </p>
              </div>
            </div>
          </div>
        );

      case 'values':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-8">
              <Heart className="w-16 h-16 text-pink-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white">Our Core Values</h2>
              <p className="text-white/70 mt-2">What drives us every day</p>
            </div>
            
            <div className="space-y-4 max-w-2xl mx-auto">
              {[
                { icon: Zap, title: 'Excellence', desc: 'We strive for the best in everything we do', color: 'text-yellow-400' },
                { icon: Users, title: 'Collaboration', desc: 'Together we achieve more than we could alone', color: 'text-blue-400' },
                { icon: BookOpen, title: 'Continuous Learning', desc: 'We never stop growing and improving', color: 'text-green-400' },
                { icon: Heart, title: 'Empathy', desc: 'We care about our team, users, and community', color: 'text-pink-400' },
                { icon: Target, title: 'Integrity', desc: 'We do the right thing, even when no one is watching', color: 'text-purple-400' }
              ].map((value, idx) => (
                <div key={idx} className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-5">
                  <value.icon className={`w-8 h-8 ${value.color} flex-shrink-0`} />
                  <div>
                    <h3 className="text-lg font-semibold text-white">{value.title}</h3>
                    <p className="text-white/70">{value.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-8">
              <Users className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white">Let's Complete Your Profile</h2>
              <p className="text-white/70 mt-2">Help us know you better</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 mb-2">First Name</label>
                  <input
                    type="text"
                    value={responses.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Your first name"
                  />
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={responses.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Your last name"
                  />
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={responses.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="+1 (123) 456-7890"
                  />
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Location</label>
                  <input
                    type="text"
                    value={responses.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="City, Country"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">LinkedIn Profile (optional)</label>
                <input
                  type="url"
                  value={responses.linkedinProfile}
                  onChange={(e) => handleInputChange('linkedinProfile', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Short Bio</label>
                <textarea
                  value={responses.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Tell us a bit about yourself..."
                />
              </div>
            </div>
          </div>
        );

      case 'background':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-8">
              <GraduationCap className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white">Your Background</h2>
              <p className="text-white/70 mt-2">Tell us about your education and experience</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-4">
              <div>
                <label className="block text-white/80 mb-2">Current Education Level</label>
                <select
                  value={responses.educationLevel}
                  onChange={(e) => handleInputChange('educationLevel', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" className="bg-gray-800">Select...</option>
                  <option value="high_school" className="bg-gray-800">High School</option>
                  <option value="undergraduate" className="bg-gray-800">Undergraduate (Bachelor's)</option>
                  <option value="graduate" className="bg-gray-800">Graduate (Master's)</option>
                  <option value="phd" className="bg-gray-800">PhD/Doctorate</option>
                  <option value="bootcamp" className="bg-gray-800">Bootcamp/Certification</option>
                  <option value="self_taught" className="bg-gray-800">Self-taught</option>
                </select>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 mb-2">School/University</label>
                  <input
                    type="text"
                    value={responses.education}
                    onChange={(e) => handleInputChange('education', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="University name"
                  />
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Major/Field of Study</label>
                  <input
                    type="text"
                    value={responses.major}
                    onChange={(e) => handleInputChange('major', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Computer Science, etc."
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Expected Graduation Year</label>
                <input
                  type="text"
                  value={responses.graduationYear}
                  onChange={(e) => handleInputChange('graduationYear', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="2025"
                />
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Previous Experience (if any)</label>
                <textarea
                  value={responses.previousExperience}
                  onChange={(e) => handleInputChange('previousExperience', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Previous internships, projects, or relevant experience..."
                />
              </div>
            </div>
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-8">
              <Code className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white">Skills & Interests</h2>
              <p className="text-white/70 mt-2">What are you good at and excited about?</p>
            </div>
            
            <div className="max-w-3xl mx-auto space-y-6">
              <div>
                <label className="block text-white/80 mb-3">Technical Skills (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {SKILL_OPTIONS.map(skill => (
                    <button
                      key={skill}
                      onClick={() => toggleArrayItem('skills', skill)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        responses.skills?.includes(skill)
                          ? 'bg-cyan-500 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-white/80 mb-3">Areas of Interest (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_AREAS.map(interest => (
                    <button
                      key={interest}
                      onClick={() => toggleArrayItem('interests', interest)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        responses.interests?.includes(interest)
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Projects You've Worked On</label>
                <textarea
                  value={responses.projectsWorkedOn}
                  onChange={(e) => handleInputChange('projectsWorkedOn', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  placeholder="Describe any personal or academic projects..."
                />
              </div>
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-8">
              <Target className="w-16 h-16 text-orange-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white">Your Goals</h2>
              <p className="text-white/70 mt-2">What do you hope to achieve?</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-4">
              <div>
                <label className="block text-white/80 mb-2">What do you want to learn during this internship?</label>
                <textarea
                  value={responses.learningGoals}
                  onChange={(e) => handleInputChange('learningGoals', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="Technical skills, soft skills, industry knowledge..."
                />
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">What are your career aspirations?</label>
                <textarea
                  value={responses.careerGoals}
                  onChange={(e) => handleInputChange('careerGoals', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="Where do you see yourself in 5 years?"
                />
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">What excites you most about this opportunity?</label>
                <textarea
                  value={responses.whatExcitesYou}
                  onChange={(e) => handleInputChange('whatExcitesYou', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="What made you join Upcheck?"
                />
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Preferred Work Style</label>
                <select
                  value={responses.preferredWorkStyle}
                  onChange={(e) => handleInputChange('preferredWorkStyle', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="" className="bg-gray-800">Select...</option>
                  <option value="independent" className="bg-gray-800">Independent - I like to work on my own</option>
                  <option value="collaborative" className="bg-gray-800">Collaborative - I thrive in team settings</option>
                  <option value="mixed" className="bg-gray-800">Mixed - A balance of both</option>
                  <option value="mentored" className="bg-gray-800">Mentored - I prefer guidance and direction</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'availability':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-8">
              <Calendar className="w-16 h-16 text-teal-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white">Availability</h2>
              <p className="text-white/70 mt-2">Help us understand your schedule</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 mb-2">Available Hours Per Week</label>
                  <select
                    value={responses.availableHoursPerWeek}
                    onChange={(e) => handleInputChange('availableHoursPerWeek', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="" className="bg-gray-800">Select...</option>
                    <option value="10-15" className="bg-gray-800">10-15 hours</option>
                    <option value="15-20" className="bg-gray-800">15-20 hours</option>
                    <option value="20-30" className="bg-gray-800">20-30 hours</option>
                    <option value="30-40" className="bg-gray-800">30-40 hours (full-time)</option>
                    <option value="flexible" className="bg-gray-800">Flexible</option>
                  </select>
                </div>
                <div>
                  <label className="block text-white/80 mb-2">Your Timezone</label>
                  <input
                    type="text"
                    value={responses.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="IST, PST, EST, etc."
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Preferred Communication Channel</label>
                <select
                  value={responses.preferredCommunication}
                  onChange={(e) => handleInputChange('preferredCommunication', e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="" className="bg-gray-800">Select...</option>
                  <option value="email" className="bg-gray-800">Email</option>
                  <option value="slack" className="bg-gray-800">Slack/Teams</option>
                  <option value="video" className="bg-gray-800">Video Calls</option>
                  <option value="chat" className="bg-gray-800">Chat (WhatsApp, etc.)</option>
                  <option value="any" className="bg-gray-800">Any - I'm flexible</option>
                </select>
              </div>
              
              <div>
                <label className="block text-white/80 mb-2">Any Questions for Us?</label>
                <textarea
                  value={responses.questions}
                  onChange={(e) => handleInputChange('questions', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  placeholder="Anything you'd like to know about the team or your role?"
                />
              </div>
            </div>
          </div>
        );

      case 'walkthrough':
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-8">
              <Rocket className="w-16 h-16 text-rose-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white">Getting Started</h2>
              <p className="text-white/70 mt-2">Here's what you can do in the dashboard</p>
            </div>
            
            <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-4">
              {[
                { icon: FileText, title: 'Documentation', desc: 'Access project documents, guides, and resources', color: 'bg-blue-500/20 text-blue-400' },
                { icon: MessageSquare, title: 'Messages', desc: 'Communicate with team members securely', color: 'bg-green-500/20 text-green-400' },
                { icon: Calendar, title: 'Events & Meetings', desc: 'View scheduled meetings and events', color: 'bg-purple-500/20 text-purple-400' },
                { icon: ClipboardList, title: 'Tasks', desc: 'Track your assigned tasks and progress', color: 'bg-orange-500/20 text-orange-400' },
                { icon: Users, title: 'Team Directory', desc: 'Find and connect with team members', color: 'bg-pink-500/20 text-pink-400' },
                { icon: Briefcase, title: 'Your Profile', desc: 'Update your info and settings anytime', color: 'bg-teal-500/20 text-teal-400' }
              ].map((item, idx) => (
                <div key={idx} className={`${item.color} backdrop-blur-sm rounded-xl p-5 flex items-start gap-4`}>
                  <item.icon className="w-8 h-8 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="text-white/70 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-yellow-500/20 backdrop-blur-sm rounded-xl p-5 max-w-2xl mx-auto mt-6">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-8 h-8 text-yellow-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-white">Pro Tip</h3>
                  <p className="text-white/80 text-sm">
                    Don't hesitate to explore and ask questions! Your supervisor and team members 
                    are here to help you succeed. Check the documentation section for detailed guides.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6 animate-fadeIn">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">You're All Set! 🎉</h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              Welcome aboard, {responses.firstName || existingData.username}! 
              We're excited to have you on the team.
            </p>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-xl mx-auto">
              <p className="text-white/90">
                Your onboarding information has been saved. Feel free to explore the 
                dashboard and reach out to your supervisor if you have any questions.
              </p>
            </div>
            <button
              onClick={completeOnboarding}
              disabled={saving}
              className="mt-6 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-lg hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Completing...
                </>
              ) : (
                <>
                  Go to Dashboard
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-white/10 z-50">
        <div 
          className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-500"
          style={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2">
          {ONBOARDING_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  idx === currentStep
                    ? 'bg-white text-purple-600'
                    : idx < currentStep
                    ? 'bg-green-500 text-white'
                    : 'bg-white/20 text-white/50'
                }`}
                title={step.title}
              >
                {idx < currentStep ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="min-h-screen flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-4xl">
          {renderStepContent()}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/20 backdrop-blur-md border-t border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {currentStep > 0 && currentStep < ONBOARDING_STEPS.length - 1 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {currentStep < ONBOARDING_STEPS.length - 1 && (
              <>
                <button
                  onClick={handleSkip}
                  className="flex items-center gap-2 text-white/50 hover:text-white/70 transition-colors text-sm"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip for now
                </button>
                <button
                  onClick={handleNext}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
