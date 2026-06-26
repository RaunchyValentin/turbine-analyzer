import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../api/client'
import SettingSidebar from '../components/SettingList/SettingSidebar'
import SheetRenderer from '../components/SettingList/SheetRenderer'
import TrackOverview from '../components/SettingList/TrackOverview'

const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 520
const SIDEBAR_DEFAULT = 260

export default function Settings() {
  const { turbineId, sheetId } = useParams()
  const navigate = useNavigate()
  const [turbines, setTurbines] = useState([])
  const [nav, setNav] = useState(null)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  useEffect(() => {
    client.get('/turbines').then(r => setTurbines(r.data))
    client.get('/settings/navigation').then(r => setNav(r.data))
  }, [])

  const handleTurbineChange = (e) => {
    const tid = e.target.value
    navigate(tid ? `/settings/${tid}/SO111b` : '/settings')
  }

  const onMouseDown = useCallback((e) => {
    dragging.current = true
    startX.current = e.clientX
    startW.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [sidebarWidth])

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW.current + delta))
      setSidebarWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <div style={styles.root}>
      <div style={styles.topbar}>
        <span style={styles.topbarLabel}>Turbine:</span>
        <select value={turbineId || ''} onChange={handleTurbineChange} style={styles.select}>
          <option value=''>— select —</option>
          {turbines.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div style={styles.body}>
        {turbineId ? (
          <>
            <SettingSidebar turbineId={turbineId} activeSheet={sheetId} width={sidebarWidth} />
            <div style={styles.resizeHandle} onMouseDown={onMouseDown} />
            <main style={styles.main}>
              {!sheetId ? (
                <div style={styles.placeholder}>Select a sheet from the sidebar</div>
              ) : nav?.tracks?.find(t => t.id === sheetId) ? (
                <TrackOverview track={nav.tracks.find(t => t.id === sheetId)} turbineId={turbineId} />
              ) : (
                <SheetRenderer turbineId={turbineId} sheetId={sheetId} />
              )}
            </main>
          </>
        ) : (
          <div style={styles.placeholder}>Select a turbine to start</div>
        )}
      </div>
    </div>
  )
}

const styles = {
  root:         { display: 'flex', flexDirection: 'column', height: '100%' },
  topbar:       { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#F4F0FA', borderBottom: '1px solid #D0C4E8' },
  topbarLabel:  { color: '#9888B8', fontSize: '0.8rem' },
  select:       { background: '#F4F0FA', color: '#2A1A4A', border: '1px solid #D0C4E8', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.85rem' },
  body:         { display: 'flex', flex: 1, overflow: 'hidden' },
  resizeHandle: { width: '4px', background: '#EDE3F8', cursor: 'col-resize', flexShrink: 0, transition: 'background 0.15s', ':hover': { background: '#5C3D99' } },
  main:         { flex: 1, overflow: 'auto', padding: '1.25rem' },
  placeholder:  { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9888B8', fontSize: '0.9rem' },
}
