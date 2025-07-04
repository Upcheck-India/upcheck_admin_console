'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Clock, Users, ChevronRight } from 'lucide-react';

const EventsPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Upcoming'); // Default to 'Upcoming'

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events', { credentials: 'include' });
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
  }, []);

  const filteredEvents = events.filter(event => {
    if (filter === 'All') return true;
    const isPast = new Date(event.startTime) < new Date();
    if (filter === 'Upcoming') return !isPast;
    if (filter === 'Past') return isPast;
    return true;
  });

  const EventCard = ({ event }) => {
    const isPast = new Date(event.startTime) < new Date();
    const eventDate = new Date(event.startTime);

    return (
      <Link href={`/events/${event._id}`}>
        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6 flex flex-col justify-between h-full">
          <div>
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-bold text-gray-800 pr-2">{event.title}</h2>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${isPast ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>
                {isPast ? 'Past' : 'Upcoming'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{event.description}</p>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                <span>{eventDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 text-gray-500" />
                <span>{eventDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ({event.duration} mins)</span>
              </div>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-gray-500" />
                <span>{event.participants.length} participant(s)</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end items-center mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
            View Details
            <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Events Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Manage your scheduled meetings.</p>
          </div>
          <Link href="/events/create" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            New Meeting
          </Link>
        </div>

        <div className="mb-6">
            <div className="flex border-b border-gray-200">
                <button onClick={() => setFilter('Upcoming')} className={`px-4 py-2 text-sm font-medium ${filter === 'Upcoming' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Upcoming</button>
                <button onClick={() => setFilter('Past')} className={`px-4 py-2 text-sm font-medium ${filter === 'Past' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Past</button>
                <button onClick={() => setFilter('All')} className={`px-4 py-2 text-sm font-medium ${filter === 'All' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>All</button>
            </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <p className="text-gray-600">Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-gray-900">No events scheduled</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new meeting.</p>
            <div className="mt-6">
              <Link href="/events/create" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Schedule Meeting
              </Link>
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
