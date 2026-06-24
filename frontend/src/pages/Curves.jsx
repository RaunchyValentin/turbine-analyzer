import React, { useEffect, useState, useRef, useCallback } from 'react'
import Plot from 'react-plotly.js'
import client from '../api/client'

const SNAP_PX = 14   // pixel radius to detect point click

function r4(n) { return isFinite(n) ? Math.round(n * 10000) / 10000 : n }

// ─── Single panel ──────────────────────────────────────────────────────────

function CurvePanel({ turbines, label }) {
  const [turbineId, setTurbineId] = useState(turbines[0]?.id ?? null)
  const [curves,    setCurves]    = useState([])
  const [curveId,   setCurveId]   = useState(null)
  const [curveMeta, setCurveMeta] = useState(null)
  const [points,    setPoints]    = useState([])   // [{x,y,order}]
  const [selIdx,    setSelIdx]    = useState(null)
  const [dirty,     setDirty]     = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [axisInfo,  setAxisInfo]  = useState({ x_label: 'X', y_label: 'Y', x_unit: '', y_unit: '' })

  const gdRef     = useRef(null)    // Plotly graphDiv (via onInitialized)
  const dragRef   = useRef(null)    // {idx} when dragging
  const ptsRef    = useRef([])      // mirror of points for stable callbacks

  useEffect(() => { ptsRef.current = points }, [points])

  // ── data load ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!turbineId) return
    setCurveId(null); setPoints([]); setSelIdx(null); setCurveMeta(null)
    client.get('/curves', { params: { turbine_id: turbineId } }).then(r => {
      setCurves(r.data)
      if (r.data.length) setCurveId(r.data[0].id)
    })
  }, [turbineId])

  useEffect(() => {
    if (!curveId) return
    setDirty(false); setSelIdx(null)
    const c = curves.find(c => c.id === curveId)
    setCurveMeta(c ?? null)
    Promise.all([
      client.get(`/curves/${curveId}/points`),
      client.get(`/curves/${curveId}/axis-info`),
    ]).then(([pts, ax]) => {
      setPoints(pts.data.map((p, i) => ({ x: p.x, y: p.y, order: i })))
      setAxisInfo(ax.data)
    })
  }, [curveId, curves])

  // ── coordinate helpers ──────────────────────────────────────────────────

  const p2d = useCallback((px, py) => {
    const gd = gdRef.current
    if (!gd?._fullLayout) return null
    const { _size: s, xaxis: xa, yaxis: ya } = gd._fullLayout
    return {
      x: r4(xa.range[0] + (px - s.l) / s.w * (xa.range[1] - xa.range[0])),
      y: r4(ya.range[0] + (1 - (py - s.t) / s.h) * (ya.range[1] - ya.range[0])),
    }
  }, [])

  const d2p = useCallback((dx, dy) => {
    const gd = gdRef.current
    if (!gd?._fullLayout) return null
    const { _size: s, xaxis: xa, yaxis: ya } = gd._fullLayout
    return {
      px: s.l + (dx - xa.range[0]) / (xa.range[1] - xa.range[0]) * s.w,
      py: s.t + (1 - (dy - ya.range[0]) / (ya.range[1] - ya.range[0])) * s.h,
    }
  }, [])

  // ── mouse drag (capture-phase on Plotly div) ────────────────────────────

  const onMouseDown = useCallback((e) => {
    const gd = gdRef.current
    if (!gd?._fullLayout) return
    const rect = gd.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let closest = -1, minD = SNAP_PX
    ptsRef.current.forEach((pt, i) => {
      const px = d2p(pt.x, pt.y)
      if (!px) return
      const d = Math.hypot(mx - px.px, my - px.py)
      if (d < minD) { minD = d; closest = i }
    })

    if (closest >= 0) {
      e.stopPropagation()
      e.preventDefault()
      setSelIdx(closest)
      dragRef.current = { idx: closest }
    }
  }, [d2p])

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return
    const gd = gdRef.current
    if (!gd) return
    const rect = gd.getBoundingClientRect()
    const data = p2d(e.clientX - rect.left, e.clientY - rect.top)
    if (!data) return
    const idx = dragRef.current.idx
    setPoints(prev => prev.map((pt, i) => i === idx ? { ...pt, ...data } : pt))
    setDirty(true)
  }, [p2d])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])

  // attach listeners when graphDiv becomes available
  const [gdReady, setGdReady] = useState(false)
  useEffect(() => {
    const gd = gdRef.current
    if (!gd || !gdReady) return
    gd.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      gd.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [gdReady, onMouseDown, onMouseMove, onMouseUp])

  // ── point table editing ─────────────────────────────────────────────────

  const updatePoint = (idx, field, raw) => {
    const v = parseFloat(raw)
    if (!isFinite(v)) return
    setPoints(prev => prev.map((pt, i) => i === idx ? { ...pt, [field]: v } : pt))
    setDirty(true)
  }

  const addPoint = () => {
    const last = points[points.length - 1]
    const np = { x: last ? r4(last.x + 1) : 0, y: last ? r4(last.y) : 0, order: points.length }
    setPoints(prev => [...prev, np])
    setSelIdx(points.length)
    setDirty(true)
  }

  const deletePoint = (idx) => {
    setPoints(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, order: i })))
    setSelIdx(s => (s === idx ? null : s != null && s > idx ? s - 1 : s))
    setDirty(true)
  }

  const sortByX = () => {
    setPoints(prev => [...prev].sort((a, b) => a.x - b.x).map((p, i) => ({ ...p, order: i })))
    setSelIdx(null)
    setDirty(true)
  }

  const save = async () => {
    if (!curveId) return
    setSaving(true)
    try {
      await client.put(`/curves/${curveId}/points`,
        points.map((p, i) => ({ x: p.x, y: p.y, order: i })))
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Plotly data ─────────────────────────────────────────────────────────

  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const markerColor = points.map((_, i) => i === selIdx ? '#ff9800' : '#5b9bd5')
  const markerSize  = points.map((_, i) => i === selIdx ? 13 : 8)

  const plotData = [{
    x: xs, y: ys,
    mode: 'lines+markers',
    type: 'scatter',
    line:   { color: '#5b9bd5', width: 1.5 },
    marker: { color: markerColor, size: markerSize, line: { color: '#1e1e2e', width: 1.5 } },
    hovertemplate: 'X: %{x}<br>Y: %{y}<extra></extra>',
  }]

  const xTitle = axisInfo.x_unit ? `${axisInfo.x_label} [${axisInfo.x_unit}]` : axisInfo.x_label
  const yTitle = axisInfo.y_unit ? `${axisInfo.y_label} [${axisInfo.y_unit}]` : axisInfo.y_label

  const plotLayout = {
    uirevision: curveId,   // reset zoom/pan when curve changes
    margin: { l: 72, r: 12, t: 12, b: 58 },
    paper_bgcolor: '#1e1e2e',
    plot_bgcolor:  '#16162a',
    font:  { color: '#a0a0c0', size: 11 },
    xaxis: {
      gridcolor: '#2a2a45', zerolinecolor: '#444', color: '#777',
      autorange: true,
      title: { text: xTitle, font: { size: 11, color: '#8888aa' }, standoff: 8 },
    },
    yaxis: {
      gridcolor: '#2a2a45', zerolinecolor: '#444', color: '#777',
      autorange: true,
      title: { text: yTitle, font: { size: 11, color: '#8888aa' }, standoff: 8 },
    },
    showlegend: false,
    dragmode: 'pan',
  }

  const plotConfig = { scrollZoom: true, displayModeBar: false, responsive: true }

  // ── render ──────────────────────────────────────────────────────────────

  const detectPli = async () => {
    if (!turbineId) return
    setDetecting(true)
    try {
      const r = await client.post('/curves/detect-pli', null, { params: { turbine_id: turbineId } })
      const { created, skipped_duplicates } = r.data
      const fresh = await client.get('/curves', { params: { turbine_id: turbineId } })
      setCurves(fresh.data)
      if (fresh.data.length) setCurveId(fresh.data[0].id)
      alert(`Detected ${created} PLI curve(s)${skipped_duplicates ? `, ${skipped_duplicates} already existed` : ''}.`)
    } catch (e) {
      alert('Detection failed: ' + (e?.response?.data?.detail ?? e.message))
    } finally {
      setDetecting(false)
    }
  }

  const noCurves = curves.length === 0 && turbineId

  return (
    <div style={PANEL}>
      {/* header label */}
      <div style={{ fontSize: '0.72rem', color: '#555', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </div>

      {/* selectors */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <select value={turbineId ?? ''} onChange={e => setTurbineId(Number(e.target.value))} style={SEL}>
          {turbines.map(t => (
            <option key={t.id} value={t.id}>{t.project_name} / {t.name}</option>
          ))}
        </select>
        <select
          value={curveId ?? ''}
          onChange={e => setCurveId(Number(e.target.value))}
          style={SEL}
          disabled={curves.length === 0}
        >
          {noCurves && <option value="">— no curves —</option>}
          {curves.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {noCurves && (
          <button onClick={detectPli} disabled={detecting} style={{ ...BTN, borderColor: '#4a9', color: '#4a9' }}>
            {detecting ? 'Detecting…' : 'Detect PLI'}
          </button>
        )}
        {curveMeta?.description && (
          <span style={{ fontSize: '0.72rem', color: '#555', alignSelf: 'center', flexShrink: 0 }}>
            {curveMeta.description}
          </span>
        )}
      </div>

      {/* chart: outer clips canvas, inner absolute fills it so Plotly labels stay inside SVG */}
      <div style={{ flex: '1 1 180px', minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          {points.length === 0 && curveId && (
            <div style={EMPTY_HINT}>No points</div>
          )}
          {!curveId && (
            <div style={EMPTY_HINT}>Select a curve</div>
          )}
          <Plot
            data={plotData}
            layout={plotLayout}
            config={plotConfig}
            onInitialized={(_, gd) => { gdRef.current = gd; setGdReady(true) }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        </div>
      </div>

      {/* point table */}
      <div style={{ flex: '0 0 auto', maxHeight: 160, overflowY: 'auto', borderRadius: 4, border: '1px solid #1e1e30', isolation: 'isolate' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#14142a', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={TH_N}>#</th>
              <th style={TH_X} title={axisInfo.x_label}>
                {axisInfo.x_label}
                {axisInfo.x_unit && <span style={UNIT_BADGE}>{axisInfo.x_unit}</span>}
              </th>
              <th style={TH_X} title={axisInfo.y_label}>
                {axisInfo.y_label}
                {axisInfo.y_unit && <span style={UNIT_BADGE}>{axisInfo.y_unit}</span>}
              </th>
              <th style={{ ...TH_N, width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {points.map((pt, i) => {
              const active = i === selIdx
              return (
                <tr
                  key={i}
                  onClick={() => setSelIdx(i)}
                  style={{
                    background: active ? '#1e2d3d' : 'transparent',
                    cursor: 'pointer',
                    borderLeft: active ? '2px solid #e08030' : '2px solid transparent',
                  }}
                >
                  <td style={TD_N}>{i + 1}</td>
                  <td style={TD_V}>
                    <input
                      type="number" step="any" value={pt.x}
                      onChange={e => updatePoint(i, 'x', e.target.value)}
                      onFocus={() => setSelIdx(i)}
                      style={NUM_IN}
                    />
                  </td>
                  <td style={TD_V}>
                    <input
                      type="number" step="any" value={pt.y}
                      onChange={e => updatePoint(i, 'y', e.target.value)}
                      onFocus={() => setSelIdx(i)}
                      style={NUM_IN}
                    />
                  </td>
                  <td style={TD_N}>
                    <button
                      onClick={e => { e.stopPropagation(); deletePoint(i) }}
                      style={DEL_BTN}
                      title="Delete point"
                    >×</button>
                  </td>
                </tr>
              )
            })}
            {points.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '0.6rem', color: '#444', textAlign: 'center', fontSize: '0.75rem' }}>
                No points
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* actions */}
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button onClick={addPoint} disabled={!curveId} style={BTN}>+ Point</button>
        <button onClick={sortByX}  disabled={points.length < 2} style={BTN}>Sort X</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.72rem', color: '#555' }}>
          {points.length} pts{dirty ? ' ●' : ''}
        </span>
        <button
          onClick={save}
          disabled={!dirty || saving || !curveId}
          style={{ ...BTN, ...(dirty ? BTN_SAVE : {}) }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Curves() {
  const [turbines, setTurbines] = useState([])

  useEffect(() => {
    client.get('/turbines/list').then(r => setTurbines(r.data))
  }, [])

  if (turbines.length === 0) {
    return (
      <div style={{ color: '#555', padding: '2rem', fontSize: '0.9rem' }}>
        No turbines found — import a file first.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', height: 'calc(100vh - 72px)' }}>
      <CurvePanel turbines={turbines} label="Panel A" />
      <div style={{ width: 1, background: '#222', flexShrink: 0 }} />
      <CurvePanel turbines={turbines} label="Panel B" />
    </div>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────

const PANEL = {
  display: 'flex', flexDirection: 'column', gap: '0.5rem',
  flex: 1, minWidth: 0, overflow: 'hidden',
}

const SEL = {
  background: '#1e1e2e', color: '#e0e0e0',
  border: '1px solid #333', borderRadius: 4,
  padding: '0.3rem 0.5rem', fontSize: '0.8rem', minWidth: 120,
}

const TH_BASE = {
  padding: '0.25rem 0.45rem', textAlign: 'left',
  color: '#5a5a7a', fontWeight: 600, fontSize: '0.7rem',
  borderBottom: '1px solid #1e1e30', whiteSpace: 'nowrap',
  overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 0,
}
const TH_N = { ...TH_BASE, width: 24, maxWidth: 'none', textAlign: 'center' }
const TH_X = { ...TH_BASE, width: '45%' }

const TD_N = {
  padding: '0.05rem 0.4rem', color: '#3e3e58',
  fontSize: '0.7rem', textAlign: 'center', width: 24,
}
const TD_V = {
  padding: '0 0.4rem',
}

const NUM_IN = {
  width: '100%', background: 'transparent', border: 'none',
  color: '#a8a8c8', fontSize: '0.77rem', padding: '0.08rem 0',
  outline: 'none', fontFamily: 'monospace',
}

const UNIT_BADGE = {
  marginLeft: '0.3rem', fontSize: '0.65rem',
  color: '#5588aa', fontWeight: 400,
}

const DEL_BTN = {
  background: 'none', border: 'none', color: '#555',
  cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px',
  lineHeight: 1,
}

const BTN = {
  background: '#1e1e2e', border: '1px solid #333', color: '#999',
  borderRadius: 3, cursor: 'pointer', padding: '0.25rem 0.6rem',
  fontSize: '0.75rem',
}

const BTN_SAVE = {
  borderColor: '#5b9bd5', color: '#5b9bd5', background: '#0a1a2a',
}

const EMPTY_HINT = {
  position: 'absolute', inset: 0, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  color: '#333', fontSize: '0.85rem', pointerEvents: 'none', zIndex: 1,
}
