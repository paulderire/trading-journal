import React, { useState, useEffect, useMemo } from "react";
import { marketAlerts } from "./Calendar";

const TradingAlerts = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [todayAlert, setTodayAlert] = useState(null);
  const [upcomingAlerts, setUpcomingAlerts] = useState([]);
  const [nextSafeDay, setNextSafeDay] = useState(null);

  // Memoize the date key
  const todayKey = useMemo(() => {
    return currentDate.toISOString().slice(0, 10);
  }, [currentDate]);

  useEffect(() => {
    // Update time every second
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check if today has an alert
    if (marketAlerts[todayKey]) {
      setTodayAlert(marketAlerts[todayKey]);
    } else {
      setTodayAlert(null);
    }

    // Find upcoming alerts (next 30 days)
    const upcoming = [];
    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);
    
    for (let i = 1; i <= 30; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      const futureKey = futureDate.toISOString().slice(0, 10);
      
      if (marketAlerts[futureKey]) {
        upcoming.push({
          date: futureKey,
          daysAway: i,
          ...marketAlerts[futureKey]
        });
      }
    }
    setUpcomingAlerts(upcoming);

    // Find next safe trading day
    let foundSafe = false;
    let checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + 1);
    
    for (let i = 0; i < 30 && !foundSafe; i++) {
      const checkKey = checkDate.toISOString().slice(0, 10);
      const dayOfWeek = checkDate.getDay();
      
      // Skip weekends and check if this day has a blocking alert
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && (
          !marketAlerts[checkKey] || 
          marketAlerts[checkKey].type === 'safe' ||
          marketAlerts[checkKey].type === 'nfp' ||
          marketAlerts[checkKey].type === 'fomc')) {
        setNextSafeDay({
          date: checkKey,
          daysAway: i + 1,
          isNFP: marketAlerts[checkKey]?.type === 'nfp',
          isFOMC: marketAlerts[checkKey]?.type === 'fomc'
        });
        foundSafe = true;
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
  }, [todayKey, currentDate]);

  // Determine overall status
  const getStatus = () => {
    const dayOfWeek = currentDate.getDay();
    
    // Weekend check
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { 
        status: 'weekend', 
        color: '#6b7280', 
        bgColor: 'rgba(107, 114, 128, 0.2)',
        icon: '🌙',
        title: 'WEEKEND',
        message: 'Markets are closed. Enjoy your time off!'
      };
    }

    if (!todayAlert) {
      return { 
        status: 'clear', 
        color: '#22c55e', 
        bgColor: 'rgba(34, 197, 94, 0.15)',
        icon: '✅',
        title: 'CLEAR TO TRADE',
        message: 'No market alerts for today. Execute your setups with confidence!'
      };
    }

    switch (todayAlert.type) {
      case 'closed':
        return { 
          status: 'closed', 
          color: '#ef4444', 
          bgColor: 'rgba(239, 68, 68, 0.15)',
          icon: '🚫',
          title: 'MARKET CLOSED',
          message: todayAlert.desc
        };
      case 'danger':
        return { 
          status: 'danger', 
          color: '#ef4444', 
          bgColor: 'rgba(239, 68, 68, 0.15)',
          icon: '⚠️',
          title: 'DO NOT TRADE',
          message: todayAlert.desc
        };
      case 'warning':
        return { 
          status: 'warning', 
          color: '#f59e0b', 
          bgColor: 'rgba(245, 158, 11, 0.15)',
          icon: '⚡',
          title: 'TRADE WITH CAUTION',
          message: todayAlert.desc
        };
      case 'nfp':
        return { 
          status: 'nfp', 
          color: '#3b82f6', 
          bgColor: 'rgba(59, 130, 246, 0.15)',
          icon: '📊',
          title: 'NFP DAY - RESTRICTED',
          message: todayAlert.desc
        };
      case 'fomc':
        return { 
          status: 'fomc', 
          color: '#8b5cf6', 
          bgColor: 'rgba(139, 92, 246, 0.15)',
          icon: '🏦',
          title: 'FOMC DAY - CAUTION',
          message: todayAlert.desc
        };
      case 'safe':
        return { 
          status: 'safe', 
          color: '#22c55e', 
          bgColor: 'rgba(34, 197, 94, 0.15)',
          icon: '🟢',
          title: 'SAFE TO TRADE',
          message: todayAlert.desc
        };
      default:
        return { 
          status: 'clear', 
          color: '#22c55e', 
          bgColor: 'rgba(34, 197, 94, 0.15)',
          icon: '✅',
          title: 'CLEAR TO TRADE',
          message: 'No alerts for today.'
        };
    }
  };

  const status = getStatus();

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getAlertTypeStyle = (type) => {
    switch (type) {
      case 'closed':
      case 'danger':
        return { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', color: '#fca5a5' };
      case 'warning':
        return { bg: 'rgba(245, 158, 11, 0.2)', border: '#f59e0b', color: '#fcd34d' };
      case 'nfp':
        return { bg: 'rgba(59, 130, 246, 0.2)', border: '#3b82f6', color: '#93c5fd' };
      case 'fomc':
        return { bg: 'rgba(139, 92, 246, 0.2)', border: '#8b5cf6', color: '#c4b5fd' };
      case 'safe':
        return { bg: 'rgba(34, 197, 94, 0.2)', border: '#22c55e', color: '#86efac' };
      default:
        return { bg: 'rgba(107, 114, 128, 0.2)', border: '#6b7280', color: '#9ca3af' };
    }
  };

  return (
    <div className="feature-page" style={{ width: '100%' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.75rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>🚨 Trading Alerts</h2>
        <p style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Real-time market status and trading safety check
        </p>
      </div>

      {/* Current Date & Time */}
      <div style={{
        background: 'rgba(31, 41, 55, 0.6)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem',
        textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
          {currentDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
        <div style={{ 
          fontSize: '2rem', 
          fontWeight: 700, 
          fontFamily: 'monospace',
          color: '#f3f4f6'
        }}>
          {formatTime(currentDate)}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
          Kigali Time (CAT)
        </div>
      </div>

      {/* Main Status Card */}
      <div style={{
        background: status.bgColor,
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '2rem',
        marginBottom: '1.5rem',
        border: `3px solid ${status.color}`,
        textAlign: 'center',
        animation: status.status === 'danger' || status.status === 'closed' 
          ? 'pulse-danger 2s infinite' 
          : status.status === 'clear' || status.status === 'safe'
          ? 'pulse-safe 2s infinite'
          : 'none'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>
          {status.icon}
        </div>
        <h2 style={{
          margin: '0 0 0.5rem 0',
          fontSize: '2rem',
          fontWeight: 800,
          color: status.color,
          letterSpacing: '0.05em'
        }}>
          {status.title}
        </h2>
        <p style={{
          margin: 0,
          fontSize: '1.1rem',
          color: '#d1d5db',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6
        }}>
          {status.message}
        </p>

        {/* NFP Trading Window Warning */}
        {status.status === 'nfp' && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(59, 130, 246, 0.3)',
            borderRadius: '10px',
            border: '2px solid #3b82f6'
          }}>
            <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: '0.5rem' }}>
              ⏰ NFP Release Window
            </div>
            <div style={{ color: '#d1d5db' }}>
              <strong>3:00 PM - 4:30 PM (Kigali)</strong> — Do NOT enter trades during this window. 
              Wait for price to settle after the release.
            </div>
          </div>
        )}

        {/* FOMC Overnight Warning */}
        {status.status === 'fomc' && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(139, 92, 246, 0.3)',
            borderRadius: '10px',
            border: '2px solid #8b5cf6'
          }}>
            <div style={{ fontWeight: 700, color: '#c4b5fd', marginBottom: '0.5rem' }}>
              🌙 Overnight Hold Warning
            </div>
            <div style={{ color: '#d1d5db' }}>
              <strong>Close all positions before 8:00 PM (Kigali)</strong> — FOMC announcements 
              cause massive volatility. Never hold trades overnight on FOMC days.
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {(status.status === 'clear' || status.status === 'safe') && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            borderRadius: '12px',
            padding: '1rem',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎯</div>
            <div style={{ fontWeight: 600, color: '#22c55e' }}>Focus on Setups</div>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Look for high-probability trades
            </div>
          </div>
          <div style={{
            background: 'rgba(59, 130, 246, 0.15)',
            borderRadius: '12px',
            padding: '1rem',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📝</div>
            <div style={{ fontWeight: 600, color: '#3b82f6' }}>Log Your Trades</div>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Keep your journal updated
            </div>
          </div>
          <div style={{
            background: 'rgba(245, 158, 11, 0.15)',
            borderRadius: '12px',
            padding: '1rem',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚖️</div>
            <div style={{ fontWeight: 600, color: '#f59e0b' }}>Manage Risk</div>
            <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Stick to your plan
            </div>
          </div>
        </div>
      )}

      {/* Next Safe Day (when today is blocked) */}
      {(status.status === 'danger' || status.status === 'closed' || status.status === 'weekend') && nextSafeDay && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.15)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
            Next Trading Day
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>
            {formatDate(nextSafeDay.date)}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#86efac', marginTop: '0.25rem' }}>
            {nextSafeDay.daysAway === 1 ? 'Tomorrow' : `In ${nextSafeDay.daysAway} days`}
            {nextSafeDay.isNFP && ' (NFP Day - trade before/after release)'}
            {nextSafeDay.isFOMC && ' (FOMC Day - no overnight holds)'}
          </div>
        </div>
      )}

      {/* Upcoming Alerts */}
      {upcomingAlerts.length > 0 && (
        <div style={{
          background: 'rgba(31, 41, 55, 0.6)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h3 style={{
            margin: '0 0 1rem 0',
            fontSize: '1.1rem',
            fontWeight: 600,
            color: '#f3f4f6'
          }}>
            📅 Upcoming Market Alerts (Next 30 Days)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {upcomingAlerts.map((alert, idx) => {
              const style = getAlertTypeStyle(alert.type);
              return (
                <div key={idx} style={{
                  background: style.bg,
                  borderRadius: '10px',
                  padding: '1rem',
                  borderLeft: `4px solid ${style.border}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}>
                  <div style={{
                    minWidth: '80px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {alert.daysAway === 1 ? 'Tomorrow' : `In ${alert.daysAway} days`}
                    </div>
                    <div style={{ fontWeight: 700, color: style.color, fontSize: '0.9rem' }}>
                      {formatDate(alert.date)}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: style.color, marginBottom: '0.25rem' }}>
                      {alert.label}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#d1d5db' }}>
                      {alert.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trading Rules Reminder */}
      <div style={{
        marginTop: '1.5rem',
        background: 'rgba(31, 41, 55, 0.4)',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <h4 style={{ margin: '0 0 1rem 0', color: '#f3f4f6', fontSize: '1rem' }}>
          📌 Quick Trading Rules
        </h4>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '0.75rem',
          fontSize: '0.85rem',
          color: '#9ca3af'
        }}>
          <div>🔴 <strong>Closed/Danger:</strong> Do NOT trade at all</div>
          <div>🟡 <strong>Warning:</strong> Reduce position size by 50%</div>
          <div>📊 <strong>NFP Days:</strong> No trades 3:00-4:30 PM</div>
          <div>🏦 <strong>FOMC Days:</strong> Close positions by 8:00 PM</div>
          <div>🟢 <strong>Clear Days:</strong> Execute your A+ setups</div>
          <div>⚡ <strong>Always:</strong> Check this page before trading</div>
        </div>
      </div>
    </div>
  );
};

export default TradingAlerts;
