import React, { useState, useEffect } from "react";
import CalendarLib from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

// Market closure/warning dates - DO NOT TRADE
const marketAlerts = {
  '2025-12-24': { type: 'danger', label: '🔴 Christmas Eve', desc: 'DANGER - Early close ~20:00 GMT. Spreads widen significantly.' },
  '2025-12-25': { type: 'closed', label: '🔴 Christmas Day', desc: 'CLOSED - Global markets shut down.' },
  '2025-12-26': { type: 'closed', label: '🔴 Boxing Day', desc: 'CLOSED/THIN - UK/EU closed. Zombie markets.' },
  '2025-12-29': { type: 'warning', label: '🟡 Grey Zone', desc: 'RISKY - Banks on holiday. Choppy, random moves.' },
  '2025-12-30': { type: 'warning', label: '🟡 Grey Zone', desc: 'RISKY - No volume. SMC setups may fail.' },
  '2025-12-31': { type: 'danger', label: '🔴 New Year\'s Eve', desc: 'DANGER - Early close. Banks balancing books.' },
  '2026-01-01': { type: 'closed', label: '🔴 New Year\'s Day', desc: 'CLOSED - Global Holiday.' },
  '2026-01-05': { type: 'safe', label: '🟢 Trading Resumes', desc: 'SAFE - First real trading day. Volume returns!' },
};

const Calendar = ({ hideHeading }) => {
  const [date, setDate] = useState(new Date());
  const [tradeMap, setTradeMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrades() {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, "trades"),
          where("userId", "==", auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const map = {};
        snapshot.forEach(doc => {
          const trade = doc.data();
          // Use openTime or open_time depending on your schema
          const open = trade.openTime || trade.open_time;
          const pnl = parseFloat(trade.pnl || trade.PnL || 0);
          if (open) {
            const d = new Date(open);
            const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
            if (!map[key]) map[key] = [];
            map[key].push(pnl);
          }
        });
        setTradeMap(map);
      } catch (error) {
        console.error("Error fetching trades:", error);
      }
      setLoading(false);
    }
    fetchTrades();
  }, []);

  function tileClassName({ date, view }) {
    if (view !== 'month') return '';
    try {
      const key = date.toISOString().slice(0, 10);
      
      // Check for market alerts first
      if (marketAlerts[key]) {
        const alertType = marketAlerts[key].type;
        if (alertType === 'closed' || alertType === 'danger') return 'calendar-tile-closed';
        if (alertType === 'warning') return 'calendar-tile-warning';
        if (alertType === 'safe') return 'calendar-tile-safe';
      }
      
      // Then check for trade P&L
      if (!tradeMap[key]) return 'calendar-tile-grey';
      const sum = tradeMap[key].reduce((a, b) => a + b, 0);
      if (sum > 0) return 'calendar-tile-green';
      if (sum < 0) return 'calendar-tile-red';
      return 'calendar-tile-grey';
    } catch {
      return 'calendar-tile-grey';
    }
  }

  // Get alert info for selected date
  const selectedKey = date.toISOString().slice(0, 10);
  const selectedAlert = marketAlerts[selectedKey];

  return (
    <div className="feature-page">
      {!hideHeading && (
        <div style={{marginBottom: '1.5rem'}}>
          <h2 style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>📅 Trade Calendar</h2>
          <p style={{color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.95rem'}}>
            Track your daily trading performance at a glance
          </p>
        </div>
      )}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%'
      }}>
        <div className="big-calendar-wrapper" style={{
          width: '100%',
          background: 'rgba(31, 41, 55, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(75, 85, 99, 0.4)',
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <CalendarLib
            onChange={setDate}
            value={date}
            tileClassName={tileClassName}
          />
        </div>
        <div style={{
          marginTop: '1.25rem',
          padding: '0.75rem 1.5rem',
          background: selectedAlert 
            ? selectedAlert.type === 'closed' || selectedAlert.type === 'danger'
              ? 'rgba(239, 68, 68, 0.2)'
              : selectedAlert.type === 'warning'
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(34, 197, 94, 0.2)'
            : 'rgba(31, 41, 55, 0.6)',
          borderRadius: '10px',
          border: selectedAlert 
            ? selectedAlert.type === 'closed' || selectedAlert.type === 'danger'
              ? '1px solid rgba(239, 68, 68, 0.5)'
              : selectedAlert.type === 'warning'
                ? '1px solid rgba(245, 158, 11, 0.5)'
                : '1px solid rgba(34, 197, 94, 0.5)'
            : '1px solid rgba(75, 85, 99, 0.3)',
          color: '#9ca3af',
          fontSize: '0.95rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{color: '#f59e0b'}}>📌</span>
            Selected: <span style={{color: '#f9fafb', fontWeight: 500}}>{date.toDateString()}</span>
          </div>
          {selectedAlert && (
            <div style={{ 
              marginTop: '0.5rem', 
              padding: '0.5rem',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '6px'
            }}>
              <div style={{ 
                fontWeight: '600', 
                color: selectedAlert.type === 'safe' ? '#22c55e' : selectedAlert.type === 'warning' ? '#f59e0b' : '#ef4444',
                marginBottom: '0.25rem'
              }}>
                {selectedAlert.label}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#d1d5db' }}>
                {selectedAlert.desc}
              </div>
            </div>
          )}
        </div>
        
        {/* Legend */}
        <div style={{
          marginTop: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.85rem',
          color: '#9ca3af'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
            }}></span>
            Profit
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            }}></span>
            Loss
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: '#374151'
            }}></span>
            No Trades
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              border: '2px solid #fca5a5'
            }}></span>
            🔴 Closed/Danger
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              border: '2px solid #fcd34d'
            }}></span>
            🟡 Risky
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: '2px solid #6ee7b7'
            }}></span>
            🟢 Safe
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
