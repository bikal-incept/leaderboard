import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { BarChart3, FileText, Sun, Moon, Database, GitCompare } from 'lucide-react';

const Layout: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Load theme preference from localStorage on initial render
    const savedTheme = localStorage.getItem('theme-preference');
    return (savedTheme === 'dark' || savedTheme === 'light') ? savedTheme : 'light';
  });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Set initial theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  const navItems = [
    { path: '/leaderboards', icon: BarChart3, label: 'Leaderboards' },
    { path: '/evaluations', icon: FileText, label: 'Evaluations' },
    { path: '/compare', icon: GitCompare, label: 'Compare' },
    { path: '/look-at-data', icon: Database, label: 'Data' },
  ];

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    // Save theme preference to localStorage
    localStorage.setItem('theme-preference', newTheme);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--background)' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '80px',
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border)',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
        }}
      >
        {/* Navigation */}
        <nav style={{ flex: 1, padding: '24px 12px' }}>
          {navItems.map((item) => (
            <div
              key={item.path}
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredItem(item.path)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <NavLink
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  marginBottom: '8px',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(158, 127, 255, 0.1) 0%, rgba(56, 189, 248, 0.1) 100%)'
                    : 'transparent',
                  border: isActive ? '1px solid rgba(158, 127, 255, 0.3)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                })}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.classList.contains('active')) {
                    e.currentTarget.style.background = theme === 'dark' 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.classList.contains('active')) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <item.icon size={20} />
              </NavLink>
              
              {/* Hover Tooltip */}
              {hoveredItem === item.path && (
                <div
                  style={{
                    position: 'absolute',
                    left: '90px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    whiteSpace: 'nowrap',
                    boxShadow: theme === 'dark' 
                      ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                      : '0 4px 12px rgba(0, 0, 0, 0.1)',
                    border: '1px solid var(--border)',
                    zIndex: 100,
                    pointerEvents: 'none',
                    animation: 'fadeIn 0.15s ease-out',
                  }}
                >
                  {item.label}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Theme Toggle Button */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={toggleTheme}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '12px',
              background: 'transparent',
              border: '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme === 'dark' 
                ? 'rgba(255, 255, 255, 0.05)' 
                : 'rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto', marginLeft: '80px', height: '100vh' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
