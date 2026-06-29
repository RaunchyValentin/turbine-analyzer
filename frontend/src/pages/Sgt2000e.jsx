import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Plot from 'react-plotly.js'
import client from '../api/client'

export const IS_2000E = t => t === 'SGT5-2000E' || t === 'SGT6-2000E'

// ── Static data (from 2000_e_test.xlsx) ─────────────────────────────────────

const STARTUP_PARAMS = [
  { srel: 'MBY10DG010|GN4',        desc: 'Gradient 1 point',           value: 16,    unit: 'Hz' },
  { srel: 'MBY10DG010|GN41',       desc: 'Gradient 2 point',           value: 32,    unit: 'Hz' },
  { srel: 'MBY10DG010|GN42',       desc: 'Gradient 3 point',           value: 48,    unit: 'Hz' },
  { srel: 'MBY10DG010|V4',         desc: 'Gradient 1 slope',           value: 0.024, unit: '%/min' },
  { srel: 'MBY10DG010|V41',        desc: 'Gradient 2 slope',           value: 0.14,  unit: '%/min' },
  { srel: 'MBY10DG010|V42',        desc: 'Gradient 3 slope',           value: 0.07,  unit: '%/min' },
  { srel: 'MBP03DU002|KIGNITE.06', desc: 'Hold time NGCV NG start',    value: 2,     unit: 's' },
  { srel: 'MBP03DU002|KIGNITE.07', desc: 'Ramp time NGCV NG ignition', value: 6,     unit: 's' },
  { srel: 'MBP03DU002|FEG42',      desc: 'MIN M-Flow NGCV NG start',   value: 0.26,  unit: 'kg/s' },
  { srel: 'MBP03DU002|FEG43',      desc: 'MIN M-Flow NGCV NG ignition',value: 0.43,  unit: 'kg/s' },
]

const BASELOAD_DATA = [
  { srel: 'EGGLK',      desc: 'Baseload CC',    value: 535, unit: '°C' },
  { srel: 'EGSLK',      desc: 'Peak load CC',   value: 535, unit: '°C' },
  { srel: 'EGSL',       desc: 'Peak load SC',   value: 535, unit: '°C' },
  { srel: 'EGGL',       desc: 'Simple cycle',   value: 535, unit: '°C' },
  { srel: 'TT.ATK.D04', desc: 'Part load OTC',  value: 0,   unit: '°C' },
]

const CHANGEOVER_DATA = [
  { srel: 'TT.ATK.D04', desc: 'Part load OTC',  value: 0,   unit: '°C' },
  { srel: 'TT.ATK.01',  desc: 'DO>PO startup',  value: 365, unit: '°C' },
  { srel: 'TT.ATK.04',  desc: 'PO>DO shutdown', value: 385, unit: '°C' },
  { srel: 'TT.ATK.177', desc: 'DO>PO max',      value: 400, unit: '°C' },
  { srel: 'TT.ATK.178', desc: 'VB minimum',     value: 350, unit: '°C' },
]

const PILOT_GAS_DEFAULT = [
  { pt: 1, x: 0,    y: 0   },
  { pt: 2, x: 0.15, y: 5   },
  { pt: 3, x: 0.30, y: 15  },
  { pt: 4, x: 0.50, y: 30  },
  { pt: 5, x: 0.70, y: 55  },
  { pt: 6, x: 0.90, y: 75  },
  { pt: 7, x: 1.10, y: 90  },
  { pt: 8, x: 1.25, y: 100 },
]

const RUNUP_LIMIT = [
  { x: 0, y: 0.03 }, { x: 16, y: 0.07 }, { x: 32, y: 0.11 },
  { x: 48, y: 0.26 }, { x: 60, y: 0.3 }, { x: 200, y: 0.3 },
]
const F4_DATA = [
  { x: 0, y: 0.58 }, { x: 20, y: 0.39 }, { x: 40, y: 0.39 },
  { x: 60, y: 0.39 }, { x: 80, y: 0.36 }, { x: 100, y: 0.36 },
]
const F6_DATA = [
  { x: 300, y: 1 }, { x: 360, y: 0.82 }, { x: 380, y: 0.77 },
  { x: 430, y: 0.69 }, { x: 500, y: 0.42 }, { x: 520, y: 0.2 }, { x: 530, y: 0 },
]
const PREMIX_KV = [
  { idx: 1, flow: 0, lfit: 0 }, { idx: 2, flow: 2.8, lfit: 3 },
  { idx: 3, flow: 5.597, lfit: 10 }, { idx: 4, flow: 7.83, lfit: 13 },
  { idx: 5, flow: 111.323, lfit: 65 }, { idx: 6, flow: 139.886, lfit: 100 },
]

const LSVCAL_OLD = [
  { x: 0, y: 0.66 }, { x: 0.58, y: 0.66 }, { x: 0.65, y: 0.74 },
  { x: 0.70, y: 0.788 }, { x: 0.93, y: 0.934 }, { x: 1.25, y: 1.08 },
]
const LSVCAL_NEW_DEFAULT = [
  { x: 0, y: 0.66 }, { x: 0.615, y: 0.66 }, { x: 0.70, y: 0.755 },
  { x: 0.73, y: 0.785 }, { x: 0.94, y: 0.925 }, { x: 1.25, y: 1.07 },
]
const LSVCAL_EXP = [
  { ymincal: 0.5166, lsvsw: 0.66 }, { ymincal: 0.5475, lsvsw: 0.66 },
  { ymincal: 0.5835, lsvsw: 0.66 }, { ymincal: 0.6208, lsvsw: 0.6645 },
  { ymincal: 0.6482, lsvsw: 0.6936 }, { ymincal: 0.6729, lsvsw: 0.7214 },
  { ymincal: 0.6981, lsvsw: 0.7535 }, { ymincal: 0.7322, lsvsw: 0.7824 },
  { ymincal: 0.7754, lsvsw: 0.8126 }, { ymincal: 0.8249, lsvsw: 0.8438 },
  { ymincal: 0.8673, lsvsw: 0.8698 }, { ymincal: 0.9092, lsvsw: 0.9012 },
  { ymincal: 0.9582, lsvsw: 0.9339 }, { ymincal: 1.022,  lsvsw: 0.9669 },
  { ymincal: 1.0861, lsvsw: 0.9945 }, { ymincal: 1.1035, lsvsw: 1.0 },
  { ymincal: 1.0859, lsvsw: 1.0 },   { ymincal: 1.0175, lsvsw: 0.9676 },
  { ymincal: 0.9536, lsvsw: 0.9352 }, { ymincal: 0.9046, lsvsw: 0.9029 },
  { ymincal: 0.8629, lsvsw: 0.8713 }, { ymincal: 0.82,   lsvsw: 0.8463 },
  { ymincal: 0.771,  lsvsw: 0.8158 }, { ymincal: 0.7291, lsvsw: 0.7858 },
  { ymincal: 0.6951, lsvsw: 0.7559 }, { ymincal: 0.6716, lsvsw: 0.7249 },
  { ymincal: 0.649,  lsvsw: 0.6972 }, { ymincal: 0.6202, lsvsw: 0.6682 },
  { ymincal: 0.5764, lsvsw: 0.66 },
]
const YMIN_EXP = [
  { pel: 29.99, ymin: 0.3514 }, { pel: 35.02, ymin: 0.3749 }, { pel: 39.99, ymin: 0.4023 },
  { pel: 45.00, ymin: 0.4251 }, { pel: 50.00, ymin: 0.444  }, { pel: 54.99, ymin: 0.4593 },
  { pel: 60.03, ymin: 0.4749 }, { pel: 65.07, ymin: 0.501  }, { pel: 70.00, ymin: 0.5311 },
  { pel: 75.03, ymin: 0.5654 }, { pel: 80.01, ymin: 0.5943 }, { pel: 85.04, ymin: 0.6219 },
  { pel: 90.02, ymin: 0.655  }, { pel: 95.02, ymin: 0.701  }, { pel: 100.05,ymin: 0.7418 },
  { pel: 103.22,ymin: 0.779  }, { pel: 99.98, ymin: 0.7427 }, { pel: 95.11, ymin: 0.6974 },
  { pel: 90.01, ymin: 0.6531 }, { pel: 85.03, ymin: 0.6204 }, { pel: 80.06, ymin: 0.5921 },
  { pel: 75.02, ymin: 0.5611 }, { pel: 69.99, ymin: 0.5272 }, { pel: 65.07, ymin: 0.4982 },
  { pel: 60.03, ymin: 0.4724 }, { pel: 55.08, ymin: 0.4583 }, { pel: 50.08, ymin: 0.4417 },
  { pel: 45.06, ymin: 0.4243 }, { pel: 40.13, ymin: 0.3912 }, { pel: 34.99, ymin: 0.3673 },
]

// ── Math utils ───────────────────────────────────────────────────────────────

// Local linear LOESS (1st-order) — fits y = a + b*x locally via WLS
function loessLinearAt(xs, ys, x0, bw) {
  let sw=0, swx=0, swx2=0, swy=0, swxy=0
  for (let i = 0; i < xs.length; i++) {
    const d = (xs[i] - x0) / bw
    const w = Math.exp(-0.5 * d * d)
    sw += w; swx += w*xs[i]; swx2 += w*xs[i]*xs[i]
    swy += w*ys[i]; swxy += w*xs[i]*ys[i]
  }
  if (sw < 1e-12) return null
  const det = sw*swx2 - swx*swx
  if (det < 1e-12) return swy / sw  // fallback: weighted mean
  const b = (sw*swxy - swx*swy) / det
  const a = (swy - b*swx) / sw
  return a + b*x0
}

function runLoessFit(expData, newPts) {
  if (!expData.length || !newPts.length) return newPts
  const xs = expData.map(p => p.ymincal)
  const ys = expData.map(p => p.lsvsw)
  const yMin = Math.min(...ys), yMax = Math.max(...ys)
  const tol = (yMax - yMin) * 0.05  // 5% of y-range as plateau tolerance

  // Detect saturation edges from experimental data
  const botPts = expData.filter(p => p.lsvsw <= yMin + tol)
  const topPts = expData.filter(p => p.lsvsw >= yMax - tol)
  const bottomEdge = botPts.length >= 2 ? Math.max(...botPts.map(p => p.ymincal)) : -Infinity
  const topEdge    = topPts.length >= 2 ? Math.min(...topPts.map(p => p.ymincal)) :  Infinity

  // LOESS only on linear segment (between plateaus)
  const midData = expData.filter(p => p.ymincal > bottomEdge && p.ymincal < topEdge)
  const mxs = midData.length >= 3 ? midData.map(p => p.ymincal) : xs
  const mys = midData.length >= 3 ? midData.map(p => p.lsvsw)   : ys
  const span = Math.max(...mxs) - Math.min(...mxs) || 1
  const bw = span * 0.5

  return newPts.map(pt => {
    let y
    if (pt.x <= bottomEdge)   y = yMin
    else if (pt.x >= topEdge) y = yMax
    else                       y = loessLinearAt(mxs, mys, pt.x, bw)
    return { ...pt, y: y != null ? +y.toFixed(4) : pt.y }
  })
}

function computeRMSE(exp, hap, hll, pap) {
  if (!exp.length) return 0
  const ss = exp.reduce((s, { pel, ymin }) => s + (hll + (hap - hll) * (pel / pap) - ymin) ** 2, 0)
  return Math.sqrt(ss / exp.length)
}

// Robust IRLS fit with Huber weights — resistant to outliers (hysteresis, noise)
function autoFitYmin(exp, pap) {
  const wls = (weights) => {
    let s11=0, s12=0, s22=0, sy1=0, sy2=0
    exp.forEach(({ pel, ymin }, i) => {
      const w = weights ? weights[i] : 1
      const a = pel / pap, x1 = 1 - a, x2 = a
      s11 += w*x1*x1; s12 += w*x1*x2; s22 += w*x2*x2
      sy1 += w*x1*ymin; sy2 += w*x2*ymin
    })
    const det = s11*s22 - s12*s12
    if (Math.abs(det) < 1e-12) return null
    return { hap: (s11*sy2 - s12*sy1)/det, hll: (s22*sy1 - s12*sy2)/det }
  }
  let r = wls(null)
  if (!r) return null
  for (let iter = 0; iter < 4; iter++) {
    const resids = exp.map(({ pel, ymin }) => Math.abs(r.hll + (r.hap - r.hll) * (pel/pap) - ymin))
    const sorted = [...resids].sort((a, b) => a - b)
    const mad = sorted[Math.floor(sorted.length / 2)] || 1e-6
    const delta = Math.max(mad * 1.5, 1e-6)
    r = wls(resids.map(e => e <= delta ? 1 : delta / e)) || r
  }
  return {
    hap: +Math.max(0, Math.min(1, r.hap)).toFixed(4),
    hll: +Math.max(0, Math.min(1, r.hll)).toFixed(4),
  }
}

// "step-after" line: hold Y until next X point
function makeStepLine(pts) {
  const sorted = [...pts].sort((a, b) => a.x - b.x)
  const xs = [], ys = []
  sorted.forEach((p, i) => {
    xs.push(p.x); ys.push(p.y)
    if (i < sorted.length - 1) { xs.push(sorted[i + 1].x); ys.push(p.y) }
  })
  return { xs, ys }
}

// ── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSV(text, col1Keys, col2Keys) {
  const lines = text.trim().split(/\r?\n/)
  if (!lines.length) return null
  const delim = lines[0].includes('\t') ? '\t' : ','
  const hdr = lines[0].split(delim).map(h => h.trim().toLowerCase())
  const i1 = hdr.findIndex(h => col1Keys.some(k => h.includes(k)))
  const i2 = hdr.findIndex(h => col2Keys.some(k => h.includes(k)))
  if (i1 < 0 || i2 < 0) return null
  const rows = []
  for (let r = 1; r < lines.length; r++) {
    const c = lines[r].split(delim)
    const v1 = parseFloat(c[i1]?.replace(',', '.'))
    const v2 = parseFloat(c[i2]?.replace(',', '.'))
    if (Number.isFinite(v1) && Number.isFinite(v2)) rows.push([v1, v2])
  }
  return rows.length ? rows : null
}

// ── EditCell ─────────────────────────────────────────────────────────────────

function EditCell({ value, onChange, dec = 3 }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  if (editing) return (
    <input autoFocus value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { const n = parseFloat(draft.replace(',', '.')); if (Number.isFinite(n)) onChange(n); setEditing(false) }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false) }}
      style={S.editInput}
    />
  )
  const display = Number.isFinite(value) ? (Number.isInteger(value) && dec === 0 ? String(value) : value.toFixed(dec)) : null
  return (
    <span onClick={() => { setDraft(Number.isFinite(value) ? String(value) : ''); setEditing(true) }} style={S.editSpan} title="Click to edit">
      {display ?? <span style={{ color: '#B8A8DA', fontWeight: 400, borderBottom: 'none' }}>—</span>}
    </span>
  )
}

// ── Plotly layout preset ──────────────────────────────────────────────────────

const PL = (xTitle, yTitle, extra = {}) => ({
  paper_bgcolor: '#F7F3FC',
  plot_bgcolor: '#ffffff',
  font: { color: '#9888B8', size: 11 },
  xaxis: { title: xTitle, gridcolor: '#EDE3F8', zerolinecolor: '#D0C4E8', titlefont: { size: 11 }, ...(extra.xaxis || {}) },
  yaxis: { title: yTitle, gridcolor: '#EDE3F8', zerolinecolor: '#D0C4E8', titlefont: { size: 11 }, ...(extra.yaxis || {}) },
  margin: { l: 52, r: 16, t: 12, b: 46 },
  legend: { bgcolor: '#ffffff', bordercolor: '#D0C4E8', font: { size: 10 } },
})

const PC = { displayModeBar: false, responsive: true }

// ── Tab 1: Sheet2 ─────────────────────────────────────────────────────────────

function Sheet2Tab() {
  const [startup,    setStartup]    = useState(() => STARTUP_PARAMS.map(p => ({ ...p })))
  const [baseload,   setBaseload]   = useState(() => BASELOAD_DATA.map(p => ({ ...p })))
  const [changeover, setChangeover] = useState(() => CHANGEOVER_DATA.map(p => ({ ...p })))
  const [vbTrip,     setVbTrip]     = useState('')
  const [pilotGas,   setPilotGas]   = useState(() => PILOT_GAS_DEFAULT.map(p => ({ ...p })))

  const updRow = (setter, i, v) => setter(rows => rows.map((r, j) => j === i ? { ...r, value: v } : r))
  const updPG  = (i, field, v) => setPilotGas(pts => pts.map((r, j) => j === i ? { ...r, [field]: v } : r))

  const ParamTable = ({ rows, setter, title }) => (
    <div style={{ flexShrink: 0 }}>
      <div style={S.tableTitle}>{title}</div>
      <table style={S.table}>
        <thead><tr>
          <th style={S.th}>SREL / Block</th>
          <th style={S.th}>Description</th>
          <th style={{ ...S.th, textAlign: 'right' }}>Value</th>
          <th style={S.th}>Unit</th>
        </tr></thead>
        <tbody>{rows.map((p, i) => (
          <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
            <td style={S.tdMono}>{p.srel}</td>
            <td style={S.td}>{p.desc}</td>
            <td style={{ ...S.td, textAlign: 'right' }}>
              <EditCell value={p.value} onChange={v => updRow(setter, i, v)}
                dec={Number.isInteger(p.value) ? 0 : 3} />
            </td>
            <td style={{ ...S.td, color: '#9888B8' }}>{p.unit}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )

  const changeoverLen = changeover.length

  return (
    <div>
      <div style={S.sectionHdr}>GT Final Parameter Setting — SGT-2000E</div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <ParamTable rows={startup}  setter={setStartup}  title="Start-up Settings" />
        <ParamTable rows={baseload} setter={setBaseload} title="Baseload Settings" />

        {/* HL130 Run-Up Limitation table */}
        <div style={{ flexShrink: 0 }}>
          <div style={S.tableTitle}>HL130 Run-Up Limitation</div>
          <table style={S.table}>
            <thead><tr>
              <th style={{ ...S.th, textAlign: 'right' }}>Speed [%]</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Setpoint [%]</th>
            </tr></thead>
            <tbody>{RUNUP_LIMIT.map((p, i) => (
              <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.x}</td>
                <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.y}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* Changeover Settings with VB trip row */}
        <div style={{ flexShrink: 0 }}>
          <div style={S.tableTitle}>Mode Changeover Settings</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>SREL / Block</th>
              <th style={S.th}>Description</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Value</th>
              <th style={S.th}>Unit</th>
            </tr></thead>
            <tbody>
              {changeover.map((p, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={S.tdMono}>{p.srel}</td>
                  <td style={S.td}>{p.desc}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <EditCell value={p.value} onChange={v => updRow(setChangeover, i, v)}
                      dec={Number.isInteger(p.value) ? 0 : 3} />
                  </td>
                  <td style={{ ...S.td, color: '#9888B8' }}>{p.unit}</td>
                </tr>
              ))}
              <tr style={changeoverLen % 2 === 0 ? S.rowEven : S.rowOdd}>
                <td style={{ ...S.tdMono, color: '#9888B8' }}>N/A</td>
                <td style={S.td}>VB trip</td>
                <td style={{ ...S.td, textAlign: 'right' }}>
                  <input
                    type="number"
                    value={vbTrip}
                    onChange={e => setVbTrip(e.target.value)}
                    placeholder="—"
                    style={{ width: 62, textAlign: 'right', fontSize: '0.78rem', border: '1px solid #5C3D99', borderRadius: 3, padding: '1px 4px', background: '#FFFDE7', color: '#2A1A4A', fontVariantNumeric: 'tabular-nums' }}
                  />
                </td>
                <td style={{ ...S.td, color: '#9888B8' }}>°C</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ATKKOR + Premix */}
        <div style={{ flexShrink: 0 }}>
          <div style={S.tableTitle}>ATKKOR (MBP03DU002)</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Pt</th>
              <th style={{ ...S.th, textAlign: 'right' }}>ATK [°C]</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Flow [kg/s]</th>
            </tr></thead>
            <tbody>
              <tr style={S.rowEven}><td style={S.td}>5</td><td style={{ ...S.tdNum, fontWeight: 700 }}>100</td><td style={{ ...S.tdNum, fontWeight: 700 }}>0.04</td></tr>
              <tr style={S.rowOdd}> <td style={S.td}>6</td><td style={{ ...S.tdNum, fontWeight: 700 }}>300</td><td style={{ ...S.tdNum, fontWeight: 700 }}>0.10</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: '1rem', display: 'inline-block' }}>
            <div style={S.tableTitle}>Premix NG CV KV (HSG0)</div>
            <table style={{ ...S.table, width: '100%' }}>
              <thead><tr>
                <th style={S.th}>#</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Flow [kg/s]</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Lfit [%]</th>
              </tr></thead>
              <tbody>{PREMIX_KV.map((p, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={S.td}>{p.idx}</td>
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.flow}</td>
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.lfit}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <div style={S.chartTitle}>HL130 Run-Up Limitation</div>
          <Plot data={[{
            x: RUNUP_LIMIT.map(p => p.x), y: RUNUP_LIMIT.map(p => p.y),
            type: 'scatter', mode: 'lines+markers',
            line: { color: '#5C3D99', width: 2, shape: 'hv' }, marker: { size: 5 }, name: 'Setpoint [%]',
          }]} layout={PL('Speed [%]', 'Setpoint [%]')} config={PC} style={{ width: '100%', height: 210 }} />
        </div>

        <div style={{ flex: '1 1 240px' }}>
          <div style={S.chartTitle}>Pilot Gas F4 — IGV → Flow</div>
          <Plot data={[{
            x: F4_DATA.map(p => p.x), y: F4_DATA.map(p => p.y),
            type: 'scatter', mode: 'lines+markers',
            line: { color: '#5C3D99', width: 2 }, marker: { size: 5 }, name: 'F4 Flow [kg/s]',
          }]} layout={PL('IGV [%]', 'Flow [kg/s]')} config={PC} style={{ width: '100%', height: 210 }} />
        </div>

        <div style={{ flex: '1 1 240px' }}>
          <div style={S.chartTitle}>Pilot Gas F6 — ATK → Flow</div>
          <Plot data={[{
            x: F6_DATA.map(p => p.x), y: F6_DATA.map(p => p.y),
            type: 'scatter', mode: 'lines+markers',
            line: { color: '#E06B00', width: 2 }, marker: { size: 5 }, name: 'F6 Flow [kg/s]',
          }]} layout={PL('ATK [°C]', 'Flow [kg/s]')} config={PC} style={{ width: '100%', height: 210 }} />
        </div>

        <div style={{ flex: '1 1 240px' }}>
          <div style={S.chartTitle}>HSG0 Premix KV — Flow vs Lfit</div>
          <Plot data={[{
            x: PREMIX_KV.map(p => p.lfit), y: PREMIX_KV.map(p => p.flow),
            type: 'scatter', mode: 'lines+markers',
            line: { color: '#4caf7d', width: 2 }, marker: { size: 5 }, name: 'Flow [kg/s]',
          }]} layout={PL('Lfit [%]', 'Flow [kg/s]')} config={PC} style={{ width: '100%', height: 210 }} />
        </div>
      </div>

      {/* Pilot Gas Settings */}
      <div style={S.sectionHdr}>Pilot Gas Settings — MBP15DG010|HSP0</div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          <div style={S.tableTitle}>HSP0 Characteristic (editable)</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>#</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Flow [kg/s]</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Lfit [%]</th>
            </tr></thead>
            <tbody>{pilotGas.map((p, i) => (
              <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                <td style={{ ...S.td, color: '#9888B8' }}>{p.pt}</td>
                <td style={S.tdNum}><EditCell value={p.x} onChange={v => updPG(i, 'x', v)} dec={3} /></td>
                <td style={S.tdNum}><EditCell value={p.y} onChange={v => updPG(i, 'y', v)} dec={1} /></td>
              </tr>
            ))}</tbody>
          </table>
          <div style={S.note}>MBP15DG010|HSP0 — нормированный входной сигнал → уставка клапана пилотного газа [%]</div>
        </div>

        <div style={{ flex: '1 1 300px' }}>
          <div style={S.chartTitle}>HSP0 NG KV — Flow vs Lfit Characteristic</div>
          <Plot
            data={[{
              x: pilotGas.map(p => p.y),
              y: pilotGas.map(p => p.x),
              type: 'scatter', mode: 'lines+markers',
              line: { color: '#5C3D99', width: 2 },
              marker: { size: 6, color: '#5C3D99' },
              name: 'Flow [kg/s]',
            }]}
            layout={PL('Lfit [%]', 'Flow [kg/s]')}
            config={PC}
            style={{ width: '100%', height: 260 }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Tab 2: IGV LSVCAL ────────────────────────────────────────────────────────

function LsvcalTab({ turbineId }) {
  const [lsvcalOld, setLsvcalOld] = useState(() => LSVCAL_OLD.map(p => ({ ...p })))
  const [lsvcalNew, setLsvcalNew] = useState(() => LSVCAL_OLD.map(p => ({ x: p.x, y: null })))
  const [newSize,   setNewSize]   = useState(6)
  const [expData,   setExpData]   = useState(null)
  const [fitDone,   setFitDone]   = useState(false)
  const [csvError,  setCsvError]  = useState('')
  const [dbLoading, setDbLoading] = useState(false)
  const fileRef = useRef()

  const changeNewSize = (n) => {
    setNewSize(n)
    setLsvcalNew(prev => {
      if (n <= prev.length) return prev.slice(0, n)
      const add = n - prev.length
      const withX = [...prev].filter(p => p.x !== null).sort((a, b) => a.x - b.x)
      if (withX.length < 2) {
        return [...prev, ...Array(add).fill(null).map(() => ({ x: null, y: null }))]
      }
      // Find midpoints of the `add` largest gaps between existing breakpoints
      const gaps = []
      for (let i = 0; i < withX.length - 1; i++)
        gaps.push({ gap: withX[i+1].x - withX[i].x, mid: +((withX[i].x + withX[i+1].x) / 2).toFixed(4) })
      const newX = gaps.sort((a, b) => b.gap - a.gap).slice(0, add).map(g => g.mid)
      const combined = [...prev, ...newX.map(x => ({ x, y: null }))]
      combined.sort((a, b) => (a.x ?? Infinity) - (b.x ?? Infinity))
      return combined
    })
    setFitDone(false)
  }

  useEffect(() => {
    if (!turbineId) return
    setDbLoading(true)
    const pf = s => { const n = parseFloat(String(s || '').replace(',', '.')); return Number.isFinite(n) ? n : null }
    const find = (params, suf) => {
      const p = params.find(p =>
        (p.name || '').toUpperCase().endsWith(suf.toUpperCase()) ||
        (p.kks  || '').toUpperCase().endsWith(suf.toUpperCase())
      )
      return p ? pf(p.value) : null
    }
    Promise.all([
      client.get('/parameters', { params: { turbine_id: turbineId, search: 'LSVCAL', limit: 50 } }),
      client.get('/parameters', { params: { turbine_id: turbineId, search: 'V300',   limit: 50 } }),
    ]).then(([r1, r2]) => {
        const params = [...(r1.data || []), ...(r2.data || [])]
        const old = Array.from({ length: 6 }, (_, i) => ({
          x: find(params, `A${i + 1}`),
          y: find(params, `B${i + 1}`),
        }))
        if (old.some(p => p.x !== null || p.y !== null)) {
          setLsvcalOld(old)
          setLsvcalNew(old.map(p => ({ x: p.x, y: null })))
        }
        // else: keep LSVCAL_OLD defaults already set as initial state
      })
      .catch(() => { /* keep defaults on error */ })
      .finally(() => setDbLoading(false))
  }, [turbineId])

  const updNew = (i, field, v) => setLsvcalNew(pts => pts.map((r, j) => j === i ? { ...r, [field]: v } : r))

  const handleFit = () => {
    if (!expData || !expData.length) return
    const withX = lsvcalNew.filter(p => p.x !== null)
    if (!withX.length) return
    const fitted = runLoessFit(expData, withX)
    let fi = 0
    setLsvcalNew(lsvcalNew.map(p => p.x !== null ? fitted[fi++] : p))
    setFitDone(true)
  }

  const handleCSV = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const rows = parseCSV(e.target.result, ['ymincal'], ['lsvsw', 'lsvcal'])
      if (!rows) { setCsvError('Columns YMINCAL, LSVSW not found'); return }
      setExpData(rows.map(([ymincal, lsvsw]) => ({ ymincal, lsvsw })))
      setCsvError(''); setFitDone(false)
    }
    reader.readAsText(file)
  }

  const validOld  = [...lsvcalOld.filter(p => p.x !== null && p.y !== null)].sort((a, b) => a.x - b.x)
  const validNew  = [...lsvcalNew.filter(p => p.x !== null && p.y !== null)].sort((a, b) => a.x - b.x)
  const canFit    = !!expData && lsvcalNew.some(p => p.x !== null)

  return (
    <div>
      <div style={S.sectionHdr}>IGV Precontrol — LSVCAL Polynomial</div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* OLD (from DB) */}
        <div style={{ flexShrink: 0 }}>
          <div style={S.tableTitle}>
            LSVCAL old
            {dbLoading && <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#9888B8', marginLeft: 6 }}>loading…</span>}
          </div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>#</th>
              <th style={{ ...S.th, textAlign: 'right' }}>YMINCAL</th>
              <th style={{ ...S.th, textAlign: 'right' }}>LSVSW</th>
            </tr></thead>
            <tbody>{lsvcalOld.map((p, i) => (
              <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                <td style={{ ...S.td, color: '#9888B8' }}>{i + 1}</td>
                <td style={S.tdNum}>{p.x !== null ? p.x.toFixed(3) : <span style={{ color: '#B8A8DA' }}>—</span>}</td>
                <td style={S.tdNum}>{p.y !== null ? p.y.toFixed(3) : <span style={{ color: '#B8A8DA' }}>—</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* NEW (editable) */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...S.tableTitle, background: '#E8F5E9', color: '#1a4d1a', borderBottom: '1px solid #4caf7d44', display: 'flex', alignItems: 'center', gap: 6 }}>
            LSVCAL new
            {fitDone && <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#4caf7d' }}>✓ fitted</span>}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
              {[6, 10].map(n => (
                <button key={n} onClick={() => changeNewSize(n)} style={{
                  fontSize: '0.68rem', padding: '1px 7px', borderRadius: 3, border: '1px solid #4caf7d',
                  background: newSize === n ? '#4caf7d' : 'transparent',
                  color: newSize === n ? '#fff' : '#1a4d1a', cursor: 'pointer', fontWeight: 700,
                }}>{n} pts</button>
              ))}
            </span>
          </div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>#</th>
              <th style={{ ...S.th, textAlign: 'right' }}>YMINCAL</th>
              <th style={{ ...S.th, textAlign: 'right' }}>LSVSW</th>
            </tr></thead>
            <tbody>{lsvcalNew.map((p, i) => (
              <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                <td style={{ ...S.td, color: '#9888B8' }}>{i + 1}</td>
                <td style={S.tdNum}><EditCell value={p.x} onChange={v => updNew(i, 'x', v)} dec={4} /></td>
                <td style={S.tdNum}><EditCell value={p.y} onChange={v => updNew(i, 'y', v)} dec={4} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* CSV + experimental data */}
        <div style={{ flexShrink: 0, width: 'fit-content' }}>
          <div style={S.tableTitle}>Experimental Data (CSV)</div>
          <div style={{ fontSize: '0.72rem', color: '#6A50A0', marginBottom: '0.4rem' }}>
            Columns: <code>YMINCAL</code>, <code>LSVSW</code> (tab or comma)
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <button style={S.btn} onClick={() => fileRef.current?.click()}>Load CSV</button>
            <button
              style={{ ...S.btn, background: canFit ? '#1a4d1a' : '#B8C8B8', cursor: canFit ? 'pointer' : 'not-allowed' }}
              onClick={handleFit} disabled={!canFit}
            >▶ Fit → New</button>
            {expData && (
              <button
                style={{ ...S.btn, background: '#7a1a1a' }}
                onClick={() => { setExpData(null); setFitDone(false) }}
              >✕ Clear</button>
            )}
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }}
              onChange={e => handleCSV(e.target.files[0])} />
          </div>
          {csvError && <div style={{ color: '#cc4444', fontSize: '0.72rem', marginBottom: '0.3rem' }}>{csvError}</div>}
          {expData && expData.length > 0 ? (
            <>
              <div style={{ fontSize: '0.72rem', color: '#9888B8', marginBottom: '0.4rem' }}>
                {expData.length} points (from CSV)
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #D0C4E8', borderRadius: 4, display: 'inline-block' }}>
                <table style={{ ...S.table, width: 'auto' }}>
                  <thead><tr>
                    <th style={{ ...S.th, textAlign: 'right' }}>YMINCAL</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>LSVSW</th>
                  </tr></thead>
                  <tbody>{expData.map((p, i) => (
                    <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                      <td style={{ ...S.tdNum, fontSize: '0.72rem' }}>{p.ymincal.toFixed(4)}</td>
                      <td style={{ ...S.tdNum, fontSize: '0.72rem' }}>{(p.lsvsw ?? p.v300)?.toFixed(4) ?? '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ ...S.note, color: '#B8A8DA', fontStyle: 'italic', marginTop: '0.5rem' }}>
              Load CSV with experimental data to enable fitting
            </div>
          )}
          <div style={{ ...S.note, marginTop: '0.5rem' }}>
            Fit: plateau detection (5% tolerance) + local linear LOESS on linear segment. YMINCAL breakpoints from "new" table → fitted LSVSW.
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ marginTop: '1.25rem' }}>
        <div style={S.chartTitle}>LSVCAL / V300 — YMINCAL vs LSVSW</div>
        <Plot
          data={[
            ...(expData ? [{ x: expData.map(p => p.ymincal), y: expData.map(p => p.lsvsw), type: 'scatter', mode: 'lines+markers', line: { color: '#E06B00', width: 1 }, marker: { color: '#E06B00', size: 4, opacity: 0.75 }, name: 'Experimental' }] : []),
            ...(validOld.length >= 2 ? [{ x: validOld.map(p => p.x), y: validOld.map(p => p.y), type: 'scatter', mode: 'lines+markers', line: { color: '#5B8BC8', width: 2 }, marker: { color: '#5B8BC8', size: 7, symbol: 'square' }, name: 'LSVCAL old' }] : []),
            ...(validNew.length >= 2 ? [{ x: validNew.map(p => p.x), y: validNew.map(p => p.y), type: 'scatter', mode: 'lines+markers', line: { color: '#CC2222', width: 2 }, marker: { color: '#CC2222', size: 6 }, name: 'LSVCAL new' }] : []),
          ]}
          layout={PL('YMINCAL', 'LSVSW (LSVCAL / V300)')}
          config={PC}
          style={{ width: '100%', height: 'calc(100vh - 420px)', minHeight: 320 }}
        />
      </div>
    </div>
  )
}

// ── Tab 3: YMIN ───────────────────────────────────────────────────────────────

const HAP_OLD = 0.8, HLL_OLD = 0.2, PAP_OLD = 113.4

function YminTab() {
  const [hap, setHap] = useState(null)
  const [hll, setHll] = useState(null)
  const [pap, setPap] = useState(null)
  const [expData, setExpData] = useState(null)
  const [csvError, setCsvError] = useState('')
  const fileRef = useRef()

  const yminAt = (pel, h, l, p) => l + (h - l) * (pel / p)
  const calDN = (h, l) => h - l   // PAP = PN always → (HAP-HLL)/(PAP/PN) = HAP-HLL

  const hasNew = hap !== null && hll !== null && pap !== null
  const rmse = useMemo(() => (expData && hasNew) ? computeRMSE(expData, hap, hll, pap) : null, [expData, hap, hll, pap, hasNew])

  const handleAutoFit = () => {
    if (!expData) return
    const papEff = pap !== null ? pap : Math.max(...expData.map(p => p.pel))
    const r = autoFitYmin(expData, papEff)
    if (r) {
      setHap(r.hap)
      setHll(r.hll)
      if (pap === null) setPap(+papEff.toFixed(1))
    }
  }

  const handleCSV = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const rows = parseCSV(e.target.result, ['ymin'], ['pel', 'power', 'mw'])
      if (!rows) { setCsvError('Columns YMIN and PEL not found'); return }
      setExpData(rows.map(([ymin, pel]) => ({ ymin, pel })))
      setCsvError('')
    }
    reader.readAsText(file)
  }

  const lineOld = [0, PAP_OLD].map(pel => ({ pel, ymin: yminAt(pel, HAP_OLD, HLL_OLD, PAP_OLD) }))
  const lineNew = hasNew ? [0, pap].map(pel => ({ pel, ymin: yminAt(pel, hap, hll, pap) })) : []

  return (
    <div>
      <div style={S.sectionHdr}>YMIN Settings — IGV Minimum Position</div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Parameter table + controls */}
        <div style={{ flexShrink: 0, minWidth: 330 }}>
          <div style={S.tableTitle}>YMIN = HLL + (HAP − HLL) × (PEL / PAP)</div>
          <div style={{ ...S.note, padding: '0.2rem 0.55rem' }}>CALDN = (HAP−HLL)/(PAP/PN)</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Parameter</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Old</th>
              <th style={{ ...S.th, textAlign: 'right', background: '#3D2270' }}>New (editable)</th>
              <th style={S.th}>Unit</th>
            </tr></thead>
            <tbody>
              {[
                { p: 'HAP', old: HAP_OLD, val: hap, set: setHap, unit: '—', dec: 4 },
                { p: 'HLL', old: HLL_OLD, val: hll, set: setHll, unit: '—', dec: 4 },
                { p: 'PAP', old: PAP_OLD, val: pap, set: setPap, unit: 'MW', dec: 1 },
                { p: 'PN',  old: PAP_OLD, val: pap, set: null,   unit: 'MW', dec: 1 },
              ].map(({ p, old, val, set, unit, dec }, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#5C3D99' }}>{p}</td>
                  <td style={{ ...S.tdNum, color: '#9888B8' }}>{old.toFixed(dec)}</td>
                  <td style={{ ...S.tdNum, background: '#F0F4FF' }}>
                    {set ? <EditCell value={val} onChange={set} dec={dec} /> : (val !== null ? <strong>{val.toFixed(dec)}</strong> : <span style={{ color: '#B8A8DA' }}>—</span>)}
                  </td>
                  <td style={{ ...S.td, color: '#9888B8' }}>{unit}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #D0C4E8' }}>
                <td style={{ ...S.td, fontWeight: 700, color: '#6A50A0' }}>CALDN</td>
                <td style={{ ...S.tdNum, color: '#9888B8' }}>{calDN(HAP_OLD, HLL_OLD).toFixed(4)}</td>
                <td style={{ ...S.tdNum, background: '#f0fff4', fontWeight: 700, color: '#1a4d1a' }}>{hasNew ? calDN(hap, hll).toFixed(4) : <span style={{ color: '#B8A8DA' }}>—</span>}</td>
                <td style={{ ...S.td, color: '#9888B8' }}>—</td>
              </tr>
            </tbody>
          </table>

          {/* RMSE + autofit */}
          <div style={{ marginTop: '0.75rem', background: '#f0fff4', border: '1px solid #4caf7d44', borderRadius: 6, padding: '0.6rem 0.75rem' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#1a4d1a', marginBottom: '0.35rem' }}>Fit Quality — RMSE vs Experimental</div>
            {rmse !== null ? (
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: '0.5rem',
                color: rmse < 0.01 ? '#1a4d1a' : rmse < 0.02 ? '#cc6600' : '#cc0000' }}>
                RMSE = {rmse.toFixed(5)}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#9888B8', marginBottom: '0.5rem' }}>Load CSV to compute RMSE</div>
            )}
            <button
              style={{ ...S.btn, background: expData ? '#1a4d1a' : '#B8C8B8', cursor: expData ? 'pointer' : 'not-allowed' }}
              onClick={handleAutoFit} disabled={!expData}>
              ⚡ Auto-fit HAP / HLL (Least Squares)
            </button>
            <div style={{ ...S.note, marginTop: '0.25rem' }}>
              {expData && pap === null ? 'PAP = max(PEL) из данных' : 'Robust IRLS (Huber weights, 4 iter) — устойчив к выбросам'}
            </div>
          </div>

          {/* CSV */}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ ...S.tableTitle, marginBottom: '0.35rem' }}>Experimental Data (CSV)</div>
            <div style={{ fontSize: '0.72rem', color: '#6A50A0', marginBottom: '0.3rem' }}>
              Columns: <code>YMIN</code>, <code>PEL</code> [MW]
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button style={S.btn} onClick={() => fileRef.current?.click()}>Load CSV</button>
              {expData && (
                <button
                  style={{ ...S.btn, background: '#7a1a1a' }}
                  onClick={() => { setExpData(null); setCsvError('') }}
                >✕ Clear</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" style={{ display: 'none' }}
              onChange={e => handleCSV(e.target.files[0])} />
            {csvError && <div style={{ color: '#cc4444', fontSize: '0.72rem', marginTop: '0.25rem' }}>{csvError}</div>}
            {expData && (
              <div style={{ ...S.note, marginTop: '0.25rem' }}>{expData.length} points (from CSV)</div>
            )}
          </div>

          {/* Live preview */}
          {hasNew && (
            <div style={{ ...S.note, marginTop: '0.75rem', background: '#F7F3FC', border: '1px solid #D0C4E8', borderRadius: 4, padding: '0.4rem 0.6rem', lineHeight: 1.6 }}>
              YMIN(0 MW) = <strong>{yminAt(0, hap, hll, pap).toFixed(4)}</strong><br />
              YMIN({pap} MW) = <strong>{yminAt(pap, hap, hll, pap).toFixed(4)}</strong><br />
              CALDN = <strong>{calDN(hap, hll).toFixed(4)}</strong>
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ flex: '1 1 360px' }}>
          <div style={S.chartTitle}>YMIN = f(PEL) — experimental vs parametric line</div>
          <Plot
            data={[
              {
                x: lineOld.map(p => p.pel), y: lineOld.map(p => p.ymin),
                type: 'scatter', mode: 'lines',
                line: { color: '#9888B8', width: 2, dash: 'dash' },
                name: `Old: HAP=${HAP_OLD}, HLL=${HLL_OLD}`,
              },
              ...(lineNew.length ? [{
                x: lineNew.map(p => p.pel), y: lineNew.map(p => p.ymin),
                type: 'scatter', mode: 'lines',
                line: { color: '#5C3D99', width: 2.5 },
                name: `New: HAP=${hap}, HLL=${hll}`,
              }] : []),
              ...(expData ? [{
                x: expData.map(p => p.pel), y: expData.map(p => p.ymin),
                type: 'scatter', mode: 'markers',
                marker: { color: '#E06B00', size: 5, opacity: 0.65 },
                name: 'Experimental',
              }] : []),
            ]}
            layout={{
              ...PL('PEL [MW]', 'YMIN [−]'),
              xaxis: { ...PL('PEL [MW]', 'YMIN [−]').xaxis, range: [0, 120] },
              yaxis: { ...PL('PEL [MW]', 'YMIN [−]').yaxis, range: [0.1, 0.9] },
            }}
            config={PC}
            style={{ width: '100%', height: 'calc(100vh - 380px)', minHeight: 320 }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const S = {
  sectionHdr: { fontSize: '0.95rem', fontWeight: 700, color: '#2A1A4A', borderBottom: '2px solid #D0C4E8', paddingBottom: '0.35rem', marginBottom: '0.9rem' },
  tableTitle:  { background: '#F7F3FC', border: '1px solid #D0C4E8', padding: '0.22rem 0.55rem', fontWeight: 700, fontSize: '0.78rem', color: '#5C3D99', marginBottom: 0 },
  table:       { borderCollapse: 'collapse', fontSize: '0.78rem' },
  th:          { background: '#5C3D99', color: '#ffffff', padding: '0.25rem 0.55rem', textAlign: 'left', fontWeight: 600, borderRight: '1px solid #3D2270', whiteSpace: 'nowrap' },
  td:          { padding: '0.18rem 0.55rem', borderBottom: '1px solid #EDE3F8', color: '#2A1A4A', whiteSpace: 'nowrap' },
  tdNum:       { padding: '0.18rem 0.55rem', borderBottom: '1px solid #EDE3F8', color: '#2A1A4A', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  tdMono:      { padding: '0.18rem 0.55rem', borderBottom: '1px solid #EDE3F8', color: '#5C3D99', fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' },
  rowEven:     { background: '#F7F3FC' },
  rowOdd:      { background: '#ffffff' },
  btn:         { padding: '0.28rem 0.7rem', fontSize: '0.78rem', background: '#5C3D99', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 },
  note:        { fontSize: '0.7rem', color: '#9888B8', marginTop: '0.35rem' },
  chartTitle:  { fontSize: '0.78rem', fontWeight: 700, color: '#5C3D99', textAlign: 'center', marginBottom: '0.2rem' },
  editInput:   { width: 68, fontSize: '0.78rem', border: '1px solid #5C3D99', borderRadius: 3, padding: '1px 3px', background: '#FFFDE7', color: '#2A1A4A' },
  editSpan:    { cursor: 'pointer', fontWeight: 700, borderBottom: '1px dashed #5C3D99', color: '#5C3D99', fontVariantNumeric: 'tabular-nums' },
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'sheet2', label: 'Parameters' },
  { id: 'lsvcal', label: 'IGV LSVCAL' },
  { id: 'ymin',   label: 'YMIN' },
]

export default function Sgt2000e() {
  const { turbineId } = useParams()
  const navigate = useNavigate()
  const [turbines, setTurbines] = useState([])
  const [tab, setTab] = useState('sheet2')

  useEffect(() => {
    client.get('/turbines').then(r => setTurbines((r.data || []).filter(t => IS_2000E(t.type))))
  }, [])

  const current = turbines.find(t => String(t.id) === String(turbineId))

  return (
    <div style={pg.root}>
      {/* Topbar */}
      <div style={pg.topbar} className="no-print">
        <span style={pg.label}>Turbine (SGT-2000E):</span>
        <select value={turbineId || ''} onChange={e => navigate(e.target.value ? `/sgt2000e/${e.target.value}` : '/sgt2000e')} style={pg.select}>
          <option value=''>— select —</option>
          {turbines.map(t => <option key={t.id} value={t.id}>{t.name}{t.type ? ` — ${t.type}` : ''}</option>)}
        </select>
        {current?.type && <span style={pg.typeBadge}>{current.type}</span>}
        {turbines.length === 0 && (
          <span style={{ fontSize: '0.73rem', color: '#cc6600' }}>
            No SGT5/6-2000E turbines imported yet — import a JAR/SREL and set Model = SGT5/6-2000E
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div style={pg.tabBar} className="no-print">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ ...pg.tab, ...(tab === t.id ? pg.tabActive : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content — all tabs stay mounted to preserve state */}
      <div style={pg.content}>
        <div style={{ display: tab === 'sheet2' ? 'block' : 'none' }}><Sheet2Tab /></div>
        <div style={{ display: tab === 'lsvcal' ? 'block' : 'none' }}><LsvcalTab turbineId={turbineId} /></div>
        <div style={{ display: tab === 'ymin'   ? 'block' : 'none' }}><YminTab /></div>
      </div>
    </div>
  )
}

const pg = {
  root:      { display: 'flex', flexDirection: 'column', minHeight: '100%' },
  topbar:    { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.9rem', background: '#F4F0FA', border: '1px solid #D0C4E8', borderRadius: 6, marginBottom: '0.75rem' },
  label:     { color: '#9888B8', fontSize: '0.8rem', flexShrink: 0 },
  select:    { background: '#F4F0FA', color: '#2A1A4A', border: '1px solid #D0C4E8', borderRadius: 4, padding: '0.18rem 0.5rem', fontSize: '0.85rem' },
  typeBadge: { fontSize: '0.72rem', fontWeight: 700, padding: '0.12rem 0.5rem', borderRadius: 3, background: '#E8F0FA', color: '#2A5099', border: '1px solid #C4D0E8', flexShrink: 0 },
  tabBar:    { display: 'flex', borderBottom: '2px solid #D0C4E8', background: '#F7F3FC', borderRadius: '6px 6px 0 0', overflow: 'hidden', marginBottom: 0 },
  tab:       { padding: '0.45rem 1.25rem', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontSize: '0.83rem', background: 'transparent', color: '#9888B8', transition: 'all 0.15s' },
  tabActive: { borderBottom: '2px solid #5C3D99', color: '#5C3D99', fontWeight: 700, background: '#ffffff' },
  content:   { flex: 1, padding: '1rem 0.25rem 2rem' },
}
