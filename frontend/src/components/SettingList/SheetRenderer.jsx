import React, { useEffect, useState, useCallback } from 'react'
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

export default function SheetRenderer({ turbineId, sheetId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    client.get(`/settings/${turbineId}/${sheetId}`)
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load sheet data'))
      .finally(() => setLoading(false))
  }, [turbineId, sheetId])

  useEffect(() => { load() }, [load])

  const handleOverrideSaved = useCallback(() => load(), [load])

  if (loading) return <div style={styles.status}>Loading…</div>
  if (error)   return <div style={{ ...styles.status, color: '#e74c3c' }}>{error}</div>
  if (!data)   return null

  if (data.pattern === 'stub') {
    return (
      <div style={styles.stub}>
        <div style={styles.stubTitle}>{data.id}</div>
        <div style={styles.stubMsg}>Sheet config not yet implemented (Priority 3–4)</div>
      </div>
    )
  }

  const Component = PATTERNS[data.pattern]
  if (!Component) return <div style={styles.status}>Unknown pattern: {data.pattern}</div>

  return (
    <div>
      <div style={styles.header}>
        <span style={styles.sheetId}>{data.id}</span>
        <h2 style={styles.title}>{data.title}</h2>
        {data.fuel && <span style={styles.fuelBadge}>{data.fuel}</span>}
      </div>
      <Component
        data={data}
        turbineId={turbineId}
        onOverrideSaved={handleOverrideSaved}
      />
    </div>
  )
}

const styles = {
  status:     { padding: '2rem', color: '#888', fontSize: '0.9rem' },
  stub:       { padding: '2rem', textAlign: 'center' },
  stubTitle:  { fontSize: '1.2rem', color: '#5b9bd5', marginBottom: '0.5rem' },
  stubMsg:    { color: '#555', fontSize: '0.85rem' },
  header:     { display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #222', paddingBottom: '0.5rem' },
  sheetId:    { color: '#5b9bd5', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 },
  title:      { margin: 0, fontSize: '1.1rem', color: '#111111', fontWeight: 700 },
  fuelBadge:  { marginLeft: 'auto', fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '3px', background: '#1e2a3a', color: '#5b9bd5' },
}
