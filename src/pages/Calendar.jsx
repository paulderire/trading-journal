import React, { useState, useEffect } from "react";
import CalendarLib from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

// Market closure/warning dates - DO NOT TRADE
// Exported so TradingAlerts page can use it
export const marketAlerts = {
  // ===== 2025 END OF YEAR =====
  '2025-12-24': { type: 'danger', label: '🔴 Christmas Eve', desc: 'DANGER - Early close ~20:00 GMT. Spreads widen significantly.' },
  '2025-12-25': { type: 'closed', label: '🔴 Christmas Day', desc: 'CLOSED - Global markets shut down.' },
  '2025-12-26': { type: 'closed', label: '🔴 Boxing Day', desc: 'CLOSED/THIN - UK/EU closed. Zombie markets.' },
  '2025-12-29': { type: 'warning', label: '🟡 Grey Zone', desc: 'RISKY - Banks on holiday. Choppy, random moves.' },
  '2025-12-30': { type: 'warning', label: '🟡 Grey Zone', desc: 'RISKY - No volume. SMC setups may fail.' },
  '2025-12-31': { type: 'danger', label: '🔴 New Year\'s Eve', desc: 'DANGER - Early close. Banks balancing books.' },
  
  // ===== 2026 DEATH ZONE (Start of Year) =====
  '2026-01-01': { type: 'closed', label: '🔴 New Year\'s Day', desc: 'CLOSED - Global Holiday. Do not touch the app.' },
  '2026-01-02': { type: 'danger', label: '🔴 Danger Day', desc: 'DANGER - Zombie market. Traders still on vacation. Random spikes.' },
  '2026-01-05': { type: 'safe', label: '🟢 Trading Resumes', desc: 'SAFE - First real trading day of 2026. Volume returns!' },
  
  // ===== 2026 US BANK HOLIDAYS =====
  '2026-01-19': { type: 'warning', label: '🟡 MLK Day', desc: 'US CLOSED - Martin Luther King Jr. Day. Avoid USD pairs after 3:30 PM.' },
  '2026-02-16': { type: 'warning', label: '🟡 Presidents Day', desc: 'US CLOSED - Presidents\' Day. Low USD liquidity.' },
  
  // ===== 2026 EASTER - THE HOLY TRAP =====
  '2026-04-03': { type: 'closed', label: '⚠️ PERFECT STORM', desc: '🚨 GOOD FRIDAY + NFP = EXTREME DANGER! Markets closed but NFP may release. 100+ pip gaps possible. ABSOLUTELY DO NOT TRADE.' },
  '2026-04-06': { type: 'closed', label: '🔴 Easter Monday', desc: 'CLOSED - UK/Europe closed. GBPUSD will be dead.' },
  
  // ===== 2026 DOUBLE DANGER DAY =====
  '2026-05-25': { type: 'closed', label: '🔴 DOUBLE DANGER', desc: 'US Memorial Day + UK Spring Bank Holiday. Both London & NY closed. Market effectively stops.' },
  
  // ===== 2026 MORE US HOLIDAYS =====
  '2026-06-19': { type: 'warning', label: '🟡 Juneteenth', desc: 'US CLOSED - Juneteenth. Avoid USD pairs.' },
  '2026-07-03': { type: 'warning', label: '🟡 Independence Day Observed', desc: 'US LOW LIQUIDITY - July 4 falls on Saturday. Low liquidity all day.' },
  '2026-09-07': { type: 'warning', label: '🟡 Labor Day', desc: 'US CLOSED - Labor Day. Avoid USD pairs after London close.' },
  '2026-11-26': { type: 'danger', label: '🔴 Thanksgiving', desc: 'DANGER - US Thanksgiving. Spreads widen massively around 8 PM Kigali time.' },
  
  // ===== 2026 END OF YEAR DEATH ZONE =====
  '2026-12-24': { type: 'danger', label: '🔴 Christmas Eve', desc: 'DANGER - Market closes early. Do not trade.' },
  '2026-12-25': { type: 'closed', label: '🔴 Christmas Day', desc: 'CLOSED - Global Holiday.' },
  '2026-12-31': { type: 'danger', label: '🔴 New Year\'s Eve', desc: 'DANGER - Banks closing books. Low liquidity.' },
  
  // ===== 2026 NFP FRIDAYS (3:00 PM - 4:30 PM Kigali - DO NOT TRADE) =====
  '2026-01-09': { type: 'nfp', label: '📊 NFP Day', desc: 'NFP RELEASE - Do NOT trade 3:00-4:30 PM Kigali time. Likely delayed.' },
  '2026-02-06': { type: 'nfp', label: '📊 NFP Day', desc: 'NFP RELEASE - Do NOT trade 3:00-4:30 PM Kigali time.' },
  '2026-03-06': { type: 'nfp', label: '📊 NFP Day', desc: 'NFP RELEASE - Do NOT trade 3:00-4:30 PM Kigali time.' },
  // April 3 is Good Friday - already marked as PERFECT STORM above
  '2026-05-08': { type: 'nfp', label: '📊 NFP Day', desc: 'NFP RELEASE - Do NOT trade 3:00-4:30 PM Kigali time.' },
  '2026-06-05': { type: 'nfp', label: '📊 NFP Day', desc: 'NFP RELEASE - Do NOT trade 3:00-4:30 PM Kigali time.' },
  '2026-07-02': { type: 'nfp', label: '📊 NFP Thursday', desc: 'NFP RELEASE (Thursday due to July 3 holiday) - Do NOT trade 3:00-4:30 PM.' },
  '2026-08-07': { type: 'nfp', label: '📊 NFP Day', desc: 'NFP RELEASE - Do NOT trade 3:00-4:30 PM Kigali time.' },
  '2026-09-04': { type: 'nfp', label: '📊 NFP Day', desc: 'NFP RELEASE - Do NOT trade 3:00-4:30 PM Kigali time.' },
  '2026-10-02': { type: 'nfp', label: '📊 NFP Day', desc: 'NFP RELEASE - Do NOT trade 3:00-4:30 PM Kigali time.' },
  '2026-11-06': { type: 'nfp', label: '📊 NFP Day', desc: 'NFP RELEASE - Do NOT trade 3:00-4:30 PM Kigali time.' },
  '2026-12-04': { type: 'nfp', label: '📊 NFP Day', desc: 'NFP RELEASE - Do NOT trade 3:00-4:30 PM Kigali time.' },
  
  // ===== 2026 FOMC WEDNESDAYS (Do NOT hold trades overnight) =====
  '2026-01-28': { type: 'fomc', label: '🏦 FOMC Day', desc: 'FOMC MEETING - Fed announces rates late at night. Do NOT hold trades overnight.' },
  '2026-03-18': { type: 'fomc', label: '🏦 FOMC Day', desc: 'FOMC MEETING - Do NOT hold trades overnight.' },
  '2026-04-29': { type: 'fomc', label: '🏦 FOMC Day', desc: 'FOMC MEETING - Do NOT hold trades overnight.' },
  '2026-06-17': { type: 'fomc', label: '🏦 FOMC Day', desc: 'FOMC MEETING - Do NOT hold trades overnight.' },
  '2026-07-29': { type: 'fomc', label: '🏦 FOMC Day', desc: 'FOMC MEETING - Do NOT hold trades overnight.' },
  '2026-09-16': { type: 'fomc', label: '🏦 FOMC Day', desc: 'FOMC MEETING - Do NOT hold trades overnight.' },
  '2026-10-28': { type: 'fomc', label: '🏦 FOMC Day', desc: 'FOMC MEETING - Do NOT hold trades overnight.' },
  '2026-12-09': { type: 'fomc', label: '🏦 FOMC Day', desc: 'FOMC MEETING - Do NOT hold trades overnight.' },
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
        if (alertType === 'nfp') return 'calendar-tile-nfp';
        if (alertType === 'fomc') return 'calendar-tile-fomc';
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
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              border: '2px solid #93c5fd'
            }}></span>
            📊 NFP Day
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              border: '2px solid #c4b5fd'
            }}></span>
            🏦 FOMC Day
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
