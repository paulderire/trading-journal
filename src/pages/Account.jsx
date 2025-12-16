import React, { useState, useEffect, useMemo, useCallback } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { requestNotificationPermission, getNotificationPermission, showNotification } from "../services/notifications";

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
  justifyContent: 'center',
  gap: '0.5rem'
};

const TABS = [
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'accounts', label: 'Trading Accounts', icon: '💰' },
  { key: 'preferences', label: 'Preferences', icon: '⚙️' },
  { key: 'stats', label: 'Account Stats', icon: '📊' },
  { key: 'security', label: 'Security', icon: '🔐' },
];

export default function Account() {
  const [activeTab, setActiveTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [trades, setTrades] = useState([]);

  // Fetch user data function
  const fetchUserData = useCallback(async (userId) => {
    // Fetch user profile - wrapped in try/catch to not block other fetches
    try {
      const profileQuery = query(
        collection(db, "user_profiles"),
        where("userId", "==", userId)
      );
      const profileSnap = await getDocs(profileQuery);
      if (!profileSnap.empty) {
        setUserProfile({ id: profileSnap.docs[0].id, ...profileSnap.docs[0].data() });
      }
    } catch (error) {
      console.log("No user profile found");
    }

    // Fetch trading accounts
    try {
      const accountsQuery = query(
        collection(db, "trading_accounts"),
        where("userId", "==", userId)
      );
      const accountsSnap = await getDocs(accountsQuery);
      const accountsList = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTradingAccounts(accountsList);
    } catch (error) {
      console.error("Error fetching trading accounts:", error.message);
    }

    // Fetch trades for stats
    try {
      const tradesQuery = query(
        collection(db, "trades"),
        where("userId", "==", userId)
      );
      const tradesSnap = await getDocs(tradesQuery);
      const tradesList = tradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrades(tradesList);
    } catch (error) {
      console.error("Error fetching trades:", error.message);
    }
  }, []);

  // Listen for auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserData(currentUser.uid);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserData]);

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
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
          <div style={{ color: '#94a3b8', fontSize: '1.125rem' }}>Loading account...</div>
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
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        padding: '2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: '700',
            color: 'white',
            border: '3px solid rgba(255,255,255,0.2)'
          }}>
            {user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              marginBottom: '0.25rem',
              background: 'linear-gradient(135deg, #10b981 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              {user?.displayName || 'Trader'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.925rem' }}>
              {user?.email}
            </p>
            <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Member since {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        padding: '1.5rem 2rem',
        overflowX: 'auto',
        borderBottom: '1px solid rgba(71, 85, 105, 0.2)'
      }}>
        {TABS.map(tab => (
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
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem 2rem' }}>
        {activeTab === 'profile' && (
          <ProfileSection user={user} userProfile={userProfile} setUserProfile={setUserProfile} />
        )}
        {activeTab === 'accounts' && (
          <TradingAccountsSection 
            tradingAccounts={tradingAccounts} 
            setTradingAccounts={setTradingAccounts}
            userId={user?.uid}
          />
        )}
        {activeTab === 'preferences' && (
          <PreferencesSection userProfile={userProfile} setUserProfile={setUserProfile} userId={user?.uid} />
        )}
        {activeTab === 'stats' && (
          <AccountStatsSection trades={trades} tradingAccounts={tradingAccounts} user={user} />
        )}
        {activeTab === 'security' && (
          <SecuritySection user={user} />
        )}
      </div>
    </div>
  );
}

// Profile Section
function ProfileSection({ user, userProfile, setUserProfile }) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [tradingExperience, setTradingExperience] = useState(userProfile?.tradingExperience || '');
  const [favoriteMarket, setFavoriteMarket] = useState(userProfile?.favoriteMarket || '');
  const [tradingStyle, setTradingStyle] = useState(userProfile?.tradingStyle || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update Firebase Auth display name
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName });
      }

      // Update or create user profile in Firestore
      const profileData = {
        userId: user.uid,
        displayName,
        bio,
        tradingExperience,
        favoriteMarket,
        tradingStyle,
        updatedAt: new Date().toISOString()
      };

      if (userProfile?.id) {
        await updateDoc(doc(db, "user_profiles", userProfile.id), profileData);
        setUserProfile({ ...userProfile, ...profileData });
      } else {
        const newDocRef = await addDoc(collection(db, "user_profiles"), {
          ...profileData,
          createdAt: new Date().toISOString()
        });
        setUserProfile({ id: newDocRef.id, ...profileData, createdAt: new Date().toISOString() });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          color: '#f1f5f9',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          👤 Personal Information
        </h3>

        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid #10b981',
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#10b981',
            fontWeight: 600
          }}>
            ✅ Profile saved successfully!
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your trading alias"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Email (read-only)
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about your trading journey..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Trading Experience
            </label>
            <select
              value={tradingExperience}
              onChange={(e) => setTradingExperience(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select experience level</option>
              <option value="beginner">Beginner (0-1 years)</option>
              <option value="intermediate">Intermediate (1-3 years)</option>
              <option value="advanced">Advanced (3-5 years)</option>
              <option value="expert">Expert (5+ years)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Favorite Market
            </label>
            <select
              value={favoriteMarket}
              onChange={(e) => setFavoriteMarket(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select market</option>
              <option value="forex">Forex</option>
              <option value="stocks">Stocks</option>
              <option value="crypto">Cryptocurrency</option>
              <option value="futures">Futures</option>
              <option value="options">Options</option>
              <option value="indices">Indices</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Trading Style
            </label>
            <select
              value={tradingStyle}
              onChange={(e) => setTradingStyle(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select style</option>
              <option value="scalper">Scalper</option>
              <option value="daytrader">Day Trader</option>
              <option value="swingtrader">Swing Trader</option>
              <option value="positiontrader">Position Trader</option>
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...buttonStyle,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              width: '100%',
              marginTop: '0.5rem',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? 'Saving...' : '💾 Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Trading Accounts Section
function TradingAccountsSection({ tradingAccounts, setTradingAccounts, userId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    broker: '',
    accountNumber: '',
    balance: '',
    currency: 'USD',
    type: 'live',
    leverage: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setForm({
      name: '',
      broker: '',
      accountNumber: '',
      balance: '',
      currency: 'USD',
      type: 'live',
      leverage: '',
      notes: ''
    });
    setEditingAccount(null);
    setShowForm(false);
  };

  const handleEdit = (account) => {
    setForm({
      name: account.name || '',
      broker: account.broker || '',
      accountNumber: account.accountNumber || '',
      balance: account.balance || '',
      currency: account.currency || 'USD',
      type: account.type || 'live',
      leverage: account.leverage || '',
      notes: account.notes || ''
    });
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.broker) {
      setError('Account name and broker are required');
      return;
    }
    if (!userId) {
      setError('You must be logged in to add an account');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const accountData = {
        userId,
        name: form.name,
        broker: form.broker,
        accountNumber: form.accountNumber,
        balance: parseFloat(form.balance) || 0,
        currency: form.currency,
        type: form.type,
        leverage: form.leverage,
        notes: form.notes,
        updatedAt: new Date().toISOString()
      };

      if (editingAccount) {
        await updateDoc(doc(db, "trading_accounts", editingAccount.id), accountData);
        setTradingAccounts(prev => prev.map(a => 
          a.id === editingAccount.id ? { ...a, ...accountData } : a
        ));
      } else {
        const docRef = await addDoc(collection(db, "trading_accounts"), {
          ...accountData,
          createdAt: new Date().toISOString()
        });
        setTradingAccounts(prev => [...prev, { id: docRef.id, ...accountData, createdAt: new Date().toISOString() }]);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      resetForm();
    } catch (err) {
      console.error("Error saving account:", err);
      setError('Failed to save account: ' + err.message);
    }
    setSaving(false);
  };

  const handleDelete = async (accountId) => {
    if (!window.confirm("Are you sure you want to delete this trading account?")) return;
    try {
      await deleteDoc(doc(db, "trading_accounts", accountId));
      setTradingAccounts(prev => prev.filter(a => a.id !== accountId));
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  const totalBalance = tradingAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  return (
    <div>
      {/* Success Message */}
      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid #10b981',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#10b981',
          fontWeight: 600
        }}>
          ✅ Trading account saved successfully!
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #ef4444',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#ef4444',
          fontWeight: 600
        }}>
          ❌ {error}
        </div>
      )}

      {/* Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ ...cardStyle, borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Total Accounts
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981' }}>
            {tradingAccounts.length}
          </div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Combined Balance
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#3b82f6' }}>
            ${totalBalance.toLocaleString()}
          </div>
        </div>
        <div style={{ ...cardStyle, borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Live Accounts
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#8b5cf6' }}>
            {tradingAccounts.filter(a => a.type === 'live').length}
          </div>
        </div>
      </div>

      {/* Add Account Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            ...buttonStyle,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            marginBottom: '1.5rem'
          }}
        >
          ➕ Add Trading Account
        </button>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#f1f5f9',
            marginBottom: '1.5rem'
          }}>
            {editingAccount ? '✏️ Edit Account' : '➕ New Trading Account'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Account Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Main Trading Account"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Broker *
              </label>
              <input
                type="text"
                value={form.broker}
                onChange={(e) => setForm(prev => ({ ...prev, broker: e.target.value }))}
                placeholder="e.g. Interactive Brokers"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Account Number
              </label>
              <input
                type="text"
                value={form.accountNumber}
                onChange={(e) => setForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                placeholder="e.g. ****1234"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Current Balance
              </label>
              <input
                type="number"
                value={form.balance}
                onChange={(e) => setForm(prev => ({ ...prev, balance: e.target.value }))}
                placeholder="10000"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm(prev => ({ ...prev, currency: e.target.value }))}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
                <option value="AUD">AUD</option>
                <option value="CAD">CAD</option>
                <option value="CHF">CHF</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Account Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="live">Live Account</option>
                <option value="demo">Demo Account</option>
                <option value="prop">Prop Firm</option>
                <option value="funded">Funded Account</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Leverage
              </label>
              <input
                type="text"
                value={form.leverage}
                onChange={(e) => setForm(prev => ({ ...prev, leverage: e.target.value }))}
                placeholder="e.g. 1:100"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional notes about this account..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button
              onClick={handleSave}
              disabled={saving || !form.name || !form.broker}
              style={{
                ...buttonStyle,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                flex: 1,
                opacity: (saving || !form.name || !form.broker) ? 0.6 : 1
              }}
            >
              {saving ? 'Saving...' : editingAccount ? '💾 Update Account' : '💾 Save Account'}
            </button>
            <button
              onClick={resetForm}
              style={{
                ...buttonStyle,
                background: 'rgba(71, 85, 105, 0.3)',
                color: '#94a3b8',
                border: '1px solid rgba(71, 85, 105, 0.4)'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Accounts List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {tradingAccounts.map(account => (
          <div key={account.id} style={{
            ...cardStyle,
            borderLeft: `4px solid ${account.type === 'live' ? '#10b981' : account.type === 'prop' ? '#8b5cf6' : '#3b82f6'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#f1f5f9', marginBottom: '0.25rem' }}>
                  {account.name}
                </h4>
                <span style={{
                  display: 'inline-block',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  background: account.type === 'live' ? 'rgba(16, 185, 129, 0.2)' : 
                              account.type === 'prop' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                  color: account.type === 'live' ? '#10b981' : 
                         account.type === 'prop' ? '#8b5cf6' : '#3b82f6',
                  textTransform: 'uppercase'
                }}>
                  {account.type}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleEdit(account)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0.25rem'
                  }}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(account.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '0.25rem'
                  }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: '#f1f5f9',
              marginBottom: '1rem'
            }}>
              {account.currency} {account.balance?.toLocaleString() || 0}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#64748b' }}>Broker:</span>
                <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>{account.broker}</span>
              </div>
              {account.leverage && (
                <div>
                  <span style={{ color: '#64748b' }}>Leverage:</span>
                  <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>{account.leverage}</span>
                </div>
              )}
              {account.accountNumber && (
                <div>
                  <span style={{ color: '#64748b' }}>Account:</span>
                  <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>{account.accountNumber}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {tradingAccounts.length === 0 && !showForm && (
          <div style={{
            ...cardStyle,
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '3rem'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
            <p style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>No trading accounts added yet</p>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Add your first trading account to track your portfolio</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Preferences Section
function PreferencesSection({ userProfile, setUserProfile, userId }) {
  const [preferences, setPreferences] = useState({
    defaultRiskPercent: userProfile?.defaultRiskPercent || '1',
    defaultLotSize: userProfile?.defaultLotSize || '0.01',
    defaultStopLoss: userProfile?.defaultStopLoss || '50',
    preferredTimeframe: userProfile?.preferredTimeframe || 'H1',
    tradingHoursStart: userProfile?.tradingHoursStart || '09:00',
    tradingHoursEnd: userProfile?.tradingHoursEnd || '17:00',
    theme: userProfile?.theme || 'dark',
    notifications: userProfile?.notifications ?? true,
    soundAlerts: userProfile?.soundAlerts ?? true
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const preferencesData = {
        userId,
        ...preferences,
        updatedAt: new Date().toISOString()
      };

      if (userProfile?.id) {
        await updateDoc(doc(db, "user_profiles", userProfile.id), preferencesData);
        setUserProfile({ ...userProfile, ...preferencesData });
      } else {
        const newDocRef = await addDoc(collection(db, "user_profiles"), {
          ...preferencesData,
          createdAt: new Date().toISOString()
        });
        setUserProfile({ id: newDocRef.id, ...preferencesData, createdAt: new Date().toISOString() });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving preferences:", error);
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid #10b981',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#10b981',
          fontWeight: 600
        }}>
          ✅ Preferences saved successfully!
        </div>
      )}

      {/* Trading Defaults */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          color: '#f1f5f9',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📊 Trading Defaults
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Default Risk %
            </label>
            <input
              type="number"
              step="0.1"
              value={preferences.defaultRiskPercent}
              onChange={(e) => setPreferences(prev => ({ ...prev, defaultRiskPercent: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Default Lot Size
            </label>
            <input
              type="number"
              step="0.01"
              value={preferences.defaultLotSize}
              onChange={(e) => setPreferences(prev => ({ ...prev, defaultLotSize: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Default Stop Loss (pips)
            </label>
            <input
              type="number"
              value={preferences.defaultStopLoss}
              onChange={(e) => setPreferences(prev => ({ ...prev, defaultStopLoss: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Preferred Timeframe
            </label>
            <select
              value={preferences.preferredTimeframe}
              onChange={(e) => setPreferences(prev => ({ ...prev, preferredTimeframe: e.target.value }))}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="M1">M1</option>
              <option value="M5">M5</option>
              <option value="M15">M15</option>
              <option value="M30">M30</option>
              <option value="H1">H1</option>
              <option value="H4">H4</option>
              <option value="D1">Daily</option>
              <option value="W1">Weekly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trading Hours */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          color: '#f1f5f9',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ⏰ Trading Hours
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Start Time
            </label>
            <input
              type="time"
              value={preferences.tradingHoursStart}
              onChange={(e) => setPreferences(prev => ({ ...prev, tradingHoursStart: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              End Time
            </label>
            <input
              type="time"
              value={preferences.tradingHoursEnd}
              onChange={(e) => setPreferences(prev => ({ ...prev, tradingHoursEnd: e.target.value }))}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* App Settings */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          color: '#f1f5f9',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🎨 App Settings
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Theme Toggle */}
          <div style={{
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '10px'
          }}>
            <div style={{ color: '#f1f5f9', fontWeight: '500', marginBottom: '0.75rem' }}>Theme</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { value: 'dark', label: '🌙 Dark', color: '#1e293b' },
                { value: 'light', label: '☀️ Light', color: '#f1f5f9' },
                { value: 'system', label: '💻 System', color: '#6366f1' }
              ].map(theme => (
                <button
                  key={theme.value}
                  onClick={() => {
                    setPreferences(prev => ({ ...prev, theme: theme.value }));
                    // Apply theme immediately
                    if (theme.value === 'light') {
                      document.body.classList.add('light-theme');
                      document.body.classList.remove('dark-theme');
                    } else if (theme.value === 'dark') {
                      document.body.classList.remove('light-theme');
                      document.body.classList.add('dark-theme');
                    } else {
                      // System preference
                      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                        document.body.classList.add('light-theme');
                        document.body.classList.remove('dark-theme');
                      } else {
                        document.body.classList.remove('light-theme');
                        document.body.classList.add('dark-theme');
                      }
                    }
                  }}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '8px',
                    border: preferences.theme === theme.value 
                      ? '2px solid #10b981' 
                      : '1px solid rgba(71, 85, 105, 0.4)',
                    background: preferences.theme === theme.value 
                      ? 'rgba(16, 185, 129, 0.2)' 
                      : 'rgba(30, 41, 59, 0.5)',
                    color: preferences.theme === theme.value ? '#10b981' : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {theme.label}
                </button>
              ))}
            </div>
            <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              Note: Light theme is coming soon. Dark theme is currently the default.
            </p>
          </div>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '10px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={preferences.notifications}
              onChange={async (e) => {
                if (e.target.checked) {
                  const granted = await requestNotificationPermission();
                  if (granted) {
                    setPreferences(prev => ({ ...prev, notifications: true }));
                    showNotification('🔔 Notifications Enabled', {
                      body: 'You will now receive trading reminders and alerts!'
                    });
                  } else {
                    alert('Please enable notifications in your browser settings');
                  }
                } else {
                  setPreferences(prev => ({ ...prev, notifications: false }));
                }
              }}
              style={{ width: '20px', height: '20px', accentColor: '#10b981' }}
            />
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: '500' }}>Enable Notifications</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                Get alerts for trading reminders
                {getNotificationPermission() === 'denied' && (
                  <span style={{ color: '#ef4444', display: 'block' }}>
                    ⚠️ Notifications blocked - check browser settings
                  </span>
                )}
              </div>
            </div>
          </label>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '10px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={preferences.soundAlerts}
              onChange={(e) => setPreferences(prev => ({ ...prev, soundAlerts: e.target.checked }))}
              style={{ width: '20px', height: '20px', accentColor: '#10b981' }}
            />
            <div>
              <div style={{ color: '#f1f5f9', fontWeight: '500' }}>Sound Alerts</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Play sounds for important events</div>
            </div>
          </label>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          ...buttonStyle,
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          width: '100%',
          opacity: saving ? 0.7 : 1
        }}
      >
        {saving ? 'Saving...' : '💾 Save Preferences'}
      </button>
    </div>
  );
}

// Account Stats Section
function AccountStatsSection({ trades, tradingAccounts, user }) {
  const stats = useMemo(() => {
    const totalTrades = trades.length;
    const wins = trades.filter(t => parseFloat(t.pnl || 0) > 0).length;
    const losses = trades.filter(t => parseFloat(t.pnl || 0) < 0).length;
    const totalPnL = trades.reduce((sum, t) => sum + parseFloat(t.pnl || 0), 0);
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    
    // Get unique symbols
    const symbols = [...new Set(trades.map(t => t.symbol).filter(Boolean))];
    
    // Get unique strategies
    const strategies = [...new Set(trades.map(t => t.strategy).filter(Boolean))];

    // Account age
    const creationDate = user?.metadata?.creationTime ? new Date(user.metadata.creationTime) : new Date();
    const daysSinceJoined = Math.floor((new Date() - creationDate) / (1000 * 60 * 60 * 24));

    // Last trade date
    const sortedTrades = [...trades].sort((a, b) => {
      const dateA = new Date(a.open_time || a.createdAt || 0);
      const dateB = new Date(b.open_time || b.createdAt || 0);
      return dateB - dateA;
    });
    const lastTradeDate = sortedTrades[0] ? new Date(sortedTrades[0].open_time || sortedTrades[0].createdAt) : null;

    return {
      totalTrades,
      wins,
      losses,
      totalPnL,
      winRate,
      symbols: symbols.length,
      strategies: strategies.length,
      daysSinceJoined,
      lastTradeDate,
      avgTradesPerDay: daysSinceJoined > 0 ? (totalTrades / daysSinceJoined).toFixed(1) : 0
    };
  }, [trades, user]);

  return (
    <div>
      {/* Main Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {[
          { label: 'Total Trades', value: stats.totalTrades, icon: '📊', color: '#3b82f6' },
          { label: 'Total P&L', value: `$${stats.totalPnL.toFixed(2)}`, icon: '💰', color: stats.totalPnL >= 0 ? '#10b981' : '#ef4444' },
          { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, icon: '🎯', color: stats.winRate >= 50 ? '#10b981' : '#f59e0b' },
          { label: 'Winning Trades', value: stats.wins, icon: '✅', color: '#10b981' },
          { label: 'Losing Trades', value: stats.losses, icon: '❌', color: '#ef4444' },
          { label: 'Symbols Traded', value: stats.symbols, icon: '💹', color: '#8b5cf6' },
          { label: 'Strategies Used', value: stats.strategies, icon: '🎪', color: '#f59e0b' },
          { label: 'Trading Accounts', value: tradingAccounts.length, icon: '🏦', color: '#3b82f6' },
        ].map((stat, i) => (
          <div key={i} style={{
            ...cardStyle,
            borderLeft: `4px solid ${stat.color}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span>{stat.icon}</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                {stat.label}
              </span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Account Timeline */}
      <div style={{ ...cardStyle }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          color: '#f1f5f9',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📅 Account Timeline
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <div style={{
            padding: '1.25rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎂</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Member For</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f1f5f9' }}>
              {stats.daysSinceJoined} days
            </div>
          </div>

          <div style={{
            padding: '1.25rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📈</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Avg Trades/Day</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f1f5f9' }}>
              {stats.avgTradesPerDay}
            </div>
          </div>

          <div style={{
            padding: '1.25rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🕐</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>Last Trade</div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#f1f5f9' }}>
              {stats.lastTradeDate ? stats.lastTradeDate.toLocaleDateString() : 'No trades yet'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Security Section
function SecuritySection({ user }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      
      // Update password
      await updatePassword(auth.currentUser, newPassword);
      
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error("Error changing password:", error);
      if (error.code === 'auth/wrong-password') {
        setMessage({ type: 'error', text: 'Current password is incorrect' });
      } else {
        setMessage({ type: 'error', text: error.message });
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: '500px' }}>
      {/* Password Change */}
      <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          color: '#f1f5f9',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🔐 Change Password
        </h3>

        {message.text && (
          <div style={{
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            borderRadius: '10px',
            padding: '1rem',
            marginBottom: '1rem',
            color: message.type === 'success' ? '#10b981' : '#ef4444',
            fontWeight: 600
          }}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              width: '100%',
              marginTop: '0.5rem',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Updating...' : '🔐 Update Password'}
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div style={{ ...cardStyle }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600', 
          color: '#f1f5f9',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          ℹ️ Account Information
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '10px'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Email</div>
            <div style={{ color: '#f1f5f9', fontWeight: '500' }}>{user?.email}</div>
          </div>

          <div style={{
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '10px'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>User ID</div>
            <div style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.8rem' }}>{user?.uid}</div>
          </div>

          <div style={{
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '10px'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Account Created</div>
            <div style={{ color: '#f1f5f9', fontWeight: '500' }}>
              {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleString() : 'N/A'}
            </div>
          </div>

          <div style={{
            padding: '1rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '10px'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Last Sign In</div>
            <div style={{ color: '#f1f5f9', fontWeight: '500' }}>
              {user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString() : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
