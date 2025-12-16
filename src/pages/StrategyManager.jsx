import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const cardStyle = {
  background: 'rgba(30, 41, 59, 0.5)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(71, 85, 105, 0.4)',
  borderRadius: '16px',
  padding: '1.5rem'
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  background: 'rgba(15, 23, 42, 0.6)',
  border: '1px solid rgba(71, 85, 105, 0.4)',
  borderRadius: '10px',
  color: '#f1f5f9',
  fontSize: '0.95rem',
  outline: 'none'
};

const buttonStyle = {
  padding: '0.75rem 1.5rem',
  borderRadius: '10px',
  border: 'none',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'all 0.2s ease'
};

const StrategyManager = () => {
  const [strategies, setStrategies] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('strategies');
  
  // Form states
  const [newStrategy, setNewStrategy] = useState({ name: '', description: '', rules: '', timeframes: '', winRate: '' });
  const [newTag, setNewTag] = useState({ name: '', category: 'confluence', color: '#10b981' });
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [editingTag, setEditingTag] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const fetchData = useCallback(async (user) => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch strategies
      const strategiesQuery = query(
        collection(db, 'strategies'),
        where('userId', '==', user.uid)
      );
      const strategiesSnap = await getDocs(strategiesQuery);
      setStrategies(strategiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Fetch tags
      const tagsQuery = query(
        collection(db, 'tags'),
        where('userId', '==', user.uid)
      );
      const tagsSnap = await getDocs(tagsQuery);
      setTags(tagsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, fetchData);
    return () => unsubscribe();
  }, [fetchData]);

  // Strategy CRUD
  const handleSaveStrategy = async () => {
    if (!auth.currentUser || !newStrategy.name.trim()) return;
    
    try {
      if (editingStrategy) {
        await updateDoc(doc(db, 'strategies', editingStrategy.id), {
          ...newStrategy,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'strategies'), {
          ...newStrategy,
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      }
      setNewStrategy({ name: '', description: '', rules: '', timeframes: '', winRate: '' });
      setEditingStrategy(null);
      setShowForm(false);
      fetchData(auth.currentUser);
    } catch (err) {
      console.error('Error saving strategy:', err);
    }
  };

  const handleDeleteStrategy = async (id) => {
    if (!confirm('Delete this strategy?')) return;
    try {
      await deleteDoc(doc(db, 'strategies', id));
      fetchData(auth.currentUser);
    } catch (err) {
      console.error('Error deleting strategy:', err);
    }
  };

  const handleEditStrategy = (strategy) => {
    setEditingStrategy(strategy);
    setNewStrategy({
      name: strategy.name || '',
      description: strategy.description || '',
      rules: strategy.rules || '',
      timeframes: strategy.timeframes || '',
      winRate: strategy.winRate || ''
    });
    setShowForm(true);
  };

  // Tag CRUD
  const handleSaveTag = async () => {
    if (!auth.currentUser || !newTag.name.trim()) return;
    
    try {
      if (editingTag) {
        await updateDoc(doc(db, 'tags', editingTag.id), {
          ...newTag,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'tags'), {
          ...newTag,
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      }
      setNewTag({ name: '', category: 'confluence', color: '#10b981' });
      setEditingTag(null);
      setShowForm(false);
      fetchData(auth.currentUser);
    } catch (err) {
      console.error('Error saving tag:', err);
    }
  };

  const handleDeleteTag = async (id) => {
    if (!confirm('Delete this tag?')) return;
    try {
      await deleteDoc(doc(db, 'tags', id));
      fetchData(auth.currentUser);
    } catch (err) {
      console.error('Error deleting tag:', err);
    }
  };

  const handleEditTag = (tag) => {
    setEditingTag(tag);
    setNewTag({
      name: tag.name || '',
      category: tag.category || 'confluence',
      color: tag.color || '#10b981'
    });
    setShowForm(true);
    setActiveTab('tags');
  };

  const tagCategories = [
    { value: 'confluence', label: 'Confluence', color: '#10b981' },
    { value: 'mistake', label: 'Mistake', color: '#ef4444' },
    { value: 'emotion', label: 'Emotion', color: '#8b5cf6' },
    { value: 'setup', label: 'Setup Type', color: '#3b82f6' },
    { value: 'other', label: 'Other', color: '#94a3b8' }
  ];

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#f1f5f9'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
          <div style={{ color: '#94a3b8' }}>Loading strategies & tags...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)',
      color: '#f1f5f9',
      padding: 0
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        padding: '1.5rem 2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              marginBottom: '0.25rem',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>📚 Strategy & Tag Manager</h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Manage your trading strategies and categorization tags
            </p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingStrategy(null); setEditingTag(null); }}
            style={{
              ...buttonStyle,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white'
            }}
          >
            + Add {activeTab === 'strategies' ? 'Strategy' : 'Tag'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          {[
            { key: 'strategies', label: '📖 Strategies', count: strategies.length },
            { key: 'tags', label: '🏷️ Tags', count: tags.length }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setShowForm(false); }}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                border: activeTab === tab.key ? 'none' : '1px solid rgba(71, 85, 105, 0.4)',
                background: activeTab === tab.key 
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' 
                  : 'rgba(30, 41, 59, 0.5)',
                color: activeTab === tab.key ? 'white' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem' }}>
        {/* Add/Edit Form */}
        {showForm && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: '4px solid #8b5cf6' }}>
            <h3 style={{ marginBottom: '1rem', color: '#f1f5f9' }}>
              {activeTab === 'strategies' 
                ? (editingStrategy ? '✏️ Edit Strategy' : '➕ New Strategy')
                : (editingTag ? '✏️ Edit Tag' : '➕ New Tag')
              }
            </h3>
            
            {activeTab === 'strategies' ? (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    Strategy Name *
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. ICT Silver Bullet"
                    value={newStrategy.name}
                    onChange={e => setNewStrategy({ ...newStrategy, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    Description
                  </label>
                  <textarea
                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                    placeholder="Describe this strategy..."
                    value={newStrategy.description}
                    onChange={e => setNewStrategy({ ...newStrategy, description: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      Timeframes
                    </label>
                    <input
                      style={inputStyle}
                      placeholder="e.g. 15m, 1H, 4H"
                      value={newStrategy.timeframes}
                      onChange={e => setNewStrategy({ ...newStrategy, timeframes: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      Win Rate %
                    </label>
                    <input
                      style={inputStyle}
                      type="number"
                      placeholder="e.g. 65"
                      value={newStrategy.winRate}
                      onChange={e => setNewStrategy({ ...newStrategy, winRate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    Trading Rules
                  </label>
                  <textarea
                    style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                    placeholder="Entry rules, exit rules, conditions..."
                    value={newStrategy.rules}
                    onChange={e => setNewStrategy({ ...newStrategy, rules: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    Tag Name *
                  </label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. RSI Divergence"
                    value={newTag.name}
                    onChange={e => setNewTag({ ...newTag, name: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      Category
                    </label>
                    <select
                      style={inputStyle}
                      value={newTag.category}
                      onChange={e => setNewTag({ ...newTag, category: e.target.value })}
                    >
                      {tagCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      Color
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {['#10b981', '#ef4444', '#8b5cf6', '#3b82f6', '#f59e0b', '#ec4899'].map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewTag({ ...newTag, color })}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: color,
                            border: newTag.color === color ? '3px solid white' : 'none',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={activeTab === 'strategies' ? handleSaveStrategy : handleSaveTag}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white'
                }}
              >
                {editingStrategy || editingTag ? 'Update' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingStrategy(null);
                  setEditingTag(null);
                  setNewStrategy({ name: '', description: '', rules: '', timeframes: '', winRate: '' });
                  setNewTag({ name: '', category: 'confluence', color: '#10b981' });
                }}
                style={{
                  ...buttonStyle,
                  background: 'rgba(71, 85, 105, 0.4)',
                  color: '#94a3b8'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Strategies List */}
        {activeTab === 'strategies' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {strategies.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📖</div>
                <div style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>No strategies yet</div>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                  Add your trading strategies to track their performance
                </div>
              </div>
            ) : (
              strategies.map(strategy => (
                <div key={strategy.id} style={{ ...cardStyle, borderLeft: '4px solid #8b5cf6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: '#f1f5f9' }}>
                        {strategy.name}
                      </h3>
                      {strategy.description && (
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                          {strategy.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {strategy.timeframes && (
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                            borderRadius: '6px',
                            fontSize: '0.8rem'
                          }}>
                            ⏱️ {strategy.timeframes}
                          </span>
                        )}
                        {strategy.winRate && (
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            borderRadius: '6px',
                            fontSize: '0.8rem'
                          }}>
                            📊 {strategy.winRate}% Win Rate
                          </span>
                        )}
                      </div>
                      {strategy.rules && (
                        <div style={{
                          marginTop: '1rem',
                          padding: '1rem',
                          background: 'rgba(15, 23, 42, 0.4)',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          color: '#94a3b8',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {strategy.rules}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleEditStrategy(strategy)}
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(59, 130, 246, 0.2)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#60a5fa',
                          cursor: 'pointer'
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteStrategy(strategy.id)}
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tags List */}
        {activeTab === 'tags' && (
          <div>
            {tags.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏷️</div>
                <div style={{ color: '#94a3b8', marginBottom: '0.5rem' }}>No tags yet</div>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                  Create tags to categorize your trades by confluences, mistakes, etc.
                </div>
              </div>
            ) : (
              <div>
                {tagCategories.map(category => {
                  const categoryTags = tags.filter(t => t.category === category.value);
                  if (categoryTags.length === 0) return null;
                  
                  return (
                    <div key={category.value} style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ 
                        fontSize: '1rem', 
                        fontWeight: '600', 
                        color: '#94a3b8',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: category.color
                        }} />
                        {category.label}
                      </h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {categoryTags.map(tag => (
                          <div
                            key={tag.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.5rem 1rem',
                              background: `${tag.color}20`,
                              border: `1px solid ${tag.color}40`,
                              borderRadius: '10px'
                            }}
                          >
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: tag.color
                            }} />
                            <span style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>{tag.name}</span>
                            <button
                              onClick={() => handleEditTag(tag)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                opacity: 0.6
                              }}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                opacity: 0.6
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyManager;
