import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Plot from 'react-plotly.js'
import client from '../api/client'
import MBA22Tab from './MBA22Tab'

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

const PILOT_GAS_DATA = [
  { port: 'A1',  nameX: '|HSP0.20',  portB: 'B1',  nameY: '|HSP0.30'  },
  { port: 'A2',  nameX: '|HSP0.40',  portB: 'B2',  nameY: '|HSP0.50'  },
  { port: 'A3',  nameX: '|HSP0.60',  portB: 'B3',  nameY: '|HSP0.70'  },
  { port: 'A4',  nameX: '|HSP0.80',  portB: 'B4',  nameY: '|HSP0.90'  },
  { port: 'A5',  nameX: '|HSP0.100', portB: 'B5',  nameY: '|HSP0.110' },
  { port: 'A6',  nameX: '|HSP0.120', portB: 'B6',  nameY: '|HSP0.130' },
  { port: 'A7',  nameX: '|HSP0.140', portB: 'B7',  nameY: '|HSP0.150' },
  { port: 'A8',  nameX: '|HSP0.160', portB: 'B8',  nameY: '|HSP0.170' },
  { port: 'A9',  nameX: '|HSP0.180', portB: 'B9',  nameY: '|HSP0.190' },
  { port: 'A10', nameX: '|HSP0.200', portB: 'B10', nameY: '|HSP0.210' },
  { port: 'A11', nameX: '|HSP0.220', portB: 'B11', nameY: '|HSP0.230' },
  { port: 'A12', nameX: '|HSP0.240', portB: 'B12', nameY: '|HSP0.250' },
  { port: 'A13', nameX: '|HSP0.260', portB: 'B13', nameY: '|HSP0.270' },
  { port: 'A14', nameX: '|HSP0.280', portB: 'B14', nameY: '|HSP0.290' },
  { port: 'A15', nameX: '|HSP0.300', portB: 'B15', nameY: '|HSP0.310' },
  { port: 'A16', nameX: '|HSP0.320', portB: 'B16', nameY: '|HSP0.330' },
  { port: 'A17', nameX: '|HSP0.340', portB: 'B17', nameY: '|HSP0.350' },
]

const RUNUP_LIMIT = [
  { port: 'A1', nameX: '|HL130.20',  portB: 'B1', nameY: '|HL130.30',  x: 0,   y: 0.03 },
  { port: 'A2', nameX: '|HL130.40',  portB: 'B2', nameY: '|HL130.50',  x: 16,  y: 0.07 },
  { port: 'A3', nameX: '|HL130.60',  portB: 'B3', nameY: '|HL130.70',  x: 32,  y: 0.11 },
  { port: 'A4', nameX: '|HL130.80',  portB: 'B4', nameY: '|HL130.90',  x: 48,  y: 0.26 },
  { port: 'A5', nameX: '|HL130.100', portB: 'B5', nameY: '|HL130.110', x: 60,  y: 0.3  },
  { port: 'A6', nameX: '|HL130.120', portB: 'B6', nameY: '|HL130.130', x: 200, y: 0.3  },
]
const F4_DATA = [
  { port: 'A1', nameX: '|F4.20',  portB: 'B1', nameY: '|F4.30',  x: 0,   y: 0.58 },
  { port: 'A2', nameX: '|F4.40',  portB: 'B2', nameY: '|F4.50',  x: 20,  y: 0.39 },
  { port: 'A3', nameX: '|F4.60',  portB: 'B3', nameY: '|F4.70',  x: 40,  y: 0.39 },
  { port: 'A4', nameX: '|F4.80',  portB: 'B4', nameY: '|F4.90',  x: 60,  y: 0.39 },
  { port: 'A5', nameX: '|F4.100', portB: 'B5', nameY: '|F4.110', x: 80,  y: 0.36 },
  { port: 'A6', nameX: '|F4.120', portB: 'B6', nameY: '|F4.130', x: 100, y: 0.36 },
]
const F6_DATA = [
  { port: 'A1', nameX: '|F6.20',  portB: 'B1', nameY: '|F6.30',  x: 300, y: 1    },
  { port: 'A2', nameX: '|F6.40',  portB: 'B2', nameY: '|F6.50',  x: 360, y: 0.82 },
  { port: 'A3', nameX: '|F6.60',  portB: 'B3', nameY: '|F6.70',  x: 380, y: 0.77 },
  { port: 'A4', nameX: '|F6.80',  portB: 'B4', nameY: '|F6.90',  x: 430, y: 0.69 },
  { port: 'A5', nameX: '|F6.100', portB: 'B5', nameY: '|F6.110', x: 500, y: 0.42 },
  { port: 'A6', nameX: '|F6.120', portB: 'B6', nameY: '|F6.130', x: 520, y: 0.2  },
  { port: 'A7', nameX: '|F6.140', portB: 'B7', nameY: '|F6.150', x: 530, y: 0    },
]
const PREMIX_KV = [
  { port: 'A1', nameX: '|HSG0.20',  portB: 'B1', nameY: '|HSG0.30',  flow: 0,       lfit: 0   },
  { port: 'A2', nameX: '|HSG0.40',  portB: 'B2', nameY: '|HSG0.50',  flow: 2.8,     lfit: 3   },
  { port: 'A3', nameX: '|HSG0.60',  portB: 'B3', nameY: '|HSG0.70',  flow: 5.597,   lfit: 10  },
  { port: 'A4', nameX: '|HSG0.80',  portB: 'B4', nameY: '|HSG0.90',  flow: 7.83,    lfit: 13  },
  { port: 'A5', nameX: '|HSG0.100', portB: 'B5', nameY: '|HSG0.110', flow: 111.323, lfit: 65  },
  { port: 'A6', nameX: '|HSG0.120', portB: 'B6', nameY: '|HSG0.130', flow: 139.886, lfit: 100 },
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

// Piecewise linear interpolation at x from sorted breakpoints
function pwInterp(pts, x) {
  if (!pts.length) return null
  if (x <= pts[0].x) return pts[0].y
  if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y
  for (let i = 0; i < pts.length - 1; i++) {
    if (x >= pts[i].x && x <= pts[i + 1].x) {
      const t = (x - pts[i].x) / (pts[i + 1].x - pts[i].x)
      return pts[i].y + t * (pts[i + 1].y - pts[i].y)
    }
  }
  return null
}

// Greedy optimal breakpoint insertion: find positions minimising piecewise RMSE vs expData
function optimalBreakpoints(expData, existing, addCount) {
  const exXs = expData.map(p => p.ymincal)
  const exYs = expData.map(p => p.lsvsw)
  const span  = Math.max(...exXs) - Math.min(...exXs) || 1
  const bw    = span * 0.4
  const yMin  = Math.min(...exYs), yMax = Math.max(...exYs)
  const tol   = (yMax - yMin) * 0.05
  const botPts = expData.filter(p => p.lsvsw <= yMin + tol)
  const topPts = expData.filter(p => p.lsvsw >= yMax - tol)
  const bottomEdge = botPts.length >= 2 ? Math.max(...botPts.map(p => p.ymincal)) : -Infinity
  const topEdge    = topPts.length >= 2 ? Math.min(...topPts.map(p => p.ymincal)) :  Infinity

  const fitY = x => {
    if (x <= bottomEdge) return yMin
    if (x >= topEdge)    return yMax
    const y = loessLinearAt(exXs, exYs, x, bw)
    return y !== null ? +y.toFixed(4) : null
  }

  const calcRMSE = pts => {
    let ss = 0, n = 0
    for (const { ymincal, lsvsw } of expData) {
      const y = pwInterp(pts, ymincal)
      if (y !== null) { ss += (y - lsvsw) ** 2; n++ }
    }
    return n > 0 ? Math.sqrt(ss / n) : Infinity
  }

  // Build starting set: existing points with y computed from LOESS (for RMSE calc)
  let current = existing
    .filter(p => p.x !== null)
    .map(p => ({ x: p.x, y: fitY(p.x) ?? p.y }))
    .filter(p => p.y !== null)
    .sort((a, b) => a.x - b.x)

  // Unique candidate x values from experimental data
  const usedX = new Set(current.map(p => p.x))
  const candidates = [...new Set(exXs)].filter(x => !usedX.has(x))

  for (let k = 0; k < addCount; k++) {
    let bestX = null, bestY = null, bestRMSE = Infinity
    for (const cx of candidates) {
      if (usedX.has(cx)) continue
      const cy = fitY(cx)
      if (cy === null) continue
      const trial = [...current, { x: cx, y: cy }].sort((a, b) => a.x - b.x)
      const rmse = calcRMSE(trial)
      if (rmse < bestRMSE) { bestRMSE = rmse; bestX = cx; bestY = cy }
    }
    if (bestX !== null) {
      current = [...current, { x: bestX, y: bestY }].sort((a, b) => a.x - b.x)
      usedX.add(bestX)
    }
  }
  return current
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

// "MBY10DG010|HL130.A01" → "HL130.A01";  "MSPG.F4L.01" → "MSPG.F4L.01"
const portOf = srel => srel ? (srel.includes('|') ? srel.split('|')[1] : srel) : '—'

function Sheet2Tab({ turbineId }) {
  const [startup,    setStartup]    = useState(() => STARTUP_PARAMS.map(p => ({ ...p, value: null })))
  const [baseload,   setBaseload]   = useState(() => BASELOAD_DATA.map(p => ({ ...p, value: null })))
  const [changeover, setChangeover] = useState(() => CHANGEOVER_DATA.map(p => ({ ...p, value: null })))
  const [vbTrip,     setVbTrip]     = useState('')
  const [pilotGas,   setPilotGas]   = useState(() => PILOT_GAS_DATA.map(p => ({ ...p, flow: null, lfit: null, srelX: null, srelY: null })))
  const [showSrel,   setShowSrel]   = useState(false)
  const [runupPts,   setRunupPts]   = useState(() => RUNUP_LIMIT.map(p => ({ ...p, x: null, y: null, srelX: null, srelY: null })))
  const [f4Pts,      setF4Pts]      = useState(() => F4_DATA.map(p => ({ ...p, x: null, y: null, srelX: null, srelY: null })))
  const [f6Pts,      setF6Pts]      = useState(() => F6_DATA.map(p => ({ ...p, x: null, y: null, srelX: null, srelY: null })))
  const [premixPts,  setPremixPts]  = useState(() => PREMIX_KV.map(p => ({ ...p, flow: null, lfit: null, srelX: null, srelY: null })))
  const [atk56,      setAtk56]      = useState({ a5: { srel: null, value: null }, b5: { srel: null, value: null }, a6: { srel: null, value: null }, b6: { srel: null, value: null } })
  const [loadNote,   setLoadNote]   = useState(null)

  useEffect(() => {
    if (!turbineId) return
    const fetch1 = search =>
      client.get('/parameters', { params: { turbine_id: turbineId, search, limit: 1 } })
        .then(r => parseFloat(r.data?.[0]?.value)).catch(() => NaN)

    const fetchFull = search =>
      client.get('/parameters', { params: { turbine_id: turbineId, search, limit: 1 } })
        .then(r => {
          const row = r.data?.[0]
          const kks = row?.kks || null; const name = row?.name || null
          return { value: parseFloat(row?.value), srel: (kks && kks !== name) ? kks : null }
        })
        .catch(() => ({ value: NaN, srel: null }))

    const loadScalar = async (arr, setter) => {
      const vals = await Promise.all(arr.map(r => fetch1(r.srel)))
      setter(arr.map((r, i) => Number.isFinite(vals[i]) ? { ...r, value: vals[i] } : r))
      return vals.filter(v => Number.isFinite(v)).length
    }

    const loadPoly = async (arr, setter, xField, yField) => {
      const [xVals, yVals] = await Promise.all([
        Promise.all(arr.map(r => fetch1(r.srelX))),
        Promise.all(arr.map(r => fetch1(r.srelY))),
      ])
      setter(arr.map((r, i) => ({
        ...r,
        [xField]: Number.isFinite(xVals[i]) ? xVals[i] : r[xField],
        [yField]: Number.isFinite(yVals[i]) ? yVals[i] : r[yField],
      })))
      return [...xVals, ...yVals].filter(v => Number.isFinite(v)).length
    }

    // Fetch SREL Parameter Key values for PLI poly points (Excel SREL import).
    // Names in DB: "{param_key}|A1", "{param_key}|B2" etc. — kks = param_key.
    const loadSrelKeys = async (tagSuffix, nRows) => {
      const { data } = await client.get('/parameters', {
        params: { turbine_id: turbineId, tag_search: tagSuffix, source: 'srel', limit: 200 }
      }).catch(() => ({ data: [] }))
      if (!data || data.length === 0) return null
      const reA = /\|[AX](\d+)$/, reB = /\|[BY](\d+)$/
      const aP = data.filter(p => reA.test(p.name)).sort((a, b) => +a.name.match(reA)[1] - +b.name.match(reA)[1])
      const bP = data.filter(p => reB.test(p.name)).sort((a, b) => +a.name.match(reB)[1] - +b.name.match(reB)[1])
      if (aP.length === 0 && bP.length === 0) return null
      return Array.from({ length: nRows }, (_, i) => ({ xSrel: aP[i]?.kks || null, ySrel: bP[i]?.kks || null }))
    }

    const loadRunup = async (allCurves) => {
      const { data } = await client.get('/parameters', {
        params: { turbine_id: turbineId, search: '|HL130.', limit: 100 }
      })
      const rows = data || []
      const findRow = suffix => {
        const row = rows.find(p => p.name.endsWith(suffix))
        const kks = row?.kks || null, name = row?.name || null
        return { value: parseFloat(row?.value), srel: (kks && kks !== name) ? kks : null }
      }
      const pts = RUNUP_LIMIT.map(r => {
        const rx = findRow(r.nameX), ry = findRow(r.nameY)
        return { ...r, x: Number.isFinite(rx.value) ? rx.value : null, y: Number.isFinite(ry.value) ? ry.value : null, srelX: rx.srel, srelY: ry.srel }
      })
      const found = pts.filter(p => p.x != null || p.y != null).length
      if (found === 0 && allCurves) {
        const curve = allCurves.find(c => (c.name || '').split('|').pop() === 'HL130')
        if (curve) {
          const { data: cpts } = await client.get(`/curves/${curve.id}/points`).catch(() => ({ data: [] }))
          if (cpts && cpts.length > 0) {
            const sorted = [...cpts].sort((a, b) => a.order - b.order)
            const sk = await loadSrelKeys('|HL130', RUNUP_LIMIT.length)
            setRunupPts(RUNUP_LIMIT.map((r, i) => ({ ...r, x: sorted[i]?.x ?? null, y: sorted[i]?.y ?? null, srelX: sk?.[i]?.xSrel ?? null, srelY: sk?.[i]?.ySrel ?? null })))
            return sorted.length
          }
        }
      }
      setRunupPts(pts)
      return found
    }

    const loadPremix = async (allCurves) => {
      const [{ data: hsgData }, { data: fegData }] = await Promise.all([
        client.get('/parameters', { params: { turbine_id: turbineId, search: '|HSG0.', limit: 100 } }),
        client.get('/parameters', { params: { turbine_id: turbineId, search: '|FEG12.10', limit: 5 } }),
      ])
      const rows = hsgData || []
      const findRow = suffix => {
        const row = rows.find(p => p.name.endsWith(suffix))
        const kks = row?.kks || null, name = row?.name || null
        return { value: parseFloat(row?.value), srel: (kks && kks !== name) ? kks : null }
      }
      const fegRow = (fegData || []).find(p => p.name.endsWith('|FEG12.10'))
      const fegSrel = fegRow ? (fegRow.kks !== fegRow.name ? fegRow.kks : null) : null
      const fegVal = fegRow ? parseFloat(fegRow.value) : null

      const pts = PREMIX_KV.map(r => {
        const rx = findRow(r.nameX), ry = findRow(r.nameY)
        let flow = Number.isFinite(rx.value) ? rx.value : null
        let srelX = rx.srel
        if (r.port === 'A6' && (flow == null || flow === 0) && Number.isFinite(fegVal)) {
          flow = fegVal
          srelX = fegSrel
        }
        return { ...r, flow, lfit: Number.isFinite(ry.value) ? ry.value : null, srelX, srelY: ry.srel }
      })
      const found = pts.filter(p => p.flow != null || p.lfit != null).length
      if (found === 0 && allCurves) {
        const popName = c => (c.name || '').split('|').pop()
        const curve = allCurves.find(c => popName(c) === 'HSG0')
          // EG240 fallback: turbine variants where premix gas function is named EG240
          || allCurves.find(c => popName(c) === 'EG240')
        if (curve) {
          const { data: cpts } = await client.get(`/curves/${curve.id}/points`).catch(() => ({ data: [] }))
          if (cpts && cpts.length > 0) {
            const sorted = [...cpts].sort((a, b) => a.order - b.order)
            const blockSuffix = curve.name.replace(/^\d+/, '')
            const sk = await loadSrelKeys(blockSuffix, PREMIX_KV.length)
            setPremixPts(PREMIX_KV.map((r, i) => ({ ...r, flow: sorted[i]?.x ?? null, lfit: sorted[i]?.y ?? null, srelX: sk?.[i]?.xSrel ?? null, srelY: sk?.[i]?.ySrel ?? null })))
            return sorted.length
          }
        }
      }
      setPremixPts(pts)
      return found
    }

    const loadF6 = async (allCurves) => {
      const { data } = await client.get('/parameters', {
        params: { turbine_id: turbineId, search: '|F6.', limit: 100 }
      })
      const rows = data || []
      const findRow = suffix => {
        const row = rows.find(p => p.name.endsWith(suffix))
        const kks = row?.kks || null, name = row?.name || null
        return { value: parseFloat(row?.value), srel: (kks && kks !== name) ? kks : null }
      }
      const pts = F6_DATA.map(r => {
        const rx = findRow(r.nameX), ry = findRow(r.nameY)
        return { ...r, x: Number.isFinite(rx.value) ? rx.value : null, y: Number.isFinite(ry.value) ? ry.value : null, srelX: rx.srel, srelY: ry.srel }
      })
      const found = pts.filter(p => p.x != null || p.y != null).length
      if (found === 0 && allCurves) {
        const popName = c => (c.name || '').split('|').pop()
        // F6H/F6L fallback: turbine variants with separate high/low F6 curves
        const curve = allCurves.find(c => popName(c) === 'F6')
          || allCurves.find(c => popName(c) === 'F6H')
          || allCurves.find(c => popName(c) === 'F6L')
        if (curve) {
          const { data: cpts } = await client.get(`/curves/${curve.id}/points`).catch(() => ({ data: [] }))
          if (cpts && cpts.length > 0) {
            const sorted = [...cpts].sort((a, b) => a.order - b.order)
            const blockSuffix = curve.name.replace(/^\d+/, '')
            const sk = await loadSrelKeys(blockSuffix, F6_DATA.length)
            setF6Pts(F6_DATA.map((r, i) => ({ ...r, x: sorted[i]?.x ?? null, y: sorted[i]?.y ?? null, srelX: sk?.[i]?.xSrel ?? null, srelY: sk?.[i]?.ySrel ?? null })))
            return sorted.length
          }
        }
      }
      setF6Pts(pts)
      return found
    }

    const loadF4 = async (allCurves) => {
      const { data } = await client.get('/parameters', {
        params: { turbine_id: turbineId, search: '|F4.', limit: 100 }
      })
      const rows = data || []
      const findRow = suffix => {
        const row = rows.find(p => p.name.endsWith(suffix))
        const kks = row?.kks || null, name = row?.name || null
        return { value: parseFloat(row?.value), srel: (kks && kks !== name) ? kks : null }
      }
      const pts = F4_DATA.map(r => {
        const rx = findRow(r.nameX), ry = findRow(r.nameY)
        return { ...r, x: Number.isFinite(rx.value) ? rx.value : null, y: Number.isFinite(ry.value) ? ry.value : null, srelX: rx.srel, srelY: ry.srel }
      })
      const found = pts.filter(p => p.x != null || p.y != null).length
      if (found === 0 && allCurves) {
        // JAR curves fallback
        const curve = allCurves.find(c => (c.name || '').split('|').pop() === 'F4')
        if (curve) {
          const { data: cpts } = await client.get(`/curves/${curve.id}/points`).catch(() => ({ data: [] }))
          if (cpts && cpts.length > 0) {
            const sorted = [...cpts].sort((a, b) => a.order - b.order)
            const sk = await loadSrelKeys('|F4', F4_DATA.length)
            setF4Pts(F4_DATA.map((r, i) => ({ ...r, x: sorted[i]?.x ?? null, y: sorted[i]?.y ?? null, srelX: sk?.[i]?.xSrel ?? null, srelY: sk?.[i]?.ySrel ?? null })))
            return sorted.length
          }
        }
        // SREL params fallback: when srel_parser didn't create a F4 curve (e.g. A1 without B1)
        // Match by port NUMBER (A1↔B1, A2↔B2, ...) to avoid index drift when B1 is missing
        const { data: srelF4 } = await client.get('/parameters', {
          params: { turbine_id: turbineId, tag_search: '|F4', source: 'srel', limit: 200 }
        }).catch(() => ({ data: [] }))
        if (srelF4 && srelF4.length > 0) {
          const reA = /\|[AX](\d+)$/, reB = /\|[BY](\d+)$/
          const aMap = Object.fromEntries(srelF4.filter(p => reA.test(p.name)).map(p => [+p.name.match(reA)[1], p]))
          const bMap = Object.fromEntries(srelF4.filter(p => reB.test(p.name)).map(p => [+p.name.match(reB)[1], p]))
          if (Object.keys(aMap).length > 0 || Object.keys(bMap).length > 0) {
            setF4Pts(F4_DATA.map((r, i) => {
              const pn = i + 1, aP = aMap[pn], bP = bMap[pn]
              return {
                ...r,
                x:     aP?.value != null ? parseFloat(aP.value) : null,
                y:     bP?.value != null ? parseFloat(bP.value) : null,
                srelX: aP?.kks || null,
                srelY: bP?.kks || null,
              }
            }))
            return Object.keys(aMap).length + Object.keys(bMap).length
          }
        }
      }
      setF4Pts(pts)
      return found
    }

    const loadAtkkor = async (allCurves) => {
      // Always use curves — avoids ATKKOR.100 vs ATKKOR.1000 ambiguity in JAR params
      // Prefer MBP03 curve; fall back to any ATKKOR curve
      const pop = c => (c.name || '').split('|').pop()
      const curve = (allCurves || []).find(c => pop(c) === 'ATKKOR' && c.name.includes('MBP03'))
        || (allCurves || []).find(c => pop(c) === 'ATKKOR')
      if (!curve) return 0
      const { data: cpts } = await client.get(`/curves/${curve.id}/points`).catch(() => ({ data: [] }))
      if (!cpts || cpts.length < 6) return 0
      const sorted = [...cpts].sort((a, b) => a.order - b.order)
      const blockSuffix = curve.name.replace(/^\d+/, '')  // strip unit prefix "12" or "22"
      const sk = await loadSrelKeys(blockSuffix, 10)
      setAtk56({
        a5: { srel: sk?.[4]?.xSrel || null, value: sorted[4]?.x ?? null },
        b5: { srel: sk?.[4]?.ySrel || null, value: sorted[4]?.y ?? null },
        a6: { srel: sk?.[5]?.xSrel || null, value: sorted[5]?.x ?? null },
        b6: { srel: sk?.[5]?.ySrel || null, value: sorted[5]?.y ?? null },
      })
      return 2
    }

    const loadHsp0 = async (allCurves) => {
      const { data } = await client.get('/parameters', {
        params: { turbine_id: turbineId, search: '|HSP0.', limit: 100 }
      })
      const rows = data || []
      const findRow = suffix => {
        const row = rows.find(p => p.name.endsWith(suffix))
        const kks = row?.kks || null, name = row?.name || null
        return { value: parseFloat(row?.value), srel: (kks && kks !== name) ? kks : null }
      }
      let pts = PILOT_GAS_DATA.map(r => {
        const rx = findRow(r.nameX), ry = findRow(r.nameY)
        return { ...r, flow: Number.isFinite(rx.value) ? rx.value : null, lfit: Number.isFinite(ry.value) ? ry.value : null, srelX: rx.srel, srelY: ry.srel }
      })
      // Trim trailing empty PLI slots (flow=0 && lfit=0 beyond real data, keeping A1)
      let end = pts.length
      while (end > 1 && pts[end - 1]?.flow === 0 && pts[end - 1]?.lfit === 0) end--
      if (end < pts.length) pts = pts.slice(0, end)
      const found = pts.filter(p => p.flow != null || p.lfit != null).length
      if (found === 0 && allCurves) {
        const popName = c => (c.name || '').split('|').pop()
        // EG240 fallback: for turbines where pilot gas staging is EG240 (on a different diagram).
        // Use the SECOND EG240 curve (Premix uses the first) when two exist; else same curve.
        const eg240all = allCurves.filter(c => popName(c) === 'EG240')
        const curve = allCurves.find(c => popName(c) === 'HSP0')
          || (eg240all.length > 1 ? eg240all[1] : eg240all[0])
        if (curve) {
          const { data: cpts } = await client.get(`/curves/${curve.id}/points`).catch(() => ({ data: [] }))
          if (cpts && cpts.length > 0) {
            const sorted = [...cpts].sort((a, b) => a.order - b.order)
            const blockSuffix = curve.name.replace(/^\d+/, '')
            const sk = await loadSrelKeys(blockSuffix, PILOT_GAS_DATA.length)
            setPilotGas(PILOT_GAS_DATA.map((r, i) => ({ ...r, flow: sorted[i]?.x ?? null, lfit: sorted[i]?.y ?? null, srelX: sk?.[i]?.xSrel ?? null, srelY: sk?.[i]?.ySrel ?? null })))
            return sorted.length
          }
        }
      }
      setPilotGas(pts)
      return found
    }

    const loadAll = async () => {
      const curvesRes = await client.get('/curves', { params: { turbine_id: turbineId } }).catch(() => ({ data: [] }))
      const allCurves = curvesRes.data || []
      const counts = await Promise.all([
        loadScalar(STARTUP_PARAMS,  setStartup),
        loadScalar(BASELOAD_DATA,   setBaseload),
        loadScalar(CHANGEOVER_DATA, setChangeover),
        loadRunup(allCurves),
        loadF4(allCurves),
        loadF6(allCurves),
        loadPremix(allCurves),
        loadAtkkor(allCurves),
        loadHsp0(allCurves),
      ])
      const total = counts.reduce((a, b) => a + b, 0)
      if (total > 0) setLoadNote(`${total} values loaded from project`)
    }
    loadAll()
  }, [turbineId])

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
      {loadNote && <div style={{ fontSize: '0.68rem', color: '#5C3D99', marginBottom: '0.4rem' }}>✓ {loadNote}</div>}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <ParamTable rows={startup}  setter={setStartup}  title="Start-up Settings" />
        <ParamTable rows={baseload} setter={setBaseload} title="Baseload Settings" />

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

        {/* ATKKOR */}
        <div style={{ flexShrink: 0 }}>
          <div style={S.tableTitle}>ATKKOR (MBP03DU002)</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Port A</th>
              {showSrel && <th style={S.thSrel}>SREL</th>}
              <th style={{ ...S.th, textAlign: 'right' }}>ATK [°C]</th>
              <th style={{ ...S.th, borderLeft: '2px solid #2A1A4A' }}>Port B</th>
              {showSrel && <th style={S.thSrel}>SREL</th>}
              <th style={{ ...S.th, textAlign: 'right' }}>Flow [kg/s]</th>
            </tr></thead>
            <tbody>
              {[{ ptA: 'A5', ptB: 'B5', a: atk56.a5, b: atk56.b5 }, { ptA: 'A6', ptB: 'B6', a: atk56.a6, b: atk56.b6 }].map((row, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={S.tdPort}>{row.ptA}</td>
                  {showSrel && <td style={S.tdSrel}>{row.a.srel || '—'}</td>}
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{row.a.value ?? '—'}</td>
                  <td style={{ ...S.tdPort, borderLeft: '2px solid #D0C4E8' }}>{row.ptB}</td>
                  {showSrel && <td style={S.tdSrel}>{row.b.srel || '—'}</td>}
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{row.b.value ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Polynomial curves header + SREL toggle */}
      <div className="no-print" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5C3D99' }}>Polynomial Curves</span>
        <button
          onClick={() => setShowSrel(v => !v)}
          style={{ fontSize: '0.68rem', padding: '0.06rem 0.42rem', borderRadius: 3, border: '1px solid #9888B8', background: showSrel ? '#EDE3F8' : 'transparent', color: '#6A50A0', cursor: 'pointer', fontFamily: 'monospace', lineHeight: 1.5 }}
        >{showSrel ? '[ − SREL ]' : '[ + SREL ]'}</button>
      </div>

      {/* Grouped: table + chart for each polynomial */}
      <div className="sgt-poly-group" style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* HL130 */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...S.tableTitle, lineHeight: 1.25 }}>
            <div>HL130 Run-Up Limitation</div>
            <div style={{ fontWeight: 400, fontSize: '0.64rem', fontFamily: 'monospace', color: '#9888B8', marginTop: 1 }}>MBY10DG010 · HL130</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginTop: 0 }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Port A</th>
                {showSrel && <th style={S.thSrel}>SREL</th>}
                <th style={{ ...S.th, textAlign: 'right' }}>Speed [s⁻¹]</th>
                <th style={{ ...S.th, borderLeft: '2px solid #2A1A4A' }}>Port B</th>
                {showSrel && <th style={S.thSrel}>SREL</th>}
                <th style={{ ...S.th, textAlign: 'right' }}>Setpoint [p.u.]</th>
              </tr></thead>
              <tbody>{runupPts.map((p, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={S.tdPort}>{p.port}</td>
                  {showSrel && <td style={S.tdSrel}>{p.srelX || '—'}</td>}
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.x ?? '—'}</td>
                  <td style={{ ...S.tdPort, borderLeft: '2px solid #D0C4E8' }}>{p.portB}</td>
                  {showSrel && <td style={S.tdSrel}>{p.srelY || '—'}</td>}
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.y ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
            <Plot data={[{
              x: runupPts.map(p => p.x), y: runupPts.map(p => p.y),
              type: 'scatter', mode: 'lines+markers',
              line: { color: '#5C3D99', width: 2 }, marker: { size: 5 }, name: 'Setpoint [%]',
            }]} layout={PL('Speed [s⁻¹]', 'Setpoint [p.u.]', { xaxis: { range: [0, 70] } })} config={PC} style={{ width: 300, height: 300 }} />
          </div>
        </div>

        {/* F4 */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...S.tableTitle, lineHeight: 1.25 }}>
            <div>Pilot Gas F4 — IGV → Flow</div>
            <div style={{ fontWeight: 400, fontSize: '0.64rem', fontFamily: 'monospace', color: '#9888B8', marginTop: 1 }}>MBP15DG010 · MSPG.F4</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Port A</th>
                {showSrel && <th style={S.thSrel}>SREL</th>}
                <th style={{ ...S.th, textAlign: 'right' }}>IGV [%]</th>
                <th style={{ ...S.th, borderLeft: '2px solid #2A1A4A' }}>Port B</th>
                {showSrel && <th style={S.thSrel}>SREL</th>}
                <th style={{ ...S.th, textAlign: 'right' }}>Flow [kg/s]</th>
              </tr></thead>
              <tbody>{f4Pts.map((p, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={S.tdPort}>{p.port}</td>
                  {showSrel && <td style={S.tdSrel}>{p.srelX || '—'}</td>}
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.x ?? '—'}</td>
                  <td style={{ ...S.tdPort, borderLeft: '2px solid #D0C4E8' }}>{p.portB}</td>
                  {showSrel && <td style={S.tdSrel}>{p.srelY || '—'}</td>}
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.y != null ? p.y.toFixed(3) : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
            <Plot data={[{
              x: f4Pts.map(p => p.x), y: f4Pts.map(p => p.y),
              type: 'scatter', mode: 'lines+markers',
              line: { color: '#5C3D99', width: 2 }, marker: { size: 5 }, name: 'F4 Flow [kg/s]',
            }]} layout={PL('IGV [%]', 'Flow [kg/s]')} config={PC} style={{ width: 300, height: 300 }} />
          </div>
        </div>

        {/* F6 */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...S.tableTitle, lineHeight: 1.25 }}>
            <div>Pilot Gas F6 — ATK → Flow</div>
            <div style={{ fontWeight: 400, fontSize: '0.64rem', fontFamily: 'monospace', color: '#9888B8', marginTop: 1 }}>MBP15DG010 · MSPG.F6</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Port A</th>
                {showSrel && <th style={S.thSrel}>SREL</th>}
                <th style={{ ...S.th, textAlign: 'right' }}>ATK [°C]</th>
                <th style={{ ...S.th, borderLeft: '2px solid #2A1A4A' }}>Port B</th>
                {showSrel && <th style={S.thSrel}>SREL</th>}
                <th style={{ ...S.th, textAlign: 'right' }}>Flow [kg/s]</th>
              </tr></thead>
              <tbody>{f6Pts.map((p, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={S.tdPort}>{p.port}</td>
                  {showSrel && <td style={S.tdSrel}>{p.srelX || '—'}</td>}
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.x ?? '—'}</td>
                  <td style={{ ...S.tdPort, borderLeft: '2px solid #D0C4E8' }}>{p.portB}</td>
                  {showSrel && <td style={S.tdSrel}>{p.srelY || '—'}</td>}
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.y != null ? p.y.toFixed(3) : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
            <Plot data={[{
              x: f6Pts.map(p => p.x), y: f6Pts.map(p => p.y),
              type: 'scatter', mode: 'lines+markers',
              line: { color: '#E06B00', width: 2 }, marker: { size: 5 }, name: 'F6 Flow [kg/s]',
            }]} layout={PL('ATK [°C]', 'Flow [kg/s]')} config={PC} style={{ width: 300, height: 300 }} />
          </div>
        </div>

        {/* Premix KV */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...S.tableTitle, lineHeight: 1.25 }}>
            <div>HSG0 Premix NG CV KV</div>
            <div style={{ fontWeight: 400, fontSize: '0.64rem', fontFamily: 'monospace', color: '#9888B8', marginTop: 1 }}>MBP15DG040 · HSG0</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <table style={S.table}>
              <thead><tr>
                <th style={S.th}>Port A</th>
                {showSrel && <th style={S.thSrel}>SREL</th>}
                <th style={{ ...S.th, textAlign: 'right' }}>Flow [m³/h]</th>
                <th style={{ ...S.th, borderLeft: '2px solid #2A1A4A' }}>Port B</th>
                {showSrel && <th style={S.thSrel}>SREL</th>}
                <th style={{ ...S.th, textAlign: 'right' }}>Lfit [%]</th>
              </tr></thead>
              <tbody>{premixPts.map((p, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={S.tdPort}>{p.port}</td>
                  {showSrel && <td style={S.tdSrel}>{p.srelX || '—'}</td>}
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.flow ?? '—'}</td>
                  <td style={{ ...S.tdPort, borderLeft: '2px solid #D0C4E8' }}>{p.portB}</td>
                  {showSrel && <td style={S.tdSrel}>{p.srelY || '—'}</td>}
                  <td style={{ ...S.tdNum, fontWeight: 700 }}>{p.lfit ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
            <Plot data={[{
              x: premixPts.map(p => p.lfit), y: premixPts.map(p => p.flow),
              type: 'scatter', mode: 'lines+markers',
              line: { color: '#4caf7d', width: 2 }, marker: { size: 5 }, name: 'Flow [m³/h]',
            }]} layout={PL('Lfit [%]', 'Flow [m³/h]')} config={PC} style={{ width: 300, height: 300 }} />
          </div>
        </div>

        {/* F4+F6 by OTC */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...S.tableTitle, lineHeight: 1.25 }}>
            <div>F4+F6 by OTC</div>
            <div style={{ fontWeight: 400, fontSize: '0.64rem', fontFamily: 'monospace', color: '#9888B8', marginTop: 1 }}>← F4 + F6 (derived)</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div>
              <table style={S.table}>
                <thead><tr>
                  <th style={{ ...S.th, textAlign: 'right' }}>F4 [kg/s]</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>ATK [°C]</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>F6 [kg/s]</th>
                  <th style={{ ...S.th, textAlign: 'right', background: '#3D2270' }}>F4+F6 [kg/s]</th>
                </tr></thead>
                <tbody>{f4Pts.map((p4, i) => {
                  const p6 = f6Pts[i] ?? f6Pts[f6Pts.length - 1]
                  const sum = p4.y != null && p6.y != null ? +(p4.y + p6.y).toFixed(3) : null
                  return (
                    <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                      <td style={S.tdNum}>{p4.y != null ? p4.y.toFixed(3) : '—'}</td>
                      <td style={S.tdNum}>{p6.x ?? '—'}</td>
                      <td style={S.tdNum}>{p6.y != null ? p6.y.toFixed(3) : '—'}</td>
                      <td style={{ ...S.tdNum, fontWeight: 700, color: '#3D2270', background: '#F0EDFA' }}>{sum ?? '—'}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
              <div style={{ ...S.note, marginTop: '0.25rem' }}>F4+F6 = сумма по точкам (ось X — ATK [°C])</div>
            </div>
            <Plot
              data={[{
                x: f4Pts.map((_, i) => (f6Pts[i] ?? f6Pts[f6Pts.length - 1]).x),
                y: f4Pts.map((p4, i) => { const p6 = f6Pts[i] ?? f6Pts[f6Pts.length - 1]; return p4.y != null && p6.y != null ? +(p4.y + p6.y).toFixed(3) : null }),
                type: 'scatter', mode: 'lines+markers',
                line: { color: '#5C3D99', width: 2.5 }, marker: { size: 7, color: '#5C3D99' },
                name: 'F4+F6 [kg/s]',
              }]}
              layout={{ ...PL('ATK [°C]', 'Flow [kg/s]'), showlegend: false }}
              config={PC}
              style={{ width: 420, height: 360 }}
            />
          </div>
        </div>
      </div>

      {/* Pilot Gas Settings */}
      <div className="sgt-section-hdr sgt-pilot-gas-hdr" style={S.sectionHdr}>Pilot Gas Settings — MBP15DG010|HSP0</div>
      <div className="sgt-pilot-gas" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          <div style={S.tableTitle}>HSP0 Characteristic (editable)</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Port A</th>
              {showSrel && <th style={S.thSrel}>SREL</th>}
              <th style={{ ...S.th, textAlign: 'right' }}>Flow [m³/h]</th>
              <th style={{ ...S.th, borderLeft: '2px solid #2A1A4A' }}>Port B</th>
              {showSrel && <th style={S.thSrel}>SREL</th>}
              <th style={{ ...S.th, textAlign: 'right' }}>Lfit [%]</th>
            </tr></thead>
            <tbody>{pilotGas.map((p, i) => (
              <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                <td style={S.tdPort}>{p.port}</td>
                {showSrel && <td style={S.tdSrel}>{p.srelX || '—'}</td>}
                <td style={S.tdNum}><EditCell value={p.flow} onChange={v => updPG(i, 'flow', v)} dec={3} /></td>
                <td style={{ ...S.tdPort, borderLeft: '2px solid #D0C4E8' }}>{p.portB}</td>
                {showSrel && <td style={S.tdSrel}>{p.srelY || '—'}</td>}
                <td style={S.tdNum}><EditCell value={p.lfit} onChange={v => updPG(i, 'lfit', v)} dec={1} /></td>
              </tr>
            ))}</tbody>
          </table>
          <div style={S.note}>MBP15DG010|HSP0 — нормированный входной сигнал → уставка клапана пилотного газа [%]</div>
        </div>

        <div style={{ flex: '1 1 300px' }}>
          <div style={S.chartTitle}>HSP0 NG KV — Flow vs Lfit Characteristic</div>
          <Plot
            data={[{
              x: pilotGas.map(p => p.lfit),
              y: pilotGas.map(p => p.flow),
              type: 'scatter', mode: 'lines+markers',
              line: { color: '#5C3D99', width: 2 },
              marker: { size: 6, color: '#5C3D99' },
              name: 'Flow [m³/h]',
            }]}
            layout={PL('Lfit [%]', 'Flow [m³/h]')}
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
  const [showSrel,  setShowSrel]  = useState(false)
  const [lsvcalOld, setLsvcalOld] = useState(() => Array(6).fill(null).map(() => ({ x: null, y: null })))
  const [lsvcalNew, setLsvcalNew] = useState(() => Array(6).fill(null).map(() => ({ x: null, y: null })))
  const [lsvcalSrels, setLsvcalSrels] = useState([]) // [{xSrel, ySrel}, ...] per point
  const [newSize,   setNewSize]   = useState(6)
  const [expData,   setExpData]   = useState(null)
  const [fitDone,   setFitDone]   = useState(false)
  const [csvError,  setCsvError]  = useState('')
  const [dbLoading, setDbLoading] = useState(false)
  const [editMode,  setEditMode]  = useState(false)
  const [plotEl,    setPlotEl]    = useState(null)
  const [foundPortName, setFoundPortName] = useState(null)  // 'LSVCAL' or 'V300' (null = not found yet)
  const [foundCurveName, setFoundCurveName] = useState(null) // full curve name e.g. '12MBP15DG010|LSVCAL'
  const fileRef  = useRef()
  const dragRef  = useRef(null)
  const hoverRef = useRef(null)

  const changeNewSize = (n) => {
    setNewSize(n)
    if (n <= lsvcalNew.length) {
      setLsvcalNew(lsvcalNew.slice(0, n))
      setFitDone(false)
      return
    }
    const add = n - lsvcalNew.length
    if (expData && expData.length > 0) {
      const result = optimalBreakpoints(expData, lsvcalNew, add)
      setLsvcalNew(result)
      setFitDone(result.every(p => p.y !== null))
    } else {
      // Fallback: midpoints of largest gaps
      const withX = lsvcalNew.filter(p => p.x !== null).sort((a, b) => a.x - b.x)
      if (withX.length < 2) {
        setLsvcalNew([...lsvcalNew, ...Array(add).fill(null).map(() => ({ x: null, y: null }))])
      } else {
        const gaps = []
        for (let i = 0; i < withX.length - 1; i++)
          gaps.push({ gap: withX[i+1].x - withX[i].x, mid: +((withX[i].x + withX[i+1].x) / 2).toFixed(4) })
        const newX = gaps.sort((a, b) => b.gap - a.gap).slice(0, add).map(g => g.mid)
        const combined = [...lsvcalNew, ...newX.map(x => ({ x, y: null }))].sort((a, b) => (a.x ?? Infinity) - (b.x ?? Infinity))
        setLsvcalNew(combined)
      }
      setFitDone(false)
    }
  }

  useEffect(() => {
    if (!turbineId) return
    setDbLoading(true)
    const run = async () => {
      const { data: allCurves } = await client.get('/curves', { params: { turbine_id: turbineId } })
      const foundCurve = (allCurves || []).find(c => {
        const pn = (c.name || '').split('|').pop()
        return pn === 'LSVCAL' || pn === 'V300'
      })
      if (!foundCurve) return
      const cName = foundCurve.name
      setFoundPortName(cName.split('|').pop())
      setFoundCurveName(cName)

      const { data: cpts } = await client.get(`/curves/${foundCurve.id}/points`)
      const pts = (cpts || []).sort((a, b) => a.order - b.order)
      if (pts.length >= 2) {
        setLsvcalOld(pts.map(p => ({ x: p.x, y: p.y })))
        setLsvcalNew(pts.map(p => ({ x: p.x, y: null })))
        setNewSize(pts.length)
      }

      // Load SREL keys per point
      // Try JAR format first: {cName}.30, .40, .50... (Port-ID based)
      const { data: jarP } = await client.get('/parameters', {
        params: { turbine_id: turbineId, search: cName + '.', limit: 200 }
      }).catch(() => ({ data: [] }))

      if (jarP && jarP.length > 0) {
        const srels = pts.map((_, i) => {
          const xId = 30 + i * 20, yId = 40 + i * 20
          const xP = jarP.find(p => p.name === `${cName}.${xId}`)
          const yP = jarP.find(p => p.name === `${cName}.${yId}`)
          const srel = p => p ? (p.kks && p.kks !== p.name ? p.kks : p.name.split('|').pop()) : null
          return { xSrel: srel(xP), ySrel: srel(yP) }
        })
        setLsvcalSrels(srels)
      } else {
        // SREL format: {cName}|X1, |X2... and |Y1, |Y2...
        const [{ data: srelX }, { data: srelY }] = await Promise.all([
          client.get('/parameters', { params: { turbine_id: turbineId, search: cName + '|X', limit: 100 } }).catch(() => ({ data: [] })),
          client.get('/parameters', { params: { turbine_id: turbineId, search: cName + '|Y', limit: 100 } }).catch(() => ({ data: [] })),
        ])
        const allSP = [...(srelX || []), ...(srelY || [])]
        if (allSP.length > 0) {
          const srels = pts.map((_, i) => {
            const xP = allSP.find(p => p.name.endsWith(`|X${i + 1}`))
            const yP = allSP.find(p => p.name.endsWith(`|Y${i + 1}`))
            const srel = p => p ? (p.kks && p.kks !== p.name ? p.kks : p.name.split('|').pop()) : null
            return { xSrel: srel(xP), ySrel: srel(yP) }
          })
          setLsvcalSrels(srels)
        }
      }
    }
    run().catch(() => {}).finally(() => setDbLoading(false))
  }, [turbineId])

  const updNew = (i, field, v) => setLsvcalNew(pts => pts.map((r, j) => j === i ? { ...r, [field]: v } : r))

  // drag-to-edit NEW curve points
  useEffect(() => {
    if (!plotEl) return
    const onDown = (e) => {
      if (!hoverRef.current) return
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = { ...hoverRef.current, startY: e.clientY }
    }
    const onMove = (e) => {
      if (!dragRef.current) return
      const layout = plotEl._fullLayout
      if (!layout?.yaxis) return
      const rect = plotEl.getBoundingClientRect()
      const dataY = layout.yaxis.p2l(e.clientY - rect.top - layout.margin.t)
      if (!Number.isFinite(dataY)) return
      const clamped = +Math.max(0.3, Math.min(1.6, dataY)).toFixed(4)
      const idx = dragRef.current.lsvcalIdx
      setLsvcalNew(pts => pts.map((p, j) => j === idx ? { ...p, y: clamped } : p))
      setFitDone(false)
    }
    const onUp = () => { dragRef.current = null }
    plotEl.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      plotEl.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [plotEl])

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
      <div style={S.sectionHdr}>IGV Precontrol — LSVCAL/V300 Polynomial</div>
      <div className="no-print" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => setShowSrel(v => !v)}
          style={{ fontSize: '0.68rem', padding: '0.06rem 0.42rem', borderRadius: 3, border: '1px solid #9888B8', background: showSrel ? '#EDE3F8' : 'transparent', color: '#6A50A0', cursor: 'pointer', fontFamily: 'monospace', lineHeight: 1.5 }}
        >{showSrel ? '[ − SREL ]' : '[ + SREL ]'}</button>
        {!dbLoading && foundCurveName && <span style={{ fontSize: '0.68rem', color: '#9888B8', fontFamily: 'monospace' }}>{foundCurveName}</span>}
      </div>
      <div className="sgt-lsvcal-tables" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* OLD (from DB) */}
        <div style={{ flexShrink: 0 }}>
          <div style={S.tableTitle}>
            {foundPortName ? `${foundPortName} current` : 'current'}
            {dbLoading && <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#9888B8', marginLeft: 6 }}>loading…</span>}
            {!dbLoading && !turbineId && <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#9888B8', marginLeft: 6 }}>select turbine</span>}
            {!dbLoading && turbineId && !foundPortName && <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#cc6600', marginLeft: 6 }}>not in DB</span>}
          </div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>#</th>
              <th style={{ ...S.th, textAlign: 'right' }}>YMINCAL</th>
              {showSrel && <th style={S.thSrel}>SREL</th>}
              <th style={{ ...S.th, textAlign: 'right' }}>LSVSW</th>
              {showSrel && <th style={S.thSrel}>SREL</th>}
            </tr></thead>
            <tbody>{lsvcalOld.map((p, i) => {
              const sr = lsvcalSrels[i] || {}
              return (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={{ ...S.td, color: '#9888B8' }}>{i + 1}</td>
                  <td style={S.tdNum}>{p.x !== null ? p.x.toFixed(3) : <span style={{ color: '#B8A8DA' }}>—</span>}</td>
                  {showSrel && <td style={S.tdSrel}>{sr.xSrel || '—'}</td>}
                  <td style={S.tdNum}>{p.y !== null ? p.y.toFixed(3) : <span style={{ color: '#B8A8DA' }}>—</span>}</td>
                  {showSrel && <td style={S.tdSrel}>{sr.ySrel || '—'}</td>}
                </tr>
              )
            })}</tbody>
          </table>
        </div>

        {/* NEW (editable) */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ ...S.tableTitle, background: '#E8F5E9', color: '#1a4d1a', borderBottom: '1px solid #4caf7d44', display: 'flex', alignItems: 'center', gap: 6 }}>
            {foundPortName ? `${foundPortName} new` : 'new'}
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
              <div className="sgt-csv-scroll" style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #D0C4E8', borderRadius: 4, display: 'inline-block' }}>
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
      <div className="sgt-lsvcal-wrap" style={{ marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <div style={S.chartTitle}>IGV PRECONTRL (LSVCAL/V300)</div>
          {validNew.length >= 1 && (
            <button
              onClick={() => { setEditMode(m => !m); hoverRef.current = null; dragRef.current = null; if (plotEl) plotEl.style.cursor = '' }}
              style={{
                fontSize: '0.73rem', padding: '2px 10px', borderRadius: 4,
                border: `1px solid ${editMode ? '#CC2222' : '#9888B8'}`,
                background: editMode ? '#CC2222' : 'transparent',
                color: editMode ? '#fff' : '#6A50A0',
                cursor: 'pointer', fontWeight: 600, flexShrink: 0,
              }}
            >{editMode ? '✎ Drag mode ON — click off to zoom' : '✎ Drag NEW points'}</button>
          )}
          {editMode && <span style={{ fontSize: '0.68rem', color: '#CC2222' }}>drag markers up/down to adjust LSVSW</span>}
        </div>
        <Plot
          data={[
            ...(expData ? [{ x: expData.map(p => p.ymincal), y: expData.map(p => p.lsvsw), type: 'scatter', mode: 'lines+markers', line: { color: '#E06B00', width: 1 }, marker: { color: '#E06B00', size: 4, opacity: 0.75 }, name: 'Experimental' }] : []),
            ...(validOld.length >= 2 ? [{ x: validOld.map(p => p.x), y: validOld.map(p => p.y), type: 'scatter', mode: 'lines+markers', line: { color: '#5B8BC8', width: 2 }, marker: { color: '#5B8BC8', size: 7, symbol: 'square' }, name: 'LSVCAL/V300 current' }] : []),
            ...(validNew.length >= 2 ? [{ x: validNew.map(p => p.x), y: validNew.map(p => p.y), type: 'scatter', mode: 'lines+markers', line: { color: '#CC2222', width: 2 }, marker: { color: '#CC2222', size: editMode ? 10 : 6 }, name: 'LSVCAL/V300 new' }] : []),
          ]}
          layout={{ ...PL('YMINCAL', 'LSVSW'), dragmode: editMode ? false : 'zoom', uirevision: 'lsvcal' }}
          config={PC}
          onInitialized={(_, el) => setPlotEl(el)}
          onHover={(data) => {
            if (!editMode || !data.points?.length) { hoverRef.current = null; return }
            const pt = data.points[0]
            const newCurveNum = (expData ? 1 : 0) + (validOld.length >= 2 ? 1 : 0)
            if (pt.curveNumber !== newCurveNum) { hoverRef.current = null; if (plotEl) plotEl.style.cursor = ''; return }
            const lsvcalIdx = lsvcalNew.indexOf(validNew[pt.pointIndex])
            if (lsvcalIdx < 0) { hoverRef.current = null; return }
            hoverRef.current = { lsvcalIdx, ptIdx: pt.pointIndex }
            if (plotEl) plotEl.style.cursor = 'ns-resize'
          }}
          onUnhover={() => { if (!dragRef.current) { hoverRef.current = null; if (plotEl) plotEl.style.cursor = '' } }}
          style={{ width: 'calc(100% + 2.5rem)', marginLeft: '-1.25rem', height: 'calc(100vh - 160px)', minHeight: 650 }}
        />
      </div>
    </div>
  )
}

// ── Tab 3: YMIN ───────────────────────────────────────────────────────────────

function YminTab({ turbineId }) {
  const showSrel = true
  const [hapOld, setHapOld] = useState(null)
  const [hllOld, setHllOld] = useState(null)
  const [papOld, setPapOld] = useState(null)
  const [hapSrel,   setHapSrel]   = useState(null)
  const [hllSrel,   setHllSrel]   = useState(null)
  const [papSrel,   setPapSrel]   = useState(null)
  const [caldnSrel, setCaldnSrel] = useState(null)
  const [hap, setHap] = useState(null)
  const [hll, setHll] = useState(null)
  const [pap, setPap] = useState(null)
  const [expData, setExpData] = useState(null)
  const [csvError, setCsvError] = useState('')
  const fileRef = useRef()

  useEffect(() => {
    // Reset on turbine change so stale values don't persist
    setHapOld(null); setHllOld(null); setPapOld(null)
    setHapSrel(null); setHllSrel(null); setPapSrel(null); setCaldnSrel(null)
    if (!turbineId) return
    const loadAll = async () => {
      // 5 parallel calls: SREL (all DU050C|* ports) + JAR per-port targeted searches
      const safeGet = (...a) => client.get(...a).catch(() => ({ data: [] }))
      const [{ data: srelP }, { data: jHap }, { data: jHll }, { data: jPap }, { data: jCaldn }] = await Promise.all([
        safeGet('/parameters', { params: { turbine_id: turbineId, tag_search: 'MBY10DU050C|', source: 'srel', limit: 50 } }),
        safeGet('/parameters', { params: { turbine_id: turbineId, search: 'DU050C|HAP.', limit: 5 } }),
        safeGet('/parameters', { params: { turbine_id: turbineId, search: 'DU050C|HLL.', limit: 5 } }),
        safeGet('/parameters', { params: { turbine_id: turbineId, search: 'DU050C|PAP.', limit: 5 } }),
        safeGet('/parameters', { params: { turbine_id: turbineId, search: 'DU050C|CALDN.', limit: 5 } }),
      ])

      const pf = p => { const n = parseFloat(p?.value); return Number.isFinite(n) ? n : null }
      const kksOf = p => (p?.kks && p.kks !== p?.name) ? p.kks : null

      // SREL: Tag-Name ends with |portName
      const findSrel = (portName) => (srelP || []).find(p => {
        try {
          const rd = typeof p.raw_data === 'string' ? JSON.parse(p.raw_data) : (p.raw_data || {})
          return (rd['Tag-Name'] || '').endsWith(`|${portName}`)
        } catch { return false }
      })

      // JAR: pid10 or pid20 from the targeted result set
      const jarFirst = (arr) => (arr || []).find(p => p.name && (p.name.endsWith('.10') || p.name.endsWith('.20')))

      const hapP   = findSrel('HAP')    || jarFirst(jHap)
      const hllP   = findSrel('HLL')    || jarFirst(jHll)
      const papP   = findSrel('PAP')    || jarFirst(jPap)
      const caldnP = findSrel('CALDN')  || jarFirst(jCaldn)

      if (pf(hapP)  !== null) { setHapOld(pf(hapP));  setHapSrel(kksOf(hapP)) }
      if (pf(hllP)  !== null) { setHllOld(pf(hllP));  setHllSrel(kksOf(hllP)) }
      if (pf(papP)  !== null) { setPapOld(pf(papP));  setPapSrel(kksOf(papP)) }
      if (caldnP)             { setCaldnSrel(kksOf(caldnP)) }
    }
    loadAll().catch(() => {})
  }, [turbineId])

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

  const hasOld = hapOld !== null && hllOld !== null && papOld !== null
  const lineOld = hasOld ? [0, papOld].map(pel => ({ pel, ymin: yminAt(pel, hapOld, hllOld, papOld) })) : []
  const lineNew = hasNew ? [0, pap].map(pel => ({ pel, ymin: yminAt(pel, hap, hll, pap) })) : []

  return (
    <div>
      <div style={S.sectionHdr}>YMIN Settings — IGV Minimum Position</div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

        {/* Parameter table + controls */}
        <div style={{ flexShrink: 0, minWidth: 330 }}>
          <div style={{ ...S.tableTitle, lineHeight: 1.3 }}>
            <div>YMIN = HLL + (HAP − HLL) × (PEL / PAP)</div>
            <div style={{ fontWeight: 400, fontSize: '0.64rem', fontFamily: 'monospace', color: '#9888B8', marginTop: 1 }}>MBY10DU050</div>
          </div>
          <div style={{ ...S.note, padding: '0.2rem 0.55rem' }}>CALDN = (HAP−HLL)/(PAP/PN)</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Parameter</th>
              {showSrel && <th style={S.thSrel}>SREL</th>}
              <th style={{ ...S.th, textAlign: 'right' }}>Old</th>
              <th style={{ ...S.th, textAlign: 'right', background: '#3D2270' }}>New (editable)</th>
              <th style={S.th}>Unit</th>
            </tr></thead>
            <tbody>
              {[
                { p: 'HAP', old: hapOld, val: hap, set: setHap, unit: '—', dec: 4, srel: hapSrel },
                { p: 'HLL', old: hllOld, val: hll, set: setHll, unit: '—', dec: 4, srel: hllSrel },
                { p: 'PAP', old: papOld, val: pap, set: setPap, unit: 'MW', dec: 1, srel: papSrel },
                { p: 'PN',  old: papOld, val: pap, set: null,   unit: 'MW', dec: 1, srel: papSrel },
              ].map(({ p, old, val, set, unit, dec, srel }, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#5C3D99' }}>{p}</td>
                  {showSrel && <td style={S.tdSrel}>{srel || '—'}</td>}
                  <td style={{ ...S.tdNum, color: '#9888B8' }}>{old != null ? old.toFixed(dec) : <span style={{ color: '#C0B0D8' }}>—</span>}</td>
                  <td style={{ ...S.tdNum, background: '#F0F4FF' }}>
                    {set ? <EditCell value={val} onChange={set} dec={dec} /> : (val !== null ? <strong>{val.toFixed(dec)}</strong> : <span style={{ color: '#B8A8DA' }}>—</span>)}
                  </td>
                  <td style={{ ...S.td, color: '#9888B8' }}>{unit}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #D0C4E8' }}>
                <td style={{ ...S.td, fontWeight: 700, color: '#6A50A0' }}>CALDN</td>
                {showSrel && <td style={S.tdSrel}>{caldnSrel || '—'}</td>}
                <td style={{ ...S.tdNum, color: '#9888B8' }}>{hasOld ? calDN(hapOld, hllOld).toFixed(4) : <span style={{ color: '#C0B0D8' }}>—</span>}</td>
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
                name: hasOld ? `Old: HAP=${hapOld}, HLL=${hllOld}` : 'Old (no data)',
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
  thSrel:      { background: '#3D2270', color: '#C4B0E0', padding: '0.25rem 0.45rem', textAlign: 'left', fontWeight: 400, fontSize: '0.64rem', fontStyle: 'italic', whiteSpace: 'nowrap' },
  td:          { padding: '0.18rem 0.55rem', borderBottom: '1px solid #EDE3F8', color: '#2A1A4A', whiteSpace: 'nowrap' },
  tdNum:       { padding: '0.18rem 0.55rem', borderBottom: '1px solid #EDE3F8', color: '#2A1A4A', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  tdMono:      { padding: '0.18rem 0.55rem', borderBottom: '1px solid #EDE3F8', color: '#5C3D99', fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' },
  tdPort:      { padding: '0.18rem 0.5rem', borderBottom: '1px solid #EDE3F8', color: '#5C3D99', fontFamily: 'monospace', fontSize: '0.72rem', whiteSpace: 'nowrap', fontWeight: 600 },
  tdSrel:      { padding: '0.18rem 0.45rem', borderBottom: '1px solid #EDE3F8', color: '#9888B8', fontFamily: 'monospace', fontSize: '0.68rem', whiteSpace: 'nowrap' },
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
  { id: 'mba22',  label: 'MBA22' },
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

  const switchTab = (id) => {
    setTab(id)
    // Plotly charts in display:none containers need a resize signal to fill correctly
    setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
  }

  return (
    <div style={pg.root}>
      {/* Topbar */}
      <div style={pg.topbar} className="no-print">
        <span style={pg.label}>Turbine:</span>
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
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => window.print()} style={pg.printBtn}>⎙ Print / Save PDF</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={pg.tabBar} className="no-print">
        {TABS.map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)}
            style={{ ...pg.tab, ...(tab === t.id ? pg.tabActive : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content — all tabs stay mounted to preserve state */}
      <div style={pg.content}>
        <div className="sgt-tab-sheet2" style={{ display: tab === 'sheet2' ? 'block' : 'none' }}><Sheet2Tab turbineId={turbineId} /></div>
        <div className="sgt-tab-lsvcal" style={{ display: tab === 'lsvcal' ? 'block' : 'none' }}><LsvcalTab turbineId={turbineId} /></div>
        <div className="sgt-tab-ymin"   style={{ display: tab === 'ymin'   ? 'block' : 'none' }}><YminTab turbineId={turbineId} /></div>
        <div className="sgt-tab-mba22"  style={{ display: tab === 'mba22'  ? 'block' : 'none' }}><MBA22Tab turbineId={turbineId} /></div>
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
  printBtn:  { fontSize: '0.78rem', padding: '0.22rem 0.8rem', borderRadius: 4, border: '1px solid #5C3D99', background: 'transparent', color: '#5C3D99', cursor: 'pointer', fontWeight: 600 },
}
