import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const Analytics = () => {
  const [setupData, setSetupData] = useState([]);
  const [dayData, setDayData] = useState([]);
  const [drawdownData, setDrawdownData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    netProfit: 0,
    winRate: 0,
    profitFactor: 0,
    avgWinner: 0,
    avgLoser: 0
  });

  useEffect(() => {
    async function fetchTrades() {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, "trades"),
          where("userId", "==", auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const trades = snapshot.docs.map(doc => doc.data());
        // Performance by Setup
        const setupMap = {};
        trades.forEach(trade => {
          const strategy = trade.strategy || "Unknown";
          const pnl = parseFloat(trade.pnl || trade.PnL || 0);
          setupMap[strategy] = (setupMap[strategy] || 0) + pnl;
        });
        setSetupData(Object.entries(setupMap));
        // Performance by Day of Week
        const dayMap = {};
        trades.forEach(trade => {
          const open = trade.openTime || trade.open_time;
          if (open) {
            const d = new Date(open);
            const day = d.toLocaleDateString('en-US', { weekday: 'long' });
            const pnl = parseFloat(trade.pnl || trade.PnL || 0);
            dayMap[day] = (dayMap[day] || 0) + pnl;
          }
        });
        setDayData(Object.entries(dayMap));
        // Drawdown Analysis
        let balance = 0;
        let peak = 0;
        let maxDrawdown = 0;
        const drawdownArr = [];
        trades.sort((a, b) => {
          const aTime = new Date(a.openTime || a.open_time).getTime();
          const bTime = new Date(b.openTime || b.open_time).getTime();
          return aTime - bTime;
        });
        trades.forEach(trade => {
          balance += parseFloat(trade.pnl || trade.PnL || 0);
          if (balance > peak) peak = balance;
          const drawdown = peak - balance;
          if (drawdown > maxDrawdown) maxDrawdown = drawdown;
          drawdownArr.push({ time: trade.openTime || trade.open_time, drawdown });
        });
        setDrawdownData(drawdownArr);
        // Summary stats
        let netProfit = 0, wins = 0, losses = 0, winSum = 0, lossSum = 0;
        trades.forEach(trade => {
          const pnl = parseFloat(trade.pnl || trade.PnL || 0);
          netProfit += pnl;
          if (pnl > 0) { wins++; winSum += pnl; }
          else if (pnl < 0) { losses++; lossSum += pnl; }
        });
        const total = wins + losses;
        const winRate = total ? (wins / total) * 100 : 0;
        const profitFactor = lossSum !== 0 ? Math.abs(winSum / lossSum) : 0;
        const avgWinner = wins ? winSum / wins : 0;
        const avgLoser = losses ? lossSum / losses : 0;
        setSummary({ netProfit, winRate, profitFactor, avgWinner, avgLoser });
      } catch (error) {
        console.error("Error fetching trades:", error);
      }
      setLoading(false);
    }
    fetchTrades();
  }, []);

  if (loading) return <div style={{padding: '2rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><span className="animate-pulse">●</span> Loading analytics...</div>;

  // Chart data
  const setupChart = {
    labels: setupData.map(item => item[0]),
    datasets: [{
      label: "PnL by Setup",
      data: setupData.map(item => item[1]),
      backgroundColor: "rgba(16, 185, 129, 0.8)",
      borderColor: "#10b981",
      borderWidth: 1,
      borderRadius: 6
    }]
  };
  const dayChart = {
    labels: dayData.map(item => item[0]),
    datasets: [{
      label: "PnL by Day",
      data: dayData.map(item => item[1]),
      backgroundColor: "rgba(59, 130, 246, 0.8)",
      borderColor: "#3b82f6",
      borderWidth: 1,
      borderRadius: 6
    }]
  };
  const drawdownChart = {
    labels: drawdownData.map(d => d.time),
    datasets: [{
      label: "Drawdown",
      data: drawdownData.map(d => d.drawdown),
      borderColor: "#ef4444",
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointBackgroundColor: "#ef4444"
    }]
  };

  return (
    <div className="analytics-container">
      <h2 style={{marginBottom: '1.5rem', background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>Advanced Analytics</h2>
      
      {/* Summary cards at the top */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div className="stat-card" style={{background: 'rgba(31, 41, 55, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(75, 85, 99, 0.4)'}}>
          <div className="stat-label">Net Profit</div>
          <div className="stat-value" style={{color: summary.netProfit >= 0 ? '#10b981' : '#ef4444'}}>{summary.netProfit.toFixed(2)}</div>
        </div>
        <div className="stat-card" style={{background: 'rgba(31, 41, 55, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(75, 85, 99, 0.4)'}}>
          <div className="stat-label">Win Rate</div>
          <div className="stat-value" style={{color: '#22c55e'}}>{summary.winRate.toFixed(1)}%</div>
        </div>
        <div className="stat-card" style={{background: 'rgba(31, 41, 55, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(75, 85, 99, 0.4)'}}>
          <div className="stat-label">Profit Factor</div>
          <div className="stat-value" style={{color: '#f59e0b'}}>{summary.profitFactor.toFixed(2)}</div>
        </div>
        <div className="stat-card" style={{background: 'rgba(31, 41, 55, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(75, 85, 99, 0.4)'}}>
          <div className="stat-label">Avg Winner</div>
          <div className="stat-value" style={{color: '#10b981'}}>{summary.avgWinner.toFixed(2)}</div>
        </div>
        <div className="stat-card" style={{background: 'rgba(31, 41, 55, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(75, 85, 99, 0.4)'}}>
          <div className="stat-label">Avg Loser</div>
          <div className="stat-value" style={{color: '#ef4444'}}>{summary.avgLoser.toFixed(2)}</div>
        </div>
      </div>
      
      {/* Charts grid below */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        <div style={{background: 'rgba(31, 41, 55, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(75, 85, 99, 0.4)', borderRadius: '16px', padding: '1.5rem'}}>
          <h3 style={{marginBottom: '1rem', fontSize: '1.1rem', color: '#f9fafb'}}>Performance by Setup</h3>
          <Bar data={setupChart} options={{responsive: true, plugins: {legend: {display: false}}, scales: {x: {ticks: {color: '#9ca3af'}}, y: {ticks: {color: '#9ca3af'}, grid: {color: 'rgba(75, 85, 99, 0.3)'}}}}} />
        </div>
        <div style={{background: 'rgba(31, 41, 55, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(75, 85, 99, 0.4)', borderRadius: '16px', padding: '1.5rem'}}>
          <h3 style={{marginBottom: '1rem', fontSize: '1.1rem', color: '#f9fafb'}}>Performance by Day of Week</h3>
          <Bar data={dayChart} options={{responsive: true, plugins: {legend: {display: false}}, scales: {x: {ticks: {color: '#9ca3af'}}, y: {ticks: {color: '#9ca3af'}, grid: {color: 'rgba(75, 85, 99, 0.3)'}}}}} />
        </div>
        <div style={{gridColumn: '1 / -1', background: 'rgba(31, 41, 55, 0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(75, 85, 99, 0.4)', borderRadius: '16px', padding: '1.5rem'}}>
          <h3 style={{marginBottom: '1rem', fontSize: '1.1rem', color: '#f9fafb'}}>Drawdown Analysis</h3>
          <div style={{maxWidth: '800px', width: '100%', margin: '0 auto', overflow: 'hidden', boxSizing: 'border-box'}}>
            <Line data={drawdownChart} options={{responsive: true, maintainAspectRatio: false, plugins: {legend: {display: true, labels: {color: '#9ca3af'}}}, scales: {x: {ticks: {color: '#9ca3af'}}, y: {ticks: {color: '#9ca3af'}, grid: {color: 'rgba(75, 85, 99, 0.3)'}}}}} height={320} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
