import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase";

// EmptyState component - defined outside to prevent recreation during render
const EmptyState = ({ type }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    background: 'rgba(31, 41, 55, 0.4)',
    borderRadius: '16px',
    border: '1px dashed rgba(75, 85, 99, 0.5)'
  }}>
    <span style={{ fontSize: '4rem', marginBottom: '1rem' }}>
      {type === 'best' ? '🎯' : '📝'}
    </span>
    <h3 style={{ margin: 0, marginBottom: '0.5rem', color: '#f9fafb', fontSize: '1.25rem' }}>
      {type === 'best' ? 'No Best Trades Yet' : 'No Missed Trades Logged'}
    </h3>
    <p style={{ margin: 0, color: '#9ca3af', textAlign: 'center', maxWidth: '300px' }}>
      {type === 'best' 
        ? 'Trades with RR ≥ 2 will appear here. Keep trading!' 
        : 'Log missed opportunities to learn from them.'}
    </p>
  </div>
);

const Playbook = ({ hideHeading }) => {
  const [bestTrades, setBestTrades] = useState([]);
  const [missedTrades, setMissedTrades] = useState([]);
  const [activeTab, setActiveTab] = useState('best');
  const [loading, setLoading] = useState(true);
  const [showAddMissed, setShowAddMissed] = useState(false);
  const [missedForm, setMissedForm] = useState({
    symbol: '',
    reason: '',
    setup: '',
    potentialRR: '',
    date: ''
  });

  useEffect(() => {
    async function fetchData() {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        // Fetch all user trades, filter and sort client-side
        const tradesQuery = query(
          collection(db, "trades"),
          where("userId", "==", auth.currentUser.uid)
        );
        const tradesSnapshot = await getDocs(tradesQuery);
        const allTrades = tradesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter for RR >= 2 and sort by RR desc
        const bestTradesData = allTrades
          .filter(t => (t.rr_ratio || 0) >= 2)
          .sort((a, b) => (b.rr_ratio || 0) - (a.rr_ratio || 0));
        setBestTrades(bestTradesData);

        // Fetch missed trades
        const missedQuery = query(
          collection(db, "missed_trades"),
          where("userId", "==", auth.currentUser.uid)
        );
        const missedSnapshot = await getDocs(missedQuery);
        const missedData = missedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort client-side
        missedData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setMissedTrades(missedData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleAddMissedTrade = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !missedForm.symbol) return;
    
    try {
      const newMissed = {
        userId: auth.currentUser.uid,
        symbol: missedForm.symbol.toUpperCase(),
        reason: missedForm.reason,
        setup: missedForm.setup,
        potentialRR: parseFloat(missedForm.potentialRR) || 0,
        open_time: missedForm.date || new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, "missed_trades"), newMissed);
      setMissedTrades([{ id: docRef.id, ...newMissed }, ...missedTrades]);
      setMissedForm({ symbol: '', reason: '', setup: '', potentialRR: '', date: '' });
      setShowAddMissed(false);
    } catch (error) {
      console.error("Error adding missed trade:", error);
    }
  };

  const handleDeleteMissed = async (id) => {
    if (!window.confirm("Delete this missed trade?")) return;
    try {
      await deleteDoc(doc(db, "missed_trades", id));
      setMissedTrades(missedTrades.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const TradeCard = ({ trade, type }) => (
    <div style={{
      background: 'rgba(31, 41, 55, 0.6)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(75, 85, 99, 0.4)',
      borderRadius: '16px',
      padding: '1.5rem',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden'
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = type === 'best' 
        ? '0 10px 40px rgba(16, 185, 129, 0.2)' 
        : '0 10px 40px rgba(245, 158, 11, 0.2)';
      e.currentTarget.style.borderColor = type === 'best' ? '#10b981' : '#f59e0b';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.4)';
    }}
    >
      {/* Accent bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: type === 'best' 
          ? 'linear-gradient(90deg, #10b981, #059669)' 
          : 'linear-gradient(90deg, #f59e0b, #d97706)'
      }} />
      
      {type === 'best' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🏆</span>
                <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb' }}>{trade.symbol}</h4>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: trade.type === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: trade.type === 'BUY' ? '#10b981' : '#ef4444',
                  textTransform: 'uppercase'
                }}>{trade.type}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#9ca3af' }}>{trade.strategy || 'No strategy'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: trade.pnl >= 0 ? '#10b981' : '#ef4444'
              }}>
                {trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toFixed(2) || '0.00'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>P&L</div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '10px',
              padding: '0.75rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{trade.rr_ratio?.toFixed(1) || '-'}R</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>Risk/Reward</div>
            </div>
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '10px',
              padding: '0.75rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>{trade.lot_size || '-'}</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>Lot Size</div>
            </div>
            <div style={{
              background: 'rgba(139, 92, 246, 0.1)',
              borderRadius: '10px',
              padding: '0.75rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#8b5cf6' }}>{trade.open_time?.split('T')[0] || '-'}</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>Date</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.25rem' }}>😔</span>
            <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f9fafb' }}>{trade.symbol}</h4>
          </div>
          
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase' }}>
              Why I Missed It
            </div>
            <p style={{ margin: 0, color: '#d1d5db', fontSize: '0.95rem', lineHeight: 1.5 }}>
              {trade.reason || 'No reason provided'}
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.85rem' }}>
            <span>📅</span>
            <span>{trade.open_time?.split('T')[0] || 'Unknown date'}</span>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="feature-page">
      {!hideHeading && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{
            margin: 0,
            fontSize: '2rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>📖 Trading Playbook</h2>
          <p style={{ color: '#9ca3af', marginTop: '0.5rem', fontSize: '1rem' }}>
            Review your best setups and learn from missed opportunities
          </p>
        </div>
      )}

      {/* Stats Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '16px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#10b981' }}>{bestTrades.length}</div>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.25rem' }}>Best Trades</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '16px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f59e0b' }}>{missedTrades.length}</div>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.25rem' }}>Missed Trades</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '16px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#3b82f6' }}>
            {bestTrades.length > 0 ? (bestTrades.reduce((sum, t) => sum + (t.rr_ratio || 0), 0) / bestTrades.length).toFixed(1) : '0'}R
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.25rem' }}>Avg. RR Ratio</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        background: 'rgba(31, 41, 55, 0.5)',
        padding: '0.5rem',
        borderRadius: '12px',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setActiveTab('best')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            transition: 'all 0.2s ease',
            background: activeTab === 'best' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
            color: activeTab === 'best' ? 'white' : '#9ca3af',
            boxShadow: activeTab === 'best' ? '0 4px 15px rgba(16, 185, 129, 0.3)' : 'none'
          }}
        >
          🏆 Best Trades ({bestTrades.length})
        </button>
        <button
          onClick={() => setActiveTab('missed')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            transition: 'all 0.2s ease',
            background: activeTab === 'missed' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
            color: activeTab === 'missed' ? 'white' : '#9ca3af',
            boxShadow: activeTab === 'missed' ? '0 4px 15px rgba(245, 158, 11, 0.3)' : 'none'
          }}
        >
          😔 Missed Trades ({missedTrades.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'best' && (
        <div>
          {bestTrades.length === 0 ? (
            <EmptyState type="best" />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1.25rem'
            }}>
              {bestTrades.map(trade => (
                <TradeCard key={trade.id} trade={trade} type="best" />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'missed' && (
        <div>
          {/* Add Missed Trade Button */}
          <button
            onClick={() => setShowAddMissed(!showAddMissed)}
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {showAddMissed ? '✕ Cancel' : '+ Add Missed Trade'}
          </button>

          {/* Add Missed Trade Form */}
          {showAddMissed && (
            <form onSubmit={handleAddMissedTrade} style={{
              background: 'rgba(31, 41, 55, 0.6)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '16px',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#9ca3af', fontSize: '0.85rem' }}>Symbol *</label>
                <input
                  type="text"
                  value={missedForm.symbol}
                  onChange={(e) => setMissedForm({ ...missedForm, symbol: e.target.value })}
                  placeholder="e.g., EURUSD"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#9ca3af', fontSize: '0.85rem' }}>Date *</label>
                <input
                  type="date"
                  value={missedForm.date || ''}
                  onChange={(e) => setMissedForm({ ...missedForm, date: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#9ca3af', fontSize: '0.85rem' }}>Why did you miss it? *</label>
                <textarea
                  value={missedForm.reason}
                  onChange={(e) => setMissedForm({ ...missedForm, reason: e.target.value })}
                  placeholder="e.g., Was distracted, not at desk, hesitated..."
                  required
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '0.9rem',
                    resize: 'vertical'
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white'
                  }}
                >
                  {loading ? 'Saving...' : '✓ Save Missed Trade'}
                </button>
              </div>
            </form>
          )}

          {missedTrades.length === 0 && !showAddMissed ? (
            <EmptyState type="missed" />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '1.25rem'
            }}>
              {missedTrades.map(trade => (
                <div key={trade.id} style={{ position: 'relative' }}>
                  <TradeCard trade={trade} type="missed" />
                  <button
                    onClick={() => handleDeleteMissed(trade.id)}
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      cursor: 'pointer',
                      color: '#ef4444',
                      fontSize: '0.8rem'
                    }}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tips Section */}
      <div style={{
        marginTop: '2.5rem',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '16px',
        padding: '1.5rem'
      }}>
        <h3 style={{ margin: 0, marginBottom: '1rem', color: '#a78bfa', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          💡 Pro Tips
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📊</span>
            <div>
              <div style={{ color: '#f9fafb', fontWeight: 500, marginBottom: '0.25rem' }}>Review Weekly</div>
              <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Analyze your best trades every week to identify patterns</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🎯</span>
            <div>
              <div style={{ color: '#f9fafb', fontWeight: 500, marginBottom: '0.25rem' }}>Learn from Misses</div>
              <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Missed trades often reveal your best setups</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📝</span>
            <div>
              <div style={{ color: '#f9fafb', fontWeight: 500, marginBottom: '0.25rem' }}>Document Everything</div>
              <div style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Detailed notes help you replicate success</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Playbook;
