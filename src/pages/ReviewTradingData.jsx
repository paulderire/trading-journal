import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc, orderBy } from "firebase/firestore";

// Shared style constants
const cardStyle = {
  background: 'rgba(30, 41, 59, 0.5)',
  backdropFilter: 'blur(10px)',
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

const HEADER_TABS = [
  { key: "grid", label: "📊 Master Grid", icon: "📊" },
  { key: "filter", label: "🔍 Smart Filter", icon: "🔍" },
  { key: "bulk", label: "⚡ Bulk Actions", icon: "⚡" },
  { key: "export", label: "📤 Export", icon: "📤" },
  { key: "alerts", label: "⚠️ Data Alerts", icon: "⚠️" },
];

export default function ReviewTradingData() {
  const [activeTab, setActiveTab] = useState("grid");
  const [trades, setTrades] = useState([]);
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filters, setFilters] = useState({
    symbol: '',
    direction: '',
    strategy: '',
    outcome: '',
    dateFrom: '',
    dateTo: '',
    minPnl: '',
    maxPnl: '',
    account: ''
  });

  // Fetch trades and accounts from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        // Fetch trades
        const q = query(
          collection(db, "trades"),
          where("userId", "==", auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const tradesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          open_time: doc.data().open_time?.toDate?.() || new Date(doc.data().open_time),
          close_time: doc.data().close_time?.toDate?.() || (doc.data().close_time ? new Date(doc.data().close_time) : null)
        }));
        setTrades(tradesData);

        // Fetch trading accounts
        const accountsQuery = query(
          collection(db, "trading_accounts"),
          where("userId", "==", auth.currentUser.uid)
        );
        const accountsSnap = await getDocs(accountsQuery);
        const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTradingAccounts(accounts);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter trades
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      if (filters.symbol && !trade.symbol?.toLowerCase().includes(filters.symbol.toLowerCase())) return false;
      // Direction filter - check both 'direction' field and 'type' field
      if (filters.direction) {
        const tradeDirection = trade.direction || (trade.type === 'BUY' ? 'long' : trade.type === 'SELL' ? 'short' : '');
        if (tradeDirection !== filters.direction) return false;
      }
      if (filters.strategy && !trade.strategy?.toLowerCase().includes(filters.strategy.toLowerCase())) return false;
      if (filters.outcome) {
        const outcome = trade.pnl > 0 ? 'win' : trade.pnl < 0 ? 'loss' : 'breakeven';
        if (outcome !== filters.outcome) return false;
      }
      if (filters.dateFrom) {
        const tradeDate = trade.open_time instanceof Date ? trade.open_time : new Date(trade.open_time);
        if (tradeDate < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo) {
        const tradeDate = trade.open_time instanceof Date ? trade.open_time : new Date(trade.open_time);
        if (tradeDate > new Date(filters.dateTo + 'T23:59:59')) return false;
      }
      if (filters.minPnl && trade.pnl < parseFloat(filters.minPnl)) return false;
      if (filters.maxPnl && trade.pnl > parseFloat(filters.maxPnl)) return false;
      // Account filter
      if (filters.account && trade.account !== filters.account && trade.accountId !== filters.account) return false;
      return true;
    });
  }, [trades, filters]);

  // Calculate stats
  const stats = useMemo(() => {
    const wins = filteredTrades.filter(t => t.pnl > 0).length;
    const losses = filteredTrades.filter(t => t.pnl < 0).length;
    const totalPnl = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgPnl = filteredTrades.length > 0 ? totalPnl / filteredTrades.length : 0;
    const winRate = filteredTrades.length > 0 ? (wins / filteredTrades.length) * 100 : 0;
    return { wins, losses, totalPnl, avgPnl, winRate, total: filteredTrades.length };
  }, [filteredTrades]);

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
        padding: '2rem',
        marginBottom: '1.5rem'
      }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: '700',
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>📈 Review Trading Data</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.925rem' }}>
          Analyze, filter, and manage all your trading history in one place
        </p>
      </div>

      {/* Stats Bar */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '1rem', 
        padding: '0 2rem',
        marginBottom: '1.5rem'
      }}>
        {[
          { label: 'Total Trades', value: stats.total, color: '#3b82f6' },
          { label: 'Wins', value: stats.wins, color: '#10b981' },
          { label: 'Losses', value: stats.losses, color: '#ef4444' },
          { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: '#f59e0b' },
          { label: 'Total P&L', value: `$${stats.totalPnl.toFixed(2)}`, color: stats.totalPnl >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Avg P&L', value: `$${stats.avgPnl.toFixed(2)}`, color: stats.avgPnl >= 0 ? '#10b981' : '#ef4444' },
        ].map((stat, i) => (
          <div key={i} style={{
            ...cardStyle,
            padding: '1rem 1.25rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        padding: '0 2rem',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem'
      }}>
        {HEADER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...buttonStyle,
              background: activeTab === tab.key 
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                : 'rgba(30, 41, 59, 0.5)',
              color: activeTab === tab.key ? 'white' : '#94a3b8',
              border: activeTab === tab.key ? 'none' : '1px solid rgba(71, 85, 105, 0.4)',
              boxShadow: activeTab === tab.key ? '0 4px 15px rgba(16, 185, 129, 0.3)' : 'none',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ padding: '0 2rem 2rem' }}>
        {activeTab === "grid" && (
          <MasterDataGrid 
            trades={filteredTrades} 
            loading={loading}
            selectedTrade={selectedTrade}
            setSelectedTrade={setSelectedTrade}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            setTrades={setTrades}
          />
        )}
        {activeTab === "filter" && (
          <SmartFilterBar 
            filters={filters} 
            setFilters={setFilters}
            trades={trades}
            tradingAccounts={tradingAccounts}
          />
        )}
        {activeTab === "bulk" && (
          <BulkManagementTools 
            trades={filteredTrades}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            setTrades={setTrades}
          />
        )}
        {activeTab === "export" && (
          <ExportShare trades={filteredTrades} stats={stats} />
        )}
        {activeTab === "alerts" && (
          <MissingDataAlerts trades={trades} />
        )}
      </div>

      {/* Trade Detail Slide-Over */}
      {selectedTrade && (
        <TradeDetailSlideOver 
          trade={selectedTrade} 
          onClose={() => setSelectedTrade(null)}
          setTrades={setTrades}
        />
      )}
    </div>
  );
}

// --- Master Data Grid ---
function MasterDataGrid({ trades, loading, selectedTrade, setSelectedTrade, selectedIds, setSelectedIds, setTrades }) {
  const [sort, setSort] = useState({ col: "open_time", dir: "desc" });
  const [actionMenuId, setActionMenuId] = useState(null);

  // Sorting logic
  const sortedData = useMemo(() => {
    return [...trades].sort((a, b) => {
      let vA = a[sort.col], vB = b[sort.col];
      if (sort.col === "open_time" || sort.col === "close_time") {
        vA = vA?.getTime?.() || 0;
        vB = vB?.getTime?.() || 0;
      }
      if (vA === null || vA === undefined) return 1;
      if (vB === null || vB === undefined) return -1;
      if (vA < vB) return sort.dir === "asc" ? -1 : 1;
      if (vA > vB) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [trades, sort]);

  // Status/outcome color
  const getStatusColor = (pnl) => {
    if (pnl > 0) return '#10b981';
    if (pnl < 0) return '#ef4444';
    return '#64748b';
  };

  const getStatusLabel = (pnl) => {
    if (pnl > 0) return 'WIN';
    if (pnl < 0) return 'LOSS';
    return 'BE';
  };

  // Column definitions
  const columns = [
    { key: "select", label: "", width: 40 },
    { key: "status", label: "Status", width: 80 },
    { key: "open_time", label: "Date/Time", width: 150 },
    { key: "symbol", label: "Symbol", width: 120 },
    { key: "type", label: "Direction", width: 90 },
    { key: "account", label: "Account", width: 120 },
    { key: "strategy", label: "Strategy", width: 140 },
    { key: "rr_ratio", label: "R:R", width: 80 },
    { key: "pnl", label: "P&L", width: 100 },
    { key: "mistake_tags", label: "Tags", width: 150 },
    { key: "actions", label: "", width: 60 }
  ];

  // Format date
  const formatDate = (dt) => {
    if (!dt) return "-";
    try {
      return new Date(dt).toLocaleString("en-US", { 
        month: "short", 
        day: "2-digit", 
        hour: "2-digit", 
        minute: "2-digit" 
      });
    } catch {
      return "-";
    }
  };

  // Handle row selection
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedData.map(t => t.id));
    }
  };

  // Delete trade
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this trade?")) return;
    try {
      await deleteDoc(doc(db, "trades", id));
      setTrades(prev => prev.filter(t => t.id !== id));
      setActionMenuId(null);
    } catch (error) {
      console.error("Error deleting trade:", error);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        ...cardStyle, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '300px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
          <div style={{ color: '#94a3b8' }}>Loading trades...</div>
        </div>
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div style={{ 
        ...cardStyle, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '300px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <div style={{ color: '#f1f5f9', fontWeight: '600', marginBottom: '0.5rem' }}>No trades found</div>
          <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Add your first trade or adjust your filters</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    padding: '1rem 0.75rem',
                    fontWeight: '600',
                    color: '#94a3b8',
                    textAlign: col.key === "actions" || col.key === "select" ? "center" : "left",
                    cursor: !["actions", "select", "status", "mistake_tags"].includes(col.key) ? "pointer" : "default",
                    borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                    whiteSpace: 'nowrap',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    minWidth: col.width
                  }}
                  onClick={() => {
                    if (!["actions", "select", "status", "mistake_tags"].includes(col.key)) {
                      setSort(s => ({
                        col: col.key,
                        dir: s.col === col.key ? (s.dir === "asc" ? "desc" : "asc") : "desc"
                      }));
                    }
                  }}
                >
                  {col.key === "select" ? (
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === sortedData.length && sortedData.length > 0}
                      onChange={toggleSelectAll}
                      style={{ accentColor: '#10b981', width: '16px', height: '16px' }}
                    />
                  ) : (
                    <>
                      {col.label}
                      {sort.col === col.key && !["actions", "select"].includes(col.key) && (
                        <span style={{ marginLeft: '4px', color: '#10b981' }}>
                          {sort.dir === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <tr 
                key={row.id} 
                style={{ 
                  background: idx % 2 === 0 ? 'rgba(30, 41, 59, 0.3)' : 'transparent',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(30, 41, 59, 0.3)' : 'transparent'}
              >
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    style={{ accentColor: '#10b981', width: '16px', height: '16px' }}
                  />
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    background: `${getStatusColor(row.pnl)}20`,
                    color: getStatusColor(row.pnl),
                    border: `1px solid ${getStatusColor(row.pnl)}40`
                  }}>
                    {getStatusLabel(row.pnl)}
                  </span>
                </td>
                <td style={{ padding: '0.75rem', fontWeight: '500' }} onClick={() => setSelectedTrade(row)}>
                  {formatDate(row.open_time)}
                </td>
                <td style={{ padding: '0.75rem', fontWeight: '600', color: '#f1f5f9' }} onClick={() => setSelectedTrade(row)}>
                  {row.symbol || '-'}
                </td>
                <td style={{ padding: '0.75rem' }} onClick={() => setSelectedTrade(row)}>
                  <span style={{
                    color: (row.direction === 'long' || row.type === 'BUY') ? '#10b981' : '#ef4444',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    fontSize: '0.8rem'
                  }}>
                    {(row.direction === 'long' || row.type === 'BUY') ? '↗ LONG' : '↘ SHORT'}
                  </span>
                </td>
                <td style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.85rem' }} onClick={() => setSelectedTrade(row)}>
                  {row.account || '-'}
                </td>
                <td style={{ padding: '0.75rem', color: '#94a3b8' }} onClick={() => setSelectedTrade(row)}>
                  {row.strategy || '-'}
                </td>
                <td style={{ padding: '0.75rem', fontWeight: '600', color: '#3b82f6' }} onClick={() => setSelectedTrade(row)}>
                  {row.rr_ratio ? `${row.rr_ratio}R` : '-'}
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  fontWeight: '700', 
                  color: getStatusColor(row.pnl)
                }} onClick={() => setSelectedTrade(row)}>
                  {row.pnl !== null && row.pnl !== undefined 
                    ? `${row.pnl >= 0 ? '+' : ''}$${row.pnl.toFixed(2)}` 
                    : '-'}
                </td>
                <td style={{ padding: '0.75rem' }} onClick={() => setSelectedTrade(row)}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {(row.mistakeTags || row.mistake_tags || []).slice(0, 2).map((tag, i) => (
                      <span key={i} style={{
                        display: 'inline-block',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '0.7rem',
                        fontWeight: '500'
                      }}>{tag}</span>
                    ))}
                    {(row.mistakeTags || row.mistake_tags || []).length > 2 && (
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                        +{(row.mistakeTags || row.mistake_tags).length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center', position: 'relative' }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionMenuId(actionMenuId === row.id ? null : row.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.25rem',
                      color: '#64748b',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    ⋯
                  </button>
                  {actionMenuId === row.id && (
                    <div style={{
                      position: 'absolute',
                      right: '100%',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(30, 41, 59, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(71, 85, 105, 0.4)',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      zIndex: 100,
                      minWidth: '120px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                    }}>
                      <button
                        onClick={() => { setSelectedTrade(row); setActionMenuId(null); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          background: 'none',
                          border: 'none',
                          color: '#f1f5f9',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          fontSize: '0.875rem'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(16, 185, 129, 0.2)'}
                        onMouseLeave={(e) => e.target.style.background = 'none'}
                      >
                        👁️ View
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          fontSize: '0.875rem'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                        onMouseLeave={(e) => e.target.style.background = 'none'}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{
        padding: '1rem 1.5rem',
        borderTop: '1px solid rgba(71, 85, 105, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.4)'
      }}>
        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
          Showing {sortedData.length} trade{sortedData.length !== 1 ? 's' : ''}
          {selectedIds.length > 0 && ` • ${selectedIds.length} selected`}
        </span>
      </div>
    </div>
  );
}

// --- Smart Filter Bar ---
function SmartFilterBar({ filters, setFilters, trades, tradingAccounts = [] }) {
  // Get unique values for dropdowns
  const uniqueSymbols = [...new Set(trades.map(t => t.symbol).filter(Boolean))];
  const uniqueStrategies = [...new Set(trades.map(t => t.strategy).filter(Boolean))];

  const handleChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      symbol: '',
      direction: '',
      strategy: '',
      outcome: '',
      dateFrom: '',
      dateTo: '',
      minPnl: '',
      maxPnl: ''
    });
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  const FilterInput = ({ label, children }) => (
    <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
      <label style={{
        display: 'block',
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#64748b',
        marginBottom: '0.5rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        {label}
      </label>
      {children}
    </div>
  );

  return (
    <div style={{ ...cardStyle }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)'
      }}>
        <div>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🔍 Smart Filters
            {activeFilterCount > 0 && (
              <span style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '20px',
                fontWeight: '700'
              }}>
                {activeFilterCount} active
              </span>
            )}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Narrow down your trades by specific criteria
          </p>
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            style={{
              ...buttonStyle,
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            ✕ Clear All
          </button>
        )}
      </div>

      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '1.25rem'
      }}>
        <FilterInput label="Symbol">
          <select
            value={filters.symbol}
            onChange={(e) => handleChange('symbol', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">All Symbols</option>
            {uniqueSymbols.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FilterInput>

        <FilterInput label="Direction">
          <select
            value={filters.direction}
            onChange={(e) => handleChange('direction', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">All Directions</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </FilterInput>

        <FilterInput label="Strategy">
          <select
            value={filters.strategy}
            onChange={(e) => handleChange('strategy', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">All Strategies</option>
            {uniqueStrategies.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FilterInput>

        <FilterInput label="Outcome">
          <select
            value={filters.outcome}
            onChange={(e) => handleChange('outcome', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">All Outcomes</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="breakeven">Breakeven</option>
          </select>
        </FilterInput>

        <FilterInput label="Trading Account">
          <select
            value={filters.account}
            onChange={(e) => handleChange('account', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">All Accounts</option>
            {tradingAccounts.map(acc => (
              <option key={acc.id} value={acc.name}>{acc.name} ({acc.broker})</option>
            ))}
          </select>
        </FilterInput>

        <FilterInput label="Date From">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            style={inputStyle}
          />
        </FilterInput>

        <FilterInput label="Date To">
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            style={inputStyle}
          />
        </FilterInput>

        <FilterInput label="Min P&L ($)">
          <input
            type="number"
            placeholder="-1000"
            value={filters.minPnl}
            onChange={(e) => handleChange('minPnl', e.target.value)}
            style={inputStyle}
          />
        </FilterInput>

        <FilterInput label="Max P&L ($)">
          <input
            type="number"
            placeholder="5000"
            value={filters.maxPnl}
            onChange={(e) => handleChange('maxPnl', e.target.value)}
            style={inputStyle}
          />
        </FilterInput>
      </div>

      {/* Quick Filter Presets */}
      <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Quick Presets
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[
            { label: '📈 Winners Only', action: () => setFilters(prev => ({ ...prev, outcome: 'win' })) },
            { label: '📉 Losers Only', action: () => setFilters(prev => ({ ...prev, outcome: 'loss' })) },
            { label: '⬆️ Long Trades', action: () => setFilters(prev => ({ ...prev, direction: 'long' })) },
            { label: '⬇️ Short Trades', action: () => setFilters(prev => ({ ...prev, direction: 'short' })) },
            { label: '📅 This Week', action: () => {
              const today = new Date();
              const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
              setFilters(prev => ({ ...prev, dateFrom: weekStart.toISOString().split('T')[0] }));
            }},
            { label: '📆 This Month', action: () => {
              const today = new Date();
              const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
              setFilters(prev => ({ ...prev, dateFrom: monthStart.toISOString().split('T')[0] }));
            }},
          ].map((preset, i) => (
            <button
              key={i}
              onClick={preset.action}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '20px',
                color: '#3b82f6',
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Trade Detail Slide-Over ---
function TradeDetailSlideOver({ trade, onClose, setTrades }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTrade, setEditedTrade] = useState({ ...trade });

  const formatDate = (dt) => {
    if (!dt) return "-";
    try {
      return new Date(dt).toLocaleString("en-US", {
        weekday: 'short',
        month: "short",
        day: "2-digit",
        year: 'numeric',
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "-";
    }
  };

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, "trades", trade.id), {
        ...editedTrade,
        open_time: editedTrade.open_time,
        close_time: editedTrade.close_time
      });
      setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, ...editedTrade } : t));
      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error("Error updating trade:", error);
    }
  };

  const getStatusColor = (pnl) => {
    if (pnl > 0) return '#10b981';
    if (pnl < 0) return '#ef4444';
    return '#64748b';
  };

  const DetailRow = ({ label, value, color }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.75rem 0',
      borderBottom: '1px solid rgba(71, 85, 105, 0.2)'
    }}>
      <span style={{ color: '#64748b', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ color: color || '#f1f5f9', fontWeight: '600' }}>{value}</span>
    </div>
  );

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '500px',
          height: '100%',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderLeft: '1px solid rgba(71, 85, 105, 0.4)',
          overflow: 'auto',
          animation: 'slideIn 0.3s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
          borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: '#f1f5f9',
                marginBottom: '0.25rem'
              }}>
                {trade.symbol || 'Trade Details'}
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                marginTop: '0.5rem'
              }}>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  background: (trade.direction === 'long' || trade.type === 'BUY') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: (trade.direction === 'long' || trade.type === 'BUY') ? '#10b981' : '#ef4444'
                }}>
                  {(trade.direction === 'long' || trade.type === 'BUY') ? 'LONG' : 'SHORT'}
                </span>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  background: `${getStatusColor(trade.pnl)}20`,
                  color: getStatusColor(trade.pnl)
                }}>
                  {trade.pnl > 0 ? 'WIN' : trade.pnl < 0 ? 'LOSS' : 'BREAKEVEN'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* P&L Card */}
          <div style={{
            ...cardStyle,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Net Profit/Loss
            </div>
            <div style={{
              fontSize: '2.5rem',
              fontWeight: '800',
              color: getStatusColor(trade.pnl),
              marginTop: '0.5rem'
            }}>
              {trade.pnl !== null && trade.pnl !== undefined
                ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`
                : '-'}
            </div>
            {trade.rr_ratio && (
              <div style={{ color: '#3b82f6', fontSize: '1rem', marginTop: '0.25rem', fontWeight: '600' }}>
                {trade.rr_ratio}R
              </div>
            )}
          </div>

          {/* Trade Details */}
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
              📊 Trade Information
            </h4>
            <DetailRow label="Entry Price" value={trade.entry_price || '-'} />
            <DetailRow label="Exit Price" value={trade.exit_price || '-'} />
            <DetailRow label="Lot Size" value={trade.lot_size || '-'} />
            <DetailRow label="Stop Loss" value={trade.stop_loss || '-'} />
            <DetailRow label="Take Profit" value={trade.take_profit || '-'} />
            <DetailRow label="% of Account" value={trade.percent_of_account ? `${trade.percent_of_account}%` : '-'} />
          </div>

          {/* Timing */}
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
              ⏰ Timing & Account
            </h4>
            <DetailRow label="Open Time" value={formatDate(trade.open_time)} />
            <DetailRow label="Close Time" value={formatDate(trade.close_time)} />
            <DetailRow label="Strategy" value={trade.strategy || '-'} />
            <DetailRow label="Trading Account" value={trade.account || '-'} />
          </div>

          {/* Tags & Emotions */}
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
              🏷️ Tags & Psychology
            </h4>
            
            {trade.confluences && trade.confluences.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Confluences</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {trade.confluences.map((c, i) => (
                    <span key={i} style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.75rem'
                    }}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {(trade.mistakeTags || trade.mistake_tags) && (trade.mistakeTags || trade.mistake_tags).length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Mistakes</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {(trade.mistakeTags || trade.mistake_tags).map((m, i) => (
                    <span key={i} style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.75rem'
                    }}>{m}</span>
                  ))}
                </div>
              </div>
            )}

            {(trade.preEmotion || trade.postEmotion) && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Emotions</div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {trade.preEmotion && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Pre: </span>
                      <span style={{ color: '#f1f5f9' }}>{trade.preEmotion}</span>
                    </div>
                  )}
                  {trade.postEmotion && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Post: </span>
                      <span style={{ color: '#f1f5f9' }}>{trade.postEmotion}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {trade.notes && (
            <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                📝 Notes
              </h4>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: '1.6' }}>
                {trade.notes}
              </p>
            </div>
          )}

          {/* Chart Images */}
          {(trade.images?.before || trade.images?.after) && (
            <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
                📸 Chart Screenshots
              </h4>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {trade.images?.before && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>Before</div>
                    <img 
                      src={trade.images.before} 
                      alt="Before trade" 
                      style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(71, 85, 105, 0.4)' }} 
                    />
                  </div>
                )}
                {trade.images?.after && (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>After</div>
                    <img 
                      src={trade.images.after} 
                      alt="After trade" 
                      style={{ width: '100%', borderRadius: '8px', border: '1px solid rgba(71, 85, 105, 0.4)' }} 
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TradingView Link */}
          {trade.tradingview_link && (
            <a
              href={trade.tradingview_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '1rem',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                color: '#3b82f6',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '0.925rem'
              }}
            >
              📊 View on TradingView →
            </a>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// --- Bulk Management Tools ---
function BulkManagementTools({ trades, selectedIds, setSelectedIds, setTrades }) {
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedTrades = trades.filter(t => selectedIds.includes(t.id));

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} trades? This cannot be undone.`)) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, "trades", id));
      }
      setTrades(prev => prev.filter(t => !selectedIds.includes(t.id)));
      setSelectedIds([]);
    } catch (error) {
      console.error("Error deleting trades:", error);
    }
    setIsProcessing(false);
  };

  const handleBulkUpdate = async () => {
    if (!bulkAction || !bulkValue) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        await updateDoc(doc(db, "trades", id), { [bulkAction]: bulkValue });
      }
      setTrades(prev => prev.map(t => 
        selectedIds.includes(t.id) ? { ...t, [bulkAction]: bulkValue } : t
      ));
      setBulkAction('');
      setBulkValue('');
    } catch (error) {
      console.error("Error updating trades:", error);
    }
    setIsProcessing(false);
  };

  const handleAddTag = async () => {
    if (!bulkValue.trim()) return;
    setIsProcessing(true);
    try {
      for (const id of selectedIds) {
        const trade = trades.find(t => t.id === id);
        const currentTags = trade?.mistakeTags || trade?.mistake_tags || [];
        if (!currentTags.includes(bulkValue.trim())) {
          await updateDoc(doc(db, "trades", id), { 
            mistakeTags: [...currentTags, bulkValue.trim()] 
          });
        }
      }
      setTrades(prev => prev.map(t => {
        if (selectedIds.includes(t.id)) {
          const currentTags = t.mistakeTags || t.mistake_tags || [];
          if (!currentTags.includes(bulkValue.trim())) {
            return { ...t, mistakeTags: [...currentTags, bulkValue.trim()] };
          }
        }
        return t;
      }));
      setBulkValue('');
    } catch (error) {
      console.error("Error adding tags:", error);
    }
    setIsProcessing(false);
  };

  return (
    <div style={{ ...cardStyle }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)'
      }}>
        <div>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ⚡ Bulk Management
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Perform batch operations on multiple trades at once
          </p>
        </div>
        {selectedIds.length > 0 && (
          <span style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            fontWeight: '700',
            fontSize: '0.875rem'
          }}>
            {selectedIds.length} selected
          </span>
        )}
      </div>

      {selectedIds.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#64748b'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>☑️</div>
          <p style={{ fontWeight: '500', color: '#94a3b8' }}>No trades selected</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Go to the Master Grid tab and select trades using the checkboxes
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Selected Trades Summary */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '1rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Selected Trades Summary
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span style={{ color: '#64748b' }}>Total: </span>
                <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{selectedTrades.length}</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Wins: </span>
                <span style={{ color: '#10b981', fontWeight: '600' }}>
                  {selectedTrades.filter(t => t.pnl > 0).length}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Losses: </span>
                <span style={{ color: '#ef4444', fontWeight: '600' }}>
                  {selectedTrades.filter(t => t.pnl < 0).length}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Total P&L: </span>
                <span style={{ 
                  color: selectedTrades.reduce((s, t) => s + (t.pnl || 0), 0) >= 0 ? '#10b981' : '#ef4444', 
                  fontWeight: '600' 
                }}>
                  ${selectedTrades.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Bulk Update Strategy */}
          <div style={{
            ...cardStyle,
            background: 'rgba(15, 23, 42, 0.5)'
          }}>
            <h4 style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
              📝 Update Strategy
            </h4>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Enter strategy name..."
                value={bulkAction === 'strategy' ? bulkValue : ''}
                onChange={(e) => { setBulkAction('strategy'); setBulkValue(e.target.value); }}
                style={{ ...inputStyle, flex: '1 1 200px' }}
              />
              <button
                onClick={handleBulkUpdate}
                disabled={bulkAction !== 'strategy' || !bulkValue || isProcessing}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  opacity: (bulkAction !== 'strategy' || !bulkValue || isProcessing) ? 0.5 : 1
                }}
              >
                {isProcessing ? 'Updating...' : 'Apply to Selected'}
              </button>
            </div>
          </div>

          {/* Bulk Add Tag */}
          <div style={{
            ...cardStyle,
            background: 'rgba(15, 23, 42, 0.5)'
          }}>
            <h4 style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
              🏷️ Add Tag to Selected
            </h4>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Enter tag name..."
                value={bulkAction === 'tag' ? bulkValue : ''}
                onChange={(e) => { setBulkAction('tag'); setBulkValue(e.target.value); }}
                style={{ ...inputStyle, flex: '1 1 200px' }}
              />
              <button
                onClick={handleAddTag}
                disabled={bulkAction !== 'tag' || !bulkValue || isProcessing}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  opacity: (bulkAction !== 'tag' || !bulkValue || isProcessing) ? 0.5 : 1
                }}
              >
                {isProcessing ? 'Adding...' : 'Add Tag'}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div style={{
            ...cardStyle,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <h4 style={{ color: '#ef4444', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
              ⚠️ Danger Zone
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Permanently delete {selectedIds.length} selected trade{selectedIds.length !== 1 ? 's' : ''}. This action cannot be undone.
            </p>
            <button
              onClick={handleBulkDelete}
              disabled={isProcessing}
              style={{
                ...buttonStyle,
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                opacity: isProcessing ? 0.5 : 1
              }}
            >
              {isProcessing ? 'Deleting...' : `🗑️ Delete ${selectedIds.length} Trade${selectedIds.length !== 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Clear Selection */}
          <button
            onClick={() => setSelectedIds([])}
            style={{
              ...buttonStyle,
              background: 'rgba(71, 85, 105, 0.3)',
              color: '#94a3b8',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              justifyContent: 'center',
              width: '100%'
            }}
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
}

// --- Export & Share ---
function ExportShare({ trades, stats }) {
  const [exportFormat, setExportFormat] = useState('csv');
  const [isExporting, setIsExporting] = useState(false);

  const generateCSV = () => {
    const headers = [
      'Date', 'Symbol', 'Direction', 'Entry Price', 'Exit Price', 'Position Size',
      'P&L', 'R:R', 'Strategy', 'Confluences', 'Mistakes', 'Notes'
    ];
    
    const rows = trades.map(t => [
      t.open_time ? new Date(t.open_time).toISOString() : '',
      t.symbol || '',
      t.type || '',
      t.entry_price || '',
      t.exit_price || '',
      t.position_size || '',
      t.pnl || '',
      t.rr_ratio || '',
      t.strategy || '',
      (t.confluences || []).join('; '),
      (t.mistake_tags || []).join('; '),
      (t.notes || '').replace(/"/g, '""')
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  };

  const generateJSON = () => {
    return JSON.stringify(trades, null, 2);
  };

  const handleExport = () => {
    setIsExporting(true);
    
    let content, filename, mimeType;
    
    if (exportFormat === 'csv') {
      content = generateCSV();
      filename = `trades_export_${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    } else {
      content = generateJSON();
      filename = `trades_export_${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsExporting(false);
  };

  const handleCopyStats = () => {
    const statsText = `
📊 Trading Statistics
━━━━━━━━━━━━━━━━━━━━
📈 Total Trades: ${stats.total}
✅ Wins: ${stats.wins}
❌ Losses: ${stats.losses}
📊 Win Rate: ${stats.winRate.toFixed(1)}%
💰 Total P&L: $${stats.totalPnl.toFixed(2)}
📉 Avg P&L: $${stats.avgPnl.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
Generated on ${new Date().toLocaleDateString()}
    `.trim();
    
    navigator.clipboard.writeText(statsText);
    alert('Stats copied to clipboard!');
  };

  return (
    <div style={{ ...cardStyle }}>
      <div style={{
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)'
      }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          color: '#f1f5f9'
        }}>
          📤 Export & Share
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Export your trading data or share your statistics
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* Export Options */}
        <div style={{
          ...cardStyle,
          background: 'rgba(15, 23, 42, 0.5)'
        }}>
          <h4 style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
            💾 Export Data ({trades.length} trades)
          </h4>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
            {['csv', 'json'].map(format => (
              <button
                key={format}
                onClick={() => setExportFormat(format)}
                style={{
                  ...buttonStyle,
                  flex: 1,
                  justifyContent: 'center',
                  background: exportFormat === format 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                    : 'rgba(30, 41, 59, 0.5)',
                  color: exportFormat === format ? 'white' : '#94a3b8',
                  border: exportFormat === format ? 'none' : '1px solid rgba(71, 85, 105, 0.4)'
                }}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting || trades.length === 0}
            style={{
              ...buttonStyle,
              width: '100%',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              opacity: (isExporting || trades.length === 0) ? 0.5 : 1
            }}
          >
            {isExporting ? 'Exporting...' : `📥 Download ${exportFormat.toUpperCase()}`}
          </button>
        </div>

        {/* Quick Share Stats */}
        <div style={{
          ...cardStyle,
          background: 'rgba(15, 23, 42, 0.5)'
        }}>
          <h4 style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
            📊 Quick Stats Share
          </h4>
          
          <div style={{
            background: 'rgba(10, 14, 23, 0.6)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            color: '#94a3b8',
            lineHeight: '1.8'
          }}>
            <div>📈 Total Trades: <span style={{ color: '#3b82f6' }}>{stats.total}</span></div>
            <div>✅ Wins: <span style={{ color: '#10b981' }}>{stats.wins}</span></div>
            <div>❌ Losses: <span style={{ color: '#ef4444' }}>{stats.losses}</span></div>
            <div>📊 Win Rate: <span style={{ color: '#f59e0b' }}>{stats.winRate.toFixed(1)}%</span></div>
            <div>💰 Total P&L: <span style={{ color: stats.totalPnl >= 0 ? '#10b981' : '#ef4444' }}>
              ${stats.totalPnl.toFixed(2)}
            </span></div>
          </div>

          <button
            onClick={handleCopyStats}
            style={{
              ...buttonStyle,
              width: '100%',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white'
            }}
          >
            📋 Copy Stats to Clipboard
          </button>
        </div>

        {/* Export Info */}
        <div style={{
          padding: '1rem',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>💡</span>
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: '500', marginBottom: '0.25rem' }}>Pro Tip</div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                Use the Smart Filter tab first to export only specific trades. Your filtered results will be exported.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Missing Data Alerts ---
function MissingDataAlerts({ trades }) {
  const alerts = useMemo(() => {
    const issues = [];

    trades.forEach(trade => {
      const tradeIssues = [];
      
      if (!trade.strategy) tradeIssues.push('Missing strategy');
      if (!trade.entry_price) tradeIssues.push('Missing entry price');
      if (!trade.exit_price && trade.pnl !== undefined) tradeIssues.push('Missing exit price');
      if (!trade.stop_loss) tradeIssues.push('Missing stop loss');
      if (!trade.rr_ratio) tradeIssues.push('Missing R:R ratio');
      if (!trade.notes) tradeIssues.push('No notes added');
      if (!(trade.confluences?.length)) tradeIssues.push('No confluences tagged');

      if (tradeIssues.length > 0) {
        issues.push({
          trade,
          issues: tradeIssues
        });
      }
    });

    return issues;
  }, [trades]);

  const healthScore = useMemo(() => {
    if (trades.length === 0) return 100;
    const perfectTrades = trades.length - alerts.length;
    return Math.round((perfectTrades / trades.length) * 100);
  }, [trades, alerts]);

  const getHealthColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{ ...cardStyle }}>
      <div style={{
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)'
      }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          color: '#f1f5f9'
        }}>
          ⚠️ Data Health Check
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Identify trades with incomplete or missing data
        </p>
      </div>

      {/* Health Score */}
      <div style={{
        ...cardStyle,
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
        textAlign: 'center',
        marginBottom: '1.5rem'
      }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Data Completeness Score
        </div>
        <div style={{
          fontSize: '4rem',
          fontWeight: '800',
          color: getHealthColor(healthScore),
          lineHeight: 1.2,
          marginTop: '0.5rem'
        }}>
          {healthScore}%
        </div>
        <div style={{ 
          color: '#94a3b8', 
          fontSize: '0.875rem', 
          marginTop: '0.5rem' 
        }}>
          {alerts.length === 0 
            ? '✨ All trades have complete data!' 
            : `${alerts.length} of ${trades.length} trades need attention`}
        </div>
      </div>

      {/* Issue Categories */}
      {alerts.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            {[
              { label: 'Missing Strategy', count: alerts.filter(a => a.issues.includes('Missing strategy')).length },
              { label: 'No Stop Loss', count: alerts.filter(a => a.issues.includes('Missing stop loss')).length },
              { label: 'No R:R Ratio', count: alerts.filter(a => a.issues.includes('Missing R:R ratio')).length },
              { label: 'No Notes', count: alerts.filter(a => a.issues.includes('No notes added')).length },
              { label: 'No Screenshots', count: alerts.filter(a => a.issues.includes('No chart screenshots')).length },
              { label: 'No Confluences', count: alerts.filter(a => a.issues.includes('No confluences tagged')).length },
            ].filter(item => item.count > 0).map((item, i) => (
              <div key={i} style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                padding: '1rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
                  {item.count}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Trades with Issues */}
          <div style={{
            ...cardStyle,
            background: 'rgba(15, 23, 42, 0.5)',
            maxHeight: '400px',
            overflow: 'auto'
          }}>
            <h4 style={{ color: '#f1f5f9', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
              📋 Trades Needing Attention
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {alerts.slice(0, 20).map((alert, i) => (
                <div key={i} style={{
                  padding: '1rem',
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '10px'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ color: '#f1f5f9', fontWeight: '600' }}>
                      {alert.trade.symbol || 'Unknown'} 
                      <span style={{ color: '#64748b', fontWeight: '400', marginLeft: '0.5rem' }}>
                        {alert.trade.open_time ? new Date(alert.trade.open_time).toLocaleDateString() : 'No date'}
                      </span>
                    </span>
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#f59e0b',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '20px',
                      fontSize: '0.7rem',
                      fontWeight: '600'
                    }}>
                      {alert.issues.length} issue{alert.issues.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {alert.issues.map((issue, j) => (
                      <span key={j} style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem'
                      }}>
                        {issue}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {alerts.length > 20 && (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#64748b', 
                  fontSize: '0.875rem',
                  padding: '0.5rem'
                }}>
                  ... and {alerts.length - 20} more
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {trades.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#64748b'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <p style={{ fontWeight: '500', color: '#94a3b8' }}>No trades to analyze</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Add some trades to see your data health report
          </p>
        </div>
      )}
    </div>
  );
}