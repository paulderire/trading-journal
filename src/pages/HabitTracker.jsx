import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, Timestamp } from "firebase/firestore";
import { showHabitReminder, getNotificationPermission } from "../services/notifications";

// Shared style constants
const cardStyle = {
  background: 'rgba(30, 41, 59, 0.5)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(71, 85, 105, 0.4)',
  borderRadius: '16px',
  padding: '1.5rem',
  width: '100%'
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  background: 'rgba(15, 23, 42, 0.6)',
  border: '1px solid rgba(71, 85, 105, 0.4)',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: '0.925rem',
  outline: 'none',
  transition: 'all 0.2s ease'
};

const buttonStyle = {
  padding: '0.75rem 1.5rem',
  borderRadius: '8px',
  border: 'none',
  fontWeight: '600',
  fontSize: '0.875rem',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
};

// Habit categories with icons
const HABIT_CATEGORIES = [
  { key: 'pre-market', label: 'Pre-Market', icon: '🌅', color: '#f59e0b' },
  { key: 'during-trade', label: 'During Trade', icon: '📊', color: '#3b82f6' },
  { key: 'post-market', label: 'Post-Market', icon: '🌙', color: '#8b5cf6' },
  { key: 'mindset', label: 'Mindset', icon: '🧠', color: '#10b981' },
  { key: 'health', label: 'Health', icon: '💪', color: '#ef4444' },
  { key: 'learning', label: 'Learning', icon: '📚', color: '#06b6d4' }
];

// Pre-built habit templates
const HABIT_TEMPLATES = [
  { name: 'Review market news', category: 'pre-market', icon: '📰' },
  { name: 'Check economic calendar', category: 'pre-market', icon: '📅' },
  { name: 'Mark key levels', category: 'pre-market', icon: '📏' },
  { name: 'Set daily trading plan', category: 'pre-market', icon: '📝' },
  { name: 'Wait for confirmation', category: 'during-trade', icon: '⏳' },
  { name: 'Stick to stop loss', category: 'during-trade', icon: '🛡️' },
  { name: 'No revenge trading', category: 'during-trade', icon: '🚫' },
  { name: 'Take partials at targets', category: 'during-trade', icon: '🎯' },
  { name: 'Journal all trades', category: 'post-market', icon: '✍️' },
  { name: 'Review wins & losses', category: 'post-market', icon: '📊' },
  { name: 'Screenshot charts', category: 'post-market', icon: '📸' },
  { name: 'Meditation/Breathing', category: 'mindset', icon: '🧘' },
  { name: 'Exercise', category: 'health', icon: '🏃' },
  { name: 'Read trading book', category: 'learning', icon: '📖' },
  { name: 'Watch educational content', category: 'learning', icon: '🎥' }
];

const HabitTracker = () => {
  const [habits, setHabits] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('today'); // today, week, calendar
  const [formData, setFormData] = useState({
    name: '',
    category: 'pre-market',
    icon: '✅',
    frequency: 'daily',
    reminder: '',
    notes: ''
  });

  // Fetch habits and completions
  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        // Fetch habits
        const habitsQuery = query(
          collection(db, "habits"),
          where("userId", "==", auth.currentUser.uid)
        );
        const habitsSnapshot = await getDocs(habitsQuery);
        const habitsData = habitsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setHabits(habitsData);

        // Fetch completions
        const completionsQuery = query(
          collection(db, "habit_completions"),
          where("userId", "==", auth.currentUser.uid)
        );
        const completionsSnapshot = await getDocs(completionsQuery);
        const completionsData = completionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCompletions(completionsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Get week dates
  const getWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const weekDates = useMemo(() => getWeekDates(), []);

  // Check if habit is completed for a date
  const isHabitCompleted = (habitId, date) => {
    return completions.some(c => c.habitId === habitId && c.date === date);
  };

  // Toggle habit completion
  const toggleHabitCompletion = async (habitId, date) => {
    if (!auth.currentUser) return;
    
    const existing = completions.find(c => c.habitId === habitId && c.date === date);
    
    try {
      if (existing) {
        // Remove completion
        await deleteDoc(doc(db, "habit_completions", existing.id));
        setCompletions(prev => prev.filter(c => c.id !== existing.id));
      } else {
        // Add completion
        const completionData = {
          habitId,
          userId: auth.currentUser.uid,
          date,
          completedAt: Timestamp.now()
        };
        const docRef = await addDoc(collection(db, "habit_completions"), completionData);
        setCompletions(prev => [...prev, { ...completionData, id: docRef.id }]);
      }
    } catch (error) {
      console.error("Error toggling completion:", error);
    }
  };

  // Calculate streak for a habit
  const calculateStreak = (habitId) => {
    const habitCompletions = completions
      .filter(c => c.habitId === habitId)
      .map(c => c.date)
      .sort()
      .reverse();
    
    if (habitCompletions.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
    let checkDate = new Date(today);
    
    // Check if completed today or yesterday to start counting
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = new Date(today.setDate(today.getDate() - 1)).toISOString().split('T')[0];
    
    if (!habitCompletions.includes(todayStr) && !habitCompletions.includes(yesterdayStr)) {
      return 0;
    }
    
    checkDate = new Date();
    if (!habitCompletions.includes(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (habitCompletions.includes(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  };

  // Calculate completion rate
  const getCompletionRate = (habitId, days = 30) => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);
    
    const habitCompletions = completions.filter(c => {
      if (c.habitId !== habitId) return false;
      const date = new Date(c.date);
      return date >= startDate && date <= today;
    });
    
    return Math.round((habitCompletions.length / days) * 100);
  };

  // Stats
  const stats = useMemo(() => {
    const today = selectedDate;
    const completedToday = habits.filter(h => isHabitCompleted(h.id, today)).length;
    const totalHabits = habits.length;
    const todayRate = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
    
    // Best streak
    const bestStreak = habits.reduce((max, h) => Math.max(max, calculateStreak(h.id)), 0);
    
    // Total completions this week
    const weekCompletions = weekDates.reduce((count, date) => {
      return count + habits.filter(h => isHabitCompleted(h.id, date)).length;
    }, 0);
    
    const maxWeekCompletions = habits.length * 7;
    const weekRate = maxWeekCompletions > 0 ? Math.round((weekCompletions / maxWeekCompletions) * 100) : 0;
    
    return { completedToday, totalHabits, todayRate, bestStreak, weekCompletions, weekRate };
  }, [habits, completions, selectedDate, weekDates]);

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const habitData = {
        ...formData,
        userId: auth.currentUser.uid,
        createdAt: Timestamp.now()
      };

      if (editingHabit) {
        await updateDoc(doc(db, "habits", editingHabit.id), habitData);
        setHabits(prev => prev.map(h => h.id === editingHabit.id ? { ...h, ...habitData } : h));
      } else {
        const docRef = await addDoc(collection(db, "habits"), habitData);
        setHabits(prev => [...prev, { ...habitData, id: docRef.id }]);
      }

      resetForm();
    } catch (error) {
      console.error("Error saving habit:", error);
    }
  };

  // Delete habit
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this habit and all its completions?")) return;
    try {
      await deleteDoc(doc(db, "habits", id));
      // Also delete all completions for this habit
      const habitCompletions = completions.filter(c => c.habitId === id);
      for (const completion of habitCompletions) {
        await deleteDoc(doc(db, "habit_completions", completion.id));
      }
      setHabits(prev => prev.filter(h => h.id !== id));
      setCompletions(prev => prev.filter(c => c.habitId !== id));
    } catch (error) {
      console.error("Error deleting habit:", error);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      category: 'pre-market',
      icon: '✅',
      frequency: 'daily',
      reminder: '',
      notes: ''
    });
    setEditingHabit(null);
    setShowModal(false);
  };

  // Edit habit
  const handleEdit = (habit) => {
    setFormData({
      name: habit.name,
      category: habit.category,
      icon: habit.icon,
      frequency: habit.frequency || 'daily',
      reminder: habit.reminder || '',
      notes: habit.notes || ''
    });
    setEditingHabit(habit);
    setShowModal(true);
  };

  // Add from template
  const addFromTemplate = (template) => {
    setFormData({
      name: template.name,
      category: template.category,
      icon: template.icon,
      frequency: 'daily',
      reminder: '',
      notes: ''
    });
    setShowModal(true);
  };

  // Get category info
  const getCategoryInfo = (key) => HABIT_CATEGORIES.find(c => c.key === key) || HABIT_CATEGORIES[0];

  // Group habits by category
  const habitsByCategory = useMemo(() => {
    const grouped = {};
    HABIT_CATEGORIES.forEach(cat => {
      grouped[cat.key] = habits.filter(h => h.category === cat.key);
    });
    return grouped;
  }, [habits]);

  // Navigate dates
  const navigateDate = (days) => {
    const current = new Date(selectedDate);
    if (isNaN(current.getTime())) {
      setSelectedDate(new Date().toISOString().split('T')[0]);
      return;
    }
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  return (
    <div className="feature-page" style={{ 
      background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)', 
      minHeight: '100vh', 
      color: '#f1f5f9',
      padding: 0
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        padding: '2rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              marginBottom: '0.5rem',
              background: 'linear-gradient(135deg, #10b981 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>✅ Habit Tracker</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.925rem' }}>
              Build consistent trading habits for long-term success
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              ...buttonStyle,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
            }}
          >
            ➕ New Habit
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
        gap: '1rem', 
        padding: '0 2rem',
        marginBottom: '1.5rem'
      }}>
        {[
          { label: 'Today', value: `${stats.completedToday}/${stats.totalHabits}`, color: '#3b82f6' },
          { label: 'Today Rate', value: `${stats.todayRate}%`, color: stats.todayRate >= 80 ? '#10b981' : stats.todayRate >= 50 ? '#f59e0b' : '#ef4444' },
          { label: 'Best Streak', value: `🔥 ${stats.bestStreak}`, color: '#f59e0b' },
          { label: 'Week Rate', value: `${stats.weekRate}%`, color: stats.weekRate >= 70 ? '#10b981' : '#f59e0b' },
          { label: 'Total Habits', value: stats.totalHabits, color: '#8b5cf6' },
          { label: 'Week Total', value: `${stats.weekCompletions}/${stats.totalHabits * 7}`, color: '#06b6d4' }
        ].map((stat, i) => (
          <div key={i} style={{
            ...cardStyle,
            padding: '1rem 1.25rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Date Navigation */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigateDate(-1)}
            style={{
              ...buttonStyle,
              background: 'rgba(30, 41, 59, 0.5)',
              color: '#94a3b8',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              padding: '0.5rem 1rem'
            }}
          >
            ←
          </button>
          <div style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600',
            color: '#f1f5f9',
            minWidth: '180px',
            textAlign: 'center'
          }}>
            {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
          <button
            onClick={() => navigateDate(1)}
            style={{
              ...buttonStyle,
              background: 'rgba(30, 41, 59, 0.5)',
              color: '#94a3b8',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              padding: '0.5rem 1rem'
            }}
          >
            →
          </button>
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            style={{
              ...buttonStyle,
              background: selectedDate === new Date().toISOString().split('T')[0] 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                : 'rgba(30, 41, 59, 0.5)',
              color: selectedDate === new Date().toISOString().split('T')[0] ? 'white' : '#94a3b8',
              border: selectedDate === new Date().toISOString().split('T')[0] ? 'none' : '1px solid rgba(71, 85, 105, 0.4)',
              padding: '0.5rem 1rem'
            }}
          >
            Today
          </button>
        </div>
        
        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { key: 'today', label: '📋 Today' },
            { key: 'week', label: '📅 Week' }
          ].map(mode => (
            <button
              key={mode.key}
              onClick={() => setViewMode(mode.key)}
              style={{
                ...buttonStyle,
                background: viewMode === mode.key 
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                  : 'rgba(30, 41, 59, 0.5)',
                color: viewMode === mode.key ? 'white' : '#94a3b8',
                border: viewMode === mode.key ? 'none' : '1px solid rgba(71, 85, 105, 0.4)'
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '0 2rem 2rem' }}>
        {loading ? (
          <div style={{ 
            ...cardStyle, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: '300px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✅</div>
              <div style={{ color: '#94a3b8' }}>Loading habits...</div>
            </div>
          </div>
        ) : habits.length === 0 ? (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {/* Empty State */}
            <div style={{ 
              ...cardStyle, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: '200px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
                <div style={{ color: '#f1f5f9', fontWeight: '600', marginBottom: '0.5rem' }}>
                  No habits yet
                </div>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Start building your trading routine with habits
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    ...buttonStyle,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white'
                  }}
                >
                  ➕ Create First Habit
                </button>
              </div>
            </div>

            {/* Templates */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ 
                fontSize: '1.125rem', 
                fontWeight: '600', 
                color: '#f1f5f9',
                marginBottom: '1rem'
              }}>
                ⚡ Quick Start Templates
              </h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                gap: '0.75rem' 
              }}>
                {HABIT_TEMPLATES.map((template, i) => (
                  <button
                    key={i}
                    onClick={() => addFromTemplate(template)}
                    style={{
                      padding: '1rem',
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(71, 85, 105, 0.4)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = getCategoryInfo(template.category).color;
                      e.currentTarget.style.background = `${getCategoryInfo(template.category).color}15`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.4)';
                      e.currentTarget.style.background = 'rgba(15, 23, 42, 0.5)';
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>{template.icon}</span>
                    <div>
                      <div style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '500' }}>
                        {template.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: getCategoryInfo(template.category).color }}>
                        {getCategoryInfo(template.category).label}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : viewMode === 'today' ? (
          /* Today View - Grouped by Category */
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {HABIT_CATEGORIES.filter(cat => habitsByCategory[cat.key]?.length > 0).map(category => (
              <div key={category.key} style={{ ...cardStyle }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: `2px solid ${category.color}30`
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{category.icon}</span>
                  <h3 style={{ 
                    fontSize: '1rem', 
                    fontWeight: '600', 
                    color: category.color 
                  }}>
                    {category.label}
                  </h3>
                  <span style={{ 
                    marginLeft: 'auto',
                    fontSize: '0.8rem',
                    color: '#64748b'
                  }}>
                    {habitsByCategory[category.key].filter(h => isHabitCompleted(h.id, selectedDate)).length}/{habitsByCategory[category.key].length}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {habitsByCategory[category.key].map(habit => {
                    const completed = isHabitCompleted(habit.id, selectedDate);
                    const streak = calculateStreak(habit.id);
                    
                    return (
                      <div
                        key={habit.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          padding: '1rem',
                          background: completed ? `${category.color}15` : 'rgba(15, 23, 42, 0.4)',
                          border: `1px solid ${completed ? category.color : 'rgba(71, 85, 105, 0.3)'}`,
                          borderRadius: '12px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <button
                          onClick={() => toggleHabitCompletion(habit.id, selectedDate)}
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            border: `2px solid ${completed ? category.color : 'rgba(71, 85, 105, 0.5)'}`,
                            background: completed ? category.color : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {completed ? '✓' : ''}
                        </button>
                        
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            marginBottom: '0.25rem'
                          }}>
                            <span style={{ fontSize: '1rem' }}>{habit.icon}</span>
                            <span style={{ 
                              color: completed ? '#f1f5f9' : '#94a3b8',
                              fontWeight: '500',
                              textDecoration: completed ? 'none' : 'none'
                            }}>
                              {habit.name}
                            </span>
                          </div>
                          {streak > 0 && (
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#f59e0b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              🔥 {streak} day streak
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => {
                              if (getNotificationPermission() === 'granted') {
                                showHabitReminder(habit.name, habit.description);
                              } else {
                                alert('Enable notifications in Account settings to use reminders');
                              }
                            }}
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: 'none',
                              color: '#f59e0b',
                              padding: '0.5rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.875rem'
                            }}
                            title="Send reminder notification"
                          >
                            🔔
                          </button>
                          <button
                            onClick={() => handleEdit(habit)}
                            style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              border: 'none',
                              color: '#3b82f6',
                              padding: '0.5rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(habit.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: 'none',
                              color: '#ef4444',
                              padding: '0.5rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.875rem'
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Add More Templates */}
            <div style={{ ...cardStyle }}>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                color: '#f1f5f9',
                marginBottom: '1rem'
              }}>
                ➕ Add More Habits
              </h3>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap',
                gap: '0.5rem' 
              }}>
                {HABIT_TEMPLATES.filter(t => !habits.some(h => h.name === t.name)).slice(0, 6).map((template, i) => (
                  <button
                    key={i}
                    onClick={() => addFromTemplate(template)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(71, 85, 105, 0.4)',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#10b981';
                      e.currentTarget.style.color = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.4)';
                      e.currentTarget.style.color = '#94a3b8';
                    }}
                  >
                    <span>{template.icon}</span>
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Week View */
          <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr>
                  <th style={{ 
                    padding: '1rem', 
                    textAlign: 'left',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                    width: '200px'
                  }}>
                    Habit
                  </th>
                  {weekDates.map((date, i) => {
                    const d = new Date(date);
                    const isToday = date === new Date().toISOString().split('T')[0];
                    return (
                      <th key={date} style={{ 
                        padding: '1rem 0.5rem', 
                        textAlign: 'center',
                        color: isToday ? '#10b981' : '#64748b',
                        fontSize: '0.75rem',
                        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                        background: isToday ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
                      }}>
                        <div>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</div>
                        <div style={{ fontWeight: '700', fontSize: '1rem', marginTop: '0.25rem' }}>
                          {d.getDate()}
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ 
                    padding: '1rem', 
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid rgba(71, 85, 105, 0.3)'
                  }}>
                    Streak
                  </th>
                </tr>
              </thead>
              <tbody>
                {habits.map(habit => {
                  const categoryInfo = getCategoryInfo(habit.category);
                  const streak = calculateStreak(habit.id);
                  
                  return (
                    <tr key={habit.id}>
                      <td style={{ 
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid rgba(71, 85, 105, 0.2)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>{habit.icon}</span>
                          <div>
                            <div style={{ color: '#f1f5f9', fontWeight: '500', fontSize: '0.9rem' }}>
                              {habit.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: categoryInfo.color }}>
                              {categoryInfo.label}
                            </div>
                          </div>
                        </div>
                      </td>
                      {weekDates.map(date => {
                        const completed = isHabitCompleted(habit.id, date);
                        const isToday = date === new Date().toISOString().split('T')[0];
                        
                        return (
                          <td key={date} style={{ 
                            padding: '0.5rem',
                            textAlign: 'center',
                            borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
                            background: isToday ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
                          }}>
                            <button
                              onClick={() => toggleHabitCompletion(habit.id, date)}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                border: `2px solid ${completed ? categoryInfo.color : 'rgba(71, 85, 105, 0.4)'}`,
                                background: completed ? categoryInfo.color : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1rem',
                                color: 'white',
                                margin: '0 auto',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {completed ? '✓' : ''}
                            </button>
                          </td>
                        );
                      })}
                      <td style={{ 
                        padding: '0.75rem',
                        textAlign: 'center',
                        borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
                        color: streak > 0 ? '#f59e0b' : '#64748b',
                        fontWeight: '600'
                      }}>
                        {streak > 0 ? `🔥 ${streak}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
          onClick={() => resetForm()}
        >
          <div 
            style={{
              ...cardStyle,
              maxWidth: '500px',
              maxHeight: '90vh',
              overflow: 'auto',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid rgba(71, 85, 105, 0.3)'
            }}>
              <h2 style={{ 
                fontSize: '1.25rem', 
                fontWeight: '700', 
                color: '#f1f5f9'
              }}>
                ✅ {editingHabit ? 'Edit Habit' : 'New Habit'}
              </h2>
              <button
                onClick={() => resetForm()}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1.25rem'
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Habit Name */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#64748b',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Habit Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Review market news"
                  style={inputStyle}
                  required
                />
              </div>

              {/* Category */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#64748b',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Category
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {HABIT_CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.key }))}
                      style={{
                        padding: '0.75rem 0.5rem',
                        background: formData.category === cat.key 
                          ? `${cat.color}20` 
                          : 'rgba(15, 23, 42, 0.5)',
                        border: `1px solid ${formData.category === cat.key ? cat.color : 'rgba(71, 85, 105, 0.4)'}`,
                        borderRadius: '8px',
                        color: formData.category === cat.key ? cat.color : '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{cat.icon}</div>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Picker */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#64748b',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Icon
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {['✅', '📊', '📈', '📉', '💰', '🎯', '🛡️', '📝', '📚', '🧘', '💪', '🏃', '📰', '📅', '⏳', '🚫', '📸', '✍️', '🎥', '📖'].map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, icon }))}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        border: formData.icon === icon ? '2px solid #10b981' : '1px solid rgba(71, 85, 105, 0.4)',
                        background: formData.icon === icon ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                        cursor: 'pointer',
                        fontSize: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#64748b',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes or reminders..."
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => resetForm()}
                  style={{
                    ...buttonStyle,
                    flex: 1,
                    justifyContent: 'center',
                    background: 'rgba(71, 85, 105, 0.3)',
                    color: '#94a3b8',
                    border: '1px solid rgba(71, 85, 105, 0.4)'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    ...buttonStyle,
                    flex: 2,
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {editingHabit ? '💾 Update Habit' : '✅ Create Habit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitTracker;