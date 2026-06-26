import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import client from '../../api/client'
import ScalarTable from './patterns/ScalarTable'
import PolyTable from './patterns/PolyTable'
import PolyTablePaired from './patterns/PolyTablePaired'
import MixedSection from './patterns/MixedSection'
import SequenceTable from './patterns/SequenceTable'
import ReadOnlyCalc from './patterns/ReadOnlyCalc'
import RunUpController from './patterns/RunUpController'
import PilotGasPaired from './patterns/PilotGasPaired'

const PATTERNS = {
  A: ScalarTable,
  B: PolyTable,
  C: PolyTablePaired,
  D: MixedSection,
  E: SequenceTable,
  F: ReadOnlyCalc,
  G: RunUpController,
  H: PilotGasPaired,
}

const STYLE_ID = 'print-all-style'
const PORTAL_ID = 'print-all-portal'

export default function PrintAllSheets({ track, turbineId, onClose }) {
  const [sheets, setSheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [portalEl, setPortalEl] = useState(null)

  // Create and mount a portal div directly in body
  useEffect(() => {
    const el = document.createElement('div')
    el.id = PORTAL_ID
    document.body.appendChild(el)
    setPortalEl(el)
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el)
      document.getElementById(STYLE_ID)?.remove()
    }
  }, [])

  // Fetch all sheets for this track in parallel
  useEffect(() => {
    const ids = (track.groups || []).flatMap(g => (g.sheets || []).map(s => s.id))
    Promise.all(
      ids.map(id =>
        client.get(`/settings/${turbineId}/${id}`)
          .then(r => r.data)
          .catch(() => null)
      )
    ).then(results => {
      setSheets(results.filter(d => d && PATTERNS[d.pattern]))
      setLoading(false)
    })
  }, [track, turbineId])

  // Auto-print when all sheets are loaded
  useEffect(() => {
    if (loading || sheets.length === 0 || !portalEl) return

    // Small delay so Plotly charts can render inside the fixed overlay
    const timer = setTimeout(() => {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = `
        @media print {
          body > *:not(#${PORTAL_ID}) { display: none !important; }
          #${PORTAL_ID} > div {
            position: static !important;
            overflow: visible !important;
            padding: 0 !important;
          }
          #${PORTAL_ID} .pa-close-btn { display: none !important; }
          #${PORTAL_ID} .pa-loading { display: none !important; }
        }
      `
      document.head.appendChild(style)
      window.print()
      window.addEventListener('afterprint', () => {
        document.getElementById(STYLE_ID)?.remove()
        onClose()
      }, { once: true })
    }, 600)

    return () => clearTimeout(timer)
  }, [loading, sheets, portalEl, onClose])

  if (!portalEl) return null

  return createPortal(
    <div style={s.overlay}>
      {/* Close button (hidden in print) */}
      <button className="pa-close-btn" onClick={onClose} style={s.closeBtn} title="Закрыть">✕</button>

      {/* Loading state */}
      {loading && (
        <div className="pa-loading" style={s.loadingMsg}>
          <div style={s.loadingSpinner} />
          Загрузка листов трека «{track.label}»…
        </div>
      )}

      {/* Ready state — also shown briefly before print dialog opens */}
      {!loading && sheets.length > 0 && (
        <div className="pa-loading" style={{ ...s.loadingMsg, color: '#3D2270' }}>
          Открываю диалог печати…
        </div>
      )}

      {/* Print content */}
      <div style={s.printBody}>
        {/* Track header (printed on first page) */}
        <div style={s.trackHeader}>
          <div>
            <div style={s.brand}>Siemens Energy · SE GS ME SO FST CFF</div>
            <div style={s.trackLabel}>{track.label}</div>
          </div>
          <div style={s.printDate}>{new Date().toLocaleDateString('de-DE')}</div>
        </div>

        {sheets.map((data, i) => {
          const Component = PATTERNS[data.pattern]
          return (
            <div key={data.id} style={{ pageBreakBefore: i > 0 ? 'always' : 'auto', marginBottom: '2rem' }}>
              <div style={s.sheetHeader}>
                <span style={s.sheetId}>{data.id}</span>
                <span style={s.sheetTitle}>{data.title}</span>
                {data.fuel && <span style={s.fuelBadge}>{data.fuel}</span>}
              </div>
              <Component data={data} turbineId={turbineId} onOverrideSaved={() => {}} />
            </div>
          )
        })}
      </div>
    </div>,
    portalEl
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: '#fff', overflowY: 'auto',
    padding: '1.5rem 2rem',
    fontFamily: 'sans-serif',
  },
  closeBtn: {
    position: 'fixed', top: '1rem', right: '1.5rem', zIndex: 10000,
    background: '#EDE3F8', border: '1px solid #D0C4E8', borderRadius: '50%',
    width: 32, height: 32, cursor: 'pointer',
    fontSize: '0.9rem', color: '#5C3D99', fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  loadingMsg: {
    position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
    background: '#F4F0FA', border: '1px solid #D0C4E8', borderRadius: 6,
    padding: '0.5rem 1.25rem', fontSize: '0.82rem', color: '#5C3D99',
    display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 10001,
    boxShadow: '0 2px 8px rgba(92,61,153,0.12)',
  },
  loadingSpinner: {
    width: 14, height: 14, border: '2px solid #D0C4E8',
    borderTopColor: '#5C3D99', borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  printBody: { maxWidth: '900px', margin: '0 auto' },
  trackHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: '1.25rem', paddingBottom: '0.6rem', borderBottom: '2px solid #5C3D99',
  },
  brand:       { fontWeight: 700, fontSize: '0.85rem', color: '#2A1A4A' },
  trackLabel:  { fontSize: '0.75rem', color: '#6A50A0', marginTop: 2 },
  printDate:   { fontSize: '0.72rem', color: '#9888B8' },
  sheetHeader: {
    display: 'flex', alignItems: 'baseline', gap: '0.75rem',
    marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid #D0C4E8',
  },
  sheetId:    { color: '#5C3D99', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 },
  sheetTitle: { fontWeight: 700, fontSize: '1.05rem', color: '#111' },
  fuelBadge:  { fontSize: '0.7rem', background: '#F4F0FA', color: '#5C3D99', padding: '0.1rem 0.4rem', borderRadius: 3 },
}
