import React, { useState, useMemo, useEffect } from 'react'
import Plot from 'react-plotly.js'
import client from '../api/client'

// ── Static data (2000_e_test.xlsx sheet MBA22) ─────────────────────────────────
const TC_SENSORS = [
  { id: 'MBA22CT102B', tMax: 0, mode: 'DO', tci: 0, n: 50, alarmSrel: 'TT.ATK.M02', tripSrel: 'TT.ATK.S02', oldAlarm: 596.6, oldTrip: 622.6 },
  { id: 'MBA22CT103B', tMax: 0, mode: 'DO', tci: 0, n: 50, alarmSrel: 'TT.ATK.M03', tripSrel: 'TT.ATK.S03', oldAlarm: 597.5, oldTrip: 623.5 },
  { id: 'MBA22CT104B', tMax: 0, mode: 'DO', tci: 0, n: 50, alarmSrel: 'TT.ATK.M04', tripSrel: 'TT.ATK.S04', oldAlarm: 616,   oldTrip: 642   },
  { id: 'MBA22CT105B', tMax: 0, mode: 'DO', tci: 0, n: 50, alarmSrel: 'TT.ATK.M05', tripSrel: 'TT.ATK.S05', oldAlarm: 600,   oldTrip: 630   },
  { id: 'MBA22CT106B', tMax: 0, mode: 'DO', tci: 0, n: 50, alarmSrel: 'TT.ATK.M06', tripSrel: 'TT.ATK.S06', oldAlarm: 625.9, oldTrip: 651.9 },
  { id: 'MBA22CT107B', tMax: 0, mode: 'DO', tci: 0, n: 50, alarmSrel: 'TT.ATK.M07', tripSrel: 'TT.ATK.S07', oldAlarm: 604.9, oldTrip: 630.9 },
  { id: 'MBA22CT108B', tMax: 0, mode: 'DO', tci: 0, n: 50, alarmSrel: 'TT.ATK.M08', tripSrel: 'TT.ATK.S08', oldAlarm: 601,   oldTrip: 627   },
  { id: 'MBA22CT109B', tMax: 0, mode: 'DO', tci: 0, n: 50, alarmSrel: 'TT.ATK.M09', tripSrel: 'TT.ATK.S09', oldAlarm: 600,   oldTrip: 630   },
]

const IMBALANCE_MODES = ['DO BL', 'PO BL', 'CC PO']

const IMBALANCE_DEFAULT = {
  'MBA22CT102B': [0, 0, 0],
  'MBA22CT103B': [0, 0, 0],
  'MBA22CT104B': [0, 0, 0],
  'MBA22CT105B': [0, 0, 0],
  'MBA22CT106B': [0, 0, 0],
  'MBA22CT107B': [0, 0, 0],
  'MBA22CT108B': [0, 0, 0],
  'MBA22CT109B': [0, 0, 0],
}

// ── Formulas (from Excel MBA22) ────────────────────────────────────────────────
// Col F: corr_simple = T_max − TCI × 0.46
// Col G: corr_high   = T_max − TCI×0.46 + ATK×(1 − 60/n)   [= F when n=0]
// Col H: ALARM       = corr_simple + 13
// Col I: TRIP        = ALARM + 26
function calcSensor(row, atk) {
  const { tMax, tci, n } = row
  if (!Number.isFinite(tMax) || !Number.isFinite(tci)) return null
  const corrSimple = tMax - tci * 0.46
  const corrHigh   = Number.isFinite(n) && n > 0
    ? tMax - tci * 0.46 + atk * (1 - 60 / n)
    : corrSimple
  const alarm = corrSimple + 13
  const trip  = alarm + 26
  return { corrSimple, corrHigh, alarm, trip }
}

// Imbalance: CCL = CT102-105 (left), CCR = CT106-109 (right)
function calcImbalance(data) {
  return IMBALANCE_MODES.map((_, mi) => {
    const g = id => data[id]?.[mi] ?? 0
    const ccl3 = (g('MBA22CT102B') + g('MBA22CT103B') + g('MBA22CT104B')) / 3
    const ccl4 = (g('MBA22CT102B') + g('MBA22CT103B') + g('MBA22CT104B') + g('MBA22CT105B')) / 4
    const ccr3 = (g('MBA22CT106B') + g('MBA22CT107B') + g('MBA22CT108B')) / 3
    const ccr4 = (g('MBA22CT106B') + g('MBA22CT107B') + g('MBA22CT108B') + g('MBA22CT109B')) / 4
    return { ccl3, ccl4, ccr3, ccr4, imb3: ccl3 - ccr3, imb4: ccl4 - ccr4 }
  })
}

// ── Local EditCell ─────────────────────────────────────────────────────────────
function EC({ value, onChange, dec = 2, w = 68 }) {
  const [ed, setEd] = useState(false)
  const [dr, setDr] = useState('')
  if (ed) return (
    <input autoFocus value={dr}
      onChange={e => setDr(e.target.value)}
      onBlur={() => { const n = parseFloat(dr.replace(',', '.')); if (Number.isFinite(n)) onChange(n); setEd(false) }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEd(false) }}
      style={{ width: w, fontSize: '0.78rem', border: '1px solid #5C3D99', borderRadius: 3, padding: '1px 3px', background: '#FFFDE7', color: '#2A1A4A', fontVariantNumeric: 'tabular-nums' }}
    />
  )
  return (
    <span onClick={() => { setDr(String(value)); setEd(true) }}
      style={{ cursor: 'pointer', fontWeight: 700, borderBottom: '1px dashed #5C3D99', color: '#5C3D99', fontVariantNumeric: 'tabular-nums' }}>
      {Number.isFinite(value) ? value.toFixed(dec) : String(value ?? '—')}
    </span>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const M = {
  table:   { borderCollapse: 'collapse', fontSize: '0.78rem', width: '100%' },
  th:      (bg = '#5C3D99') => ({ background: bg, color: '#fff', padding: '0.25rem 0.6rem', textAlign: 'left',  fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }),
  thR:     (bg = '#5C3D99') => ({ background: bg, color: '#fff', padding: '0.25rem 0.6rem', textAlign: 'right', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }),
  td:      { padding: '0.2rem 0.6rem', borderBottom: '1px solid #EDE3F8', color: '#2A1A4A', whiteSpace: 'nowrap' },
  tdR:     { padding: '0.2rem 0.6rem', borderBottom: '1px solid #EDE3F8', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: '#2A1A4A' },
  tdMono:  { padding: '0.2rem 0.6rem', borderBottom: '1px solid #EDE3F8', color: '#5C3D99', fontFamily: 'monospace', fontSize: '0.72rem', whiteSpace: 'nowrap' },
  rowEven: { background: '#F7F3FC' },
  rowOdd:  { background: '#ffffff' },
  note:    { fontSize: '0.7rem', color: '#9888B8' },
}

const PL_BASE = {
  paper_bgcolor: '#F7F3FC', plot_bgcolor: '#ffffff',
  font: { color: '#9888B8', size: 10 },
  margin: { l: 52, r: 16, t: 16, b: 60 },
  legend: { bgcolor: '#ffffff', bordercolor: '#D0C4E8', font: { size: 10 } },
  barmode: 'group',
}

const PC = { displayModeBar: false, responsive: true }

const imbColor = v => Math.abs(v) > 25 ? '#AA0000' : Math.abs(v) > 15 ? '#CC6600' : '#5C3D99'

// ── Main component ─────────────────────────────────────────────────────────────
export default function MBA22Tab({ turbineId }) {
  const [kValue,    setKValue]    = useState(200)
  const [pamb,      setPamb]      = useState(1013.25)
  const [atk,       setAtk]       = useState(535)
  const [plNotAcc,  setPlNotAcc]  = useState(0)
  const [rows,      setRows]      = useState(() => TC_SENSORS.map(s => ({ ...s })))
  const [imbData,   setImbData]   = useState(IMBALANCE_DEFAULT)
  const [tab,       setTab]       = useState('calc')
  const [srelNote,  setSrelNote]  = useState(null)

  // Load ATK (EGGLK) and old setpoints from project when turbineId is set
  useEffect(() => {
    if (!turbineId) return
    const fetch1 = (search) =>
      client.get('/parameters', { params: { turbine_id: turbineId, search, limit: 1 } })
        .then(r => parseFloat(r.data?.[0]?.value)).catch(() => NaN)

    const loadAll = async () => {
      const atkVal = await fetch1('EGGLK')
      if (Number.isFinite(atkVal)) setAtk(atkVal)

      const allSrels = TC_SENSORS.flatMap(s => [s.alarmSrel, s.tripSrel])
      const results  = await Promise.all(allSrels.map(async srel => [srel, await fetch1(srel)]))
      const map      = Object.fromEntries(results.filter(([, v]) => Number.isFinite(v)))

      if (Object.keys(map).length > 0) {
        setRows(prev => prev.map(r => ({
          ...r,
          oldAlarm: map[r.alarmSrel] ?? r.oldAlarm,
          oldTrip:  map[r.tripSrel]  ?? r.oldTrip,
        })))
        setSrelNote(`${Object.keys(map).length} setpoints loaded from project`)
      }
    }
    loadAll()
  }, [turbineId])

  const updRow   = (i, field, val) => setRows(prev => prev.map((r, j) => j === i ? { ...r, [field]: val } : r))
  const updImb   = (sensor, mi, val) => setImbData(d => ({ ...d, [sensor]: d[sensor].map((v, i) => i === mi ? val : v) }))

  const computed = useMemo(() => rows.map(r => calcSensor(r, atk)), [rows, atk])
  const imbComp  = useMemo(() => calcImbalance(imbData), [imbData])

  const SUBTABS = [
    { id: 'calc',      label: 'Setpoint Calculation' },
    { id: 'setpoints', label: 'ALARM / TRIP Setpoints' },
    { id: 'imbalance', label: 'Imbalance Analysis' },
  ]

  return (
    <div>
      {/* Section header */}
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2A1A4A', borderBottom: '2px solid #D0C4E8', paddingBottom: '0.35rem', marginBottom: '0.75rem' }}>
        MBA22 — Temperature Limits at the Turbine Outlet
      </div>

      {/* Global inputs panel */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start', padding: '0.65rem 1rem', background: '#F7F3FC', border: '1px solid #D0C4E8', borderRadius: 6, marginBottom: '0.75rem' }}>
        {[
          { label: 'K-value factor with TVI', val: kValue,   set: setKValue,   dec: 0, note: 'default 200'     },
          { label: 'pamb [mbar]',             val: pamb,     set: setPamb,     dec: 2, note: 'default 1013.25' },
          { label: 'ATK [°C]',                val: atk,      set: setAtk,      dec: 1, note: 'EGGLK'           },
          { label: 'PL not accessible [K]',   val: plNotAcc, set: setPlNotAcc, dec: 1, note: 'default 0'       },
        ].map(({ label, val, set, dec, note }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5C3D99' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <EC value={val} onChange={set} dec={dec} w={88} />
              <span style={{ fontSize: '0.67rem', color: '#9888B8' }}>{note}</span>
            </div>
          </div>
        ))}

        {/* Formula legend */}
        <div style={{ marginLeft: 'auto', background: '#ffffff', border: '1px solid #D0C4E8', borderRadius: 5, padding: '0.45rem 0.75rem', fontSize: '0.72rem', color: '#5C3D99', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: '#2A1A4A', marginBottom: 2 }}>Formulas</div>
          <div><strong>F</strong> = T<sub>max</sub> − TCI × 0.46</div>
          <div><strong>G</strong> = F + ATK × (1 − 60/n)</div>
          <div><strong>ALARM</strong> = F + 13 K &nbsp;·&nbsp; <strong>TRIP</strong> = ALARM + 26 K</div>
        </div>

        {srelNote && (
          <div style={{ width: '100%', fontSize: '0.68rem', color: '#5C3D99', marginTop: -4 }}>
            ✓ {srelNote}
          </div>
        )}
      </div>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #D0C4E8', background: '#F7F3FC' }} className="no-print">
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '0.35rem 1.1rem', border: 'none', cursor: 'pointer',
            fontSize: '0.8rem', background: 'transparent',
            color:        tab === t.id ? '#5C3D99' : '#9888B8',
            fontWeight:   tab === t.id ? 700 : 400,
            borderBottom: tab === t.id ? '2px solid #5C3D99' : '2px solid transparent',
            marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB: Setpoint Calculation ── */}
      {tab === 'calc' && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={M.note}>Нажмите на ячейку в колонках B–E чтобы редактировать. Колонки F–I вычисляются автоматически. Зелёный = значение изменилось относительно старой уставки (&gt;0.5 K).</div>
          <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
            <table style={M.table}>
              <thead>
                <tr>
                  <th style={M.th()}>KKS TC</th>
                  <th style={M.thR()}>T<sub>max</sub> [°C]</th>
                  <th style={M.th()}>Mode</th>
                  <th style={M.thR()}>TCI [K]</th>
                  <th style={M.thR()}>n [Hz]</th>
                  <th style={M.thR('#2A5099')}>F — Corr. simplified</th>
                  <th style={M.thR('#1A3A7A')}>G — Corr. high dHz</th>
                  <th style={M.thR('#7A4A00')}>H — ALARM [°C]</th>
                  <th style={M.thR('#7A0000')}>I — TRIP [°C]</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const c = computed[i]
                  const aC = c && Math.abs(c.alarm - r.oldAlarm) > 0.5
                  const tC = c && Math.abs(c.trip  - r.oldTrip)  > 0.5
                  return (
                    <tr key={i} style={i % 2 === 0 ? M.rowEven : M.rowOdd}>
                      <td style={{ ...M.tdMono, fontWeight: 700 }}>{r.id}</td>
                      <td style={M.tdR}><EC value={r.tMax}  onChange={v => updRow(i, 'tMax', v)}  dec={2} /></td>
                      <td style={M.td}>
                        <select
                          value={r.mode}
                          onChange={e => updRow(i, 'mode', e.target.value)}
                          style={{ fontSize: '0.75rem', border: '1px solid #D0C4E8', borderRadius: 3, padding: '1px 4px', background: '#F7F3FC', color: '#5C3D99', cursor: 'pointer' }}
                        >
                          <option value='DO'>DO</option>
                          <option value='PO'>PO</option>
                        </select>
                      </td>
                      <td style={M.tdR}><EC value={r.tci}   onChange={v => updRow(i, 'tci',  v)}  dec={4} /></td>
                      <td style={M.tdR}><EC value={r.n}     onChange={v => updRow(i, 'n',    v)}  dec={4} /></td>
                      <td style={{ ...M.tdR, background: '#EEF2FF' }}>{c ? c.corrSimple.toFixed(2) : '—'}</td>
                      <td style={{ ...M.tdR, background: '#E8EDFF' }}>{c ? c.corrHigh.toFixed(2)   : '—'}</td>
                      <td style={{ ...M.tdR, background: aC ? '#E8F4E8' : '#FFFAED', color: aC ? '#004400' : '#2A1A4A', fontWeight: 700 }}>
                        {c ? c.alarm.toFixed(1) : '—'}
                      </td>
                      <td style={{ ...M.tdR, background: tC ? '#E8F4E8' : '#FFF0F0', color: tC ? '#004400' : '#2A1A4A', fontWeight: 700 }}>
                        {c ? c.trip.toFixed(1) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Formula detail box */}
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
            {[
              { label: 'F — Correction simplified', bg: '#EEF2FF', border: '#C0CCF0', body: `F = T_max − TCI × 0.46\nStandard TCI correction`, },
              { label: 'G — Correction high dHz',   bg: '#E8EDFF', border: '#B0C0F0', body: `G = F + ATK × (1 − 60/n)\nAt 60 Hz nominal: ATK term = 0\nATK = ${atk} °C` },
              { label: 'H — ALARM',                  bg: '#FFFAED', border: '#E0C070', body: `H = F + 13 K\nStandard alarm margin` },
              { label: 'I — TRIP',                   bg: '#FFF0F0', border: '#E07070', body: `I = H + 26 K = F + 39 K\nTrip margin = 26 K above alarm` },
            ].map(({ label, bg, border, body }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 5, padding: '0.5rem 0.75rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#2A1A4A', marginBottom: 3 }}>{label}</div>
                {body.split('\n').map((line, i) => (
                  <div key={i} style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: i === 0 ? '#2A1A4A' : '#9888B8' }}>{line}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: ALARM / TRIP Setpoints ── */}
      {tab === 'setpoints' && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={M.note}>Старые уставки из проекта SREL. Новые = computed из вкладки Calculation. Зелёный = изменилось &gt;0.5 K.</div>
          <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
            <table style={M.table}>
              <thead>
                <tr>
                  <th style={M.th()}>Sensor</th>
                  <th style={M.th()}>SREL (Alarm)</th>
                  <th style={M.thR('#5A3A00')}>Old Alarm</th>
                  <th style={M.thR('#1A5A00')}>New Alarm</th>
                  <th style={M.th()}>SREL (Trip)</th>
                  <th style={M.thR('#5A0000')}>Old Trip</th>
                  <th style={M.thR('#4A1A00')}>New Trip</th>
                  <th style={M.thR()}>ΔAlarm [K]</th>
                  <th style={M.thR()}>ΔTrip [K]</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const c      = computed[i]
                  const nAlarm = c ? +c.alarm.toFixed(1) : null
                  const nTrip  = c ? +c.trip.toFixed(1)  : null
                  const dA     = nAlarm != null ? nAlarm - r.oldAlarm : null
                  const dT     = nTrip  != null ? nTrip  - r.oldTrip  : null
                  const aC     = dA != null && Math.abs(dA) > 0.5
                  const tC     = dT != null && Math.abs(dT) > 0.5
                  const dCol   = d => d == null ? '#9888B8' : d > 0 ? '#004400' : '#AA0000'
                  return (
                    <tr key={i} style={i % 2 === 0 ? M.rowEven : M.rowOdd}>
                      <td style={{ ...M.tdMono, fontWeight: 700 }}>{r.id}</td>
                      <td style={{ ...M.tdMono, color: '#6A50A0' }}>{r.alarmSrel}</td>
                      <td style={M.tdR}>{r.oldAlarm?.toFixed(1) ?? '—'}</td>
                      <td style={{ ...M.tdR, fontWeight: 700, background: aC ? '#E8F4E8' : 'transparent', color: aC ? '#004400' : '#2A1A4A' }}>
                        {nAlarm?.toFixed(1) ?? '—'}
                      </td>
                      <td style={{ ...M.tdMono, color: '#6A50A0' }}>{r.tripSrel}</td>
                      <td style={M.tdR}>{r.oldTrip?.toFixed(1) ?? '—'}</td>
                      <td style={{ ...M.tdR, fontWeight: 700, background: tC ? '#FFF0F0' : 'transparent', color: tC ? '#AA0000' : '#2A1A4A' }}>
                        {nTrip?.toFixed(1) ?? '—'}
                      </td>
                      <td style={{ ...M.tdR, fontWeight: 700, color: dCol(dA) }}>
                        {dA != null ? (dA > 0 ? '+' : '') + dA.toFixed(1) : '—'}
                      </td>
                      <td style={{ ...M.tdR, fontWeight: 700, color: dCol(dT) }}>
                        {dT != null ? (dT > 0 ? '+' : '') + dT.toFixed(1) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Bar chart: ALARM old vs new */}
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5C3D99', textAlign: 'center', marginBottom: '0.4rem' }}>
              ALARM setpoints — Old vs New [°C]
            </div>
            <Plot
              data={[
                {
                  type: 'bar', name: 'Old Alarm',
                  x: rows.map(r => r.id.replace('MBA22', '')),
                  y: rows.map(r => r.oldAlarm),
                  marker: { color: '#9888B8', opacity: 0.75 },
                },
                {
                  type: 'bar', name: 'New Alarm',
                  x: rows.map(r => r.id.replace('MBA22', '')),
                  y: computed.map(c => c ? +c.alarm.toFixed(1) : null),
                  marker: { color: '#5C3D99' },
                },
              ]}
              layout={{
                ...PL_BASE,
                xaxis: { title: '', gridcolor: '#EDE3F8', tickangle: -20 },
                yaxis: { title: 'ALARM [°C]', gridcolor: '#EDE3F8', range: [550, 680] },
                height: 280,
              }}
              config={PC}
              style={{ width: '100%', height: 280 }}
            />
          </div>
        </div>
      )}

      {/* ── TAB: Imbalance Analysis ── */}
      {tab === 'imbalance' && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={M.note}>1-часовые средние значения по режиму. Дисбаланс = avg CCL (CT102-105, левый) − avg CCR (CT106-109, правый).</div>
          <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
            <table style={M.table}>
              <thead>
                <tr>
                  <th style={M.th()}>Sensor</th>
                  {IMBALANCE_MODES.map(m => <th key={m} style={M.thR()}>{m} [°C]</th>)}
                </tr>
              </thead>
              <tbody>
                {/* Editable sensor readings */}
                {Object.keys(imbData).map((sensor, si) => (
                  <tr key={si} style={si % 2 === 0 ? M.rowEven : M.rowOdd}>
                    <td style={{ ...M.tdMono, fontWeight: 700 }}>{sensor}</td>
                    {IMBALANCE_MODES.map((_, mi) => (
                      <td key={mi} style={M.tdR}>
                        <EC value={imbData[sensor][mi]} onChange={v => updImb(sensor, mi, v)} dec={2} />
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Divider */}
                <tr><td colSpan={4} style={{ height: 6, borderBottom: '2px solid #D0C4E8' }} /></tr>

                {/* Computed averages */}
                {[
                  { label: 'avg CCL (102–104)', key: 'ccl3', desc: 'left 3-TC' },
                  { label: 'avg CCL (102–105)', key: 'ccl4', desc: 'left 4-TC' },
                  { label: 'avg CCR (106–108)', key: 'ccr3', desc: 'right 3-TC' },
                  { label: 'avg CCR (106–109)', key: 'ccr4', desc: 'right 4-TC' },
                ].map(({ label, key }, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? '#EEF2FF' : '#F7F3FC' }}>
                    <td style={{ ...M.td, color: '#6A50A0', fontSize: '0.72rem' }}>{label}</td>
                    {imbComp.map((c, mi) => (
                      <td key={mi} style={{ ...M.tdR, fontWeight: 700 }}>{c[key].toFixed(2)}</td>
                    ))}
                  </tr>
                ))}

                {/* Imbalance result rows */}
                <tr><td colSpan={4} style={{ height: 4 }} /></tr>
                {[
                  { label: 'Imbalance by 3 TC', key: 'imb3', bg: '#FFF8E1' },
                  { label: 'Imbalance by 4 TC', key: 'imb4', bg: '#FFF0F0' },
                ].map(({ label, key, bg }, ri) => (
                  <tr key={ri} style={{ background: bg }}>
                    <td style={{ ...M.td, fontWeight: 700, color: '#5C3D99' }}>{label}</td>
                    {imbComp.map((c, mi) => {
                      const v = c[key]
                      return (
                        <td key={mi} style={{ ...M.tdR, fontWeight: 700, color: imbColor(v), fontSize: '0.85rem' }}>
                          {v > 0 ? '+' : ''}{v.toFixed(2)} K
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Limit legend */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.7rem', color: '#9888B8' }}>
            <span style={{ color: '#AA0000', fontWeight: 700 }}>● &gt;25 K: критично</span>
            <span style={{ color: '#CC6600', fontWeight: 700 }}>● 15–25 K: предупреждение</span>
            <span style={{ color: '#5C3D99', fontWeight: 700 }}>● &lt;15 K: норма</span>
          </div>

          {/* Imbalance bar chart */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5C3D99', textAlign: 'center', marginBottom: '0.4rem' }}>
              Temperature Imbalance by Operating Mode [K]
            </div>
            <Plot
              data={[
                {
                  type: 'bar', name: '3-TC Imbalance',
                  x: IMBALANCE_MODES,
                  y: imbComp.map(c => +c.imb3.toFixed(2)),
                  marker: { color: imbComp.map(c => imbColor(c.imb3)) },
                },
                {
                  type: 'bar', name: '4-TC Imbalance',
                  x: IMBALANCE_MODES,
                  y: imbComp.map(c => +c.imb4.toFixed(2)),
                  marker: { color: imbComp.map(c => imbColor(c.imb4)), opacity: 0.7 },
                },
              ]}
              layout={{
                ...PL_BASE,
                xaxis: { gridcolor: '#EDE3F8' },
                yaxis: { title: 'Imbalance [K]', gridcolor: '#EDE3F8' },
                shapes: [
                  { type: 'line', x0: -0.5, x1: 2.5, y0: 0,  y1: 0,  line: { color: '#2A1A4A', width: 1.5 } },
                  { type: 'line', x0: -0.5, x1: 2.5, y0: 15, y1: 15, line: { color: '#CC6600', dash: 'dash', width: 1 } },
                  { type: 'line', x0: -0.5, x1: 2.5, y0: 25, y1: 25, line: { color: '#AA0000', dash: 'dash', width: 1 } },
                ],
                annotations: [
                  { x: 2.5, y: 15, text: '15 K', showarrow: false, font: { size: 9, color: '#CC6600' }, xanchor: 'left' },
                  { x: 2.5, y: 25, text: '25 K', showarrow: false, font: { size: 9, color: '#AA0000' }, xanchor: 'left' },
                ],
                height: 260,
              }}
              config={PC}
              style={{ width: '100%', height: 260 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
