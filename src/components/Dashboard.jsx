import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Shared style constants with iOS Safari support
const cardStyle = {
  background: 'rgba(30, 41, 59, 0.5)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(71, 85, 105, 0.4)',
  borderRadius: '16px',
  padding: 'clamp(1rem, 3vw, 1.5rem)',
  width: '100%'
};

const Dashboard = () => {
  const [trades, setTrades] = useState([]);
  const [goals, setGoals] = useState([]);
  const [habits, setHabits] = useState([]);
  const [habitCompletions, setHabitCompletions] = useState([]);
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('all'); // all, month, week, today

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        // Fetch trades
        const tradesQuery = query(
          collection(db, "trades"),
          where("userId", "==", auth.currentUser.uid)
        );
        const tradesSnapshot = await getDocs(tradesQuery);
        const tradesData = tradesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTrades(tradesData);

        // Fetch goals
        const goalsQuery = query(
          collection(db, "goals"),
          where("userId", "==", auth.currentUser.uid)
        );
        const goalsSnapshot = await getDocs(goalsQuery);
        setGoals(goalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch habits
        const habitsQuery = query(
          collection(db, "habits"),
          where("userId", "==", auth.currentUser.uid)
        );
        const habitsSnapshot = await getDocs(habitsQuery);
        setHabits(habitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch habit completions
        const completionsQuery = query(
          collection(db, "habit_completions"),
          where("userId", "==", auth.currentUser.uid)
        );
        const completionsSnapshot = await getDocs(completionsQuery);
        setHabitCompletions(completionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch trading accounts
        try {
          const accountsQuery = query(
            collection(db, "trading_accounts"),
            where("userId", "==", auth.currentUser.uid)
          );
          const accountsSnapshot = await getDocs(accountsQuery);
          const accountsData = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log("Dashboard - Trading accounts fetched:", accountsData);
          setTradingAccounts(accountsData);
        } catch (err) {
          console.error("Error fetching trading accounts:", err);
        }

      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Helper to safely parse trade date
  const getTradeDate = (trade) => {
    const dateValue = trade.open_time || trade.date || trade.createdAt;
    if (!dateValue) return new Date();
    if (dateValue.toDate) return dateValue.toDate(); // Firestore Timestamp
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Filter trades by timeframe
  const filteredTrades = useMemo(() => {
    if (timeframe === 'all') return trades;
    
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        return trades;
    }

    return trades.filter(t => {
      const tradeDate = getTradeDate(t);
      return tradeDate >= startDate;
    });
  }, [trades, timeframe]);

  // Calculate comprehensive stats
  const stats = useMemo(() => {
    if (filteredTrades.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakeven: 0,
        winRate: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        profitFactor: 0,
        avgRMultiple: 0,
        expectancy: 0,
        maxDrawdown: 0,
        avgHoldTime: 0,
        todayPnL: 0,
        weekPnL: 0,
        monthPnL: 0,
        bestDay: { date: '', pnl: 0 },
        worstDay: { date: '', pnl: 0 },
        currentStreak: 0,
        longestWinStreak: 0,
        longestLoseStreak: 0,
        tradesPerDay: 0,
        equityCurve: [],
        dailyPnL: {},
        bySymbol: {},
        byStrategy: {},
        bySession: {},
        byDayOfWeek: {}
      };
    }

    const wins = filteredTrades.filter(t => parseFloat(t.pnl || 0) > 0);
    const losses = filteredTrades.filter(t => parseFloat(t.pnl || 0) < 0);
    const breakeven = filteredTrades.filter(t => parseFloat(t.pnl || 0) === 0);
    
    const totalPnL = filteredTrades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
    const totalWins = wins.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0));
    
    const avgWin = wins.length > 0 ? totalWins / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
    const winRate = filteredTrades.length > 0 ? (wins.length / filteredTrades.length) * 100 : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    const expectancy = filteredTrades.length > 0 ? totalPnL / filteredTrades.length : 0;

    // R-Multiple calculations
    const rMultiples = filteredTrades
      .filter(t => t.rMultiple !== undefined && t.rMultiple !== null)
      .map(t => parseFloat(t.rMultiple || 0));
    const avgRMultiple = rMultiples.length > 0 
      ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length 
      : 0;

    // Largest win/loss
    const pnls = filteredTrades.map(t => parseFloat(t.pnl || 0));
    const largestWin = Math.max(...pnls, 0);
    const largestLoss = Math.min(...pnls, 0);

    // Daily PnL grouping
    const dailyPnL = {};
    filteredTrades.forEach(t => {
      const date = getTradeDate(t);
      const dateStr = date.toISOString().split('T')[0];
      dailyPnL[dateStr] = (dailyPnL[dateStr] || 0) + parseFloat(t.pnl || 0);
    });

    // Best/Worst day
    const dailyEntries = Object.entries(dailyPnL);
    let bestDay = { date: '', pnl: 0 };
    let worstDay = { date: '', pnl: 0 };
    dailyEntries.forEach(([date, pnl]) => {
      if (pnl > bestDay.pnl) bestDay = { date, pnl };
      if (pnl < worstDay.pnl) worstDay = { date, pnl };
    });

    // Equity curve
    const sortedTrades = [...filteredTrades].sort((a, b) => {
      const dateA = getTradeDate(a);
      const dateB = getTradeDate(b);
      return dateA - dateB;
    });
    
    let runningTotal = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const equityCurve = sortedTrades.map((t, i) => {
      runningTotal += parseFloat(t.pnl || 0);
      if (runningTotal > peak) peak = runningTotal;
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      return {
        trade: i + 1,
        equity: runningTotal,
        date: getTradeDate(t)
      };
    });

    // Streaks
    let currentStreak = 0;
    let longestWinStreak = 0;
    let longestLoseStreak = 0;
    let tempWinStreak = 0;
    let tempLoseStreak = 0;
    
    sortedTrades.forEach((t, i) => {
      const pnl = parseFloat(t.pnl || 0);
      if (pnl > 0) {
        tempWinStreak++;
        tempLoseStreak = 0;
        if (i === sortedTrades.length - 1) currentStreak = tempWinStreak;
      } else if (pnl < 0) {
        tempLoseStreak++;
        tempWinStreak = 0;
        if (i === sortedTrades.length - 1) currentStreak = -tempLoseStreak;
      }
      longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
      longestLoseStreak = Math.max(longestLoseStreak, tempLoseStreak);
    });

    // By Symbol
    const bySymbol = {};
    filteredTrades.forEach(t => {
      const symbol = t.symbol || 'Unknown';
      if (!bySymbol[symbol]) bySymbol[symbol] = { trades: 0, pnl: 0, wins: 0 };
      bySymbol[symbol].trades++;
      bySymbol[symbol].pnl += parseFloat(t.pnl || 0);
      if (parseFloat(t.pnl || 0) > 0) bySymbol[symbol].wins++;
    });

    // By Strategy
    const byStrategy = {};
    filteredTrades.forEach(t => {
      const strategy = t.strategy || 'No Strategy';
      if (!byStrategy[strategy]) byStrategy[strategy] = { trades: 0, pnl: 0, wins: 0 };
      byStrategy[strategy].trades++;
      byStrategy[strategy].pnl += parseFloat(t.pnl || 0);
      if (parseFloat(t.pnl || 0) > 0) byStrategy[strategy].wins++;
    });

    // By Session (based on hour)
    const bySession = { 'Pre-Market': { trades: 0, pnl: 0 }, 'Open': { trades: 0, pnl: 0 }, 'Mid-Day': { trades: 0, pnl: 0 }, 'Power Hour': { trades: 0, pnl: 0 }, 'After Hours': { trades: 0, pnl: 0 } };
    filteredTrades.forEach(t => {
      const date = getTradeDate(t);
      const hour = date.getHours();
      let session = 'Mid-Day';
      if (hour < 9) session = 'Pre-Market';
      else if (hour < 11) session = 'Open';
      else if (hour < 14) session = 'Mid-Day';
      else if (hour < 16) session = 'Power Hour';
      else session = 'After Hours';
      bySession[session].trades++;
      bySession[session].pnl += parseFloat(t.pnl || 0);
    });

    // By Day of Week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDayOfWeek = {};
    days.forEach(d => byDayOfWeek[d] = { trades: 0, pnl: 0 });
    filteredTrades.forEach(t => {
      const date = getTradeDate(t);
      const day = days[date.getDay()];
      byDayOfWeek[day].trades++;
      byDayOfWeek[day].pnl += parseFloat(t.pnl || 0);
    });

    // Time-based PnL
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - 1);

    const todayPnL = trades
      .filter(t => getTradeDate(t) >= todayStart)
      .reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);

    const weekPnL = trades
      .filter(t => getTradeDate(t) >= weekStart)
      .reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);

    const monthPnL = trades
      .filter(t => getTradeDate(t) >= monthStart)
      .reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);

    // Trades per day
    const uniqueDays = new Set(Object.keys(dailyPnL)).size;
    const tradesPerDay = uniqueDays > 0 ? filteredTrades.length / uniqueDays : 0;

    return {
      totalTrades: filteredTrades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      breakeven: breakeven.length,
      winRate,
      totalPnL,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      profitFactor,
      avgRMultiple,
      expectancy,
      maxDrawdown,
      todayPnL,
      weekPnL,
      monthPnL,
      bestDay,
      worstDay,
      currentStreak,
      longestWinStreak,
      longestLoseStreak,
      tradesPerDay,
      equityCurve,
      dailyPnL,
      bySymbol,
      byStrategy,
      bySession,
      byDayOfWeek
    };
  }, [filteredTrades, trades]);

  // Today's habits completion
  const todayHabits = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const completed = habits.filter(h => 
      habitCompletions.some(c => c.habitId === h.id && c.date === today)
    ).length;
    return { total: habits.length, completed };
  }, [habits, habitCompletions]);

  // Active goals progress
  const activeGoals = useMemo(() => {
    return goals.filter(g => g.status === 'active' || !g.status).slice(0, 3);
  }, [goals]);

  // Account stats - P&L per account and total balance
  const accountStats = useMemo(() => {
    // Calculate P&L per account from trades
    const pnlByAccount = {};
    const tradeCountByAccount = {};
    
    filteredTrades.forEach(trade => {
      const accountName = trade.account || 'Unassigned';
      if (!pnlByAccount[accountName]) {
        pnlByAccount[accountName] = 0;
        tradeCountByAccount[accountName] = 0;
      }
      pnlByAccount[accountName] += parseFloat(trade.pnl || 0);
      tradeCountByAccount[accountName]++;
    });

    // Combine with trading accounts data
    const accountsWithStats = tradingAccounts.map(acc => ({
      ...acc,
      pnl: pnlByAccount[acc.name] || 0,
      tradeCount: tradeCountByAccount[acc.name] || 0
    }));

    // Total balance across all accounts
    const totalBalance = tradingAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    
    // Total realized P&L from all trades
    const totalRealizedPnL = Object.values(pnlByAccount).reduce((sum, pnl) => sum + pnl, 0);

    return {
      accounts: accountsWithStats,
      totalBalance,
      totalRealizedPnL,
      pnlByAccount,
      tradeCountByAccount
    };
  }, [filteredTrades, tradingAccounts]);

  // Format currency
  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  // Recent trades
  const recentTrades = useMemo(() => {
    return [...trades]
      .sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [trades]);

  // Calendar heatmap data (last 90 days)
  const calendarData = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const pnl = stats.dailyPnL[dateStr] || 0;
      days.push({ date: dateStr, pnl, dayOfWeek: date.getDay() });
    }
    return days;
  }, [stats.dailyPnL]);

  if (loading) {
    return (
      <div className="feature-page" style={{ 
        background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)', 
        minHeight: '100vh', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <div style={{ color: '#94a3b8', fontSize: '1.125rem' }}>Loading dashboard...</div>
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
            }}>📊 Trading Dashboard</h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          {/* Timeframe Toggle */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
              { key: 'all', label: 'All Time' }
            ].map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: timeframe === tf.key ? 'none' : '1px solid rgba(71, 85, 105, 0.4)',
                  background: timeframe === tf.key 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                    : 'rgba(30, 41, 59, 0.5)',
                  color: timeframe === tf.key ? 'white' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem' }}>
        {/* Top KPI Cards */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {/* Total P&L */}
          <div style={{
            ...cardStyle,
            borderLeft: `4px solid ${stats.totalPnL >= 0 ? '#10b981' : '#ef4444'}`,
            padding: '1.25rem'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Total P&L
            </div>
            <div style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: stats.totalPnL >= 0 ? '#10b981' : '#ef4444'
            }}>
              {formatCurrency(stats.totalPnL)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              {stats.totalTrades} trades
            </div>
          </div>

          {/* Win Rate */}
          <div style={{
            ...cardStyle,
            borderLeft: `4px solid ${stats.winRate >= 50 ? '#10b981' : '#f59e0b'}`,
            padding: '1.25rem'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Win Rate
            </div>
            <div style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: stats.winRate >= 50 ? '#10b981' : '#f59e0b'
            }}>
              {stats.winRate.toFixed(1)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              {stats.winningTrades}W / {stats.losingTrades}L
            </div>
          </div>

          {/* Profit Factor */}
          <div style={{
            ...cardStyle,
            borderLeft: `4px solid ${stats.profitFactor >= 1.5 ? '#10b981' : stats.profitFactor >= 1 ? '#f59e0b' : '#ef4444'}`,
            padding: '1.25rem'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Profit Factor
            </div>
            <div style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: stats.profitFactor >= 1.5 ? '#10b981' : stats.profitFactor >= 1 ? '#f59e0b' : '#ef4444'
            }}>
              {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              {stats.profitFactor >= 1.5 ? 'Excellent' : stats.profitFactor >= 1 ? 'Profitable' : 'Needs Work'}
            </div>
          </div>

          {/* Avg R-Multiple */}
          <div style={{
            ...cardStyle,
            borderLeft: `4px solid ${stats.avgRMultiple >= 1 ? '#10b981' : stats.avgRMultiple >= 0 ? '#f59e0b' : '#ef4444'}`,
            padding: '1.25rem'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Avg R-Multiple
            </div>
            <div style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: stats.avgRMultiple >= 1 ? '#10b981' : stats.avgRMultiple >= 0 ? '#f59e0b' : '#ef4444'
            }}>
              {stats.avgRMultiple.toFixed(2)}R
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              Risk/Reward
            </div>
          </div>

          {/* Max Drawdown */}
          <div style={{
            ...cardStyle,
            borderLeft: '4px solid #ef4444',
            padding: '1.25rem'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Max Drawdown
            </div>
            <div style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: '#ef4444'
            }}>
              {formatCurrency(-stats.maxDrawdown)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              Peak to trough
            </div>
          </div>

          {/* Expectancy */}
          <div style={{
            ...cardStyle,
            borderLeft: `4px solid ${stats.expectancy >= 0 ? '#10b981' : '#ef4444'}`,
            padding: '1.25rem'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Expectancy
            </div>
            <div style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: stats.expectancy >= 0 ? '#10b981' : '#ef4444'
            }}>
              {formatCurrency(stats.expectancy)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              Per trade avg
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {[
            { label: 'Today', value: formatCurrency(stats.todayPnL), color: stats.todayPnL >= 0 ? '#10b981' : '#ef4444' },
            { label: 'This Week', value: formatCurrency(stats.weekPnL), color: stats.weekPnL >= 0 ? '#10b981' : '#ef4444' },
            { label: 'This Month', value: formatCurrency(stats.monthPnL), color: stats.monthPnL >= 0 ? '#10b981' : '#ef4444' },
            { label: 'Avg Win', value: formatCurrency(stats.avgWin), color: '#10b981' },
            { label: 'Avg Loss', value: formatCurrency(-stats.avgLoss), color: '#ef4444' },
            { label: 'Best Day', value: formatCurrency(stats.bestDay.pnl), color: '#10b981' },
            { label: 'Worst Day', value: formatCurrency(stats.worstDay.pnl), color: '#ef4444' },
            { label: 'Streak', value: `${stats.currentStreak > 0 ? '🔥' : '❄️'} ${Math.abs(stats.currentStreak)}`, color: stats.currentStreak > 0 ? '#10b981' : '#ef4444' }
          ].map((stat, i) => (
            <div key={i} style={{
              ...cardStyle,
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: '700', color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Trading Accounts Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ 
            fontSize: '1rem', 
            fontWeight: '600', 
            color: '#f1f5f9',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🏦 Trading Accounts
            {tradingAccounts.length > 0 && (
              <span style={{ 
                fontSize: '0.75rem', 
                color: '#64748b', 
                fontWeight: '400' 
              }}>
                Total Balance: {formatCurrency(accountStats.totalBalance)}
              </span>
            )}
          </h3>
          
          {tradingAccounts.length === 0 ? (
            <div style={{
              ...cardStyle,
              padding: '2rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏦</div>
              <div style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>No trading accounts configured</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                Add your trading accounts in the Account page to track performance by account
              </div>
            </div>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: '1rem'
            }}>
              {accountStats.accounts.map((account, i) => (
                <div key={account.id || i} style={{
                  ...cardStyle,
                  padding: '1.25rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Broker badge */}
                  <div style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    fontSize: '0.65rem',
                    fontWeight: '500',
                    textTransform: 'uppercase'
                  }}>
                    {account.broker || 'Unknown'}
                  </div>
                  
                  {/* Account name */}
                  <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: '600', 
                    color: '#f1f5f9',
                    marginBottom: '0.5rem',
                    paddingRight: '4rem'
                  }}>
                    {account.name}
                  </div>
                  
                  {/* Balance */}
                  <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: '700', 
                    color: '#10b981',
                    marginBottom: '0.75rem'
                  }}>
                    {formatCurrency(account.balance)}
                  </div>
                  
                  {/* Stats row */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    fontSize: '0.75rem',
                    color: '#94a3b8'
                  }}>
                    <div>
                      <span style={{ color: '#64748b' }}>P&L: </span>
                      <span style={{ 
                        color: account.pnl >= 0 ? '#10b981' : '#ef4444',
                        fontWeight: '600'
                      }}>
                        {account.pnl >= 0 ? '+' : ''}{formatCurrency(account.pnl)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Trades: </span>
                      <span style={{ fontWeight: '600' }}>{account.tradeCount}</span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Type: </span>
                      <span style={{ 
                        color: account.type === 'live' ? '#10b981' : '#f59e0b',
                        fontWeight: '500'
                      }}>
                        {account.type === 'live' ? 'Live' : 'Demo'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(12, 1fr)', 
          gap: '1.5rem'
        }}>
          {/* Equity Curve */}
          <div style={{ ...cardStyle, gridColumn: 'span 8' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#f1f5f9',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📈 Equity Curve
            </h3>
            {stats.equityCurve.length > 0 ? (
              <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '2px', paddingBottom: '1rem' }}>
                {(() => {
                  const maxEquity = Math.max(...stats.equityCurve.map(e => Math.abs(e.equity)), 1);
                  const minEquity = Math.min(...stats.equityCurve.map(e => e.equity), 0);
                  const range = maxEquity - minEquity || 1;
                  
                  return stats.equityCurve.map((point, i) => {
                    const height = ((point.equity - minEquity) / range) * 180;
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: `${Math.max(height, 2)}px`,
                          background: point.equity >= 0 
                            ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)' 
                            : 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
                          borderRadius: '2px 2px 0 0',
                          minWidth: '3px',
                          transition: 'all 0.2s ease'
                        }}
                        title={`Trade ${point.trade}: ${formatCurrency(point.equity)}`}
                      />
                    );
                  });
                })()}
              </div>
            ) : (
              <div style={{ 
                height: '200px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#64748b'
              }}>
                No trade data to display
              </div>
            )}
          </div>

          {/* Today's Progress */}
          <div style={{ ...cardStyle, gridColumn: 'span 4' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#f1f5f9',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🎯 Today's Progress
            </h3>
            
            {/* Habits Progress */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Habits</span>
                <span style={{ fontSize: '0.8rem', color: '#f1f5f9' }}>
                  {todayHabits.completed}/{todayHabits.total}
                </span>
              </div>
              <div style={{ 
                height: '8px', 
                background: 'rgba(71, 85, 105, 0.3)', 
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${todayHabits.total > 0 ? (todayHabits.completed / todayHabits.total) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>

            {/* Active Goals */}
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem' }}>Active Goals</div>
              {activeGoals.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeGoals.map(goal => {
                    const progress = Math.min((goal.current || 0) / (goal.target || 1) * 100, 100);
                    return (
                      <div key={goal.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#f1f5f9' }}>{goal.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{progress.toFixed(0)}%</span>
                        </div>
                        <div style={{ 
                          height: '6px', 
                          background: 'rgba(71, 85, 105, 0.3)', 
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: progress >= 100 ? '#10b981' : '#3b82f6',
                            borderRadius: '3px'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>No active goals</div>
              )}
            </div>
          </div>

          {/* Calendar Heatmap */}
          <div style={{ ...cardStyle, gridColumn: 'span 8' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#f1f5f9',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🗓️ 90-Day P&L Heatmap
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
              {calendarData.map((day, i) => {
                let bg = 'rgba(71, 85, 105, 0.2)';
                if (day.pnl > 0) {
                  const intensity = Math.min(day.pnl / 500, 1);
                  bg = `rgba(16, 185, 129, ${0.3 + intensity * 0.7})`;
                } else if (day.pnl < 0) {
                  const intensity = Math.min(Math.abs(day.pnl) / 500, 1);
                  bg = `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`;
                }
                return (
                  <div
                    key={i}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      background: bg,
                      cursor: 'pointer'
                    }}
                    title={`${day.date}: ${formatCurrency(day.pnl)}`}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: '#64748b' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(239, 68, 68, 0.7)' }} />
                Loss
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: '#64748b' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(71, 85, 105, 0.3)' }} />
                No Trades
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: '#64748b' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.7)' }} />
                Profit
              </div>
            </div>
          </div>

          {/* Performance by Day of Week */}
          <div style={{ ...cardStyle, gridColumn: 'span 4' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#f1f5f9',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📅 By Day of Week
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                const data = stats.byDayOfWeek[day] || { trades: 0, pnl: 0 };
                const maxPnL = Math.max(...Object.values(stats.byDayOfWeek).map(d => Math.abs(d.pnl)), 1);
                const width = data.pnl !== 0 ? (Math.abs(data.pnl) / maxPnL) * 100 : 0;
                
                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '60px', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {day.slice(0, 3)}
                    </div>
                    <div style={{ flex: 1, height: '20px', background: 'rgba(71, 85, 105, 0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${width}%`,
                        background: data.pnl >= 0 ? '#10b981' : '#ef4444',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '0.5rem'
                      }}>
                        <span style={{ fontSize: '0.65rem', color: 'white', fontWeight: '600' }}>
                          {data.pnl !== 0 ? formatCurrency(data.pnl) : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Symbols */}
          <div style={{ ...cardStyle, gridColumn: 'span 4' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#f1f5f9',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              💹 Top Symbols
            </h3>
            {Object.keys(stats.bySymbol).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(stats.bySymbol)
                  .sort((a, b) => b[1].pnl - a[1].pnl)
                  .slice(0, 5)
                  .map(([symbol, data]) => (
                    <div key={symbol} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#f1f5f9', fontSize: '0.875rem' }}>{symbol}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {data.trades} trades • {((data.wins / data.trades) * 100).toFixed(0)}% WR
                        </div>
                      </div>
                      <div style={{ 
                        fontWeight: '700', 
                        color: data.pnl >= 0 ? '#10b981' : '#ef4444',
                        fontSize: '0.875rem'
                      }}>
                        {formatCurrency(data.pnl)}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                No symbol data
              </div>
            )}
          </div>

          {/* Strategy Performance */}
          <div style={{ ...cardStyle, gridColumn: 'span 4' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#f1f5f9',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🎯 Strategies
            </h3>
            {Object.keys(stats.byStrategy).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(stats.byStrategy)
                  .sort((a, b) => b[1].pnl - a[1].pnl)
                  .slice(0, 5)
                  .map(([strategy, data]) => (
                    <div key={strategy} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#f1f5f9', fontSize: '0.875rem' }}>{strategy}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {data.trades} trades • {((data.wins / data.trades) * 100).toFixed(0)}% WR
                        </div>
                      </div>
                      <div style={{ 
                        fontWeight: '700', 
                        color: data.pnl >= 0 ? '#10b981' : '#ef4444',
                        fontSize: '0.875rem'
                      }}>
                        {formatCurrency(data.pnl)}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                No strategy data
              </div>
            )}
          </div>

          {/* Recent Trades */}
          <div style={{ ...cardStyle, gridColumn: 'span 4' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#f1f5f9',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🕐 Recent Trades
            </h3>
            {recentTrades.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentTrades.map(trade => {
                  const date = trade.date?.toDate ? trade.date.toDate() : new Date(trade.date);
                  const pnl = parseFloat(trade.pnl || 0);
                  return (
                    <div key={trade.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: '8px',
                      borderLeft: `3px solid ${pnl >= 0 ? '#10b981' : '#ef4444'}`
                    }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#f1f5f9', fontSize: '0.875rem' }}>
                          {trade.symbol}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {date.toLocaleDateString()} • {trade.direction || 'Long'}
                        </div>
                      </div>
                      <div style={{ 
                        fontWeight: '700', 
                        color: pnl >= 0 ? '#10b981' : '#ef4444',
                        fontSize: '0.875rem'
                      }}>
                        {formatCurrency(pnl)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
                No recent trades
              </div>
            )}
          </div>

          {/* Session Performance */}
          <div style={{ ...cardStyle, gridColumn: 'span 6' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#f1f5f9',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              ⏰ Session Performance
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {Object.entries(stats.bySession).map(([session, data]) => (
                <div key={session} style={{
                  flex: '1 1 calc(33% - 0.5rem)',
                  minWidth: '120px',
                  padding: '1rem',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: '10px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    {session}
                  </div>
                  <div style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '700', 
                    color: data.pnl >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    {formatCurrency(data.pnl)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {data.trades} trades
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div style={{ ...cardStyle, gridColumn: 'span 6' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              color: '#f1f5f9',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📊 Quick Stats
            </h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '1rem'
            }}>
              {[
                { label: 'Largest Win', value: formatCurrency(stats.largestWin), color: '#10b981' },
                { label: 'Largest Loss', value: formatCurrency(stats.largestLoss), color: '#ef4444' },
                { label: 'Trades/Day', value: stats.tradesPerDay.toFixed(1), color: '#3b82f6' },
                { label: 'Win Streak', value: `🔥 ${stats.longestWinStreak}`, color: '#10b981' },
                { label: 'Lose Streak', value: `❄️ ${stats.longestLoseStreak}`, color: '#ef4444' },
                { label: 'Breakeven', value: stats.breakeven, color: '#f59e0b' }
              ].map((stat, i) => (
                <div key={i} style={{
                  padding: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: stat.color }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
