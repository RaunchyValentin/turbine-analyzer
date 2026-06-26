import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'

const PRIORITY_COLORS = { 1: '#4caf7d', 2: '#5C3D99', 3: '#888', 4: '#666' }

export default function SettingSidebar({ turbineId, activeSheet, width }) {
  const [nav, setNav] = useState(null)
  const [expanded, setExpanded] = useState({})
  const navigate = useNavigate()

  useEffect(() => {
    client.get('/settings/navigation').then(r => {
      setNav(r.data)
      // Auto-expand the track and group that contains the active sheet
      if (activeSheet) {
        const init = {}
        r.data.tracks?.forEach(track => {
          track.groups?.forEach(group => {
            if (group.sheets?.some(s => s.id === activeSheet)) {
              init[track.id] = true
              init[group.id] = true
            }
          })
        })
        setExpanded(init)
      }
    })
  }, [])

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const goSheet = (sheetId) => navigate(`/settings/${turbineId}/${sheetId}`)
  const goTrack = (trackId) => navigate(`/settings/${turbineId}/${trackId}`)

  const sidebarStyle = { ...styles.sidebar, width: width ?? 260 }

  if (!nav) return <div style={sidebarStyle} className="no-print"><span style={{ color: '#9888B8', fontSize: '0.8rem', padding: '1rem' }}>Loading…</span></div>

  return (
    <aside style={sidebarStyle} className="no-print">
      {nav.tracks?.map(track => (
        <div key={track.id}>
          <button style={{ ...styles.trackBtn, ...(activeSheet === track.id ? styles.trackActive : {}) }}
            onClick={() => { toggle(track.id); goTrack(track.id) }}>
            <span style={styles.arrow}>{expanded[track.id] ? '▾' : '▸'}</span>
            <span>{track.label}</span>
            {track.shortcut && <span style={styles.shortcut}>{track.shortcut}</span>}
          </button>

          {expanded[track.id] && track.groups?.map(group => (
            <div key={group.id}>
              <button style={styles.groupBtn} onClick={() => toggle(group.id)}>
                <span style={styles.arrow}>{expanded[group.id] ? '▾' : '▸'}</span>
                <span>{group.label}</span>
              </button>

              {expanded[group.id] && group.sheets?.map(sheet => (
                <button
                  key={sheet.id}
                  style={{
                    ...styles.sheetBtn,
                    ...(sheet.id === activeSheet ? styles.sheetActive : {}),
                  }}
                  onClick={() => goSheet(sheet.id)}
                >
                  <span style={{ ...styles.dot, background: PRIORITY_COLORS[sheet.priority] || '#555' }} />
                  <span style={styles.sheetId}>{sheet.id}</span>
                  <span style={styles.sheetLabel}>{sheet.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ))}
    </aside>
  )
}

const styles = {
  sidebar: {
    background: '#F7F3FC', borderRight: '1px solid #D0C4E8',
    overflowY: 'auto', flexShrink: 0, fontSize: '0.8rem',
  },
  trackBtn: {
    width: '100%', textAlign: 'left', padding: '0.55rem 0.75rem',
    background: '#5C3D99', border: 'none', borderBottom: '1px solid #D0C4E8',
    color: '#2A1A4A', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
    display: 'flex', alignItems: 'center', gap: '0.4rem',
  },
  trackActive: { background: '#EDE3F8', color: '#5C3D99' },
  shortcut: { marginLeft: 'auto', color: '#D0C4E8', fontSize: '0.7rem', fontWeight: 400 },
  groupBtn: {
    width: '100%', textAlign: 'left', padding: '0.4rem 1.25rem',
    background: 'transparent', border: 'none',
    color: '#9888B8', cursor: 'pointer', fontSize: '0.78rem',
    display: 'flex', alignItems: 'center', gap: '0.4rem',
  },
  sheetBtn: {
    width: '100%', textAlign: 'left', padding: '0.3rem 1rem 0.3rem 2rem',
    background: 'transparent', border: 'none', borderLeft: '2px solid transparent',
    color: '#6A50A0', cursor: 'pointer', fontSize: '0.76rem',
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    transition: 'background 0.1s',
  },
  sheetActive: {
    background: '#EDE3F8', borderLeftColor: '#5C3D99', color: '#2A1A4A',
  },
  arrow: { fontSize: '0.65rem', color: '#9888B8', flexShrink: 0 },
  dot:   { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  sheetId:    { color: '#2A1A4A', flexShrink: 0, minWidth: '52px', fontSize: '0.82rem', fontWeight: 700 },
  sheetLabel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, color: '#6A50A0' },
}
