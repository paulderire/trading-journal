import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Login successful", userCredential);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      console.error("Login error:", err);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    setResetLoading(true);
    setError("");
    setMessage("");
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
      setShowReset(false);
    } catch (err) {
      setError(err.message);
    }
    setResetLoading(false);
  };

  return (
    <div className="login-container" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)',
      padding: '1rem'
    }}>
      <div style={{
        background: 'rgba(30, 41, 59, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(71, 85, 105, 0.4)',
        borderRadius: '20px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>📊 Trading Journal</h2>
        <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: '2rem', fontSize: '0.9rem' }}>
          {showReset ? 'Reset your password' : 'Sign in to your account'}
        </p>

        {message && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid #10b981',
            borderRadius: '10px',
            padding: '0.75rem',
            marginBottom: '1rem',
            color: '#10b981',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            ✅ {message}
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            borderRadius: '10px',
            padding: '0.75rem',
            marginBottom: '1rem',
            color: '#ef4444',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            ❌ {error}
          </div>
        )}

        {showReset ? (
          <form onSubmit={handlePasswordReset}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '10px',
                  color: '#f1f5f9',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
              />
            </div>
            <button 
              type="submit" 
              disabled={resetLoading}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: resetLoading ? 'not-allowed' : 'pointer',
                opacity: resetLoading ? 0.7 : 1,
                transition: 'all 0.2s ease',
                marginBottom: '1rem'
              }}
            >
              {resetLoading ? 'Sending...' : 'Send Reset Email'}
            </button>
            <button 
              type="button"
              onClick={() => setShowReset(false)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'transparent',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                borderRadius: '10px',
                color: '#94a3b8',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '10px',
                  color: '#f1f5f9',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '10px',
                  color: '#f1f5f9',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
              />
            </div>
            <button 
              type="submit"
              style={{
                width: '100%',
                padding: '0.875rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '1rem'
              }}
            >
              Sign In
            </button>
            <button 
              type="button"
              onClick={() => setShowReset(true)}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'transparent',
                border: 'none',
                color: '#10b981',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Forgot Password?
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
