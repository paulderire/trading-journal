import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from "firebase/firestore";

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

const GOAL_TYPES = [
  { key: 'profit', label: 'Profit Target', icon: '💰', unit: '$' },
  { key: 'winRate', label: 'Win Rate', icon: '📊', unit: '%' },
  { key: 'trades', label: 'Trade Count', icon: '📈', unit: 'trades' },
  { key: 'rMultiple', label: 'R-Multiple', icon: '🎯', unit: 'R' },
  { key: 'maxLoss', label: 'Max Daily Loss', icon: '🛡️', unit: '$' },
  { key: 'consistency', label: 'Consistency Days', icon: '📅', unit: 'days' },
  { key: 'drawdown', label: 'Max Drawdown', icon: '📉', unit: '%' },
  { key: 'custom', label: 'Custom Goal', icon: '✨', unit: '' }
];

const TIMEFRAMES = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly', label: 'Yearly' }
];

const GoalSetting = () => {
  const [goals, setGoals] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [formData, setFormData] = useState({
    type: 'profit',
    title: '',
    targetValue: '',
    currentValue: 0,
    timeframe: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    notes: '',
    priority: 'medium',
    customUnit: ''
  });

  // Fetch goals and trades
  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        // Fetch goals
        const goalsQuery = query(
          collection(db, "goals"),
          where("userId", "==", auth.currentUser.uid)
        );
        const goalsSnapshot = await getDocs(goalsQuery);
        const goalsData = goalsSnapshot.docs.map(doc => {
          const data = doc.data();
          const safeDate = (val) => {
            if (!val) return null;
            if (val.toDate) return val.toDate();
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
          };
          return {
            id: doc.id,
            ...data,
            startDate: safeDate(data.startDate) || new Date(),
            endDate: safeDate(data.endDate),
            createdAt: safeDate(data.createdAt) || new Date()
          };
        });
        setGoals(goalsData);

        // Fetch trades for progress calculation
        const tradesQuery = query(
          collection(db, "trades"),
          where("userId", "==", auth.currentUser.uid)
        );
        const tradesSnapshot = await getDocs(tradesQuery);
        const tradesData = tradesSnapshot.docs.map(doc => {
          const data = doc.data();
          let openTime = data.open_time;
          if (openTime?.toDate) openTime = openTime.toDate();
          else if (openTime) {
            const d = new Date(openTime);
            openTime = isNaN(d.getTime()) ? new Date() : d;
          } else openTime = new Date();
          return { id: doc.id, ...data, open_time: openTime };
        });
        setTrades(tradesData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Calculate goal progress based on trades
  const calculateProgress = (goal) => {
    const now = new Date();
    const startDate = new Date(goal.startDate);
    const endDate = new Date(goal.endDate);
    
    // Filter trades within goal period
    const relevantTrades = trades.filter(t => {
      const tradeDate = new Date(t.open_time);
      return tradeDate >= startDate && tradeDate <= endDate;
    });

    switch (goal.type) {
      case 'profit':
        return relevantTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      case 'winRate':
        if (relevantTrades.length === 0) return 0;
        const wins = relevantTrades.filter(t => t.pnl > 0).length;
        return (wins / relevantTrades.length) * 100;
      case 'trades':
        return relevantTrades.length;
      case 'rMultiple':
        if (relevantTrades.length === 0) return 0;
        return relevantTrades.reduce((sum, t) => sum + (t.rr_ratio || 0), 0) / relevantTrades.length;
      case 'maxLoss':
        // Track max single day loss
        const dailyLosses = {};
        relevantTrades.forEach(t => {
          const date = new Date(t.open_time).toDateString();
          dailyLosses[date] = (dailyLosses[date] || 0) + (t.pnl < 0 ? Math.abs(t.pnl) : 0);
        });
        return Math.max(...Object.values(dailyLosses), 0);
      case 'consistency':
        // Count unique trading days
        const tradingDays = new Set(relevantTrades.map(t => new Date(t.open_time).toDateString()));
        return tradingDays.size;
      case 'drawdown':
        // Simple drawdown calculation
        let peak = 0;
        let maxDrawdown = 0;
        let cumulative = 0;
        relevantTrades.forEach(t => {
          cumulative += t.pnl || 0;
          if (cumulative > peak) peak = cumulative;
          const drawdown = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0;
          if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });
        return maxDrawdown;
      default:
        return goal.currentValue || 0;
    }
  };

  // Get progress percentage
  const getProgressPercentage = (goal) => {
    const current = calculateProgress(goal);
    const target = parseFloat(goal.targetValue) || 1;
    
    // For maxLoss and drawdown, we want to stay BELOW target
    if (goal.type === 'maxLoss' || goal.type === 'drawdown') {
      return current <= target ? 100 : Math.max(0, (1 - (current - target) / target) * 100);
    }
    
    return Math.min(100, (current / target) * 100);
  };

  // Get goal status
  const getGoalStatus = (goal) => {
    const now = new Date();
    const endDate = new Date(goal.endDate);
    const progress = getProgressPercentage(goal);
    
    if (goal.completed) return 'completed';
    if (now > endDate && progress < 100) return 'failed';
    if (now > endDate && progress >= 100) return 'completed';
    if (progress >= 100) return 'achieved';
    return 'active';
  };

  // Filter goals by tab
  const filteredGoals = useMemo(() => {
    return goals.filter(goal => {
      const status = getGoalStatus(goal);
      if (activeTab === 'active') return status === 'active' || status === 'achieved';
      if (activeTab === 'completed') return status === 'completed';
      if (activeTab === 'failed') return status === 'failed';
      return true;
    });
  }, [goals, trades, activeTab]);

  // Stats
  const stats = useMemo(() => {
    const activeCount = goals.filter(g => getGoalStatus(g) === 'active').length;
    const completedCount = goals.filter(g => getGoalStatus(g) === 'completed').length;
    const failedCount = goals.filter(g => getGoalStatus(g) === 'failed').length;
    const achievedCount = goals.filter(g => getGoalStatus(g) === 'achieved').length;
    const successRate = goals.length > 0 
      ? ((completedCount + achievedCount) / goals.length) * 100 
      : 0;
    return { activeCount, completedCount, failedCount, achievedCount, successRate, total: goals.length };
  }, [goals, trades]);

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const goalData = {
        ...formData,
        userId: auth.currentUser.uid,
        targetValue: parseFloat(formData.targetValue),
        currentValue: 0,
        completed: false,
        startDate: Timestamp.fromDate(new Date(formData.startDate)),
        endDate: Timestamp.fromDate(new Date(formData.endDate)),
        createdAt: Timestamp.now()
      };

      if (editingGoal) {
        await updateDoc(doc(db, "goals", editingGoal.id), goalData);
        setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, ...goalData, id: editingGoal.id } : g));
      } else {
        const docRef = await addDoc(collection(db, "goals"), goalData);
        setGoals(prev => [...prev, { ...goalData, id: docRef.id }]);
      }

      resetForm();
    } catch (error) {
      console.error("Error saving goal:", error);
    }
  };

  // Delete goal
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this goal?")) return;
    try {
      await deleteDoc(doc(db, "goals", id));
      setGoals(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      console.error("Error deleting goal:", error);
    }
  };

  // Mark as complete
  const markComplete = async (goal) => {
    try {
      await updateDoc(doc(db, "goals", goal.id), { completed: true });
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, completed: true } : g));
    } catch (error) {
      console.error("Error completing goal:", error);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      type: 'profit',
      title: '',
      targetValue: '',
      currentValue: 0,
      timeframe: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      notes: '',
      priority: 'medium',
      customUnit: ''
    });
    setEditingGoal(null);
    setShowModal(false);
  };

  // Edit goal
  const handleEdit = (goal) => {
    setFormData({
      type: goal.type,
      title: goal.title,
      targetValue: goal.targetValue.toString(),
      currentValue: goal.currentValue,
      timeframe: goal.timeframe,
      startDate: new Date(goal.startDate).toISOString().split('T')[0],
      endDate: new Date(goal.endDate).toISOString().split('T')[0],
      notes: goal.notes || '',
      priority: goal.priority || 'medium',
      customUnit: goal.customUnit || ''
    });
    setEditingGoal(goal);
    setShowModal(true);
  };

  // Get goal type info
  const getGoalTypeInfo = (type) => GOAL_TYPES.find(t => t.key === type) || GOAL_TYPES[0];

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#64748b';
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'achieved': return '#3b82f6';
      case 'failed': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  // Set end date based on timeframe
  const handleTimeframeChange = (timeframe) => {
    const start = new Date(formData.startDate);
    let end = new Date(start);
    
    switch (timeframe) {
      case 'daily':
        end = new Date(start);
        break;
      case 'weekly':
        end.setDate(start.getDate() + 7);
        break;
      case 'monthly':
        end.setMonth(start.getMonth() + 1);
        break;
      case 'quarterly':
        end.setMonth(start.getMonth() + 3);
        break;
      case 'yearly':
        end.setFullYear(start.getFullYear() + 1);
        break;
    }
    
    setFormData(prev => ({
      ...prev,
      timeframe,
      endDate: end.toISOString().split('T')[0]
    }));
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
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
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
              background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>🎯 Goal Setting</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.925rem' }}>
              Set, track, and achieve your trading goals
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
            ➕ New Goal
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
          { label: 'Total Goals', value: stats.total, color: '#3b82f6' },
          { label: 'Active', value: stats.activeCount, color: '#f59e0b' },
          { label: 'Achieved', value: stats.achievedCount, color: '#10b981' },
          { label: 'Completed', value: stats.completedCount, color: '#8b5cf6' },
          { label: 'Failed', value: stats.failedCount, color: '#ef4444' },
          { label: 'Success Rate', value: `${stats.successRate.toFixed(0)}%`, color: stats.successRate >= 70 ? '#10b981' : '#f59e0b' }
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

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        padding: '0 2rem',
        marginBottom: '1.5rem'
      }}>
        {[
          { key: 'active', label: '🔥 Active Goals' },
          { key: 'completed', label: '✅ Completed' },
          { key: 'failed', label: '❌ Failed' },
          { key: 'all', label: '📋 All Goals' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...buttonStyle,
              background: activeTab === tab.key 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                : 'rgba(30, 41, 59, 0.5)',
              color: activeTab === tab.key ? 'white' : '#94a3b8',
              border: activeTab === tab.key ? 'none' : '1px solid rgba(71, 85, 105, 0.4)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Goals Grid */}
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
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎯</div>
              <div style={{ color: '#94a3b8' }}>Loading goals...</div>
            </div>
          </div>
        ) : filteredGoals.length === 0 ? (
          <div style={{ 
            ...cardStyle, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: '300px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
              <div style={{ color: '#f1f5f9', fontWeight: '600', marginBottom: '0.5rem' }}>
                {activeTab === 'active' ? 'No active goals' : activeTab === 'completed' ? 'No completed goals yet' : activeTab === 'failed' ? 'No failed goals' : 'No goals set'}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                {activeTab === 'active' ? 'Create your first goal to start tracking your progress' : 'Goals will appear here based on their status'}
              </div>
              {activeTab === 'active' && (
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    ...buttonStyle,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white'
                  }}
                >
                  ➕ Create First Goal
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {filteredGoals.map(goal => {
              const typeInfo = getGoalTypeInfo(goal.type);
              const status = getGoalStatus(goal);
              const progress = getProgressPercentage(goal);
              const currentValue = calculateProgress(goal);
              const daysLeft = Math.ceil((new Date(goal.endDate) - new Date()) / (1000 * 60 * 60 * 24));
              
              return (
                <div key={goal.id} style={{
                  ...cardStyle,
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Priority indicator */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: getPriorityColor(goal.priority)
                  }} />
                  
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem'
                      }}>
                        {typeInfo.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: '#f1f5f9', marginBottom: '0.125rem' }}>
                          {goal.title || typeInfo.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {goal.timeframe.charAt(0).toUpperCase() + goal.timeframe.slice(1)} Goal
                        </div>
                      </div>
                    </div>
                    <div style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      background: `${getStatusColor(status)}20`,
                      color: getStatusColor(status)
                    }}>
                      {status}
                    </div>
                  </div>

                  {/* Progress */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Progress</span>
                      <span style={{ fontWeight: '700', color: progress >= 100 ? '#10b981' : '#f1f5f9' }}>
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '10px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      borderRadius: '5px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${Math.min(100, progress)}%`,
                        height: '100%',
                        background: progress >= 100 
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : progress >= 50 
                            ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        borderRadius: '5px',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>

                  {/* Values */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    padding: '1rem',
                    background: 'rgba(15, 23, 42, 0.4)',
                    borderRadius: '12px',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                        Current
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f1f5f9' }}>
                        {goal.type === 'profit' || goal.type === 'maxLoss' ? '$' : ''}
                        {currentValue.toFixed(goal.type === 'trades' || goal.type === 'consistency' ? 0 : 2)}
                        {goal.type === 'winRate' || goal.type === 'drawdown' ? '%' : ''}
                        {goal.type === 'rMultiple' ? 'R' : ''}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                        Target
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                        {goal.type === 'profit' || goal.type === 'maxLoss' ? '$' : ''}
                        {goal.targetValue}
                        {goal.type === 'winRate' || goal.type === 'drawdown' ? '%' : ''}
                        {goal.type === 'rMultiple' ? 'R' : ''}
                        {goal.type === 'custom' ? goal.customUnit : ''}
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    fontSize: '0.8rem',
                    color: '#64748b',
                    marginBottom: '1rem'
                  }}>
                    <span>📅 {new Date(goal.startDate).toLocaleDateString()}</span>
                    <span style={{ 
                      color: daysLeft > 0 ? (daysLeft <= 3 ? '#f59e0b' : '#94a3b8') : '#ef4444',
                      fontWeight: daysLeft <= 3 ? '600' : '400'
                    }}>
                      {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Ends today' : 'Ended'}
                    </span>
                    <span>🏁 {new Date(goal.endDate).toLocaleDateString()}</span>
                  </div>

                  {/* Notes */}
                  {goal.notes && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      marginBottom: '1rem',
                      fontStyle: 'italic'
                    }}>
                      💭 {goal.notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {status === 'active' && progress >= 100 && (
                      <button
                        onClick={() => markComplete(goal)}
                        style={{
                          ...buttonStyle,
                          flex: 1,
                          justifyContent: 'center',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: 'white',
                          padding: '0.6rem'
                        }}
                      >
                        ✅ Mark Complete
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(goal)}
                      style={{
                        ...buttonStyle,
                        flex: 1,
                        justifyContent: 'center',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        padding: '0.6rem'
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      style={{
                        ...buttonStyle,
                        justifyContent: 'center',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '0.6rem 1rem'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Goal Templates Section */}
      <div style={{ padding: '0 2rem 2rem' }}>
        <div style={{ ...cardStyle }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#f1f5f9',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ⚡ Quick Start Templates
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: '1rem' 
          }}>
            {[
              { type: 'profit', title: 'Monthly Profit', value: 1000, timeframe: 'monthly', icon: '💰' },
              { type: 'winRate', title: '60% Win Rate', value: 60, timeframe: 'monthly', icon: '📊' },
              { type: 'trades', title: '20 Trades/Week', value: 20, timeframe: 'weekly', icon: '📈' },
              { type: 'maxLoss', title: 'Max $100 Loss/Day', value: 100, timeframe: 'daily', icon: '🛡️' },
              { type: 'consistency', title: '22 Trading Days', value: 22, timeframe: 'monthly', icon: '📅' },
              { type: 'drawdown', title: 'Max 5% Drawdown', value: 5, timeframe: 'monthly', icon: '📉' }
            ].map((template, i) => (
              <button
                key={i}
                onClick={() => {
                  const today = new Date();
                  let endDate = new Date(today);
                  if (template.timeframe === 'daily') endDate = new Date(today);
                  else if (template.timeframe === 'weekly') endDate.setDate(today.getDate() + 7);
                  else if (template.timeframe === 'monthly') endDate.setMonth(today.getMonth() + 1);
                  
                  setFormData({
                    type: template.type,
                    title: template.title,
                    targetValue: template.value.toString(),
                    currentValue: 0,
                    timeframe: template.timeframe,
                    startDate: today.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0],
                    notes: '',
                    priority: 'medium',
                    customUnit: ''
                  });
                  setShowModal(true);
                }}
                style={{
                  padding: '1rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#10b981';
                  e.target.style.background = 'rgba(16, 185, 129, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = 'rgba(71, 85, 105, 0.4)';
                  e.target.style.background = 'rgba(15, 23, 42, 0.5)';
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{template.icon}</div>
                <div style={{ fontWeight: '600', color: '#f1f5f9', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  {template.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {template.timeframe.charAt(0).toUpperCase() + template.timeframe.slice(1)}
                </div>
              </button>
            ))}
          </div>
        </div>
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
              maxWidth: '600px',
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
                color: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🎯 {editingGoal ? 'Edit Goal' : 'Create New Goal'}
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
              {/* Goal Type */}
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
                  Goal Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {GOAL_TYPES.map(type => (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: type.key }))}
                      style={{
                        padding: '0.75rem 0.5rem',
                        background: formData.type === type.key 
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                          : 'rgba(15, 23, 42, 0.5)',
                        border: formData.type === type.key ? 'none' : '1px solid rgba(71, 85, 105, 0.4)',
                        borderRadius: '8px',
                        color: formData.type === type.key ? 'white' : '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{type.icon}</div>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
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
                  Goal Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={`e.g., ${getGoalTypeInfo(formData.type).label}`}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Target Value */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
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
                    Target Value ({getGoalTypeInfo(formData.type).unit || formData.customUnit || 'units'})
                  </label>
                  <input
                    type="number"
                    value={formData.targetValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, targetValue: e.target.value }))}
                    placeholder="Enter target"
                    style={inputStyle}
                    required
                    step="any"
                  />
                </div>
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
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                  </select>
                </div>
              </div>

              {/* Custom Unit (for custom type) */}
              {formData.type === 'custom' && (
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
                    Custom Unit
                  </label>
                  <input
                    type="text"
                    value={formData.customUnit}
                    onChange={(e) => setFormData(prev => ({ ...prev, customUnit: e.target.value }))}
                    placeholder="e.g., pips, points, %"
                    style={inputStyle}
                  />
                </div>
              )}

              {/* Timeframe */}
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
                  Timeframe
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {TIMEFRAMES.map(tf => (
                    <button
                      key={tf.key}
                      type="button"
                      onClick={() => handleTimeframeChange(tf.key)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: formData.timeframe === tf.key 
                          ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' 
                          : 'rgba(15, 23, 42, 0.5)',
                        border: formData.timeframe === tf.key ? 'none' : '1px solid rgba(71, 85, 105, 0.4)',
                        borderRadius: '8px',
                        color: formData.timeframe === tf.key ? 'white' : '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
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
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    style={inputStyle}
                    required
                  />
                </div>
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
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    style={inputStyle}
                    required
                  />
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
                  placeholder="Add any notes or reminders for this goal..."
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
                  {editingGoal ? '💾 Update Goal' : '🎯 Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalSetting;