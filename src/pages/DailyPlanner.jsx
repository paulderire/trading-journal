import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, Timestamp } from "firebase/firestore";

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

// Time blocks for the day
const TIME_BLOCKS = [
  { key: 'pre-market', label: 'Pre-Market', time: '6:00 - 9:30', icon: '🌅', color: '#f59e0b' },
  { key: 'market-open', label: 'Market Open', time: '9:30 - 11:00', icon: '🔔', color: '#10b981' },
  { key: 'mid-day', label: 'Mid-Day', time: '11:00 - 14:00', icon: '☀️', color: '#3b82f6' },
  { key: 'power-hour', label: 'Power Hour', time: '14:00 - 16:00', icon: '⚡', color: '#8b5cf6' },
  { key: 'post-market', label: 'Post-Market', time: '16:00 - 18:00', icon: '🌙', color: '#06b6d4' },
  { key: 'evening', label: 'Evening Review', time: '18:00+', icon: '📊', color: '#ec4899' }
];

// Task priority levels
const PRIORITIES = [
  { key: 'high', label: 'High', color: '#ef4444', icon: '🔴' },
  { key: 'medium', label: 'Medium', color: '#f59e0b', icon: '🟡' },
  { key: 'low', label: 'Low', color: '#10b981', icon: '🟢' }
];

// Pre-built task templates
const TASK_TEMPLATES = {
  'pre-market': [
    { text: 'Review overnight news & futures', priority: 'high' },
    { text: 'Check economic calendar', priority: 'high' },
    { text: 'Mark key support/resistance levels', priority: 'medium' },
    { text: 'Review watchlist & set alerts', priority: 'medium' },
    { text: 'Set daily profit/loss limits', priority: 'high' }
  ],
  'market-open': [
    { text: 'Wait 15 min for market to settle', priority: 'high' },
    { text: 'Identify opening range', priority: 'medium' },
    { text: 'Look for A+ setups only', priority: 'high' }
  ],
  'mid-day': [
    { text: 'Reduce position sizes', priority: 'medium' },
    { text: 'Focus on trend continuation', priority: 'low' },
    { text: 'Review morning trades', priority: 'medium' }
  ],
  'power-hour': [
    { text: 'Watch for breakouts', priority: 'high' },
    { text: 'Monitor volume spikes', priority: 'medium' },
    { text: 'Prepare for EOD moves', priority: 'medium' }
  ],
  'post-market': [
    { text: 'Journal all trades', priority: 'high' },
    { text: 'Screenshot charts', priority: 'medium' },
    { text: 'Calculate daily P&L', priority: 'high' }
  ],
  'evening': [
    { text: 'Review what worked/didn\'t work', priority: 'high' },
    { text: 'Update trading journal notes', priority: 'medium' },
    { text: 'Prepare next day watchlist', priority: 'medium' },
    { text: 'Study 1 trading concept', priority: 'low' }
  ]
};

const DailyPlanner = () => {
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddTask, setShowAddTask] = useState(null); // Which time block to add to
  const [newTask, setNewTask] = useState({ text: '', priority: 'medium', timeBlock: '' });
  const [dailyFocus, setDailyFocus] = useState('');
  const [marketBias, setMarketBias] = useState('neutral');
  const [riskLevel, setRiskLevel] = useState('normal');

  // Fetch tasks for selected date
  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        // Fetch tasks
        const tasksQuery = query(
          collection(db, "daily_tasks"),
          where("userId", "==", auth.currentUser.uid),
          where("date", "==", selectedDate)
        );
        const tasksSnapshot = await getDocs(tasksQuery);
        const tasksData = tasksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTasks(tasksData);

        // Fetch daily notes
        const notesQuery = query(
          collection(db, "daily_notes"),
          where("userId", "==", auth.currentUser.uid),
          where("date", "==", selectedDate)
        );
        const notesSnapshot = await getDocs(notesQuery);
        if (notesSnapshot.docs.length > 0) {
          const noteData = notesSnapshot.docs[0].data();
          setDailyFocus(noteData.focus || '');
          setMarketBias(noteData.marketBias || 'neutral');
          setRiskLevel(noteData.riskLevel || 'normal');
          setNotes({ id: notesSnapshot.docs[0].id, ...noteData });
        } else {
          setDailyFocus('');
          setMarketBias('neutral');
          setRiskLevel('normal');
          setNotes({});
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedDate]);

  // Save daily notes
  const saveDailyNotes = async () => {
    if (!auth.currentUser) return;
    try {
      const noteData = {
        userId: auth.currentUser.uid,
        date: selectedDate,
        focus: dailyFocus,
        marketBias,
        riskLevel,
        updatedAt: Timestamp.now()
      };

      if (notes.id) {
        await updateDoc(doc(db, "daily_notes", notes.id), noteData);
      } else {
        const docRef = await addDoc(collection(db, "daily_notes"), noteData);
        setNotes({ ...noteData, id: docRef.id });
      }
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  };

  // Add task
  const handleAddTask = async () => {
    if (!auth.currentUser || !newTask.text.trim()) return;
    try {
      const taskData = {
        userId: auth.currentUser.uid,
        date: selectedDate,
        text: newTask.text,
        priority: newTask.priority,
        timeBlock: showAddTask,
        completed: false,
        createdAt: Timestamp.now()
      };
      const docRef = await addDoc(collection(db, "daily_tasks"), taskData);
      setTasks(prev => [...prev, { ...taskData, id: docRef.id }]);
      setNewTask({ text: '', priority: 'medium', timeBlock: '' });
      setShowAddTask(null);
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  // Toggle task completion
  const toggleTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      await updateDoc(doc(db, "daily_tasks", taskId), {
        completed: !task.completed,
        completedAt: !task.completed ? Timestamp.now() : null
      });
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ));
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  // Delete task
  const deleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, "daily_tasks", taskId));
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // Add template tasks for a time block
  const addTemplateTasks = async (timeBlock) => {
    if (!auth.currentUser) return;
    const templates = TASK_TEMPLATES[timeBlock] || [];
    try {
      for (const template of templates) {
        const taskData = {
          userId: auth.currentUser.uid,
          date: selectedDate,
          text: template.text,
          priority: template.priority,
          timeBlock,
          completed: false,
          createdAt: Timestamp.now()
        };
        const docRef = await addDoc(collection(db, "daily_tasks"), taskData);
        setTasks(prev => [...prev, { ...taskData, id: docRef.id }]);
      }
    } catch (error) {
      console.error("Error adding templates:", error);
    }
  };

  // Copy previous day's tasks
  const copyFromPreviousDay = async () => {
    if (!auth.currentUser) return;
    const prevDate = new Date(selectedDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    
    try {
      const prevQuery = query(
        collection(db, "daily_tasks"),
        where("userId", "==", auth.currentUser.uid),
        where("date", "==", prevDateStr)
      );
      const snapshot = await getDocs(prevQuery);
      
      for (const docSnap of snapshot.docs) {
        const prevTask = docSnap.data();
        const taskData = {
          userId: auth.currentUser.uid,
          date: selectedDate,
          text: prevTask.text,
          priority: prevTask.priority,
          timeBlock: prevTask.timeBlock,
          completed: false,
          createdAt: Timestamp.now()
        };
        const docRef = await addDoc(collection(db, "daily_tasks"), taskData);
        setTasks(prev => [...prev, { ...taskData, id: docRef.id }]);
      }
    } catch (error) {
      console.error("Error copying tasks:", error);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const highPriority = tasks.filter(t => t.priority === 'high' && !t.completed).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, highPriority, progress };
  }, [tasks]);

  // Get tasks for a time block
  const getBlockTasks = (blockKey) => tasks.filter(t => t.timeBlock === blockKey);

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
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
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
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>📅 Daily Planner</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.925rem' }}>
              Structure your trading day for maximum focus
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={copyFromPreviousDay}
              style={{
                ...buttonStyle,
                background: 'rgba(30, 41, 59, 0.5)',
                color: '#94a3b8',
                border: '1px solid rgba(71, 85, 105, 0.4)'
              }}
            >
              📋 Copy Yesterday
            </button>
            <button
              onClick={saveDailyNotes}
              style={{
                ...buttonStyle,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
              }}
            >
              💾 Save Notes
            </button>
          </div>
        </div>
      </div>

      {/* Date Navigation & Stats */}
      <div style={{ padding: '0 2rem', marginBottom: '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Date Nav */}
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
              minWidth: '200px',
              textAlign: 'center'
            }}>
              {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
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
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                  : 'rgba(30, 41, 59, 0.5)',
                color: selectedDate === new Date().toISOString().split('T')[0] ? 'white' : '#94a3b8',
                border: selectedDate === new Date().toISOString().split('T')[0] ? 'none' : '1px solid rgba(71, 85, 105, 0.4)',
                padding: '0.5rem 1rem'
              }}
            >
              Today
            </button>
          </div>

          {/* Progress Stats */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{
              ...cardStyle,
              padding: '0.75rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%',
                background: `conic-gradient(#10b981 ${stats.progress * 3.6}deg, rgba(71, 85, 105, 0.3) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  color: '#10b981'
                }}>
                  {stats.progress}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Progress</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#f1f5f9' }}>
                  {stats.completed}/{stats.total}
                </div>
              </div>
            </div>
            {stats.highPriority > 0 && (
              <div style={{
                ...cardStyle,
                padding: '0.75rem 1.25rem',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.1)'
              }}>
                <div style={{ fontSize: '0.7rem', color: '#ef4444', textTransform: 'uppercase' }}>High Priority</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ef4444' }}>
                  {stats.highPriority} left
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily Settings */}
      <div style={{ padding: '0 2rem', marginBottom: '1.5rem' }}>
        <div style={{ ...cardStyle }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1.5rem',
            alignItems: 'end'
          }}>
            {/* Daily Focus */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                🎯 Daily Focus
              </label>
              <input
                type="text"
                value={dailyFocus}
                onChange={(e) => setDailyFocus(e.target.value)}
                placeholder="What's your main focus today?"
                style={inputStyle}
              />
            </div>

            {/* Market Bias */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                📈 Market Bias
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['bullish', 'neutral', 'bearish'].map(bias => (
                  <button
                    key={bias}
                    onClick={() => setMarketBias(bias)}
                    style={{
                      flex: 1,
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: `1px solid ${marketBias === bias 
                        ? bias === 'bullish' ? '#10b981' : bias === 'bearish' ? '#ef4444' : '#f59e0b'
                        : 'rgba(71, 85, 105, 0.4)'}`,
                      background: marketBias === bias 
                        ? bias === 'bullish' ? 'rgba(16, 185, 129, 0.2)' : bias === 'bearish' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(15, 23, 42, 0.5)',
                      color: marketBias === bias 
                        ? bias === 'bullish' ? '#10b981' : bias === 'bearish' ? '#ef4444' : '#f59e0b'
                        : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      textTransform: 'capitalize'
                    }}
                  >
                    {bias === 'bullish' ? '🐂' : bias === 'bearish' ? '🐻' : '➡️'} {bias}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Level */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                ⚠️ Risk Level
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['reduced', 'normal', 'aggressive'].map(level => (
                  <button
                    key={level}
                    onClick={() => setRiskLevel(level)}
                    style={{
                      flex: 1,
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: `1px solid ${riskLevel === level 
                        ? level === 'reduced' ? '#10b981' : level === 'aggressive' ? '#ef4444' : '#3b82f6'
                        : 'rgba(71, 85, 105, 0.4)'}`,
                      background: riskLevel === level 
                        ? level === 'reduced' ? 'rgba(16, 185, 129, 0.2)' : level === 'aggressive' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'
                        : 'rgba(15, 23, 42, 0.5)',
                      color: riskLevel === level 
                        ? level === 'reduced' ? '#10b981' : level === 'aggressive' ? '#ef4444' : '#3b82f6'
                        : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      textTransform: 'capitalize'
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Blocks */}
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
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📅</div>
              <div style={{ color: '#94a3b8' }}>Loading planner...</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {TIME_BLOCKS.map(block => {
              const blockTasks = getBlockTasks(block.key);
              const completedCount = blockTasks.filter(t => t.completed).length;
              
              return (
                <div 
                  key={block.key}
                  style={{
                    ...cardStyle,
                    borderLeft: `4px solid ${block.color}`
                  }}
                >
                  {/* Block Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid rgba(71, 85, 105, 0.3)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>{block.icon}</span>
                      <div>
                        <h3 style={{ 
                          fontSize: '1rem', 
                          fontWeight: '600', 
                          color: block.color,
                          marginBottom: '0.125rem'
                        }}>
                          {block.label}
                        </h3>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{block.time}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {blockTasks.length > 0 && (
                        <span style={{ 
                          fontSize: '0.8rem', 
                          color: completedCount === blockTasks.length ? '#10b981' : '#64748b',
                          fontWeight: '500'
                        }}>
                          {completedCount}/{blockTasks.length}
                        </span>
                      )}
                      <button
                        onClick={() => addTemplateTasks(block.key)}
                        style={{
                          background: 'rgba(139, 92, 246, 0.15)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          color: '#8b5cf6',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}
                        title="Add template tasks"
                      >
                        ⚡ Templates
                      </button>
                      <button
                        onClick={() => setShowAddTask(block.key)}
                        style={{
                          background: `${block.color}20`,
                          border: `1px solid ${block.color}40`,
                          color: block.color,
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Tasks */}
                  {blockTasks.length === 0 ? (
                    <div style={{ 
                      padding: '1.5rem',
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: '0.875rem',
                      background: 'rgba(15, 23, 42, 0.3)',
                      borderRadius: '8px'
                    }}>
                      No tasks scheduled. Add tasks or use templates to get started.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {blockTasks.map(task => {
                        const priority = PRIORITIES.find(p => p.key === task.priority) || PRIORITIES[1];
                        
                        return (
                          <div
                            key={task.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.75rem 1rem',
                              background: task.completed 
                                ? 'rgba(16, 185, 129, 0.1)' 
                                : 'rgba(15, 23, 42, 0.4)',
                              border: `1px solid ${task.completed 
                                ? 'rgba(16, 185, 129, 0.3)' 
                                : 'rgba(71, 85, 105, 0.2)'}`,
                              borderRadius: '10px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <button
                              onClick={() => toggleTask(task.id)}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                border: `2px solid ${task.completed ? '#10b981' : priority.color}`,
                                background: task.completed ? '#10b981' : 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '0.75rem',
                                flexShrink: 0
                              }}
                            >
                              {task.completed && '✓'}
                            </button>
                            
                            <span style={{ 
                              flex: 1,
                              color: task.completed ? '#64748b' : '#f1f5f9',
                              textDecoration: task.completed ? 'line-through' : 'none',
                              fontSize: '0.9rem'
                            }}>
                              {task.text}
                            </span>

                            <span style={{ 
                              fontSize: '0.7rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              background: `${priority.color}20`,
                              color: priority.color,
                              fontWeight: '500'
                            }}>
                              {priority.icon} {priority.label}
                            </span>

                            <button
                              onClick={() => deleteTask(task.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                padding: '0.25rem',
                                fontSize: '0.875rem',
                                opacity: 0.6,
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#64748b';
                                e.currentTarget.style.opacity = '0.6';
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Task Inline */}
                  {showAddTask === block.key && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      background: 'rgba(15, 23, 42, 0.5)',
                      borderRadius: '10px',
                      border: `1px solid ${block.color}30`
                    }}>
                      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <input
                          type="text"
                          value={newTask.text}
                          onChange={(e) => setNewTask(prev => ({ ...prev, text: e.target.value }))}
                          placeholder="What needs to be done?"
                          style={{ ...inputStyle, flex: 1 }}
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                        />
                        <select
                          value={newTask.priority}
                          onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                          style={{ ...inputStyle, width: 'auto', minWidth: '120px' }}
                        >
                          {PRIORITIES.map(p => (
                            <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            setShowAddTask(null);
                            setNewTask({ text: '', priority: 'medium', timeBlock: '' });
                          }}
                          style={{
                            ...buttonStyle,
                            background: 'rgba(71, 85, 105, 0.3)',
                            color: '#94a3b8',
                            padding: '0.5rem 1rem'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddTask}
                          style={{
                            ...buttonStyle,
                            background: block.color,
                            color: 'white',
                            padding: '0.5rem 1rem'
                          }}
                        >
                          Add Task
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyPlanner;