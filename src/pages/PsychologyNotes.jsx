import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, Timestamp } from "firebase/firestore";

const moods = [
  { name: "Confident", emoji: "💪", color: "#10b981" },
  { name: "Anxious", emoji: "😰", color: "#f59e0b" },
  { name: "Bored", emoji: "😐", color: "#6b7280" },
  { name: "Excited", emoji: "🔥", color: "#ef4444" },
  { name: "Frustrated", emoji: "😤", color: "#dc2626" },
  { name: "Calm", emoji: "😌", color: "#3b82f6" },
  { name: "Focused", emoji: "🎯", color: "#8b5cf6" },
  { name: "Distracted", emoji: "🌀", color: "#f97316" }
];

function PsychologyNotes() {
  const [preTradeMood, setPreTradeMood] = useState("");
  const [postTradeMood, setPostTradeMood] = useState("");
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch existing notes
  useEffect(() => {
    const fetchNotes = async () => {
      if (!auth.currentUser) return;
      try {
        // Simple query without orderBy to avoid index requirement
        const q = query(
          collection(db, "psychology_notes"),
          where("userId", "==", auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort client-side
        notesData.sort((a, b) => {
          const dateA = a.date?.toDate?.() || new Date(a.createdAt || 0);
          const dateB = b.date?.toDate?.() || new Date(b.createdAt || 0);
          return dateB - dateA; // desc
        });
        setNotes(notesData);
      } catch (err) {
        console.error("Error fetching notes:", err);
      }
      setLoading(false);
    };
    fetchNotes();
  }, [success]);

  const handleSave = async () => {
    if (!auth.currentUser) {
      setError("You must be logged in to save notes");
      return;
    }
    if (!preTradeMood && !postTradeMood && !reflection) {
      setError("Please fill in at least one field");
      return;
    }
    
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await addDoc(collection(db, "psychology_notes"), {
        userId: auth.currentUser.uid,
        preTradeMood,
        postTradeMood,
        reflection,
        date: Timestamp.fromDate(new Date()),
        createdAt: new Date().toISOString()
      });
      setSuccess(true);
      setPreTradeMood("");
      setPostTradeMood("");
      setReflection("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm("Delete this note?")) return;
    try {
      await deleteDoc(doc(db, "psychology_notes", noteId));
      setNotes(notes.filter(n => n.id !== noteId));
    } catch (err) {
      setError("Failed to delete: " + err.message);
    }
  };

  const MoodButton = ({ mood, selected, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.75rem 1rem',
        borderRadius: '12px',
        border: selected ? `2px solid ${mood.color}` : '1px solid rgba(75, 85, 99, 0.4)',
        background: selected ? `${mood.color}20` : 'rgba(17, 24, 39, 0.6)',
        color: selected ? mood.color : '#9ca3af',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '80px'
      }}
    >
      <span style={{ fontSize: '1.5rem' }}>{mood.emoji}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{mood.name}</span>
    </button>
  );

  return (
    <div className="psychology-page" style={{
      width: '100%',
      maxWidth: '100%',
      padding: '0'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '2rem'
      }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Psychology & Notes
        </h2>
        <p style={{
          color: '#9ca3af',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>🧠</span>
          Trading is 90% psychology. Track your mind, not just your money.
        </p>
      </div>

      {/* Mood Selection Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Pre-Trade Mood */}
        <div style={{
          background: 'rgba(31, 41, 55, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(75, 85, 99, 0.4)',
          borderRadius: '16px',
          padding: '1.5rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}>
              ⏰
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f9fafb', margin: 0 }}>Pre-Trade Mood</h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>How are you feeling before trading?</p>
            </div>
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            {moods.map(mood => (
              <MoodButton
                key={mood.name}
                mood={mood}
                selected={preTradeMood === mood.name}
                onClick={() => setPreTradeMood(mood.name)}
              />
            ))}
          </div>
        </div>

        {/* Post-Trade Mood */}
        <div style={{
          background: 'rgba(31, 41, 55, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(75, 85, 99, 0.4)',
          borderRadius: '16px',
          padding: '1.5rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}>
              ✅
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f9fafb', margin: 0 }}>Post-Trade Mood</h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>How do you feel after your session?</p>
            </div>
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            {moods.map(mood => (
              <MoodButton
                key={mood.name}
                mood={mood}
                selected={postTradeMood === mood.name}
                onClick={() => setPostTradeMood(mood.name)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Daily Reflection */}
      <div style={{
        background: 'rgba(31, 41, 55, 0.8)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(75, 85, 99, 0.4)',
        borderRadius: '16px',
        padding: '1.5rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem'
          }}>
            📝
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f9fafb', margin: 0 }}>Daily Reflection</h3>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>Reflect on today's market conditions and your mental state</p>
          </div>
        </div>
        
        <textarea
          style={{
            width: '100%',
            minHeight: '150px',
            borderRadius: '12px',
            padding: '1rem',
            fontSize: '0.95rem',
            background: 'rgba(17, 24, 39, 0.6)',
            border: '1px solid rgba(75, 85, 99, 0.4)',
            color: '#f9fafb',
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: 1.6,
            transition: 'all 0.2s ease'
          }}
          placeholder="What went well today? What could you improve? Any patterns you noticed in your trading behavior..."
          value={reflection}
          onChange={e => setReflection(e.target.value)}
          onFocus={e => {
            e.target.style.borderColor = '#8b5cf6';
            e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.15)';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(75, 85, 99, 0.4)';
            e.target.style.boxShadow = 'none';
          }}
        />

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '1.25rem'
        }}>
          <button
            style={{
              padding: '0.85rem 2rem',
              borderRadius: '10px',
              background: saving 
                ? 'rgba(139, 92, 246, 0.5)' 
                : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.95rem',
              border: 'none',
              cursor: saving || (!preTradeMood && !postTradeMood && !reflection) ? 'not-allowed' : 'pointer',
              opacity: (!preTradeMood && !postTradeMood && !reflection) ? 0.5 : 1,
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onClick={handleSave}
            disabled={saving || (!preTradeMood && !postTradeMood && !reflection)}
            onMouseOver={e => {
              if (!saving && (preTradeMood || postTradeMood || reflection)) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
              }
            }}
            onMouseOut={e => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.3)';
            }}
          >
            {saving ? (
              <>
                <span className="animate-pulse">●</span> Saving...
              </>
            ) : (
              <>
                💾 Save Entry
              </>
            )}
          </button>

          {success && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#10b981',
              fontSize: '0.9rem',
              fontWeight: 500,
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <span>✓</span> Saved successfully!
            </div>
          )}
          
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#ef4444',
              fontSize: '0.9rem',
              fontWeight: 500
            }}>
              <span>⚠</span> {error}
            </div>
          )}
        </div>
      </div>

      {/* Tips Section */}
      <div style={{
        marginTop: '1.5rem',
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        borderRadius: '12px',
        padding: '1.25rem'
      }}>
        <h4 style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: '#a78bfa',
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          💡 Trading Psychology Tips
        </h4>
        <ul style={{
          margin: 0,
          paddingLeft: '1.25rem',
          color: '#9ca3af',
          fontSize: '0.85rem',
          lineHeight: 1.8
        }}>
          <li>Never trade when emotionally compromised (angry, anxious, or overly excited)</li>
          <li>Take breaks after significant wins or losses to reset your mental state</li>
          <li>Review your mood patterns to identify when you trade best</li>
          <li>Use journaling to process emotions and improve decision-making</li>
        </ul>
      </div>

      {/* Notes History */}
      <div style={{
        marginTop: '2rem',
        background: 'rgba(30, 41, 59, 0.5)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(71, 85, 105, 0.4)',
        borderRadius: '16px',
        padding: '1.5rem'
      }}>
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 600,
          color: '#f9fafb',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📚 Your Journal History
        </h3>
        
        {loading ? (
          <div style={{ color: '#9ca3af', padding: '1rem', textAlign: 'center' }}>
            <span className="animate-pulse">●</span> Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#6b7280'
          }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📝</p>
            <p>No notes yet. Start journaling above!</p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {notes.slice(0, 10).map(note => {
              const preMood = moods.find(m => m.name === note.preTradeMood);
              const postMood = moods.find(m => m.name === note.postTradeMood);
              const noteDate = note.date?.toDate?.() || new Date(note.createdAt);
              
              return (
                <div key={note.id} style={{
                  background: 'rgba(17, 24, 39, 0.5)',
                  border: '1px solid rgba(75, 85, 99, 0.3)',
                  borderRadius: '12px',
                  padding: '1rem',
                  position: 'relative'
                }}>
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(note.id)}
                    style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      padding: '0.35rem 0.5rem',
                      cursor: 'pointer',
                      color: '#ef4444',
                      fontSize: '0.75rem'
                    }}
                    title="Delete note"
                  >
                    🗑️
                  </button>
                  
                  {/* Date */}
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#6b7280',
                    marginBottom: '0.75rem'
                  }}>
                    {noteDate.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  
                  {/* Moods */}
                  <div style={{
                    display: 'flex',
                    gap: '1.5rem',
                    marginBottom: note.reflection ? '0.75rem' : 0
                  }}>
                    {preMood && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Pre:</span>
                        <span style={{ color: preMood.color }}>{preMood.emoji} {preMood.name}</span>
                      </div>
                    )}
                    {postMood && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Post:</span>
                        <span style={{ color: postMood.color }}>{postMood.emoji} {postMood.name}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Reflection */}
                  {note.reflection && (
                    <p style={{
                      margin: 0,
                      color: '#d1d5db',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      borderTop: '1px solid rgba(75, 85, 99, 0.3)',
                      paddingTop: '0.75rem',
                      marginTop: '0.5rem'
                    }}>
                      {note.reflection}
                    </p>
                  )}
                </div>
              );
            })}
            
            {notes.length > 10 && (
              <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
                Showing 10 of {notes.length} notes
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PsychologyNotes;
