import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import client from '../../api/client'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/turbines', label: 'Turbines' },
  // { to: '/settings', label: 'Setting List' },  // hidden — WIP
  { to: '/comparison', label: 'Comparison' },
  { to: '/curves', label: 'Curves' },
  { to: '/export', label: 'Export' },
]

export default function NavBar() {
  const [version, setVersion] = useState('')
  useEffect(() => {
    client.get('/version').then(r => setVersion(r.data.version)).catch(() => {})
  }, [])

  return (
    <nav style={styles.nav}>
      <span style={styles.brand}>
        Turbine Analyzer
        {version && <span style={styles.ver}>v{version}</span>}
      </span>
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
    background: '#8A00E5',
    color: '#ffffff',
    borderBottom: '1px solid #6B00B3',
  },
  brand: {
    fontWeight: 700,
    fontSize: '1rem',
    color: '#ffffff',
    marginRight: '1rem',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.4rem',
  },
  ver: {
    fontSize: '0.65rem',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: '0.04em',
  },
  links: {
    display: 'flex',
    gap: '0.25rem',
  },
  link: {
    padding: '0.35rem 0.75rem',
    borderRadius: '4px',
    color: 'rgba(255,255,255,0.8)',
    textDecoration: 'none',
    fontSize: '0.875rem',
  },
  active: {
    background: '#6B00B3',
    color: '#ffffff',
  },
}
