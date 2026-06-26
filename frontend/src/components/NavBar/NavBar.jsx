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

function SeLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" style={{ flexShrink: 0 }} aria-label="Siemens Energy">
      {/* outer flame */}
      <path
        d="M15 3 C19.5 8.5 22 13 22 18 C22 23 18.9 27 15 27 C11.1 27 8 23 8 18 C8 13 10.5 8.5 15 3Z"
        fill="rgba(255,255,255,0.95)"
      />
      {/* inner flame cutout */}
      <path
        d="M15 11 C17 14.5 18 16.5 18 19 C18 21.2 16.7 23 15 23 C13.3 23 12 21.2 12 19 C12 16.5 13 14.5 15 11Z"
        fill="#5C3D99"
      />
    </svg>
  )
}

export default function NavBar() {
  const [version, setVersion] = useState('')
  useEffect(() => {
    client.get('/version').then(r => setVersion(r.data.version)).catch(() => {})
  }, [])

  const year = new Date().getFullYear()

  return (
    <nav style={styles.nav}>
      {/* Brand block */}
      <div style={styles.brandBlock}>
        <SeLogo />
        <div style={styles.brandText}>
          <span style={styles.brandName}>Siemens Energy</span>
          <span style={styles.dept}>SE GS ME SO FST CFF</span>
        </div>
      </div>

      {/* Divider */}
      <div style={styles.divider} />

      {/* App name + version + year */}
      <div style={styles.appBlock}>
        <span style={styles.appName}>Turbine Analyzer</span>
        <span style={styles.ver}>
          {version ? `v${version}` : ''}
          {version ? '  ·  ' : ''}
          {year}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Nav links */}
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
    gap: '0.75rem',
    padding: '0 1.25rem',
    height: 52,
    background: '#5C3D99',
    color: '#ffffff',
    borderBottom: '1px solid #3D2270',
    flexShrink: 0,
  },
  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    lineHeight: 1,
  },
  brandName: {
    fontWeight: 700,
    fontSize: '0.875rem',
    color: '#ffffff',
    letterSpacing: '0.01em',
  },
  dept: {
    fontSize: '0.62rem',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '0.06em',
    fontWeight: 500,
  },
  divider: {
    width: 1,
    height: 28,
    background: 'rgba(255,255,255,0.25)',
    flexShrink: 0,
  },
  appBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    lineHeight: 1,
    flexShrink: 0,
  },
  appName: {
    fontWeight: 600,
    fontSize: '0.825rem',
    color: '#ffffff',
  },
  ver: {
    fontSize: '0.6rem',
    color: 'rgba(255,255,255,0.5)',
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
    background: '#3D2270',
    color: '#ffffff',
  },
}
