import React, { useEffect, useState } from "react";
import { collection, query, getDocs, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import Playbook from "./Playbook";
import PsychologyNotes from "./PsychologyNotes";
import Calendar from "./Calendar";
import AddTrade from "../components/AddTrade";
import Analytics from "../components/Analytics";

const RecentTrades = () => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        setTrades([]);
        return;
      }
      
      try {
        const q = query(
          collection(db, "trades"), 
          where("userId", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        const tradesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort client-side and limit to 10
        tradesData.sort((a, b) => {
          const dateA = new Date(a.open_time || a.createdAt || 0);
          const dateB = new Date(b.open_time || b.createdAt || 0);
          return dateB - dateA;
        });
        setTrades(tradesData.slice(0, 10));
      } catch (error) {
        console.error("Error fetching trades:", error);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="recent-trades-list">
        <h3>Recent Trades</h3>
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
          Loading trades...
        </div>
      </div>
    );
  }

  return (
    <div className="recent-trades-list">
      <h3>Recent Trades</h3>
      {trades.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem', 
          color: '#9ca3af',
          background: 'rgba(31, 41, 55, 0.4)',
          borderRadius: '12px',
          border: '1px dashed rgba(75, 85, 99, 0.5)'
        }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📊</span>
          No trades recorded yet. Add your first trade!
        </div>
      ) : (
        <ul>
          {trades.map(trade => (
            <li key={trade.id} className="trade-list-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '1.1rem' }}>{trade.symbol}</strong>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: trade.type === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: trade.type === 'BUY' ? '#10b981' : '#ef4444'
                }}>{trade.type}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.85rem', color: '#9ca3af' }}>
                <span>Entry: <span style={{ color: '#f9fafb' }}>{trade.entry_price}</span></span>
                <span>Exit: <span style={{ color: '#f9fafb' }}>{trade.exit_price || '-'}</span></span>
                <span>P&L: <span style={{ color: trade.pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                  {trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toFixed(2) || '0.00'}
                </span></span>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                {trade.strategy && <span>📋 {trade.strategy} • </span>}
                <span>📅 {trade.open_time?.split('T')[0] || 'N/A'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Journal = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("journalActiveTab") || "journal";
  });

  useEffect(() => {
    localStorage.setItem("journalActiveTab", activeTab);
  }, [activeTab]);
  return (
    <div className="feature-page">
      <div className="journal-header-bar">
        <div className="journal-header-actions">
          <button
            className={"journal-tab-btn" + (activeTab === "addtrade" ? " active" : "")}
            onClick={() => setActiveTab("addtrade")}
          >Add Trade</button>
          <button
            className={"journal-tab-btn" + (activeTab === "journal" ? " active" : "")}
            onClick={() => setActiveTab("journal")}
          >Journal</button>
          <button
            className={"journal-tab-btn" + (activeTab === "playbook" ? " active" : "")}
            onClick={() => setActiveTab("playbook")}
          >Playbook</button>
          <button
            className={"journal-tab-btn" + (activeTab === "calendar" ? " active" : "")}
            onClick={() => setActiveTab("calendar")}
          >Calendar</button>
          <button
            className={"journal-tab-btn" + (activeTab === "analytics" ? " active" : "")}
            onClick={() => setActiveTab("analytics")}
          >Advanced Analytics</button>
          <button
            className={"journal-tab-btn" + (activeTab === "psychology" ? " active" : "")}
            onClick={() => setActiveTab("psychology")}
          >Psychology & Notes</button>
        </div>
      </div>
      <div style={{marginTop: '2em'}}>
        {activeTab === "addtrade" && <AddTrade />}
        {activeTab === "journal" && <RecentTrades />}
        {activeTab === "playbook" && <Playbook hideHeading />}
        {activeTab === "calendar" && <Calendar hideHeading />}
        {activeTab === "analytics" && <Analytics />}
        {activeTab === "psychology" && <PsychologyNotes />}
      </div>
    </div>
  );
}

export default Journal;
