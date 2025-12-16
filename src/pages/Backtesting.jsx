import React, { useState, useEffect, useRef } from "react";
import { Bar } from 'react-chartjs-2';
import { db, auth } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy, Timestamp } from "firebase/firestore";

// Modern card style
const cardStyle = {
  background: 'rgba(31, 41, 55, 0.6)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '16px',
  padding: '2rem',
  width: '100%'
};

const inputStyle = {
  width: '100%',
  padding: '0.875rem 1rem',
  borderRadius: '10px',
  background: 'rgba(17, 24, 39, 0.8)',
  color: '#f9fafb',
  border: '1px solid rgba(75, 85, 99, 0.5)',
  fontSize: '1rem',
  outline: 'none',
  transition: 'all 0.2s ease'
};

const labelStyle = {
  fontWeight: 600,
  color: '#9ca3af',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
  display: 'block'
};

const RapidEntry = () => {
  const [pair, setPair] = useState("");
  const [result, setResult] = useState("");
  const [trades, setTrades] = useState([]);
  const pairRef = useRef(null);

  useEffect(() => {
    if (trades.length > 0) {
      setPair(trades[trades.length - 1].pair);
    }
  }, [trades]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key.toLowerCase() === "w") quickAdd("win");
      if (e.key.toLowerCase() === "l") quickAdd("loss");
      if (e.key.toLowerCase() === "b") quickAdd("breakeven");
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const quickAdd = (type) => {
    let res = "";
    if (type === "win") res = "Quick Win (2R)";
    if (type === "loss") res = "Quick Loss (-1R)";
    if (type === "breakeven") res = "Break Even";
    setResult(res);
    if (pair) {
      setTrades([...trades, { pair, result: res }]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pair && result) {
      setTrades([...trades, { pair, result }]);
      setResult("");
    }
  };

  const QuickButton = ({ onClick, color, gradient, children }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.875rem 1.5rem',
        borderRadius: '12px',
        background: `linear-gradient(135deg, ${gradient})`,
        color: color === 'dark' ? '#111827' : 'white',
        fontWeight: 700,
        border: 'none',
        fontSize: '0.95rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: `0 4px 15px ${gradient.split(',')[0]}40`
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {children}
    </button>
  );

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.75rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ⚡ Rapid Entry Interface
        </h2>
        <p style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          The Speed Logger - Quick trade entry with keyboard shortcuts
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={labelStyle}>Pair/Asset</label>
            <input
              ref={pairRef}
              value={pair}
              onChange={e => setPair(e.target.value)}
              style={inputStyle}
              placeholder="e.g. EURUSD"
              onFocus={e => e.currentTarget.style.borderColor = '#10b981'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)'}
            />
          </div>
          <div>
            <label style={labelStyle}>Result</label>
            <input
              value={result}
              onChange={e => setResult(e.target.value)}
              style={inputStyle}
              placeholder="Result or use Quick-Add"
              onFocus={e => e.currentTarget.style.borderColor = '#10b981'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)'}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <QuickButton onClick={() => quickAdd("win")} color="dark" gradient="#22c55e, #16a34a">
            ✓ Quick Win (2R)
          </QuickButton>
          <QuickButton onClick={() => quickAdd("loss")} color="light" gradient="#ef4444, #dc2626">
            ✗ Quick Loss (-1R)
          </QuickButton>
          <QuickButton onClick={() => quickAdd("breakeven")} color="dark" gradient="#3b82f6, #2563eb">
            ⟷ Break Even
          </QuickButton>
        </div>

        <button
          type="submit"
          style={{
            padding: '1rem 2.5rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            fontWeight: 700,
            border: 'none',
            fontSize: '1rem',
            margin: '0 auto',
            display: 'block',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          + Add Trade
        </button>
      </form>

      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontWeight: 600, color: '#f9fafb', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 Logged Trades
        </h3>
        {trades.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            background: 'rgba(17, 24, 39, 0.5)',
            borderRadius: '12px',
            border: '1px dashed rgba(75, 85, 99, 0.5)',
            color: '#6b7280'
          }}>
            No trades logged yet. Use the buttons above or keyboard shortcuts.
          </div>
        ) : (
          <div style={{
            background: 'rgba(17, 24, 39, 0.5)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(75, 85, 99, 0.3)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(31, 41, 55, 0.8)' }}>
                  <th style={{ padding: '1rem', color: '#10b981', fontWeight: 600, textAlign: 'left', fontSize: '0.85rem', textTransform: 'uppercase' }}>Pair/Asset</th>
                  <th style={{ padding: '1rem', color: '#10b981', fontWeight: 600, textAlign: 'left', fontSize: '0.85rem', textTransform: 'uppercase' }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(75, 85, 99, 0.3)' }}>
                    <td style={{ padding: '1rem', color: '#f9fafb', fontWeight: 600 }}>{t.pair}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: t.result.includes('Win') ? 'rgba(34, 197, 94, 0.2)' : t.result.includes('Loss') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: t.result.includes('Win') ? '#22c55e' : t.result.includes('Loss') ? '#ef4444' : '#3b82f6'
                      }}>
                        {t.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{
        marginTop: '1.5rem',
        padding: '1rem 1.5rem',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        fontSize: '0.9rem',
        color: '#9ca3af'
      }}>
        <div>⌨️ <strong style={{ color: '#f9fafb' }}>Keyboard Shortcuts:</strong> <span style={{ color: '#22c55e' }}>W</span> = Win, <span style={{ color: '#ef4444' }}>L</span> = Loss, <span style={{ color: '#3b82f6' }}>B</span> = Break Even</div>
        <div>🔄 <strong style={{ color: '#f9fafb' }}>Sticky Fields:</strong> Last pair used will auto-fill next entry</div>
      </div>
    </div>
  );
};

const WhatIfVariables = () => {
  const [trades] = useState([
    { pair: 'EURUSD', result: 'Quick Win (2R)', type: 'win' },
    { pair: 'GBPUSD', result: 'Quick Loss (-1R)', type: 'loss' },
    { pair: 'USDJPY', result: 'Break Even', type: 'breakeven' },
    { pair: 'EURUSD', result: 'Quick Win (2R)', type: 'win' },
    { pair: 'GBPUSD', result: 'Quick Loss (-1R)', type: 'loss' },
  ]);
  const [rr, setRR] = useState(2);

  const calcPnL = (rrValue) => {
    let pnl = 0;
    trades.forEach(t => {
      if (t.type === 'win') pnl += rrValue;
      else if (t.type === 'loss') pnl -= 1;
    });
    return pnl;
  };
  const totalPnL = calcPnL(rr);

  const rrValues = [1, 2, 3, 4, 5];
  const winRates = [60, 50, 40, 35, 30];
  const profits = rrValues.map((r, i) => {
    const wins = winRates[i];
    const losses = 100 - wins;
    return wins * r - losses * 1;
  });

  const chartData = {
    labels: rrValues.map(r => `RR ${r}`),
    datasets: [
      {
        label: 'Win Rate (%)',
        data: winRates,
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 6,
        yAxisID: 'y',
      },
      {
        label: 'Profit (per 100 trades)',
        data: profits,
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderRadius: 6,
        yAxisID: 'y1',
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#9ca3af', font: { size: 12 } }
      },
      title: {
        display: true,
        text: 'Strike Rate vs RR Profitability',
        color: '#f9fafb',
        font: { size: 16, weight: 600 }
      }
    },
    scales: {
      x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(75, 85, 99, 0.3)' } },
      y: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'Win Rate (%)', color: '#3b82f6' },
        ticks: { color: '#9ca3af' },
        grid: { color: 'rgba(75, 85, 99, 0.3)' },
        min: 0,
        max: 100
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'Profit (per 100 trades)', color: '#10b981' },
        ticks: { color: '#9ca3af' },
        grid: { drawOnChartArea: false },
      }
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.75rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🎲 What If Variables
        </h2>
        <p style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          R-Multiple Simulator - See how different RR ratios affect your profitability
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '1.25rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{rr.toFixed(1)}R</div>
          <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.25rem' }}>Current RR</div>
        </div>
        <div style={{
          background: `linear-gradient(135deg, ${totalPnL >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'} 0%, ${totalPnL >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)'} 100%)`,
          border: `1px solid ${totalPnL >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '12px',
          padding: '1.25rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: totalPnL >= 0 ? '#10b981' : '#ef4444' }}>
            {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(1)}R
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.25rem' }}>Simulated P&L</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          padding: '1.25rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#3b82f6' }}>{trades.length}</div>
          <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.25rem' }}>Sample Trades</div>
        </div>
      </div>

      {/* RR Slider */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.5)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <label style={{ ...labelStyle, marginBottom: '1rem' }}>Risk-to-Reward Simulator</label>
        <input
          type="range"
          min={1}
          max={5}
          step={0.1}
          value={rr}
          onChange={e => setRR(Number(e.target.value))}
          style={{
            width: '100%',
            height: '8px',
            borderRadius: '4px',
            appearance: 'none',
            background: `linear-gradient(to right, #10b981 0%, #10b981 ${(rr - 1) / 4 * 100}%, rgba(75, 85, 99, 0.5) ${(rr - 1) / 4 * 100}%, rgba(75, 85, 99, 0.5) 100%)`,
            cursor: 'pointer'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>
          <span>1R</span>
          <span>2R</span>
          <span>3R</span>
          <span>4R</span>
          <span>5R</span>
        </div>
      </div>

      {/* Chart */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.5)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <Bar data={chartData} options={chartOptions} />
      </div>

      <div style={{
        padding: '1rem 1.5rem',
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        fontSize: '0.9rem',
        color: '#9ca3af'
      }}>
        💡 <strong style={{ color: '#a78bfa' }}>Insight:</strong> Adjust the RR slider to see how profit changes. The chart shows the relationship between win rate and RR for profitability.
      </div>
    </div>
  );
};
import { useMemo } from 'react';

const DeepAnalytics = () => {
  const trades = useMemo(() => [
    { pair: 'EURUSD', entry: 1.1000, stop: 1.0980, target: 1.1040, exit: 1.1040, mfe: 1.1050, mae: 1.0990 },
    { pair: 'GBPUSD', entry: 1.2500, stop: 1.2480, target: 1.2550, exit: 1.2550, mfe: 1.2560, mae: 1.2490 },
    { pair: 'USDJPY', entry: 150.00, stop: 149.80, target: 150.50, exit: 150.50, mfe: 150.60, mae: 149.90 },
  ], []);

  const maeArr = trades.map(t => Math.abs(t.entry - t.mae));
  const mfeArr = trades.map(t => Math.abs(t.mfe - t.target));
  const avgMAE = (maeArr.reduce((a, b) => a + b, 0) / maeArr.length).toFixed(5);
  const avgMFE = (mfeArr.reduce((a, b) => a + b, 0) / mfeArr.length).toFixed(5);

  const monteCarloResults = useMemo(() => {
    const nSim = 1000;
    const plArr = [];
    for (let i = 0; i < nSim; i++) {
      const shuffled = [...trades].sort(() => Math.random() - 0.5);
      let pl = 0;
      shuffled.forEach(t => {
        pl += t.exit > t.entry ? (t.target - t.entry) : (t.stop - t.entry);
      });
      plArr.push(pl);
    }
    return plArr;
  }, [trades]);

  const minPL = Math.min(...monteCarloResults).toFixed(2);
  const maxPL = Math.max(...monteCarloResults).toFixed(2);
  const avgPL = (monteCarloResults.reduce((a, b) => a + b, 0) / monteCarloResults.length).toFixed(2);

  const histogram = useMemo(() => {
    const bins = 20;
    const min = Math.min(...monteCarloResults);
    const max = Math.max(...monteCarloResults);
    const binSize = (max - min) / bins;
    const counts = Array(bins).fill(0);
    monteCarloResults.forEach(val => {
      const idx = Math.min(bins - 1, Math.floor((val - min) / binSize));
      counts[idx]++;
    });
    return {
      labels: counts.map((_, i) => `${(min + i * binSize).toFixed(2)}`),
      datasets: [{
        label: 'Frequency',
        data: counts,
        backgroundColor: 'rgba(139, 92, 246, 0.7)',
        borderRadius: 4,
      }]
    };
  }, [monteCarloResults]);

  const StatCard = ({ icon, label, value, color, subtext }) => (
    <div style={{
      background: `linear-gradient(135deg, ${color}20 0%, ${color}08 100%)`,
      border: `1px solid ${color}50`,
      borderRadius: '12px',
      padding: '1.25rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color }}>{value}</div>
      <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.25rem' }}>{label}</div>
      {subtext && <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>{subtext}</div>}
    </div>
  );

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.75rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🔬 Deep Analytics
        </h2>
        <p style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          Finding the "Edge" - Advanced metrics to optimize your trading
        </p>
      </div>

      {/* MAE/MFE Section */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.5)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ color: '#f9fafb', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📊 Excursion Analysis
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <StatCard
            icon="📉"
            label="Avg Maximum Adverse Excursion"
            value={avgMAE}
            color="#ef4444"
            subtext="Optimize Stop Loss"
          />
          <StatCard
            icon="📈"
            label="Avg Maximum Favorable Excursion"
            value={avgMFE}
            color="#10b981"
            subtext="Optimize Take Profit"
          />
        </div>
      </div>

      {/* Monte Carlo Section */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.5)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <h3 style={{ color: '#f9fafb', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🎰 Monte Carlo Simulation
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
          1,000 random trade order simulations
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard icon="⬇️" label="Min P&L" value={minPL} color="#ef4444" />
          <StatCard icon="⬆️" label="Max P&L" value={maxPL} color="#10b981" />
          <StatCard icon="➡️" label="Avg P&L" value={avgPL} color="#3b82f6" />
        </div>

        <div style={{ background: 'rgba(31, 41, 55, 0.5)', borderRadius: '10px', padding: '1rem' }}>
          <Bar data={histogram} options={{
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false },
              title: {
                display: true,
                text: 'P&L Distribution',
                color: '#f9fafb',
                font: { size: 14, weight: 600 }
              }
            },
            scales: {
              x: {
                ticks: { color: '#6b7280', maxTicksLimit: 8 },
                grid: { color: 'rgba(75, 85, 99, 0.3)' },
                title: { display: true, text: 'P&L Range', color: '#9ca3af' }
              },
              y: {
                ticks: { color: '#6b7280' },
                grid: { color: 'rgba(75, 85, 99, 0.3)' },
                title: { display: true, text: 'Frequency', color: '#9ca3af' }
              }
            }
          }} />
        </div>
      </div>

      <div style={{
        padding: '1rem 1.5rem',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        fontSize: '0.9rem',
        color: '#9ca3af'
      }}>
        <div>📉 <strong style={{ color: '#f9fafb' }}>MAE</strong> helps optimize Stop Loss placement</div>
        <div>📈 <strong style={{ color: '#f9fafb' }}>MFE</strong> helps optimize Take Profit placement</div>
        <div>🎰 <strong style={{ color: '#f9fafb' }}>Monte Carlo</strong> shows the risk of losing streaks</div>
      </div>
    </div>
  );
};

// No sample images; only user-uploaded images will be shown

const VisualGallery = () => {
  const [filter, setFilter] = useState('all');
  const [images, setImages] = useState([]);
  const [uploadData, setUploadData] = useState({ before: null, after: null, outcome: 'win' });
  const beforeInputRef = useRef();
  const afterInputRef = useRef();

  const filteredImages = filter === 'all' ? images : images.filter(img => img.outcome === filter);

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (files && files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadData(prev => ({ ...prev, [name]: ev.target.result }));
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (uploadData.before && uploadData.after) {
      setImages(prev => [
        ...prev,
        {
          id: Date.now(),
          before: uploadData.before,
          after: uploadData.after,
          outcome: uploadData.outcome
        }
      ]);
      setTimeout(() => {
        setUploadData({ before: null, after: null, outcome: 'win' });
        if (beforeInputRef.current) beforeInputRef.current.value = "";
        if (afterInputRef.current) afterInputRef.current.value = "";
      }, 100);
    }
  };

  const FilterButton = ({ value, label, color }) => (
    <button
      onClick={() => setFilter(value)}
      style={{
        padding: '0.75rem 1.5rem',
        borderRadius: '10px',
        border: 'none',
        fontWeight: 600,
        fontSize: '0.9rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        background: filter === value ? `linear-gradient(135deg, ${color})` : 'rgba(17, 24, 39, 0.8)',
        color: filter === value ? (value === 'loss' ? 'white' : '#111827') : '#9ca3af',
        boxShadow: filter === value ? `0 4px 15px ${color.split(',')[0]}40` : 'none'
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.75rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🖼️ Visual Gallery
        </h2>
        <p style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.95rem' }}>
          The Pattern Recognizer - Compare before/after charts to spot patterns
        </p>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleUpload} style={{
        background: 'rgba(17, 24, 39, 0.5)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        alignItems: 'end'
      }}>
        <div>
          <label style={labelStyle}>Before Chart</label>
          <div style={{
            background: 'rgba(31, 41, 55, 0.8)',
            border: '2px dashed rgba(75, 85, 99, 0.5)',
            borderRadius: '10px',
            padding: '1rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}>
            <input
              type="file"
              name="before"
              accept="image/*"
              onChange={handleFileChange}
              ref={beforeInputRef}
              style={{ display: 'none' }}
              id="before-upload"
            />
            <label htmlFor="before-upload" style={{ cursor: 'pointer', display: 'block' }}>
              {uploadData.before ? (
                <img src={uploadData.before} alt="Preview" style={{ width: '100%', maxHeight: '100px', objectFit: 'cover', borderRadius: '6px' }} />
              ) : (
                <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>📤 Click to upload</div>
              )}
            </label>
          </div>
        </div>

        <div>
          <label style={labelStyle}>After Chart</label>
          <div style={{
            background: 'rgba(31, 41, 55, 0.8)',
            border: '2px dashed rgba(75, 85, 99, 0.5)',
            borderRadius: '10px',
            padding: '1rem',
            textAlign: 'center',
            cursor: 'pointer'
          }}>
            <input
              type="file"
              name="after"
              accept="image/*"
              onChange={handleFileChange}
              ref={afterInputRef}
              style={{ display: 'none' }}
              id="after-upload"
            />
            <label htmlFor="after-upload" style={{ cursor: 'pointer', display: 'block' }}>
              {uploadData.after ? (
                <img src={uploadData.after} alt="Preview" style={{ width: '100%', maxHeight: '100px', objectFit: 'cover', borderRadius: '6px' }} />
              ) : (
                <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>📤 Click to upload</div>
              )}
            </label>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Outcome</label>
          <select
            name="outcome"
            value={uploadData.outcome}
            onChange={e => setUploadData(prev => ({ ...prev, outcome: e.target.value }))}
            style={{
              ...inputStyle,
              cursor: 'pointer'
            }}
          >
            <option value="win">✓ Win</option>
            <option value="loss">✗ Loss</option>
          </select>
        </div>

        <button
          type="submit"
          style={{
            padding: '0.875rem 1.5rem',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          📤 Upload Trade
        </button>
      </form>

      {/* Filter Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <FilterButton value="all" label="📊 Show All" color="#3b82f6, #2563eb" />
        <FilterButton value="win" label="✓ Wins Only" color="#22c55e, #16a34a" />
        <FilterButton value="loss" label="✗ Losses Only" color="#ef4444, #dc2626" />
      </div>

      {/* Gallery Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.5rem'
      }}>
        {filteredImages.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '3rem',
            textAlign: 'center',
            background: 'rgba(17, 24, 39, 0.5)',
            borderRadius: '12px',
            border: '1px dashed rgba(75, 85, 99, 0.5)'
          }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📷</span>
            <div style={{ color: '#9ca3af', fontSize: '1rem' }}>No images yet. Upload your trade screenshots above.</div>
          </div>
        ) : filteredImages.map(img => (
          <div
            key={img.id}
            style={{
              background: 'rgba(17, 24, 39, 0.6)',
              borderRadius: '12px',
              overflow: 'hidden',
              border: `1px solid ${img.outcome === 'win' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{
              padding: '0.75rem 1rem',
              background: img.outcome === 'win' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '1.25rem' }}>{img.outcome === 'win' ? '🏆' : '📉'}</span>
              <span style={{
                fontWeight: 700,
                color: img.outcome === 'win' ? '#22c55e' : '#ef4444'
              }}>
                {img.outcome === 'win' ? 'Winning Trade' : 'Losing Trade'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Before</div>
                <img src={img.before} alt="Before" style={{ width: '100%', borderRadius: '8px', aspectRatio: '16/9', objectFit: 'cover' }} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase' }}>After</div>
                <img src={img.after} alt="After" style={{ width: '100%', borderRadius: '8px', aspectRatio: '16/9', objectFit: 'cover' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '1.5rem',
        padding: '1rem 1.5rem',
        background: 'rgba(236, 72, 153, 0.1)',
        border: '1px solid rgba(236, 72, 153, 0.3)',
        borderRadius: '12px',
        fontSize: '0.9rem',
        color: '#9ca3af'
      }}>
        💡 <strong style={{ color: '#f472b6' }}>Pro Tip:</strong> Compare winning vs losing trades to identify visual patterns in your setups
      </div>
    </div>
  );
};
const TechnicalImplementation = () => (
  <div style={cardStyle}>
    <h2 style={{
      margin: 0,
      marginBottom: '1.5rem',
      fontSize: '1.75rem',
      fontWeight: 700,
      background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    }}>📋 Technical Implementation</h2>
    <div style={{
      background: 'rgba(17, 24, 39, 0.5)',
      borderRadius: '12px',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      <h3 style={{ color: '#10b981', fontWeight: 600, marginBottom: '1rem' }}>Date Handling: Best Practices</h3>
      <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#d1d5db', lineHeight: 1.8 }}>
        <li><strong style={{ color: '#f9fafb' }}>Entry Date</strong>: The historical date the trade happened. <span style={{ color: '#3b82f6' }}>All charts use this date.</span></li>
        <li><strong style={{ color: '#f9fafb' }}>Created At</strong>: The date the user logs the data. Used only for audit/logging.</li>
      </ul>
    </div>
    <div style={{
      padding: '1rem 1.5rem',
      background: 'rgba(245, 158, 11, 0.1)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: '12px',
      fontSize: '0.9rem',
      color: '#9ca3af'
    }}>
      ⚠️ <strong style={{ color: '#f59e0b' }}>Important:</strong> Charts and analytics must use Entry Date to order trades for correct equity curves.
    </div>
  </div>
);

const SessionManagement = () => {
  const [sessions, setSessions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    strategy: "",
    asset: "",
    timeframe: "",
    dateRange: "",
    startingBalance: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchSessions() {
      const snap = await getDocs(collection(db, "backtest_sessions"));
      setSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); 
    }
    fetchSessions();
  }, [showModal, saving]);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await addDoc(collection(db, "backtest_sessions"), {
        ...form,
        startingBalance: parseFloat(form.startingBalance),
        created: Timestamp.fromDate(new Date())
      });
      setShowModal(false);
      setForm({ strategy: "", asset: "", timeframe: "", dateRange: "", startingBalance: "" });
    } catch (e) {
      setError("Failed to save session.");
    }
    setSaving(false);
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '1.75rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            📁 Session Management
          </h2>
          <p style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            Create and compare backtesting sessions
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '0.875rem 1.75rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: 'white',
            fontWeight: 700,
            border: 'none',
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          + Create New Session
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div style={{
            background: 'rgba(31, 41, 55, 0.95)',
            backdropFilter: 'blur(20px)',
            padding: '2rem',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '500px',
            color: '#f9fafb',
            border: '1px solid rgba(75, 85, 99, 0.5)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{
              margin: 0,
              marginBottom: '1.5rem',
              fontSize: '1.5rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>Create New Session</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Strategy Name</label>
                <input name="strategy" value={form.strategy} onChange={handleChange} style={inputStyle} placeholder="e.g. ICT Silver Bullet" />
              </div>
              <div>
                <label style={labelStyle}>Pair/Asset</label>
                <input name="asset" value={form.asset} onChange={handleChange} style={inputStyle} placeholder="e.g. EURUSD" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Timeframe</label>
                  <input name="timeframe" value={form.timeframe} onChange={handleChange} style={inputStyle} placeholder="e.g. 15M" />
                </div>
                <div>
                  <label style={labelStyle}>Starting Balance</label>
                  <input name="startingBalance" type="number" value={form.startingBalance} onChange={handleChange} style={inputStyle} placeholder="e.g. 10000" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Date Range</label>
                <input name="dateRange" value={form.dateRange} onChange={handleChange} style={inputStyle} placeholder="e.g. Jan 2024 - Dec 2024" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  fontWeight: 700,
                  border: 'none',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? '⏳ Saving...' : '✓ Save Session'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '0.875rem 1.5rem',
                  borderRadius: '10px',
                  background: 'transparent',
                  color: '#9ca3af',
                  fontWeight: 600,
                  border: '1px solid rgba(75, 85, 99, 0.5)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
            {error && <div style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center' }}>{error}</div>}
          </div>
        </div>
      )}

      {/* Sessions Table */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.5)',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(75, 85, 99, 0.3)'
      }}>
        <h3 style={{
          margin: 0,
          padding: '1.25rem 1.5rem',
          background: 'rgba(31, 41, 55, 0.5)',
          color: '#f9fafb',
          fontWeight: 600,
          fontSize: '1.1rem',
          borderBottom: '1px solid rgba(75, 85, 99, 0.3)'
        }}>
          📊 Session Comparison
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(31, 41, 55, 0.8)' }}>
                {['Strategy', 'Pair/Asset', 'Timeframe', 'Date Range', 'Starting Balance', 'Created'].map(header => (
                  <th key={header} style={{
                    padding: '1rem',
                    color: '#3b82f6',
                    fontWeight: 600,
                    textAlign: 'left',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid rgba(75, 85, 99, 0.3)'
                  }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: '#6b7280'
                  }}>
                    <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
                    No sessions yet. Create your first backtesting session above.
                  </td>
                </tr>
              ) : (
                sessions.map((s, i) => (
                  <tr
                    key={s.id}
                    style={{
                      borderTop: i > 0 ? '1px solid rgba(75, 85, 99, 0.2)' : 'none',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '1rem', color: '#f9fafb', fontWeight: 600 }}>{s.strategy}</td>
                    <td style={{ padding: '1rem', color: '#10b981', fontWeight: 600 }}>{s.asset}</td>
                    <td style={{ padding: '1rem', color: '#9ca3af' }}>{s.timeframe}</td>
                    <td style={{ padding: '1rem', color: '#9ca3af' }}>{s.dateRange}</td>
                    <td style={{ padding: '1rem', color: '#f59e0b', fontWeight: 600 }}>${s.startingBalance?.toLocaleString()}</td>
                    <td style={{ padding: '1rem', color: '#6b7280', fontSize: '0.9rem' }}>{s.created?.toDate().toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
const Backtesting = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("backtestingActiveTab") || "session";
  });

  useEffect(() => {
    localStorage.setItem("backtestingActiveTab", activeTab);
  }, [activeTab]);

  const tabs = [
    { id: 'session', label: '📁 Session Management', icon: '📁' },
    { id: 'rapid', label: '⚡ Rapid Entry', icon: '⚡' },
    { id: 'whatif', label: '🎲 What If', icon: '🎲' },
    { id: 'analytics', label: '🔬 Deep Analytics', icon: '🔬' },
    { id: 'gallery', label: '🖼️ Visual Gallery', icon: '🖼️' },
  ];

  return (
    <div className="feature-page">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{
          margin: 0,
          fontSize: '2rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🧪 Backtesting Lab
        </h1>
        <p style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '1rem' }}>
          Test, analyze, and refine your trading strategies
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        background: 'rgba(31, 41, 55, 0.5)',
        padding: '0.5rem',
        borderRadius: '14px',
        overflowX: 'auto',
        flexWrap: 'wrap'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'transparent',
              color: activeTab === tab.id ? 'white' : '#9ca3af',
              boxShadow: activeTab === tab.id
                ? '0 4px 15px rgba(16, 185, 129, 0.3)'
                : 'none'
            }}
            onMouseEnter={e => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = '#f9fafb';
                e.currentTarget.style.background = 'rgba(75, 85, 99, 0.3)';
              }
            }}
            onMouseLeave={e => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === "session" && <SessionManagement />}
        {activeTab === "rapid" && <RapidEntry />}
        {activeTab === "whatif" && <WhatIfVariables />}
        {activeTab === "analytics" && <DeepAnalytics />}
        {activeTab === "gallery" && <VisualGallery />}
        {activeTab === "tech" && <TechnicalImplementation />}
      </div>
    </div>
  );
};

export default Backtesting;