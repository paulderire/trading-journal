import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const cardStyle = {
  background: 'rgba(30, 41, 59, 0.5)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(71, 85, 105, 0.4)',
  borderRadius: '16px',
  padding: '1.5rem'
};

const buttonStyle = {
  padding: '0.75rem 1.5rem',
  borderRadius: '10px',
  border: 'none',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem'
};

const Reports = () => {
  const [trades, setTrades] = useState([]);
  const [goals, setGoals] = useState([]);
  const [habits, setHabits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  // eslint-disable-next-line no-unused-vars
  const [exportFormat, setExportFormat] = useState('csv');

  const fetchData = useCallback(async (user) => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch trades
      const tradesQuery = query(collection(db, "trades"), where("userId", "==", user.uid));
      const tradesSnapshot = await getDocs(tradesQuery);
      setTrades(tradesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch goals
      const goalsQuery = query(collection(db, "goals"), where("userId", "==", user.uid));
      const goalsSnapshot = await getDocs(goalsQuery);
      setGoals(goalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch habits
      const habitsQuery = query(collection(db, "habits"), where("userId", "==", user.uid));
      const habitsSnapshot = await getDocs(habitsQuery);
      setHabits(habitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) fetchData(user);
      else setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchData]);

  // Filter trades by date range
  const getFilteredTrades = () => {
    if (!dateRange.start && !dateRange.end) return trades;
    
    return trades.filter(trade => {
      const tradeDate = trade.open_time || trade.date || trade.createdAt;
      if (!tradeDate) return true;
      
      const date = tradeDate.toDate ? tradeDate.toDate() : new Date(tradeDate);
      const start = dateRange.start ? new Date(dateRange.start) : new Date(0);
      const end = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : new Date();
      
      return date >= start && date <= end;
    });
  };

  // Calculate stats
  const calculateStats = (filteredTrades) => {
    const wins = filteredTrades.filter(t => parseFloat(t.pnl || 0) > 0);
    const losses = filteredTrades.filter(t => parseFloat(t.pnl || 0) < 0);
    const totalPnL = filteredTrades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
    const winRate = filteredTrades.length > 0 ? (wins.length / filteredTrades.length * 100) : 0;
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;

    return { totalTrades: filteredTrades.length, wins: wins.length, losses: losses.length, totalPnL, winRate, avgWin, avgLoss, profitFactor };
  };

  // Export to CSV
  const exportToCSV = (data, filename) => {
    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          let cell = row[header];
          // Handle special cases
          if (cell === null || cell === undefined) cell = '';
          if (typeof cell === 'object') {
            if (cell.toDate) cell = cell.toDate().toISOString();
            else cell = JSON.stringify(cell);
          }
          // Escape commas and quotes
          cell = String(cell).replace(/"/g, '""');
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            cell = `"${cell}"`;
          }
          return cell;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Export to JSON
  const exportToJSON = (data, filename) => {
    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    const jsonContent = JSON.stringify(data, (key, value) => {
      if (value && value.toDate) return value.toDate().toISOString();
      return value;
    }, 2);

    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  // Generate PDF report (simplified HTML-based)
  const exportToPDF = (filteredTrades) => {
    const stats = calculateStats(filteredTrades);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trading Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
          h2 { color: #3b82f6; margin-top: 30px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
          .stat-card { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #0f172a; }
          .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
          .positive { color: #10b981; }
          .negative { color: #ef4444; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f1f5f9; font-weight: 600; }
          .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>📊 Trading Journal Report</h1>
        <p>Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${dateRange.start || dateRange.end ? `<p>Period: ${dateRange.start || 'Start'} to ${dateRange.end || 'Present'}</p>` : ''}
        
        <h2>Performance Summary</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.totalTrades}</div>
            <div class="stat-label">Total Trades</div>
          </div>
          <div class="stat-card">
            <div class="stat-value ${stats.totalPnL >= 0 ? 'positive' : 'negative'}">$${stats.totalPnL.toFixed(2)}</div>
            <div class="stat-label">Total P&L</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.winRate.toFixed(1)}%</div>
            <div class="stat-label">Win Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.profitFactor.toFixed(2)}</div>
            <div class="stat-label">Profit Factor</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value positive">${stats.wins}</div>
            <div class="stat-label">Winning Trades</div>
          </div>
          <div class="stat-card">
            <div class="stat-value negative">${stats.losses}</div>
            <div class="stat-label">Losing Trades</div>
          </div>
          <div class="stat-card">
            <div class="stat-value positive">$${stats.avgWin.toFixed(2)}</div>
            <div class="stat-label">Avg Win</div>
          </div>
          <div class="stat-card">
            <div class="stat-value negative">$${stats.avgLoss.toFixed(2)}</div>
            <div class="stat-label">Avg Loss</div>
          </div>
        </div>

        <h2>Trade History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Symbol</th>
              <th>Direction</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>P&L</th>
              <th>Strategy</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTrades.slice(0, 50).map(trade => {
              const date = trade.open_time?.toDate ? trade.open_time.toDate() : new Date(trade.open_time || trade.date);
              const pnl = parseFloat(trade.pnl || 0);
              return `
                <tr>
                  <td>${date.toLocaleDateString()}</td>
                  <td>${trade.symbol || '-'}</td>
                  <td>${trade.direction || trade.type || '-'}</td>
                  <td>${trade.entry_price || '-'}</td>
                  <td>${trade.exit_price || '-'}</td>
                  <td class="${pnl >= 0 ? 'positive' : 'negative'}">$${pnl.toFixed(2)}</td>
                  <td>${trade.strategy || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        ${filteredTrades.length > 50 ? `<p style="color: #94a3b8; font-style: italic;">Showing first 50 trades of ${filteredTrades.length} total</p>` : ''}

        <div class="footer">
          <p>Trading Journal - Generated Report</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExport = (type) => {
    setExporting(true);
    const filteredTrades = getFilteredTrades();

    setTimeout(() => {
      switch (type) {
        case 'trades-csv':
          exportToCSV(filteredTrades.map(t => ({
            date: t.open_time?.toDate ? t.open_time.toDate().toISOString() : t.open_time || t.date,
            symbol: t.symbol,
            direction: t.direction || t.type,
            entry_price: t.entry_price,
            exit_price: t.exit_price,
            lot_size: t.lot_size || t.position_size,
            pnl: t.pnl,
            strategy: t.strategy,
            account: t.account,
            notes: t.notes
          })), 'trades');
          break;
        case 'trades-json':
          exportToJSON(filteredTrades, 'trades');
          break;
        case 'trades-pdf':
          exportToPDF(filteredTrades);
          break;
        case 'goals-csv':
          exportToCSV(goals.map(g => ({
            title: g.title,
            type: g.type,
            target: g.target,
            current: g.current,
            status: g.status,
            deadline: g.deadline,
            notes: g.notes
          })), 'goals');
          break;
        case 'habits-csv':
          exportToCSV(habits.map(h => ({
            name: h.name,
            category: h.category,
            frequency: h.frequency,
            notes: h.notes
          })), 'habits');
          break;
        case 'all-json':
          exportToJSON({ trades: filteredTrades, goals, habits }, 'trading_journal_backup');
          break;
        default:
          break;
      }
      setExporting(false);
    }, 500);
  };

  const filteredTrades = getFilteredTrades();
  const stats = calculateStats(filteredTrades);

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: '#f1f5f9' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <div>Loading reports...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)',
      color: '#f1f5f9'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        padding: '1.5rem 2rem'
      }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: '700',
          marginBottom: '0.25rem',
          background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>📈 Reports & Export</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          Generate reports and export your trading data
        </p>
      </div>

      <div style={{ padding: '1.5rem 2rem' }}>
        {/* Date Range Filter */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📅 Date Range Filter
          </h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>From</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  outline: 'none'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>To</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  outline: 'none'
                }}
              />
            </div>
            <button
              onClick={() => setDateRange({ start: '', end: '' })}
              style={{
                ...buttonStyle,
                background: 'rgba(71, 85, 105, 0.4)',
                color: '#94a3b8',
                marginTop: '1.25rem'
              }}
            >
              Clear
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem' }}>
            Showing {filteredTrades.length} of {trades.length} trades
          </p>
        </div>

        {/* Quick Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {[
            { label: 'Total Trades', value: stats.totalTrades, color: '#3b82f6' },
            { label: 'Total P&L', value: `$${stats.totalPnL.toFixed(0)}`, color: stats.totalPnL >= 0 ? '#10b981' : '#ef4444' },
            { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: stats.winRate >= 50 ? '#10b981' : '#f59e0b' },
            { label: 'Profit Factor', value: stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1 ? '#10b981' : '#ef4444' },
            { label: 'Goals', value: goals.length, color: '#8b5cf6' },
            { label: 'Habits', value: habits.length, color: '#f59e0b' }
          ].map((stat, i) => (
            <div key={i} style={{ ...cardStyle, padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Export Options */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {/* Trades Export */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📊 Export Trades
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Export your trade history in various formats
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => handleExport('trades-csv')}
                disabled={exporting}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  justifyContent: 'center'
                }}
              >
                📄 Export as CSV
              </button>
              <button
                onClick={() => handleExport('trades-json')}
                disabled={exporting}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  justifyContent: 'center'
                }}
              >
                📋 Export as JSON
              </button>
              <button
                onClick={() => handleExport('trades-pdf')}
                disabled={exporting}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: 'white',
                  justifyContent: 'center'
                }}
              >
                📑 Generate PDF Report
              </button>
            </div>
          </div>

          {/* Other Exports */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📦 Other Exports
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Export goals, habits, or create a full backup
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => handleExport('goals-csv')}
                disabled={exporting}
                style={{
                  ...buttonStyle,
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  color: '#a78bfa',
                  justifyContent: 'center'
                }}
              >
                🎯 Export Goals (CSV)
              </button>
              <button
                onClick={() => handleExport('habits-csv')}
                disabled={exporting}
                style={{
                  ...buttonStyle,
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#fbbf24',
                  justifyContent: 'center'
                }}
              >
                ✅ Export Habits (CSV)
              </button>
              <button
                onClick={() => handleExport('all-json')}
                disabled={exporting}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  justifyContent: 'center'
                }}
              >
                💾 Full Backup (JSON)
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div style={{ ...cardStyle, marginTop: '1.5rem', background: 'rgba(59, 130, 246, 0.1)' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#60a5fa' }}>
            💡 Export Tips
          </h4>
          <ul style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, paddingLeft: '1.25rem' }}>
            <li>CSV files can be opened in Excel, Google Sheets, or any spreadsheet application</li>
            <li>JSON format preserves all data and is ideal for backups or importing into other tools</li>
            <li>PDF reports are great for printing or sharing performance summaries</li>
            <li>Use the date filter to export specific time periods</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Reports;
