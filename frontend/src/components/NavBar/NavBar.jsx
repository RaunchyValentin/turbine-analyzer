import React from 'react'
import { NavLink } from 'react-router-dom'

/* global __APP_VERSION__ */
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/turbines', label: 'Turbines' },
  { to: '/settings', label: 'Settings' },
  { to: '/sgt2000e', label: 'SGT-2000E' },
  { to: '/comparison', label: 'Comparison' },
  { to: '/curves', label: 'Curves' },
  { to: '/export', label: 'Export' },
]

export default function NavBar() {
  const year = new Date().getFullYear()

  return (
    <nav style={styles.nav} className="no-print">
      {/* Official SE logo */}
      <div style={styles.logoPill}>
        <img src="/se-logo.svg" alt="Siemens Energy" style={styles.logoImg} />
      </div>

      {/* Department */}
      <span style={styles.dept}>SE GS ME SO FST CFF</span>

      {/* Divider */}
      <div style={styles.divider} />

      {/* App name + version + year */}
      <div style={styles.appBlock}>
        <span style={styles.appName}>Turbine Analyzer</span>
        <span style={styles.ver}>
          {APP_VERSION ? `v${APP_VERSION}  ·  ` : ''}{year}
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
  logoPill: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  logoImg: {
    height: 24,
    width: 'auto',
    display: 'block',
    filter: 'brightness(0) invert(1)',
  },
  dept: {
    fontSize: '0.62rem',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: '0.06em',
    fontWeight: 500,
    flexShrink: 0,
    whiteSpace: 'nowrap',
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
    fontSize: '0.68rem',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: '0.03em',
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
