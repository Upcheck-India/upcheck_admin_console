'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Clock, Users, ChevronRight, Video, Search, Filter, CalendarDays, Zap, Settings, ArrowUpRight, RefreshCw, CheckCircle, RotateCwSquare } from 'lucide-react';
import TopNav from '../components/TopNav';

const EventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Upcoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showRecurring, setShowRecurring] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const url = showRecurring ? '/api/events?includeRecurring=true' : '/api/events';
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        const data = await response.json();
        setEvents(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();

    // Check for success messages from URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('created') === 'true') {
      setNotification({ message: 'Meeting created successfully!', type: 'success' });
      // Clean up URL
      window.history.replaceState({}, '', '/events');
    } else if (urlParams.get('recurring_created') === 'true') {
      setNotification({ message: 'Recurring meeting series created successfully!', type: 'success' });
      // Clean up URL
      window.history.replaceState({}, '', '/events');
    }

    // Auto-hide notification after 5 seconds
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, showRecurring]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const url = showRecurring ? '/api/events?includeRecurring=true' : '/api/events';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         event.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Recurring series are always shown if enabled, regardless of time filter
    if (event.isRecurringSeries) return true;
    
    if (filter === 'All') return true;
    const isPast = new Date(event.startTime) < new Date();
    if (filter === 'Upcoming') return !isPast;
    if (filter === 'Past') return isPast;
    return true;
  });

  const getEventStats = () => {
    const now = new Date();
    const regularEvents = events.filter(event => !event.isRecurringSeries);
    const recurringSeries = events.filter(event => event.isRecurringSeries);
    
    const upcoming = regularEvents.filter(event => new Date(event.startTime) > now).length;
    const past = regularEvents.filter(event => new Date(event.startTime) < now).length;
    const today = regularEvents.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.toDateString() === now.toDateString();
    }).length;
    
    return { 
      upcoming, 
      past, 
      today, 
      total: regularEvents.length,
      recurring: recurringSeries.length
    };
  };

  const stats = getEventStats();

  const EventCard = ({ event }) => {
    const isRecurringSeries = event.isRecurringSeries;
    const isPast = !isRecurringSeries && new Date(event.startTime) < new Date();
    const eventDate = new Date(event.startTime);
    const isToday = !isRecurringSeries && eventDate.toDateString() === new Date().toDateString();
    const isUpcoming = eventDate > new Date();

    const linkHref = isRecurringSeries ? `/events/recurring` : `/events/${event._id}`;

    return (
      <Link href={linkHref}>
        <div className={`bg-white rounded-xl shadow-sm border hover:shadow-lg transition-all duration-300 p-6 group relative overflow-hidden ${
          isRecurringSeries 
            ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-white'
            : isToday 
              ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-white' 
              : 'border-gray-200 hover:border-indigo-300'
        }`}>
          {/* Gradient overlay for today's events or recurring series */}
          {(isToday || isRecurringSeries) && (
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${
              isRecurringSeries 
                ? 'from-purple-500/10 to-transparent' 
                : 'from-indigo-500/10 to-transparent'
            } rounded-bl-full`}></div>
          )}
          
          <div className="flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-xl font-bold text-gray-900 pr-2 group-hover:text-indigo-600 transition-colors">
                  {event.title}
                </h2>
                <div className="flex items-center space-x-2">
                  {isRecurringSeries && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 flex items-center">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Series
                    </span>
                  )}
                  {isToday && !isRecurringSeries && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 flex items-center">
                      <Zap className="w-3 h-3 mr-1" />
                      Today
                    </span>
                  )}
                  {!isRecurringSeries && (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      isPast ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                    }`}>
                      {isPast ? 'Past' : 'Upcoming'}
                    </span>
                  )}
                  {isRecurringSeries && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                      Active
                    </span>
                  )}
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                {event.description}
              </p>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center text-gray-700">
                  <div className="p-1 bg-gray-100 rounded-md mr-3">
                    <Calendar className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="font-medium">
                    {isRecurringSeries 
                      ? `Created ${eventDate.toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}`
                      : eventDate.toLocaleDateString(undefined, { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                    }
                  </span>
                </div>
                
                <div className="flex items-center text-gray-700">
                  <div className="p-1 bg-gray-100 rounded-md mr-3">
                    <Clock className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="font-medium">
                    {isRecurringSeries 
                      ? `${event.duration} mins • ${event.totalInstances || 0} meetings`
                      : `${eventDate.toLocaleTimeString(undefined, { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })} • ${event.duration} mins`
                    }
                  </span>
                </div>
                
                <div className="flex items-center text-gray-700">
                  <div className="p-1 bg-gray-100 rounded-md mr-3">
                    <Users className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="font-medium">
                    {event.participants.length} participant{event.participants.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center text-xs text-gray-500">
                <Video className="w-4 h-4 mr-1" />
                {isRecurringSeries 
                  ? `Recurring ${event.provider === 'google_meet' ? 'Google Meet' : 'Zoom'}`
                  : event.provider === 'google_meet' ? 'Google Meet' : 'Zoom Meeting'
                }
              </div>
              <div className={`flex items-center text-sm font-semibold transition-colors ${
                isRecurringSeries 
                  ? 'text-purple-600 group-hover:text-purple-700'
                  : 'text-indigo-600 group-hover:text-indigo-700'
              }`}>
                {isRecurringSeries ? 'Manage Series' : 'View Details'}
                <ArrowUpRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  const StatCard = ({ icon: Icon, label, value, color = 'indigo' }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg bg-${color}-100 mr-4`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );

  const FilterTab = ({ value, label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
        isActive
          ? 'bg-indigo-100 text-indigo-700 shadow-sm'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <TopNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Meetings Dashboard</h1>
            <p className="text-gray-600">Manage your scheduled meetings and video conferences</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/events/recurring"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              <RotateCwSquare className="w-4 h-4 mr-2" />
              Recurring Meetings
            </Link>
            <div className="relative inline-block text-left">
              <div className="flex">
                <Link 
                  href="/events/create"
                  className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-l-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Meeting
                </Link>
                <div className="relative">
                  <button
                    type="button"
                    className="inline-flex items-center px-2 py-2 border border-l-0 border-transparent text-sm font-medium rounded-r-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    onClick={() => {
                      // Simple dropdown - you can enhance this with proper state management
                      const dropdown = document.getElementById('meeting-dropdown');
                      dropdown.classList.toggle('hidden');
                    }}
                  >
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </button>
                  <div
                    id="meeting-dropdown"
                    className="hidden absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                  >
                    <div className="py-1">
                      <Link
                        href="/events/create"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Calendar className="w-4 h-4 mr-3" />
                        Single Meeting
                      </Link>
                      <Link
                        href="/events/recurring/create"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <RefreshCw className="w-4 h-4 mr-3" />
                        Recurring Series
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'error' 
              ? 'bg-red-50 border-red-200 text-red-800' 
              : 'bg-green-50 border-green-200 text-green-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                <span className="font-medium">{notification.message}</span>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatCard icon={CalendarDays} label="Total Events" value={stats.total} color="indigo" />
          <StatCard icon={Clock} label="Upcoming" value={stats.upcoming} color="green" />
          <StatCard icon={Zap} label="Today" value={stats.today} color="yellow" />
          <StatCard icon={Calendar} label="Past Events" value={stats.past} color="gray" />
          <StatCard icon={RotateCwSquare} label="Recurring Series" value={stats.recurring} color="purple" />
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500 mr-2" />
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                  <FilterTab 
                    value="Upcoming" 
                    label="Upcoming" 
                    isActive={filter === 'Upcoming'} 
                    onClick={() => setFilter('Upcoming')} 
                  />
                  <FilterTab 
                    value="Past" 
                    label="Past" 
                    isActive={filter === 'Past'} 
                    onClick={() => setFilter('Past')} 
                  />
                  <FilterTab 
                    value="All" 
                    label="All" 
                    isActive={filter === 'All'} 
                    onClick={() => setFilter('All')} 
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="showRecurring"
                  checked={showRecurring}
                  onChange={(e) => setShowRecurring(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="showRecurring" className="text-sm text-gray-700 cursor-pointer">
                  Show recurring series
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading events...</p>
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 max-w-md mx-auto">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchTerm ? 'No events found' : 'No events scheduled'}
              </h3>
              <p className="text-gray-500 mb-8">
                {searchTerm 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'Get started by creating your first meeting.'
                }
              </p>
              {!searchTerm && (
                <Link 
                  href="/events/create"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Meeting
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsPage;