import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Shared style constants
const cardStyle = {
  background: 'rgba(30, 41, 59, 0.5)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(71, 85, 105, 0.4)',
  borderRadius: '16px',
  padding: 'clamp(1rem, 3vw, 1.5rem)',
  width: '100%'
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
  justifyContent: 'center',
  gap: '0.5rem'
};

// MT5 XM column mapping - typical MT5 export format
const MT5_COLUMN_MAP = {
  'Time': 'date',
  'Deal': 'dealId',
  'Symbol': 'pair',
  'Type': 'direction',
  'Direction': 'direction',
  'Volume': 'lotSize',
  'Price': 'entryPrice',
  'S/L': 'stopLoss',
  'T/P': 'takeProfit',
  'Profit': 'pnl',
  'Commission': 'commission',
  'Swap': 'swap',
  'Comment': 'notes',
  // Alternative column names
  'Open Time': 'date',
  'Open Price': 'entryPrice',
  'Close Time': 'closeDate',
  'Close Price': 'exitPrice',
  'Order': 'orderId',
  'Ticket': 'ticketId'
};

export default function ImportTrades() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [parsedTrades, setParsedTrades] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [existingTrades, setExistingTrades] = useState([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [tradingAccounts, setTradingAccounts] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch existing trades for duplicate detection
        const tradesQuery = query(
          collection(db, "trades"),
          where("userId", "==", currentUser.uid)
        );
        const tradesSnap = await getDocs(tradesQuery);
        setExistingTrades(tradesSnap.docs.map(doc => doc.data()));

        // Fetch trading accounts
        try {
          const accountsQuery = query(
            collection(db, "trading_accounts"),
            where("userId", "==", currentUser.uid)
          );
          const accountsSnap = await getDocs(accountsQuery);
          const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTradingAccounts(accounts);
          if (accounts.length > 0) {
            setSelectedAccount(accounts[0].name || accounts[0].id);
          }
        } catch (error) {
          console.error("Error fetching trading accounts:", error);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    // Handle both comma and tab delimited files
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    
    // Parse header
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
    
    const trades = [];
    let duplicates = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse values, handling quoted strings
      const values = parseCSVLine(line, delimiter);
      
      if (values.length !== headers.length) continue;

      const trade = {};
      headers.forEach((header, index) => {
        const mappedField = MT5_COLUMN_MAP[header] || header.toLowerCase().replace(/\s+/g, '');
        trade[mappedField] = values[index]?.trim().replace(/"/g, '') || '';
      });

      // Skip if not a buy/sell trade (filter out balance operations)
      const direction = (trade.direction || '').toLowerCase();
      if (!direction.includes('buy') && !direction.includes('sell')) continue;

      // Format the trade
      const formattedTrade = formatTrade(trade);
      
      // Check for duplicates - use field names that match AddTrade.jsx
      const isDuplicate = existingTrades.some(existing => {
        const existingSymbol = (existing.symbol || existing.pair || '').toUpperCase();
        const existingDate = existing.open_time || existing.date || '';
        const existingPnl = parseFloat(existing.pnl) || 0;
        
        return existingSymbol === formattedTrade.symbol &&
               existingDate.split('T')[0] === (formattedTrade.open_time || '').split('T')[0] &&
               Math.abs(existingPnl - formattedTrade.pnl) < 0.01;
      });

      if (isDuplicate) {
        duplicates++;
        formattedTrade.isDuplicate = true;
      }

      trades.push(formattedTrade);
    }

    setDuplicateCount(duplicates);
    return trades;
  };

  const parseCSVLine = (line, delimiter) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    
    return values;
  };

  const formatTrade = (trade) => {
    // Parse direction
    let direction = 'long';
    const dirStr = (trade.direction || '').toLowerCase();
    if (dirStr.includes('sell')) direction = 'short';

    // Parse date - MT5 format is usually YYYY.MM.DD HH:MM:SS
    let openTime = trade.date || '';
    if (openTime.includes('.')) {
      openTime = openTime.replace(/\./g, '-');
    }

    let closeTime = trade.closeDate || '';
    if (closeTime.includes('.')) {
      closeTime = closeTime.replace(/\./g, '-');
    }

    // Parse numeric values
    const pnl = parseFloat(trade.pnl) || 0;
    const commission = parseFloat(trade.commission) || 0;
    const swap = parseFloat(trade.swap) || 0;
    const totalPnl = pnl + commission + swap;

    // Match AddTrade.jsx field structure
    return {
      // Core fields matching AddTrade.jsx
      symbol: (trade.pair || trade.symbol || '').toUpperCase(),
      type: direction === 'long' ? 'BUY' : 'SELL',
      direction,
      entry_price: parseFloat(trade.entryPrice || trade.price) || 0,
      exit_price: parseFloat(trade.exitPrice) || 0,
      lot_size: parseFloat(trade.lotSize || trade.volume) || 0,
      open_time: openTime,
      close_time: closeTime,
      stop_loss: parseFloat(trade.stopLoss || trade.sl) || 0,
      take_profit: parseFloat(trade.takeProfit || trade.tp) || 0,
      pnl: totalPnl,
      
      // Additional MT5 specific fields
      commission: commission,
      swap: swap,
      ticketId: trade.ticketId || trade.dealId || trade.orderId || '',
      
      // Metadata
      notes: trade.notes || trade.comment || '',
      source: 'MT5-XM',
      account: selectedAccount,
      strategy: '',
      confluences: [],
      mistakeTags: [],
      
      // Display helpers
      outcome: totalPnl >= 0 ? 'win' : 'loss',
      isDuplicate: false
    };
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const trades = parseCSV(text);
      setParsedTrades(trades);
      setPreviewMode(true);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!user || parsedTrades.length === 0) return;

    setImporting(true);
    let imported = 0;
    let skipped = 0;

    try {
      for (const trade of parsedTrades) {
        if (trade.isDuplicate) {
          skipped++;
          continue;
        }

        await addDoc(collection(db, "trades"), {
          ...trade,
          userId: user.uid,
          account: selectedAccount,
          createdAt: new Date().toISOString(),
          importedAt: new Date().toISOString(),
          isDuplicate: undefined // Remove this flag before saving
        });
        imported++;
      }

      setImportResult({
        success: true,
        imported,
        skipped,
        total: parsedTrades.length
      });
      setParsedTrades([]);
      setPreviewMode(false);
      setFile(null);
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({
        success: false,
        error: error.message
      });
    }

    setImporting(false);
  };

  const removeTrade = (index) => {
    const newTrades = [...parsedTrades];
    if (newTrades[index].isDuplicate) {
      setDuplicateCount(prev => prev - 1);
    }
    newTrades.splice(index, 1);
    setParsedTrades(newTrades);
  };

  if (loading) {
    return (
      <div className="feature-page" style={{ 
        background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)', 
        minHeight: '100vh', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📥</div>
          <div style={{ color: '#94a3b8', fontSize: '1.125rem' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="feature-page" style={{ 
        background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)', 
        minHeight: '100vh', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
          <div style={{ color: '#94a3b8', fontSize: '1.125rem' }}>Please login to import trades</div>
        </div>
      </div>
    );
  }

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
        }}>📥 Import Trades from MT5</h1>
        <p style={{ color: '#94a3b8', fontSize: '1rem' }}>
          Import your trade history from MetaTrader 5 (XM Broker)
        </p>
      </div>

      <div style={{ padding: '0 2rem 2rem 2rem' }}>

        {/* Instructions Card */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#f1f5f9',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            📋 How to Export from MT5
          </h3>
          <ol style={{ 
            color: '#94a3b8', 
            lineHeight: '1.8',
            paddingLeft: '1.25rem',
            margin: 0
          }}>
            <li>Open MetaTrader 5 and go to the <strong style={{ color: '#f1f5f9' }}>History</strong> tab at the bottom</li>
            <li>Right-click on the history table and select <strong style={{ color: '#f1f5f9' }}>Deals</strong> to see all trades</li>
            <li>Set your date range by right-clicking and selecting <strong style={{ color: '#f1f5f9' }}>Custom Period</strong></li>
            <li>Right-click again and select <strong style={{ color: '#f1f5f9' }}>Report → Open XML (MS Office Excel)</strong> or <strong style={{ color: '#f1f5f9' }}>Save as Detailed Report</strong></li>
            <li>Save the file and convert to CSV if needed, then upload below</li>
          </ol>
        </div>

        {/* Account Selection */}
        {tradingAccounts.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '0.9rem', 
              color: '#94a3b8', 
              marginBottom: '0.5rem' 
            }}>
              Import to Trading Account:
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '300px',
                padding: '0.75rem 1rem',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '0.925rem',
                cursor: 'pointer'
              }}
            >
              {tradingAccounts.map(acc => (
                <option key={acc.id} value={acc.name || acc.id}>
                  {acc.name} ({acc.broker || 'Unknown Broker'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Upload Area */}
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <div 
            style={{
              border: '2px dashed rgba(71, 85, 105, 0.6)',
              borderRadius: '12px',
              padding: '3rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: file ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
            }}
            onClick={() => document.getElementById('csv-upload').click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.6)';
              e.currentTarget.style.background = 'transparent';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.6)';
              const droppedFile = e.dataTransfer.files[0];
              if (droppedFile) {
                const input = document.getElementById('csv-upload');
                const dt = new DataTransfer();
                dt.items.add(droppedFile);
                input.files = dt.files;
                handleFileChange({ target: { files: [droppedFile] } });
              }
            }}
          >
            <input
              type="file"
              id="csv-upload"
              accept=".csv,.txt,.htm,.html"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              {file ? '✅' : '📄'}
            </div>
            <div style={{ color: '#f1f5f9', fontSize: '1.125rem', marginBottom: '0.5rem' }}>
              {file ? file.name : 'Drop your MT5 export file here'}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
              {file ? `${parsedTrades.length} trades found` : 'or click to browse (CSV, TXT, HTML)'}
            </div>
          </div>
        </div>

        {/* Import Result */}
        {importResult && (
          <div style={{ 
            ...cardStyle, 
            marginBottom: '1.5rem',
            background: importResult.success 
              ? 'rgba(16, 185, 129, 0.2)' 
              : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${importResult.success ? '#10b981' : '#ef4444'}`
          }}>
            {importResult.success ? (
              <div>
                <div style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#10b981',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  ✅ Import Complete!
                </div>
                <div style={{ color: '#94a3b8' }}>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>{importResult.imported}</span> trades imported
                  {importResult.skipped > 0 && (
                    <span> • <span style={{ color: '#f59e0b' }}>{importResult.skipped}</span> duplicates skipped</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#ef4444',
                  marginBottom: '0.5rem'
                }}>
                  ❌ Import Failed
                </div>
                <div style={{ color: '#94a3b8' }}>{importResult.error}</div>
              </div>
            )}
          </div>
        )}

        {/* Preview Table */}
        {previewMode && parsedTrades.length > 0 && (
          <div style={{ ...cardStyle }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <h3 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '600', 
                  color: '#f1f5f9',
                  marginBottom: '0.25rem'
                }}>
                  Preview ({parsedTrades.length} trades)
                </h3>
                {duplicateCount > 0 && (
                  <p style={{ color: '#f59e0b', fontSize: '0.875rem', margin: 0 }}>
                    ⚠️ {duplicateCount} potential duplicates detected (will be skipped)
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    setPreviewMode(false);
                    setParsedTrades([]);
                    setFile(null);
                  }}
                  style={{
                    ...buttonStyle,
                    background: 'rgba(71, 85, 105, 0.4)',
                    color: '#f1f5f9'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  style={{
                    ...buttonStyle,
                    background: importing ? 'rgba(16, 185, 129, 0.5)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white'
                  }}
                >
                  {importing ? 'Importing...' : `Import ${parsedTrades.filter(t => !t.isDuplicate).length} Trades`}
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '0.875rem'
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.4)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>Pair</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>Direction</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#94a3b8', fontWeight: 500 }}>Lot Size</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#94a3b8', fontWeight: 500 }}>P&L</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTrades.map((trade, index) => (
                    <tr 
                      key={index}
                      style={{ 
                        borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
                        opacity: trade.isDuplicate ? 0.5 : 1,
                        background: trade.isDuplicate ? 'rgba(245, 158, 11, 0.1)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '0.75rem', color: '#f1f5f9' }}>{trade.open_time?.split(' ')[0] || trade.open_time}</td>
                      <td style={{ padding: '0.75rem', color: '#f1f5f9', fontWeight: 600 }}>{trade.symbol}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: trade.direction === 'long' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: trade.direction === 'long' ? '#10b981' : '#ef4444'
                        }}>
                          {trade.type}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#f1f5f9' }}>{trade.lot_size}</td>
                      <td style={{ 
                        padding: '0.75rem', 
                        textAlign: 'right',
                        color: trade.pnl >= 0 ? '#10b981' : '#ef4444',
                        fontWeight: 600
                      }}>
                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        {trade.isDuplicate ? (
                          <span style={{ 
                            color: '#f59e0b', 
                            fontSize: '0.75rem',
                            background: 'rgba(245, 158, 11, 0.2)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px'
                          }}>
                            Duplicate
                          </span>
                        ) : (
                          <span style={{ color: '#10b981', fontSize: '0.875rem' }}>✓</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button
                          onClick={() => removeTrade(index)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: 'none',
                            color: '#ef4444',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!previewMode && !file && (
          <div style={{ 
            ...cardStyle, 
            textAlign: 'center',
            padding: '3rem'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.5 }}>📊</div>
            <div style={{ color: '#94a3b8', fontSize: '1rem' }}>
              Upload your MT5 trade history to get started
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
