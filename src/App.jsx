
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import Journal from "./pages/Journal";
import PsychologyNotes from "./pages/PsychologyNotes";
import Playbook from "./pages/Playbook";
import Calendar from "./pages/Calendar";
import Backtesting from "./pages/Backtesting";
import ReviewTradingData from "./pages/ReviewTradingData";
import GoalSetting from "./pages/GoalSetting";
import HabitTracker from "./pages/HabitTracker";
import DailyPlanner from "./pages/DailyPlanner";
import Login from "./pages/Login";
import Account from "./pages/Account";
import ImportTrades from "./pages/ImportTrades";
import StrategyManager from "./pages/StrategyManager";
import Reports from "./pages/Reports";
import TradePlan from "./pages/TradePlan";
import Dashboard from "./components/Dashboard";
// import AddTrade from "./components/AddTrade";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import "./App.css";

// Sidebar state context
const SidebarContext = React.createContext();

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen } = React.useContext(SidebarContext);
  
  if (location.pathname === "/login") return null;
  
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };
  
  return (
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Hamburger Menu Button */}
        <button 
          className="hamburger-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <div className={`hamburger-icon ${sidebarOpen ? 'open' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </button>
        <span className="navbar-title">Trading Journal</span>
      </div>
      <button className="logout-btn" onClick={handleLogout}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Logout
      </button>
    </nav>
  );
}

// Navigation items with icons
const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/', label: 'Journal', icon: '📓' },
  { path: '/trade-plan', label: 'Trade Plan', icon: '📝' },
  { path: '/import', label: 'Import Trades', icon: '📥' },
  { path: '/backtesting', label: 'Backtesting', icon: '🧪' },
  { path: '/review', label: 'Review Data', icon: '📋' },
  { path: '/strategies', label: 'Strategies & Tags', icon: '🎲' },
  { path: '/reports', label: 'Reports', icon: '📈' },
  { path: '/goals', label: 'Goal Setting', icon: '🎯' },
  { path: '/habits', label: 'Habit Tracker', icon: '✅' },
  { path: '/planner', label: 'Daily Planner', icon: '📅' },
  { path: '/psychology', label: 'Psychology', icon: '🧠' },
  { path: '/playbook', label: 'Playbook', icon: '📖' },
  { path: '/calendar', label: 'Calendar', icon: '🗓️' },
  { path: '/account', label: 'Account', icon: '👤' },
];

function Sidebar() {
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen } = React.useContext(SidebarContext);
  
  if (location.pathname === "/login") return null;
  
  return (
    <>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <ul>
          {navItems.map((item) => (
            <li key={item.path}>
              <Link 
                to={item.path}
                className={location.pathname === item.path ? 'active' : ''}
                onClick={() => {
                  // Close sidebar on mobile after clicking
                  if (window.innerWidth <= 768) {
                    setSidebarOpen(false);
                  }
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        
        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-text">
            <span className="nav-icon">💡</span>
            <span className="nav-label">Trade Smart, Trade Safe</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function AppContent() {
  const location = useLocation();
  const { sidebarOpen } = React.useContext(SidebarContext);
  
  // Render login page without layout wrapper
  if (location.pathname === '/login') {
    return <Login />;
  }
  
  return (
    <>
      <Navbar />
      <div className={`app-layout ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
        <Sidebar />
        <main>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/" element={<Journal />} />
            <Route path="/trade-plan" element={<TradePlan />} />
            <Route path="/import" element={<ImportTrades />} />
            <Route path="/playbook" element={<Playbook />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/backtesting" element={<Backtesting />} />
            <Route path="/review" element={<ReviewTradingData />} />
            <Route path="/strategies" element={<StrategyManager />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/goals" element={<GoalSetting />} />
            <Route path="/habits" element={<HabitTracker />} />
            <Route path="/planner" element={<DailyPlanner />} />
            <Route path="/psychology" element={<PsychologyNotes />} />
            <Route path="/account" element={<Account />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<AppContent />} />
        </Routes>
      </Router>
    </SidebarContext.Provider>
  );
}

export default App;
