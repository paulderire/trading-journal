import React, { useState, useEffect, useCallback } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Shared style constants
const cardStyle = {
  background: 'rgba(30, 41, 59, 0.5)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
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

const TradePlan = () => {
  const [activeTab, setActiveTab] = useState('daily');
  const [tradePlans, setTradePlans] = useState([]);
  const [financialGoals, setFinancialGoals] = useState([]);
  const [trades, setTrades] = useState([]);
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Trade plan form
  const [planForm, setPlanForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'daily', // daily, weekly, monthly
    marketBias: 'neutral', // bullish, bearish, neutral
    watchlist: '',
    keyLevels: '',
    entryRules: '',
    exitRules: '',
    riskPerTrade: '1',
    maxDailyLoss: '',
    profitTarget: '',
    sessionFocus: 'london', // london, ny, asia
    notes: '',
    status: 'planned' // planned, in-progress, completed, skipped
  });

  // Financial goal form
  const [goalForm, setGoalForm] = useState({
    title: '',
    type: 'balance', // balance, monthly_income, yearly_income, drawdown, account_growth
    targetAmount: '',
    currentAmount: '',
    startDate: new Date().toISOString().split('T')[0],
    targetDate: '',
    milestones: [],
    notes: '',
    status: 'active'
  });

  const fetchData = useCallback(async (user) => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch trade plans
      const plansQuery = query(collection(db, "trade_plans"), where("userId", "==", user.uid));
      const plansSnapshot = await getDocs(plansQuery);
      setTradePlans(plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch financial goals
      const goalsQuery = query(collection(db, "financial_goals"), where("userId", "==", user.uid));
      const goalsSnapshot = await getDocs(goalsQuery);
      setFinancialGoals(goalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch trades for linking
      const tradesQuery = query(collection(db, "trades"), where("userId", "==", user.uid));
      const tradesSnapshot = await getDocs(tradesQuery);
      setTrades(tradesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch trading accounts
      const accountsQuery = query(collection(db, "trading_accounts"), where("userId", "==", user.uid));
      const accountsSnapshot = await getDocs(accountsQuery);
      setTradingAccounts(accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, fetchData);
    return () => unsubscribe();
  }, [fetchData]);

  // Calculate total account balance
  const totalBalance = tradingAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

  // Get trades for a specific date
  const getTradesForDate = (date) => {
    return trades.filter(trade => {
      const tradeDate = trade.open_time || trade.date;
      if (!tradeDate) return false;
      const d = tradeDate.toDate ? tradeDate.toDate() : new Date(tradeDate);
      return d.toISOString().split('T')[0] === date;
    });
  };

  // Calculate P&L for date
  const getPnLForDate = (date) => {
    return getTradesForDate(date).reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
  };

  // Save trade plan
  const handleSavePlan = async () => {
    if (!auth.currentUser) return;
    try {
      if (editingPlan) {
        await updateDoc(doc(db, "trade_plans", editingPlan.id), {
          ...planForm,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, "trade_plans"), {
          ...planForm,
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      }
      setShowPlanModal(false);
      setEditingPlan(null);
      resetPlanForm();
      fetchData(auth.currentUser);
    } catch (error) {
      console.error("Error saving plan:", error);
    }
  };

  // Save financial goal
  const handleSaveGoal = async () => {
    if (!auth.currentUser) return;
    try {
      if (editingGoal) {
        await updateDoc(doc(db, "financial_goals", editingGoal.id), {
          ...goalForm,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, "financial_goals"), {
          ...goalForm,
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      }
      setShowGoalModal(false);
      setEditingGoal(null);
      resetGoalForm();
      fetchData(auth.currentUser);
    } catch (error) {
      console.error("Error saving goal:", error);
    }
  };

  // Delete handlers
  const handleDeletePlan = async (id) => {
    if (!window.confirm("Delete this trade plan?")) return;
    await deleteDoc(doc(db, "trade_plans", id));
    fetchData(auth.currentUser);
  };

  const handleDeleteGoal = async (id) => {
    if (!window.confirm("Delete this financial goal?")) return;
    await deleteDoc(doc(db, "financial_goals", id));
    fetchData(auth.currentUser);
  };

  const resetPlanForm = () => {
    setPlanForm({
      date: new Date().toISOString().split('T')[0],
      type: 'daily',
      marketBias: 'neutral',
      watchlist: '',
      keyLevels: '',
      entryRules: '',
      exitRules: '',
      riskPerTrade: '1',
      maxDailyLoss: '',
      profitTarget: '',
      sessionFocus: 'london',
      notes: '',
      status: 'planned'
    });
  };

  const resetGoalForm = () => {
    setGoalForm({
      title: '',
      type: 'balance',
      targetAmount: '',
      currentAmount: '',
      startDate: new Date().toISOString().split('T')[0],
      targetDate: '',
      milestones: [],
      notes: '',
      status: 'active'
    });
  };

  // Get plan for selected date
  const todaysPlan = tradePlans.find(p => p.date === selectedDate);

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  if (loading) {
    return (
      <div className="feature-page" style={{
        background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          Loading trade plans...
        </div>
      </div>
    );
  }

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
        padding: '1.5rem 2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              marginBottom: '0.25rem',
              background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>📋 Trade Plan & Financial Goals</h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Plan your trades, trade your plan
            </p>
          </div>

          {/* Account Balance Summary */}
          <div style={{
            ...cardStyle,
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            width: 'auto'
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Total Balance</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>{formatCurrency(totalBalance)}</div>
            </div>
            <div style={{ width: '1px', height: '40px', background: 'rgba(71, 85, 105, 0.4)' }} />
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Today's P&L</div>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: getPnLForDate(selectedDate) >= 0 ? '#10b981' : '#ef4444' 
              }}>
                {formatCurrency(getPnLForDate(selectedDate))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          {[
            { key: 'daily', label: '📅 Daily Plan', icon: '📅' },
            { key: 'weekly', label: '📆 Weekly Plan', icon: '📆' },
            { key: 'financial', label: '💰 Financial Goals', icon: '💰' }
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
      </div>

      <div style={{ padding: '1.5rem 2rem' }}>
        {/* Daily Plan Tab */}
        {activeTab === 'daily' && (
          <div>
            {/* Date Selector & Add Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ ...inputStyle, width: 'auto' }}
                />
                <span style={{ color: '#64748b' }}>
                  {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <button
                onClick={() => {
                  setPlanForm({ ...planForm, date: selectedDate, type: 'daily' });
                  setShowPlanModal(true);
                }}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white'
                }}
              >
                ➕ {todaysPlan ? 'Edit Plan' : 'Create Plan'}
              </button>
            </div>

            {/* Today's Plan Card */}
            {todaysPlan ? (
              <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f1f5f9', marginBottom: '0.5rem' }}>
                      📋 Trade Plan for {new Date(todaysPlan.date).toLocaleDateString()}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: todaysPlan.marketBias === 'bullish' ? 'rgba(16, 185, 129, 0.2)' :
                                   todaysPlan.marketBias === 'bearish' ? 'rgba(239, 68, 68, 0.2)' :
                                   'rgba(148, 163, 184, 0.2)',
                        color: todaysPlan.marketBias === 'bullish' ? '#10b981' :
                               todaysPlan.marketBias === 'bearish' ? '#ef4444' : '#94a3b8'
                      }}>
                        {todaysPlan.marketBias === 'bullish' ? '🟢 Bullish' :
                         todaysPlan.marketBias === 'bearish' ? '🔴 Bearish' : '⚪ Neutral'}
                      </span>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: '#3b82f6'
                      }}>
                        {todaysPlan.sessionFocus?.toUpperCase()} Session
                      </span>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        background: todaysPlan.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' :
                                   todaysPlan.status === 'in-progress' ? 'rgba(245, 158, 11, 0.2)' :
                                   'rgba(148, 163, 184, 0.2)',
                        color: todaysPlan.status === 'completed' ? '#10b981' :
                               todaysPlan.status === 'in-progress' ? '#f59e0b' : '#94a3b8'
                      }}>
                        {todaysPlan.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => {
                        setEditingPlan(todaysPlan);
                        setPlanForm(todaysPlan);
                        setShowPlanModal(true);
                      }}
                      style={{ ...buttonStyle, background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '0.5rem 1rem' }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeletePlan(todaysPlan.id)}
                      style={{ ...buttonStyle, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.5rem 1rem' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {/* Watchlist */}
                  <div>
                    <h4 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>📊 Watchlist</h4>
                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '8px', color: '#f1f5f9' }}>
                      {todaysPlan.watchlist || 'No watchlist set'}
                    </div>
                  </div>

                  {/* Key Levels */}
                  <div>
                    <h4 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>📏 Key Levels</h4>
                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '8px', color: '#f1f5f9', whiteSpace: 'pre-wrap' }}>
                      {todaysPlan.keyLevels || 'No key levels set'}
                    </div>
                  </div>

                  {/* Entry Rules */}
                  <div>
                    <h4 style={{ fontSize: '0.875rem', color: '#10b981', marginBottom: '0.5rem', textTransform: 'uppercase' }}>✅ Entry Rules</h4>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', color: '#f1f5f9', whiteSpace: 'pre-wrap' }}>
                      {todaysPlan.entryRules || 'No entry rules set'}
                    </div>
                  </div>

                  {/* Exit Rules */}
                  <div>
                    <h4 style={{ fontSize: '0.875rem', color: '#ef4444', marginBottom: '0.5rem', textTransform: 'uppercase' }}>🚪 Exit Rules</h4>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', color: '#f1f5f9', whiteSpace: 'pre-wrap' }}>
                      {todaysPlan.exitRules || 'No exit rules set'}
                    </div>
                  </div>
                </div>

                {/* Risk Management */}
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Risk Per Trade: </span>
                    <span style={{ color: '#f59e0b', fontWeight: '600' }}>{todaysPlan.riskPerTrade}%</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Max Daily Loss: </span>
                    <span style={{ color: '#ef4444', fontWeight: '600' }}>{formatCurrency(todaysPlan.maxDailyLoss)}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Profit Target: </span>
                    <span style={{ color: '#10b981', fontWeight: '600' }}>{formatCurrency(todaysPlan.profitTarget)}</span>
                  </div>
                </div>

                {/* Notes */}
                {todaysPlan.notes && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>📝 Notes</h4>
                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '1rem', borderRadius: '8px', color: '#94a3b8' }}>
                      {todaysPlan.notes}
                    </div>
                  </div>
                )}

                {/* Today's Trades Summary */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
                  <h4 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem', textTransform: 'uppercase' }}>📈 Today's Execution</h4>
                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Trades Taken: </span>
                      <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{getTradesForDate(selectedDate).length}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>P&L: </span>
                      <span style={{ 
                        color: getPnLForDate(selectedDate) >= 0 ? '#10b981' : '#ef4444', 
                        fontWeight: '600' 
                      }}>
                        {formatCurrency(getPnLForDate(selectedDate))}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Target Hit: </span>
                      <span style={{ 
                        color: getPnLForDate(selectedDate) >= parseFloat(todaysPlan.profitTarget || 0) ? '#10b981' : '#f59e0b',
                        fontWeight: '600'
                      }}>
                        {getPnLForDate(selectedDate) >= parseFloat(todaysPlan.profitTarget || 0) ? '✅ Yes' : '⏳ Not Yet'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                <h3 style={{ fontSize: '1.25rem', color: '#f1f5f9', marginBottom: '0.5rem' }}>No Plan for This Day</h3>
                <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Create a trade plan to stay disciplined</p>
                <button
                  onClick={() => {
                    setPlanForm({ ...planForm, date: selectedDate, type: 'daily' });
                    setShowPlanModal(true);
                  }}
                  style={{
                    ...buttonStyle,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    margin: '0 auto'
                  }}
                >
                  ➕ Create Trade Plan
                </button>
              </div>
            )}

            {/* Recent Plans */}
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#f1f5f9', marginTop: '2rem', marginBottom: '1rem' }}>
              📚 Recent Trade Plans
            </h3>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {tradePlans
                .filter(p => p.type === 'daily' && p.date !== selectedDate)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5)
                .map(plan => (
                  <div 
                    key={plan.id} 
                    style={{ 
                      ...cardStyle, 
                      padding: '1rem 1.5rem',
                      cursor: 'pointer',
                      opacity: 0.8,
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setSelectedDate(plan.date)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: '#f1f5f9', fontWeight: '500' }}>
                          {new Date(plan.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span style={{
                          marginLeft: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          background: plan.marketBias === 'bullish' ? 'rgba(16, 185, 129, 0.2)' :
                                     plan.marketBias === 'bearish' ? 'rgba(239, 68, 68, 0.2)' :
                                     'rgba(148, 163, 184, 0.2)',
                          color: plan.marketBias === 'bullish' ? '#10b981' :
                                 plan.marketBias === 'bearish' ? '#ef4444' : '#94a3b8'
                        }}>
                          {plan.marketBias}
                        </span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        P&L: <span style={{ color: getPnLForDate(plan.date) >= 0 ? '#10b981' : '#ef4444' }}>
                          {formatCurrency(getPnLForDate(plan.date))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Weekly Plan Tab */}
        {activeTab === 'weekly' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#f1f5f9' }}>📆 Weekly Trade Plans</h3>
              <button
                onClick={() => {
                  setPlanForm({ ...planForm, type: 'weekly' });
                  setShowPlanModal(true);
                }}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white'
                }}
              >
                ➕ Create Weekly Plan
              </button>
            </div>

            {tradePlans.filter(p => p.type === 'weekly').length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📆</div>
                <h3 style={{ fontSize: '1.25rem', color: '#f1f5f9', marginBottom: '0.5rem' }}>No Weekly Plans Yet</h3>
                <p style={{ color: '#64748b' }}>Create weekly plans to track your longer-term trading strategy</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {tradePlans
                  .filter(p => p.type === 'weekly')
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map(plan => (
                    <div key={plan.id} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ color: '#f1f5f9', fontWeight: '600' }}>
                            Week of {new Date(plan.date).toLocaleDateString()}
                          </h4>
                          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                            {plan.notes || 'No notes'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => {
                              setEditingPlan(plan);
                              setPlanForm(plan);
                              setShowPlanModal(true);
                            }}
                            style={{ background: 'rgba(59, 130, 246, 0.2)', border: 'none', color: '#3b82f6', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#ef4444', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Financial Goals Tab */}
        {activeTab === 'financial' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#f1f5f9' }}>💰 Financial Goals</h3>
              <button
                onClick={() => setShowGoalModal(true)}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white'
                }}
              >
                ➕ Add Financial Goal
              </button>
            </div>

            {/* Current Balance Overview */}
            <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', color: '#64748b', marginBottom: '1rem' }}>💳 Account Balances</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {tradingAccounts.map(acc => (
                  <div key={acc.id} style={{ 
                    background: 'rgba(15, 23, 42, 0.4)', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    borderLeft: '3px solid #10b981'
                  }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{acc.name}</div>
                    <div style={{ color: '#10b981', fontSize: '1.25rem', fontWeight: '700' }}>
                      {formatCurrency(acc.balance)}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{acc.broker}</div>
                  </div>
                ))}
                {tradingAccounts.length === 0 && (
                  <div style={{ color: '#64748b' }}>No trading accounts. Add them in Account settings.</div>
                )}
              </div>
            </div>

            {/* Financial Goals List */}
            {financialGoals.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
                <h3 style={{ fontSize: '1.25rem', color: '#f1f5f9', marginBottom: '0.5rem' }}>No Financial Goals Yet</h3>
                <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Set financial milestones to track your trading journey</p>
                <button
                  onClick={() => setShowGoalModal(true)}
                  style={{
                    ...buttonStyle,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    margin: '0 auto'
                  }}
                >
                  ➕ Add Your First Goal
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {financialGoals.map(goal => {
                  const progress = (parseFloat(goal.currentAmount || totalBalance) / parseFloat(goal.targetAmount)) * 100;
                  const isCompleted = progress >= 100;
                  
                  return (
                    <div key={goal.id} style={{ ...cardStyle }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div>
                          <h4 style={{ color: '#f1f5f9', fontWeight: '600', marginBottom: '0.25rem' }}>
                            {goal.type === 'balance' && '💰'}
                            {goal.type === 'monthly_income' && '📅'}
                            {goal.type === 'yearly_income' && '📆'}
                            {goal.type === 'account_growth' && '📈'}
                            {goal.type === 'drawdown' && '🛡️'}
                            {' '}{goal.title}
                          </h4>
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            background: isCompleted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                            color: isCompleted ? '#10b981' : '#3b82f6'
                          }}>
                            {isCompleted ? '✅ Completed' : goal.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => {
                              setEditingGoal(goal);
                              setGoalForm(goal);
                              setShowGoalModal(true);
                            }}
                            style={{ background: 'rgba(59, 130, 246, 0.2)', border: 'none', color: '#3b82f6', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#ef4444', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                            Current: {formatCurrency(goal.currentAmount || totalBalance)}
                          </span>
                          <span style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600' }}>
                            Target: {formatCurrency(goal.targetAmount)}
                          </span>
                        </div>
                        <div style={{ 
                          height: '12px', 
                          background: 'rgba(15, 23, 42, 0.6)', 
                          borderRadius: '6px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(progress, 100)}%`,
                            height: '100%',
                            background: isCompleted 
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                              : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            borderRadius: '6px',
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                        <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
                          <span style={{ color: isCompleted ? '#10b981' : '#3b82f6', fontWeight: '600' }}>
                            {progress.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Goal Details */}
                      <div style={{ display: 'flex', gap: '2rem', fontSize: '0.8rem', color: '#64748b' }}>
                        {goal.startDate && (
                          <span>Started: {new Date(goal.startDate).toLocaleDateString()}</span>
                        )}
                        {goal.targetDate && (
                          <span>Target Date: {new Date(goal.targetDate).toLocaleDateString()}</span>
                        )}
                        <span>
                          Remaining: {formatCurrency(Math.max(0, parseFloat(goal.targetAmount) - (goal.currentAmount || totalBalance)))}
                        </span>
                      </div>

                      {goal.notes && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', color: '#94a3b8', fontSize: '0.875rem' }}>
                          {goal.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trade Plan Modal */}
      {showPlanModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            ...cardStyle,
            maxWidth: '700px',
            maxHeight: '90vh',
            overflow: 'auto',
            width: '100%'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f1f5f9', marginBottom: '1.5rem' }}>
              {editingPlan ? '✏️ Edit Trade Plan' : '📋 Create Trade Plan'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Date</label>
                <input
                  type="date"
                  value={planForm.date}
                  onChange={(e) => setPlanForm({ ...planForm, date: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Market Bias</label>
                <select
                  value={planForm.marketBias}
                  onChange={(e) => setPlanForm({ ...planForm, marketBias: e.target.value })}
                  style={inputStyle}
                >
                  <option value="bullish">🟢 Bullish</option>
                  <option value="bearish">🔴 Bearish</option>
                  <option value="neutral">⚪ Neutral</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Session Focus</label>
                <select
                  value={planForm.sessionFocus}
                  onChange={(e) => setPlanForm({ ...planForm, sessionFocus: e.target.value })}
                  style={inputStyle}
                >
                  <option value="asia">Asia</option>
                  <option value="london">London</option>
                  <option value="ny">New York</option>
                  <option value="all">All Sessions</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Status</label>
                <select
                  value={planForm.status}
                  onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}
                  style={inputStyle}
                >
                  <option value="planned">Planned</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Watchlist (symbols)</label>
              <input
                type="text"
                value={planForm.watchlist}
                onChange={(e) => setPlanForm({ ...planForm, watchlist: e.target.value })}
                placeholder="EURUSD, GBPUSD, XAUUSD..."
                style={inputStyle}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Key Levels</label>
              <textarea
                value={planForm.keyLevels}
                onChange={(e) => setPlanForm({ ...planForm, keyLevels: e.target.value })}
                placeholder="Support: 1.0850&#10;Resistance: 1.0920&#10;..."
                rows={3}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#10b981', fontSize: '0.875rem', marginBottom: '0.5rem' }}>✅ Entry Rules</label>
                <textarea
                  value={planForm.entryRules}
                  onChange={(e) => setPlanForm({ ...planForm, entryRules: e.target.value })}
                  placeholder="1. Wait for confirmation&#10;2. Enter on pullback&#10;..."
                  rows={4}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#ef4444', fontSize: '0.875rem', marginBottom: '0.5rem' }}>🚪 Exit Rules</label>
                <textarea
                  value={planForm.exitRules}
                  onChange={(e) => setPlanForm({ ...planForm, exitRules: e.target.value })}
                  placeholder="1. Take profit at 1:2 RR&#10;2. Stop loss below swing&#10;..."
                  rows={4}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Risk Per Trade (%)</label>
                <input
                  type="number"
                  value={planForm.riskPerTrade}
                  onChange={(e) => setPlanForm({ ...planForm, riskPerTrade: e.target.value })}
                  placeholder="1"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Max Daily Loss ($)</label>
                <input
                  type="number"
                  value={planForm.maxDailyLoss}
                  onChange={(e) => setPlanForm({ ...planForm, maxDailyLoss: e.target.value })}
                  placeholder="500"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Profit Target ($)</label>
                <input
                  type="number"
                  value={planForm.profitTarget}
                  onChange={(e) => setPlanForm({ ...planForm, profitTarget: e.target.value })}
                  placeholder="300"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Notes</label>
              <textarea
                value={planForm.notes}
                onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })}
                placeholder="Any additional notes for today..."
                rows={3}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  setEditingPlan(null);
                  resetPlanForm();
                }}
                style={{ ...buttonStyle, background: 'rgba(71, 85, 105, 0.4)', color: '#94a3b8' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                style={{ ...buttonStyle, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white' }}
              >
                {editingPlan ? '💾 Update Plan' : '✅ Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Financial Goal Modal */}
      {showGoalModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            ...cardStyle,
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
            width: '100%'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f1f5f9', marginBottom: '1.5rem' }}>
              {editingGoal ? '✏️ Edit Financial Goal' : '💰 Add Financial Goal'}
            </h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Goal Title</label>
              <input
                type="text"
                value={goalForm.title}
                onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                placeholder="e.g., Reach $50,000 account"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Goal Type</label>
              <select
                value={goalForm.type}
                onChange={(e) => setGoalForm({ ...goalForm, type: e.target.value })}
                style={inputStyle}
              >
                <option value="balance">💰 Account Balance Target</option>
                <option value="monthly_income">📅 Monthly Income Target</option>
                <option value="yearly_income">📆 Yearly Income Target</option>
                <option value="account_growth">📈 Account Growth (%)</option>
                <option value="drawdown">🛡️ Max Drawdown Limit</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Current Amount ($)</label>
                <input
                  type="number"
                  value={goalForm.currentAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, currentAmount: e.target.value })}
                  placeholder={totalBalance.toString()}
                  style={inputStyle}
                />
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Leave empty to use total balance: {formatCurrency(totalBalance)}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Target Amount ($)</label>
                <input
                  type="number"
                  value={goalForm.targetAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                  placeholder="50000"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Start Date</label>
                <input
                  type="date"
                  value={goalForm.startDate}
                  onChange={(e) => setGoalForm({ ...goalForm, startDate: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Target Date</label>
                <input
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Notes</label>
              <textarea
                value={goalForm.notes}
                onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })}
                placeholder="Why is this goal important to you?"
                rows={3}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => {
                  setShowGoalModal(false);
                  setEditingGoal(null);
                  resetGoalForm();
                }}
                style={{ ...buttonStyle, background: 'rgba(71, 85, 105, 0.4)', color: '#94a3b8' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGoal}
                style={{ ...buttonStyle, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white' }}
              >
                {editingGoal ? '💾 Update Goal' : '✅ Add Goal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradePlan;
