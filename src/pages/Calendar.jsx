import React, { useState, useEffect } from "react";
import CalendarLib from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

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
      if (!tradeMap[key]) return 'calendar-tile-grey';
      const sum = tradeMap[key].reduce((a, b) => a + b, 0);
      if (sum > 0) return 'calendar-tile-green';
      if (sum < 0) return 'calendar-tile-red';
      return 'calendar-tile-grey';
    } catch {
      return 'calendar-tile-grey';
    }
  }

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
          background: 'rgba(31, 41, 55, 0.6)',
          borderRadius: '10px',
          border: '1px solid rgba(75, 85, 99, 0.3)',
          color: '#9ca3af',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{color: '#f59e0b'}}>📌</span>
          Selected: <span style={{color: '#f9fafb', fontWeight: 500}}>{date.toDateString()}</span>
        </div>
        
        {/* Legend */}
        <div style={{
          marginTop: '1rem',
          display: 'flex',
          gap: '2rem',
          fontSize: '0.9rem',
          color: '#9ca3af'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
            }}></span>
            Profitable Day
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            }}></span>
            Loss Day
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              background: '#374151'
            }}></span>
            No Trades
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
