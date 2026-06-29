import React, { useState, useMemo } from 'react'
import Plot from 'react-plotly.js'
import ValueCell from '../ValueCell'

// ── helpers ──────────────────────────────────────────────────────────────────

function fv(srel, k) {
  const n = parseFloat(srel?.[k]?.value)
  return Number.isFinite(n) ? n : null
}

function fmt(v, dec = 3) {
  if (v == null || !Number.isFinite(v)) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(dec)
}

// Shows ◆ for static values, ValueCell for editable
function SV({ k, srel, turbineId, sheetId, onSaved }) {
  const item = srel?.[k] || {}
  if (item.static && !item.overridden) {
    return (
      <span style={S.staticVal}>◆ {item.value}</span>
    )
  }
  return (
    <ValueCell
      srelKey={k}
      value={item.value ?? null}
      originalValue={item.original ?? null}
      overridden={!!item.overridden}
      editable
      turbineId={turbineId}
      sheetId={sheetId}
      onSaved={onSaved}
    />
  )
}

// ── Polynomial pair tables ────────────────────────────────────────────────────

function PtTable({ pts, label, xLabel, yLabel, corrFactor, disabled, srel, turbineId, sheetId, onSaved }) {
  return (
    <div style={S.tableWrap}>
      <div style={S.tableHdr}>
        <span style={S.tableLabel}>{label}</span>
        {disabled && <span style={S.deactivatedBadge}>initially deactivated</span>}
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>SREL</th>
            <th style={{ ...S.th, textAlign: 'right' }}>{xLabel}</th>
            <th style={S.th}>SREL</th>
            <th style={{ ...S.th, textAlign: 'right' }}>{yLabel}</th>
            {corrFactor != null && !disabled && (
              <th style={{ ...S.th, ...S.thCorr, textAlign: 'right' }}>× {fmt(corrFactor, 4)}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {pts.map((pt, i) => {
            const item = srel?.[pt.bk] || {}
            const isStatic = pt.staticB !== undefined || item.static
            const yCorr = corrFactor != null && pt.y != null ? +(pt.y * corrFactor).toFixed(4) : null
            return (
              <tr key={i} style={{ ...(i % 2 === 0 ? S.rowEven : S.rowOdd), opacity: disabled ? 0.5 : 1 }}>
                <td style={S.tdKey}>{pt.ak}</td>
                <td style={S.tdVal}>
                  {disabled
                    ? <span style={S.staticVal}>{pt.x != null ? pt.x : '—'}</span>
                    : <ValueCell srelKey={pt.ak} value={srel?.[pt.ak]?.value ?? null}
                        originalValue={srel?.[pt.ak]?.original ?? null}
                        overridden={!!srel?.[pt.ak]?.overridden}
                        editable turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />}
                </td>
                <td style={S.tdKey}>{pt.bk}</td>
                <td style={S.tdVal}>
                  {isStatic && !item.overridden
                    ? <span style={S.staticVal}>◆ {pt.staticB ?? item.value}</span>
                    : disabled
                    ? <span style={S.staticVal}>{pt.y != null ? pt.y : '—'}</span>
                    : <ValueCell srelKey={pt.bk} value={item.value ?? null}
                        originalValue={item.original ?? null}
                        overridden={!!item.overridden}
                        editable turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />}
                </td>
                {corrFactor != null && !disabled && (
                  <td style={{ ...S.tdVal, ...S.tdCorr }}>{yCorr != null ? yCorr : '—'}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PolySection({ secTitle, secNote, loadLabel, unloadLabel, pts, xLabel, yLabel,
                        corrFactor, corrLabel, unloadingDisabled, srel, turbineId, sheetId, onSaved }) {
  const loadPts  = pts.load
  const unloadPts = pts.unload

  const traces = useMemo(() => {
    const lraw = loadPts.filter(p => p.x != null && p.y != null)
    const uraw = unloadPts.filter(p => p.x != null && p.y != null)
    const lcorr = corrFactor != null ? lraw.map(p => ({ x: p.x, y: +(p.y * corrFactor).toFixed(4) })) : []
    const out = []
    if (lraw.length > 1) out.push({
      x: lraw.map(p => p.x), y: lraw.map(p => p.y), type: 'scatter', mode: 'lines+markers',
      name: 'Loading', line: { color: '#5C3D99', width: 2 }, marker: { size: 4 },
    })
    if (uraw.length > 1 && !unloadingDisabled) out.push({
      x: uraw.map(p => p.x), y: uraw.map(p => p.y), type: 'scatter', mode: 'lines+markers',
      name: 'Unloading', line: { color: '#9370DB', width: 2, dash: 'dash' }, marker: { size: 4 },
    })
    if (lcorr.length > 1) out.push({
      x: lcorr.map(p => p.x), y: lcorr.map(p => p.y), type: 'scatter', mode: 'lines+markers',
      name: corrLabel || 'Loading (corrected)', line: { color: '#4caf7d', width: 2, dash: 'dot' }, marker: { size: 4 },
    })
    return out
  }, [srel, corrFactor, unloadingDisabled]) // eslint-disable-line

  const hasChart = traces.length > 0

  const cp = { srel, turbineId, sheetId, onSaved }

  return (
    <div style={S.polySection}>
      <div style={S.sectionTitle}>{secTitle}</div>
      {secNote && <div style={S.sectionNote}>{secNote}</div>}
      <div style={S.pairRow}>
        <PtTable pts={loadPts}   label={loadLabel}   xLabel={xLabel} yLabel={yLabel}
          corrFactor={corrFactor} disabled={false} {...cp} />
        <PtTable pts={unloadPts} label={unloadLabel} xLabel={xLabel} yLabel={yLabel}
          corrFactor={null} disabled={unloadingDisabled} {...cp} />
      </div>
      {hasChart && (
        <Plot
          data={traces}
          layout={{
            paper_bgcolor: '#F7F3FC', plot_bgcolor: '#ffffff',
            font: { color: '#9888B8', size: 11 },
            xaxis: { title: xLabel, gridcolor: '#EDE3F8', zerolinecolor: '#D0C4E8' },
            yaxis: { title: yLabel, gridcolor: '#EDE3F8', zerolinecolor: '#D0C4E8' },
            margin: { l: 55, r: 20, t: 15, b: 45 },
            legend: { bgcolor: '#ffffff', bordercolor: '#D0C4E8', font: { size: 10 } },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '260px', marginTop: '0.75rem' }}
        />
      )}
    </div>
  )
}

// ── Correction calc panel (collapsible) ──────────────────────────────────────

function CorrPanel({ title, formula, formula2, rows, result }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={S.corrPanel}>
      <button style={S.corrHeader} onClick={() => setOpen(v => !v)}>
        <span style={S.corrTitle}>{title}</span>
        <span style={S.corrChevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={S.corrBody}>
          <div style={S.formulaBox}>{formula}</div>
          {formula2 && <div style={S.formulaBox}>{formula2}</div>}
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Description</th>
                <th style={S.th}>SREL key</th>
                <th style={{ ...S.th, textAlign: 'right', background: '#555', color: '#ddd' }}>Inactive (no analyzer)</th>
                <th style={{ ...S.th, textAlign: 'right', background: '#1a4d1a', color: '#cfc' }}>Active (analyzer on)</th>
                <th style={S.th}>Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={S.tdDesc}>{r.desc}</td>
                  <td style={S.tdKey}>{r.srel || '—'}</td>
                  <td style={{ ...S.tdVal, background: '#F5F5F5', color: r.inact == null ? '#cc4444' : '#333' }}>
                    {r.inact != null ? fmt(r.inact, r.dec ?? 4) : '#N/A'}
                  </td>
                  <td style={{ ...S.tdVal, background: '#f0fff4', color: r.act == null ? '#cc4444' : '#1a4d1a', fontWeight: 700 }}>
                    {r.act != null ? fmt(r.act, r.dec ?? 4) : '#N/A'}
                  </td>
                  <td style={S.tdUnit}>{r.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result && (
            <div style={S.resultRow}>
              <span style={S.resultLabel}>{result.label}:</span>
              <span style={S.resultItem}>
                Inactive: <span style={{ ...S.resultVal, color: result.inact != null ? '#1a4d1a' : '#cc4444' }}>
                  {result.inact != null ? fmt(result.inact, 4) : '#N/A'}
                </span>
              </span>
              <span style={S.resultItem}>
                Active: <span style={{ ...S.resultVal, color: result.act != null ? '#1a4d1a' : '#cc4444' }}>
                  {result.act != null ? fmt(result.act, 4) : '#N/A'}
                </span>
              </span>
              {result.inv != null && (
                <span style={S.resultItem}>
                  1/PG_WI: <span style={{ ...S.resultVal, color: '#1a4d1a' }}>{fmt(result.inv, 4)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const DENS_AIR      = 1.2928
const LHV_MEAS_DEF  = 36.5

export default function LhvCorrPage({ data, turbineId, onOverrideSaved }) {
  const { srel = {} } = data
  const sheetId = data.id
  const onSaved = onOverrideSaved

  const [densGas, setDensGas] = useState(0.8)

  // SREL correction inputs
  const LHV_ref = fv(srel, 'HUEGR.X')
  const F_wLHV  = fv(srel, 'UGAS18.X')
  const WI_ref  = fv(srel, 'UGAS16.X')
  const F_wWI   = fv(srel, 'UGAS17.X')
  const HUEGP   = fv(srel, 'HUEGP.X')
  const LHV_meas_active = HUEGP ?? LHV_MEAS_DEF

  // PG_LHV
  const lhvKg_inact = LHV_MEAS_DEF / densGas       // 45.625
  const lhvKg_act   = LHV_meas_active / densGas
  const PG_LHV_inact = LHV_ref != null && F_wLHV != null
    ? +((LHV_ref / lhvKg_inact - 1) * F_wLHV + 1).toFixed(4) : null
  const PG_LHV_act = LHV_ref != null && F_wLHV != null
    ? +((LHV_ref / lhvKg_act - 1) * F_wLHV + 1).toFixed(4) : null

  // PG_WI
  const WI_inact = LHV_MEAS_DEF / Math.sqrt(densGas / DENS_AIR)  // 46.3995
  const WI_act   = LHV_meas_active / Math.sqrt(densGas / DENS_AIR)
  const PG_WI_inact = WI_ref != null && F_wWI != null
    ? +((WI_ref / WI_inact - 1) * F_wWI + 1).toFixed(4) : null
  const PG_WI_act = WI_ref != null && F_wWI != null
    ? +((WI_ref / WI_act - 1) * F_wWI + 1).toFixed(4) : null
  const inv_PG_WI = PG_WI_act != null && PG_WI_act !== 0
    ? +(1 / PG_WI_act).toFixed(4) : null

  // Polynomial key arrays — resolve x/y from srel
  const resolveKeys = (keys) => keys.map(({ ak, bk, staticB }) => ({
    ak, bk, staticB,
    x: fv(srel, ak),
    y: staticB !== undefined ? staticB : fv(srel, bk),
  }))

  const F6L_K  = Array.from({ length: 20 }, (_, i) => ({ ak: `F6L.A${i+1}`,  bk: `F6L.B${i+1}` }))
  const F6LE_K = Array.from({ length: 20 }, (_, i) => ({ ak: `F6LE.A${i+1}`, bk: `F6LE.B${i+1}` }))
  const F8L_K  = Array.from({ length: 10 }, (_, i) => ({ ak: `F8L.A${i+1}`,  bk: `F8L.B${i+1}`,  staticB: i === 0 ? 13.5 : undefined }))
  const F8LE_K = Array.from({ length: 10 }, (_, i) => ({ ak: `F8LE.A${i+1}`, bk: `F8LE.B${i+1}`, staticB: i === 0 ? 13.5 : undefined }))

  const lhvRows = [
    { desc: 'LHV reference',        srel: 'HUEGR.X',  inact: LHV_ref,      act: LHV_ref,      unit: 'MJ/kg',  dec: 4 },
    { desc: 'Gas density ρ_gas',     srel: '—',        inact: densGas,      act: densGas,       unit: 'kg/m³',  dec: 3 },
    { desc: 'LHV measured',          srel: '—',        inact: null,         act: LHV_meas_active, unit: 'MJ/m³', dec: 3 },
    { desc: 'LHV_meas / ρ_gas',      srel: 'HUEGP.X',  inact: lhvKg_inact,  act: lhvKg_act,    unit: 'MJ/kg',  dec: 4 },
    { desc: 'F_weight_LHV',          srel: 'UGAS18.X', inact: F_wLHV,       act: F_wLHV,        unit: '—',      dec: 4 },
  ]

  const wiRows = [
    { desc: 'WI reference',            srel: 'UGAS16.X', inact: WI_ref,    act: WI_ref,    unit: 'MJ/Nm³', dec: 4 },
    { desc: 'Air density ρ_air (std)', srel: '—',        inact: DENS_AIR,  act: DENS_AIR,  unit: 'kg/Nm³', dec: 4 },
    { desc: 'Gas density ρ_gas',        srel: '—',       inact: densGas,   act: densGas,   unit: 'kg/m³',  dec: 3 },
    { desc: 'LHV measured',             srel: '—',       inact: null,      act: LHV_meas_active, unit: 'MJ/m³', dec: 3 },
    { desc: 'WI actual',                srel: '—',       inact: WI_inact,  act: WI_act,    unit: 'MJ/Nm³', dec: 4 },
    { desc: 'F_weight_WI',              srel: 'UGAS17.X', inact: F_wWI,   act: F_wWI,     unit: '—',      dec: 4 },
  ]

  const cp = { srel, turbineId, sheetId, onSaved }

  return (
    <div>
      {/* ── Gas quality inputs panel ── */}
      <div style={S.gasPanel}>
        {/* Temperatures (static) */}
        <div style={S.gasPanelGroup}>
          <div style={S.gasPanelTitle}>Gas Temperature</div>
          {[
            { k: 'EGTL.X', label: 'Cold gas (EGTL)' },
            { k: 'EGTH.X', label: 'Hot gas (EGTH)' },
          ].map(({ k, label }) => {
            const item = srel[k] || {}
            return (
              <div key={k} style={S.gasPanelRow}>
                <span style={S.gasPanelLabel}>{label}</span>
                <span style={S.tdKey}>{k}</span>
                {item.static && !item.overridden
                  ? <span style={S.staticVal}>◆ {item.value}</span>
                  : <ValueCell srelKey={k} value={item.value ?? null} originalValue={item.original ?? null}
                      overridden={!!item.overridden} editable turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />}
                <span style={S.gasPanelUnit}>°C</span>
              </div>
            )
          })}
        </div>

        {/* LHV inputs */}
        <div style={S.gasPanelGroup}>
          <div style={S.gasPanelTitle}>LHV Correction Inputs</div>
          {[
            { k: 'HUEGR.X', label: 'LHV reference',  unit: 'MJ/kg' },
            { k: 'UGAS18.X', label: 'F_weight_LHV',  unit: '—' },
            { k: 'HUEGP.X',  label: 'LHV/ρ (HUEGP)', unit: 'MJ/kg' },
          ].map(({ k, label, unit }) => {
            const item = srel[k] || {}
            return (
              <div key={k} style={S.gasPanelRow}>
                <span style={S.gasPanelLabel}>{label}</span>
                <span style={S.tdKey}>{k}</span>
                <ValueCell srelKey={k} value={item.value ?? null} originalValue={item.original ?? null}
                  overridden={!!item.overridden} editable turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />
                <span style={S.gasPanelUnit}>{unit}</span>
              </div>
            )
          })}
        </div>

        {/* WI inputs */}
        <div style={S.gasPanelGroup}>
          <div style={S.gasPanelTitle}>WI Correction Inputs</div>
          {[
            { k: 'UGAS16.X', label: 'WI reference',  unit: 'MJ/Nm³' },
            { k: 'UGAS17.X', label: 'F_weight_WI',   unit: '—' },
          ].map(({ k, label, unit }) => {
            const item = srel[k] || {}
            return (
              <div key={k} style={S.gasPanelRow}>
                <span style={S.gasPanelLabel}>{label}</span>
                <span style={S.tdKey}>{k}</span>
                <ValueCell srelKey={k} value={item.value ?? null} originalValue={item.original ?? null}
                  overridden={!!item.overridden} editable turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />
                <span style={S.gasPanelUnit}>{unit}</span>
              </div>
            )
          })}
        </div>

        {/* Analyzer defaults */}
        <div style={S.gasPanelGroup}>
          <div style={S.gasPanelTitle}>Analyzer-inactive defaults</div>
          <div style={S.gasPanelRow}>
            <span style={S.gasPanelLabel}>Gas density ρ_gas</span>
            <input type="number" step="0.01" value={densGas}
              onChange={e => setDensGas(parseFloat(e.target.value) || 0.8)}
              style={S.densInput} />
            <span style={S.gasPanelUnit}>kg/m³</span>
          </div>
          <div style={{ ...S.gasPanelRow, color: '#9888B8', fontSize: '0.7rem' }}>
            <span>ρ_air std = {DENS_AIR} kg/Nm³ · LHV_meas default = {LHV_MEAS_DEF} MJ/m³</span>
          </div>
          {(PG_LHV_act != null || PG_WI_act != null) && (
            <div style={S.corrResultMini}>
              {PG_LHV_act != null && <span>PG_LHV = <strong>{fmt(PG_LHV_act, 4)}</strong></span>}
              {PG_WI_act != null  && <span>PG_WI = <strong>{fmt(PG_WI_act, 4)}</strong></span>}
            </div>
          )}
        </div>
      </div>

      {/* ── 3.1a OTC → mPG (20pt) ── */}
      <PolySection
        secTitle="3.1a Pilot Gas as Function of OTC — COLD Fuel Gas (20 points)"
        secNote={PG_LHV_act != null
          ? `Green column = raw × PG_LHV (${fmt(PG_LHV_act, 4)})`
          : 'LHV correction: enter HUEGR.X, UGAS18.X to compute correction factor'}
        loadLabel="MSPG.F6L — Loading"
        unloadLabel="MSPG.F6LE — Unloading ⚠"
        pts={{ load: resolveKeys(F6L_K), unload: resolveKeys(F6LE_K) }}
        xLabel="OTC [°C]"
        yLabel="m PG [kg/s]"
        corrFactor={PG_LHV_act}
        corrLabel="Loading (LHV corr.)"
        unloadingDisabled={true}
        {...cp}
      />

      <CorrPanel
        title="▼ PG_LHV Calculation"
        formula="PG_LHV = (LHV_ref [MJ/kg] / (LHV_meas [MJ/m³] / ρ_gas [kg/m³]) − 1) × F_weight_LHV + 1"
        rows={lhvRows}
        result={{ label: 'PG_LHV', inact: PG_LHV_inact, act: PG_LHV_act }}
      />

      {/* ── 3.2a IGV → PG Split (10pt) ── */}
      <div style={S.handoffNote}>
        NOTE: F8L.B1 = F8LE.B1 = 13.5◆ (static). To ensure smooth switching from OTC mass-flow control
        to IGV-fraction control, this first set point must match the last valid OTC (F6L) value at the switch point.
      </div>

      <PolySection
        secTitle="3.2a Pilot Gas Split as Function of IGV — COLD Fuel Gas (10 points)"
        secNote={PG_WI_act != null
          ? `WI correction active: PG_WI = ${fmt(PG_WI_act, 4)}, 1/PG_WI = ${fmt(inv_PG_WI, 4)}`
          : 'WI correction: enter UGAS16.X, UGAS17.X to compute correction factor'}
        loadLabel="MSPG.F8L — Loading"
        unloadLabel="MSPG.F8LE — Unloading ⚠"
        pts={{ load: resolveKeys(F8L_K), unload: resolveKeys(F8LE_K) }}
        xLabel="IGV [%]"
        yLabel="PG Split [%]"
        corrFactor={null}
        corrLabel={null}
        unloadingDisabled={true}
        {...cp}
      />

      <CorrPanel
        title="▼ PG_WI Calculation"
        formula="WI_actual = LHV_meas [MJ/m³] / √(ρ_gas [kg/m³] / ρ_air_std [kg/Nm³])"
        formula2="PG_WI = ((WI_ref [MJ/Nm³] / WI_actual) − 1) × F_weight_WI + 1"
        rows={wiRows}
        result={{ label: 'PG_WI', inact: PG_WI_inact, act: PG_WI_act, inv: inv_PG_WI }}
      />
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  // Gas panel
  gasPanel:        { display: 'flex', flexWrap: 'wrap', gap: '1.25rem', padding: '0.75rem', background: '#F7F3FC', border: '1px solid #D0C4E8', borderRadius: '6px', marginBottom: '1.25rem' },
  gasPanelGroup:   { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  gasPanelTitle:   { fontSize: '0.76rem', fontWeight: 700, color: '#5C3D99', marginBottom: '0.2rem' },
  gasPanelRow:     { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem' },
  gasPanelLabel:   { color: '#6A50A0', width: '120px', flexShrink: 0 },
  gasPanelUnit:    { color: '#9888B8', fontSize: '0.7rem' },
  densInput:       { width: '56px', fontSize: '0.76rem', border: '1px solid #D0C4E8', borderRadius: '3px', padding: '1px 4px', background: '#fff', color: '#2A1A4A' },
  corrResultMini:  { display: 'flex', gap: '0.75rem', marginTop: '0.3rem', fontSize: '0.74rem', color: '#4caf7d' },

  // Poly section
  polySection:     { marginBottom: '0.75rem' },
  sectionTitle:    { fontSize: '0.86rem', fontWeight: 700, color: '#2A1A4A', marginBottom: '0.25rem' },
  sectionNote:     { fontSize: '0.72rem', color: '#4caf7d', marginBottom: '0.4rem', fontStyle: 'italic' },
  pairRow:         { display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' },

  // Table
  tableWrap:       { flexShrink: 0 },
  tableHdr:        { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' },
  tableLabel:      { fontFamily: 'monospace', color: '#5C3D99', fontWeight: 700, fontSize: '0.8rem' },
  deactivatedBadge:{ fontSize: '0.65rem', color: '#cc6600', border: '1px solid #cc660055', borderRadius: '3px', padding: '0 0.3rem', background: '#fff8f0' },
  table:           { borderCollapse: 'collapse', fontSize: '0.78rem', flexShrink: 0 },
  th:              { background: '#F7F3FC', color: '#9888B8', padding: '0.25rem 0.5rem', textAlign: 'left', borderBottom: '1px solid #D0C4E8', whiteSpace: 'nowrap', fontWeight: 600 },
  thCorr:          { background: '#e8f5e9', color: '#1a4d1a' },
  rowEven:         { background: '#F7F3FC' },
  rowOdd:          { background: '#ffffff' },
  tdKey:           { padding: '0.2rem 0.5rem', borderBottom: '1px solid #D0C4E8', color: '#5C3D99', fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' },
  tdVal:           { padding: '0.2rem 0.5rem', borderBottom: '1px solid #D0C4E8', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '60px' },
  tdCorr:          { background: '#f0fff4', color: '#1a4d1a', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  tdDesc:          { padding: '0.2rem 0.5rem', borderBottom: '1px solid #D0C4E8', color: '#6A50A0', fontSize: '0.75rem' },
  tdUnit:          { padding: '0.2rem 0.4rem', borderBottom: '1px solid #D0C4E8', color: '#9888B8', fontSize: '0.72rem', whiteSpace: 'nowrap' },
  staticVal:       { color: '#7799bb', fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem', fontFamily: 'monospace' },

  // Corr panel
  corrPanel:       { border: '1px solid #D0C4E8', borderRadius: '6px', marginBottom: '1rem', overflow: 'hidden' },
  corrHeader:      { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.75rem', background: '#e8f5e9', border: 'none', cursor: 'pointer', textAlign: 'left' },
  corrTitle:       { fontSize: '0.8rem', fontWeight: 700, color: '#1a4d1a' },
  corrChevron:     { fontSize: '0.7rem', color: '#1a4d1a' },
  corrBody:        { padding: '0.6rem 0.75rem' },
  formulaBox:      { fontFamily: 'monospace', fontSize: '0.75rem', color: '#1a4d1a', background: '#f0fff4', border: '1px solid #4caf7d44', borderRadius: '4px', padding: '0.4rem 0.6rem', marginBottom: '0.5rem' },
  resultRow:       { display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', padding: '0.4rem 0.6rem', borderTop: '2px solid #4caf7d44', marginTop: '0.4rem', background: '#f0fff4' },
  resultLabel:     { fontWeight: 700, color: '#1a4d1a', fontSize: '0.8rem' },
  resultItem:      { fontSize: '0.78rem', color: '#6A50A0' },
  resultVal:       { fontWeight: 700, fontFamily: 'monospace', fontSize: '0.8rem' },

  // Handoff note
  handoffNote:     { background: '#FFF8EC', border: '1px solid #E0A93F44', borderRadius: '4px', padding: '0.4rem 0.75rem', fontSize: '0.73rem', color: '#7b5000', marginBottom: '0.6rem', marginTop: '0.25rem' },
}
