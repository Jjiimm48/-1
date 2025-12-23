
import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { NotesView } from './components/NotesView';
import { EventModal } from './components/EventModal';
import { SettingsModal } from './components/SettingsModal';
import { AddEventButton } from './components/AddEventButton';
import { SelectedDayEvents } from './components/SelectedDayEvents';
import { useCalendar } from './hooks/useCalendar';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useHolidays } from './hooks/useHolidays';
import { useSwipe } from './hooks/useSwipe';
import { Event, Settings, View, Note } from './types';
import { CATEGORIES } from './constants';
import { ArrowDownTrayIcon } from './components/icons';

const App: React.FC = () => {
  const [settings, setSettings] = useLocalStorage<Settings>('calendarSettings', {
    theme: 'light',
    firstDayOfWeek: 'monday',
  });

  const [events, setEvents] = useLocalStorage<Event[]>('calendarEvents', []);
  const [notes, setNotes] = useLocalStorage<Note[]>('calendarNotes', []);
  
  const [view, setView] = useState<View>('month');
  const {
    currentDate,
    setCurrentDate,
    daysInMonth,
    startDayOfMonth,
  } = useCalendar(settings.firstDayOfWeek);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt' as any, handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt' as any, handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Get holidays for the current, previous, and next year to ensure smooth navigation
  const currentYear = currentDate.getFullYear();
  const currentYearHolidays = useHolidays(currentYear);
  const nextYearHolidays = useHolidays(currentYear + 1);
  const prevYearHolidays = useHolidays(currentYear - 1);

  const allHolidays = useMemo(() => {
      return [...prevYearHolidays, ...currentYearHolidays, ...nextYearHolidays];
  }, [prevYearHolidays, currentYearHolidays, nextYearHolidays]);
  
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Navigation Logic
  const handlePrev = () => {
    if (view === 'notes') return;
    
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else if (view === 'week') {
      newDate.setDate(currentDate.getDate() - 7);
    } 
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    if (view === 'notes') return;

    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(currentDate.getMonth() + 1);
    } else if (view === 'week') {
      newDate.setDate(currentDate.getDate() + 7);
    } 
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  // Swipe Handlers
  const swipeHandlers = useSwipe({
    onSwipedLeft: handleNext,
    onSwipedRight: handlePrev,
  });
  
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddEventClick = () => {
    setSelectedEvent(null);
    setIsEventModalOpen(true);
  };

  const handleEditEventClick = (event: Event) => {
    setSelectedEvent(event);
    const eventDate = new Date(event.date);
    // Fix timezone issue when creating date from string YYYY-MM-DD
    const localDate = new Date(eventDate.valueOf() + eventDate.getTimezoneOffset() * 60 * 1000);
    setSelectedDate(localDate);
    
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = (eventData: Omit<Event, 'id'>) => {
    if (selectedEvent) {
      if (selectedEvent.isReadOnly) return;
      setEvents(events.map(e => e.id === selectedEvent.id ? { ...eventData, id: selectedEvent.id } : e));
    } else {
      setEvents([...events, { ...eventData, id: Date.now().toString() }]);
    }
    setIsEventModalOpen(false);
    setSelectedEvent(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    const eventToDelete = events.find(e => e.id === eventId);
    if (eventToDelete?.isReadOnly) return;
    
    setEvents(events.filter(e => e.id !== eventId));
    setIsEventModalOpen(false);
    setSelectedEvent(null);
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ events, notes }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "aplo_imerologio_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const sortedEvents = useMemo(() => {
    const combinedEvents = [...events, ...allHolidays];
    return combinedEvents.sort((a, b) => {
      if (!a.time && b.time) return -1;
      if (a.time && !b.time) return 1;
      if (!a.time && !b.time) return 0;
      
      const timeA = a.time ? a.time.split(':').map(Number) : [0, 0];
      const timeB = b.time ? b.time.split(':').map(Number) : [0, 0];
      return timeA[0] - timeB[0] || timeA[1] - timeB[1];
    });
  }, [events, allHolidays]);

  // Filter events for the selected date for the bottom preview
  const selectedDayEvents = useMemo(() => {
    return sortedEvents.filter(e => {
        const eventDate = new Date(e.date);
        const localEventDate = new Date(eventDate.valueOf() + eventDate.getTimezoneOffset() * 60 * 1000);
        return localEventDate.getFullYear() === selectedDate.getFullYear() && 
               localEventDate.getMonth() === selectedDate.getMonth() && 
               localEventDate.getDate() === selectedDate.getDate();
    });
  }, [sortedEvents, selectedDate]);

  const renderView = () => {
    switch (view) {
      case 'month':
        return (
          <MonthView
            currentDate={currentDate}
            daysInMonth={daysInMonth}
            startDayOfMonth={startDayOfMonth}
            events={sortedEvents}
            onDateClick={handleDateClick}
            onEditEvent={handleEditEventClick}
            firstDayOfWeek={settings.firstDayOfWeek}
            selectedDate={selectedDate}
          />
        );
      case 'week':
        return <WeekView currentDate={currentDate} events={sortedEvents} onEditEvent={handleEditEventClick} firstDayOfWeek={settings.firstDayOfWeek} />;
      case 'notes':
        return <NotesView notes={notes} setNotes={setNotes} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-green-50 dark:bg-gray-800 shadow-lg font-sans overflow-hidden relative">
      <Header
        currentDate={currentDate}
        view={view}
        setView={setView}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
      />
      
      <main 
        className="flex-1 overflow-y-auto p-2 sm:p-4 touch-pan-y relative" 
        {...swipeHandlers}
      >
        {renderView()}
      </main>

      {/* Show selected events preview only in month view */}
      {view === 'month' && (
        <SelectedDayEvents 
            date={selectedDate} 
            events={selectedDayEvents} 
            onEditEvent={handleEditEventClick}
        />
      )}
      
      {/* Floating Action Button - Only show on calendar views */}
      {view !== 'notes' && (
        <AddEventButton onClick={handleAddEventClick} />
      )}
      
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        event={selectedEvent}
        selectedDate={selectedDate}
        categories={CATEGORIES}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        onExport={handleExport}
        deferredPrompt={deferredPrompt}
        onInstall={handleInstallClick}
      />

      {/* Install Banner */}
      {deferredPrompt && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[60] flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
               <ArrowDownTrayIcon className="w-6 h-6" />
             </div>
             <div>
               <p className="font-semibold text-gray-900 dark:text-white">Εγκατάσταση Εφαρμογής</p>
               <p className="text-sm text-gray-600 dark:text-gray-400">Προσθήκη στην αρχική οθόνη για καλύτερη εμπειρία.</p>
             </div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={() => setDeferredPrompt(null)}
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Όχι τώρα
            </button>
            <button 
              onClick={handleInstallClick}
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
            >
              Εγκατάσταση
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
