import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const initialState = {
  symbol: '',
  direction: 'long',
  entry: '',
  exit: '',
  lotSize: '',
  pnl: '',
  openTime: '',
  closeTime: '',
  strategy: '',
  confluences: [],
  mistakeTags: [],
  notes: '',
  beforeImg: '',
  afterImg: '',
  tradingviewLink: '',
  stopLoss: '',
  takeProfit: '',
  accountBalance: '',
  preEmotion: '',
  postEmotion: ''
};

const confluenceOptions = ["RSI Divergence", "Golden Pocket", "Breakout", "Volume Spike"];
const mistakeOptions = ["FOMO", "Revenge Trade", "Did not wait for candle close"];
const emotionOptions = ["Confident", "Anxious", "Bored", "Excited"];

/**
 * FOREX PNL CALCULATION
 * Formula: Profit/Loss = (Exit Price - Entry Price) × Lot Size × Pip Value
 * 
 * Step 1: Calculate pip movement
 *   - Most pairs: (price diff) / 0.0001 = pips
 *   - JPY pairs: (price diff) / 0.01 = pips
 * 
 * Step 2: Calculate monetary value
 *   - Standard Lot (1.0) = 100,000 units = ~$10 per pip
 *   - Mini Lot (0.1) = 10,000 units = ~$1 per pip
 *   - Micro Lot (0.01) = 1,000 units = ~$0.10 per pip
 * 
 * Pip Value Formula: (One Pip / Exchange Rate) × Lot Size in units
 * For USD-quoted pairs (EUR/USD, GBP/USD): pip value ≈ $10 per standard lot
 */

// Get pip decimal size based on symbol
function getPipSize(symbol) {
  const sym = (symbol || '').toUpperCase();
  // JPY pairs: pip is at 2nd decimal (0.01)
  if (sym.includes('JPY')) return 0.01;
  // Gold (XAUUSD): pip is at 1st decimal (0.1)
  if (sym.includes('XAU') || sym.includes('GOLD')) return 0.1;
  // Indices: pip is 1 point
  if (sym.includes('US30') || sym.includes('NAS') || sym.includes('SPX') || sym.includes('DAX') || sym.includes('US100')) return 1;
  // Default forex pairs: pip is at 4th decimal (0.0001)
  return 0.0001;
}

// Get pip value in USD per standard lot (100,000 units)
function getPipValuePerStandardLot(symbol) {
  const sym = (symbol || '').toUpperCase();
  // For USD-quoted pairs (EUR/USD, GBP/USD, AUD/USD, NZD/USD)
  // Pip value = $10 per standard lot
  if (sym.endsWith('USD') && !sym.includes('XAU')) return 10;
  // For JPY pairs quoted in USD (USD/JPY) - approx $9.10 per pip (varies with rate)
  if (sym.includes('JPY')) return 9.10;
  // Gold (XAU/USD): $10 per 0.1 pip movement per standard lot
  if (sym.includes('XAU') || sym.includes('GOLD')) return 10;
  // Indices - typically $1 per point per contract
  if (sym.includes('US30') || sym.includes('NAS') || sym.includes('SPX') || sym.includes('DAX') || sym.includes('US100')) return 1;
  // Default: $10 per pip (approximate for most major pairs)
  return 10;
}

// Calculate pips from price movement
function calcPips(entry, exit, symbol) {
  if (!entry || !exit) return '';
  const entryPrice = parseFloat(entry);
  const exitPrice = parseFloat(exit);
  const pipSize = getPipSize(symbol);
  
  // Pips = (Exit Price - Entry Price) / Pip Size
  const pips = (exitPrice - entryPrice) / pipSize;
  return pips.toFixed(1);
}

// Calculate PnL using forex formula
function calcPnL(entry, exit, lotSize, direction, symbol) {
  if (!entry || !exit || !lotSize) return '';
  
  const entryPrice = parseFloat(entry);
  const exitPrice = parseFloat(exit);
  const lots = parseFloat(lotSize);
  const pipSize = getPipSize(symbol);
  const pipValuePerLot = getPipValuePerStandardLot(symbol);
  
  // Step 1: Calculate price difference
  const priceDiff = exitPrice - entryPrice;
  
  // Step 2: Convert to pips
  // Pips = Price Difference / Pip Size
  const pips = priceDiff / pipSize;
  
  // Step 3: Calculate monetary value
  // PnL = Pips × Lot Size × Pip Value per Standard Lot
  // Note: lotSize of 1.0 = standard lot, 0.1 = mini lot, 0.01 = micro lot
  let pnl = pips * lots * pipValuePerLot;
  
  // Apply direction (for short trades, profit when price goes down)
  if (direction === 'short') {
    pnl = -pnl;
  }
  
  return pnl.toFixed(2);
}

function calcRR(entry, stopLoss, takeProfit) {
  if (!entry || !stopLoss || !takeProfit) return '';
  const risk = Math.abs(parseFloat(entry) - parseFloat(stopLoss));
  const reward = Math.abs(parseFloat(takeProfit) - parseFloat(entry));
  return (reward / risk).toFixed(2);
}

// Calculate % risk/reward based on PnL vs account balance
function calcPercentOfAccount(accountBalance, pnl) {
  if (!accountBalance || !pnl) return '';
  const balance = parseFloat(accountBalance);
  const profit = parseFloat(pnl);
  // Percent = (PnL / Account Balance) × 100
  return ((profit / balance) * 100).toFixed(2);
}

const AddTrade = () => {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [beforePreview, setBeforePreview] = useState(null);
  const [afterPreview, setAfterPreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const beforeInputRef = useRef(null);
  const afterInputRef = useRef(null);

  // Fetch trading accounts on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const accountsQuery = query(
            collection(db, "trading_accounts"),
            where("userId", "==", user.uid)
          );
          const accountsSnap = await getDocs(accountsQuery);
          const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTradingAccounts(accounts);
          
          // Auto-select first account if available
          if (accounts.length > 0) {
            setSelectedAccount(accounts[0]);
            setForm(prev => ({ ...prev, accountBalance: accounts[0].balance?.toString() || '' }));
          }
        } catch (err) {
          console.error("Error fetching trading accounts:", err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle account selection change
  const handleAccountChange = (e) => {
    const accountId = e.target.value;
    const account = tradingAccounts.find(a => a.id === accountId);
    setSelectedAccount(account);
    if (account) {
      setForm(prev => ({ ...prev, accountBalance: account.balance?.toString() || '' }));
    }
  };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setForm(prev => ({
        ...prev,
        [name]: checked
          ? [...prev[name], value]
          : prev[name].filter(v => v !== value)
      }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // Auto-calculated fields
  const rr = calcRR(form.entry, form.stopLoss, form.takeProfit);
  const percentOfAccount = calcPercentOfAccount(form.accountBalance, form.pnl);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!auth.currentUser) {
      setError('You must be logged in to add a trade');
      setLoading(false);
      return;
    }

    if (!form.symbol || !form.entry) {
      setError('Symbol and Entry Price are required');
      setLoading(false);
      return;
    }

    try {
      const tradeData = {
        userId: auth.currentUser.uid,
        symbol: form.symbol.toUpperCase(),
        type: form.direction === 'long' ? 'BUY' : 'SELL',
        direction: form.direction,
        entry_price: parseFloat(form.entry) || 0,
        exit_price: parseFloat(form.exit) || 0,
        lot_size: parseFloat(form.lotSize) || 0,
        open_time: form.openTime || new Date().toISOString(),
        close_time: form.closeTime || '',
        strategy: form.strategy || '',
        confluences: form.confluences,
        mistakeTags: form.mistakeTags,
        notes: form.notes || '',
        tradingviewLink: form.tradingviewLink || '',
        images: {
          before: form.beforeImg || '',
          after: form.afterImg || ''
        },
        stop_loss: parseFloat(form.stopLoss) || 0,
        take_profit: parseFloat(form.takeProfit) || 0,
        account_balance: parseFloat(form.accountBalance) || 0,
        account: selectedAccount?.name || '',
        accountId: selectedAccount?.id || '',
        preEmotion: form.preEmotion || '',
        postEmotion: form.postEmotion || '',
        pnl: parseFloat(form.pnl) || 0,
        rr_ratio: parseFloat(rr) || 0,
        percent_of_account: parseFloat(percentOfAccount) || 0,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'trades'), tradeData);
      
      setSuccess(true);
      setForm(initialState); // Reset form
      setBeforePreview(null);
      setAfterPreview(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error adding trade:', err);
      setError('Failed to add trade: ' + err.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="feature-page">
      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid #10b981',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#10b981',
          textAlign: 'center',
          fontWeight: 600
        }}>
          ✅ Trade added successfully!
        </div>
      )}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #ef4444',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#ef4444',
          textAlign: 'center',
          fontWeight: 600
        }}>
          ❌ {error}
        </div>
      )}
      <form className="trade-form" onSubmit={handleSubmit}>
        <div>
          <label>Instrument/Pair</label>
          <input name="symbol" value={form.symbol} onChange={handleChange} placeholder="e.g. EURUSD" />
        </div>
        <div>
          <label>Direction</label>
          <select name="direction" value={form.direction} onChange={handleChange}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </div>
        <div>
          <label>Entry Price</label>
          <input name="entry" type="number" value={form.entry} onChange={handleChange} />
        </div>
        <div>
          <label>Exit Price</label>
          <input name="exit" type="number" value={form.exit} onChange={handleChange} />
        </div>
        <div>
          <label>Lot Size</label>
          <input name="lotSize" type="number" step="0.01" value={form.lotSize} onChange={handleChange} placeholder="e.g. 0.01, 0.1, 1.0" />
        </div>
        <div>
          <label>Date & Time (Open)</label>
          <input name="openTime" type="datetime-local" value={form.openTime} onChange={handleChange} />
        </div>
        <div>
          <label>Date & Time (Close)</label>
          <input name="closeTime" type="datetime-local" value={form.closeTime} onChange={handleChange} />
        </div>
        <div>
          <label>Setup/Strategy</label>
          <input name="strategy" value={form.strategy} onChange={handleChange} placeholder="e.g. Break and Retest" />
        </div>
        <div>
          <label>Confluences</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {confluenceOptions.map(opt => (
              <label key={opt} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem',
                padding: '0.5rem 0.8rem',
                background: form.confluences.includes(opt) ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                border: form.confluences.includes(opt) ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease'
              }}>
                <input 
                  type="checkbox" 
                  name="confluences" 
                  value={opt} 
                  checked={form.confluences.includes(opt)} 
                  onChange={handleChange}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                /> 
                {opt}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label>Mistake Tags</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {mistakeOptions.map(opt => (
              <label key={opt} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem',
                padding: '0.5rem 0.8rem',
                background: form.mistakeTags.includes(opt) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                border: form.mistakeTags.includes(opt) ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease'
              }}>
                <input 
                  type="checkbox" 
                  name="mistakeTags" 
                  value={opt} 
                  checked={form.mistakeTags.includes(opt)} 
                  onChange={handleChange}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                /> 
                {opt}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label>Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} />
        </div>
        
        {/* Image Upload Section */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ marginBottom: '0.75rem', display: 'block' }}>📸 Chart Screenshots</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Before Image */}
            <div 
              onClick={() => beforeInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(71, 85, 105, 0.5)',
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: beforePreview ? 'transparent' : 'rgba(15, 23, 42, 0.3)',
                transition: 'all 0.2s ease',
                position: 'relative',
                minHeight: '120px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <input 
                ref={beforeInputRef}
                type="file" 
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setBeforePreview(event.target.result);
                      setForm(prev => ({ ...prev, beforeImg: event.target.result }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              {beforePreview ? (
                <>
                  <img src={beforePreview} alt="Before" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '8px' }} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBeforePreview(null);
                      setForm(prev => ({ ...prev, beforeImg: '' }));
                    }}
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      background: 'rgba(239, 68, 68, 0.8)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >✕</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Before Trade</div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Click to upload</div>
                </>
              )}
            </div>
            
            {/* After Image */}
            <div 
              onClick={() => afterInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(71, 85, 105, 0.5)',
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: afterPreview ? 'transparent' : 'rgba(15, 23, 42, 0.3)',
                transition: 'all 0.2s ease',
                position: 'relative',
                minHeight: '120px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <input 
                ref={afterInputRef}
                type="file" 
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setAfterPreview(event.target.result);
                      setForm(prev => ({ ...prev, afterImg: event.target.result }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              {afterPreview ? (
                <>
                  <img src={afterPreview} alt="After" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '8px' }} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAfterPreview(null);
                      setForm(prev => ({ ...prev, afterImg: '' }));
                    }}
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      background: 'rgba(239, 68, 68, 0.8)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >✕</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>After Trade</div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Click to upload</div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* TradingView Section */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#2962FF">
              <path d="M4.5 3h15A1.5 1.5 0 0121 4.5v15a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19.5v-15A1.5 1.5 0 014.5 3zm.5 2v14h14V5H5zm2 10h2V9H7v6zm3 0h2V7h-2v8zm3 0h2v-4h-2v4z"/>
            </svg>
            TradingView Chart Link
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              name="tradingviewLink" 
              value={form.tradingviewLink} 
              onChange={handleChange}
              placeholder="https://www.tradingview.com/chart/..."
              style={{ flex: 1 }}
            />
            {form.tradingviewLink && (
              <a
                href={form.tradingviewLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(41, 98, 255, 0.2)',
                  border: '1px solid rgba(41, 98, 255, 0.4)',
                  borderRadius: '8px',
                  color: '#60a5fa',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.85rem'
                }}
              >
                Open ↗
              </a>
            )}
          </div>
          <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Paste your TradingView chart URL for reference
          </p>
        </div>
        
        <div>
          <label>Stop Loss</label>
          <input name="stopLoss" type="number" value={form.stopLoss} onChange={handleChange} />
        </div>
        <div>
          <label>Take Profit</label>
          <input name="takeProfit" type="number" value={form.takeProfit} onChange={handleChange} />
        </div>
        <div>
          <label>Trading Account</label>
          {tradingAccounts.length > 0 ? (
            <select 
              value={selectedAccount?.id || ''} 
              onChange={handleAccountChange}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              {tradingAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.broker}) - ${acc.balance?.toLocaleString() || 0}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.875rem', padding: '0.5rem 0' }}>
              No trading accounts found. <a href="/account" style={{ color: '#10b981' }}>Add one in Account settings</a>
            </div>
          )}
        </div>
        <div>
          <label>Account Balance</label>
          <input 
            name="accountBalance" 
            type="number" 
            value={form.accountBalance} 
            onChange={handleChange}
            placeholder={selectedAccount ? `From ${selectedAccount.name}` : 'Enter balance'}
          />
        </div>
        <div>
          <label>Pre-Trade Emotion</label>
          <select name="preEmotion" value={form.preEmotion} onChange={handleChange}>
            <option value="">Select</option>
            {emotionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label>Post-Trade Emotion</label>
          <select name="postEmotion" value={form.postEmotion} onChange={handleChange}>
            <option value="">Select</option>
            {emotionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div>
          <label>Profit/Loss ($)</label>
          <input 
            name="pnl" 
            type="number" 
            step="0.01" 
            value={form.pnl} 
            onChange={handleChange} 
            placeholder="Enter actual P&L (e.g. 50 or -25)" 
            style={{ 
              color: form.pnl ? (parseFloat(form.pnl) >= 0 ? '#10b981' : '#ef4444') : 'inherit',
              fontWeight: form.pnl ? 600 : 400
            }} 
          />
        </div>
        <div>
          <label>R:R Ratio (calculated)</label>
          <input value={rr ? `${rr}R` : ''} readOnly />
        </div>
        <div>
          <label>% of Account (calculated)</label>
          <input 
            value={percentOfAccount ? `${percentOfAccount}%` : ''} 
            readOnly 
            style={{ 
              color: percentOfAccount ? (parseFloat(percentOfAccount) >= 0 ? '#10b981' : '#ef4444') : 'inherit'
            }} 
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Adding Trade...' : 'Add Trade'}
        </button>
      </form>
    </div>
  );
};

export default AddTrade;
