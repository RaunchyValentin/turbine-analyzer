import React from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/turbines', label: 'Turbines' },
  // { to: '/settings', label: 'Setting List' },  // hidden — WIP
  { to: '/comparison', label: 'Comparison' },
  { to: '/curves', label: 'Curves' },
  { to: '/export', label: 'Export' },
]

export default function NavBar() {
  return (
    <nav style={styles.nav}>
      <span style={styles.brand}>Turbine Analyzer</span>
      <div style={styles.links}>
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.active : {}),
            })}
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.5rem 1.25rem',
    background: '#1a1a2e',
    color: '#e0e0e0',
    borderBottom: '1px solid #333',
  },
  brand: {
    fontWeight: 700,
    fontSize: '1rem',
    color: '#fff',
    marginRight: '1rem',
    whiteSpace: 'nowrap',
  },
  links: {
    display: 'flex',
    gap: '0.25rem',
  },
  link: {
    padding: '0.35rem 0.75rem',
    borderRadius: '4px',
    color: '#ccc',
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
  active: {
    background: '#0f3460',
    color: '#fff',
  },
}
