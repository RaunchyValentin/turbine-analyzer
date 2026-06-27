import React, { useState, useMemo } from 'react'
import Plot from 'react-plotly.js'
import ValueCell from '../ValueCell'

function StaticVal({ value }) {
  return <span style={S.staticVal}>◆ {value ?? '—'}</span>
}

function SideTable({ st, showSrel, turbineId, sheetId, onOverrideSaved }) {
  if (!st) return null
  return (
    <div style={S.tableWrap}>
      <div style={S.tableHdr}>
        <span style={S.tableLabel}>{st.label}</span>
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Port</th>
            {showSrel && <th style={S.thSrel}>SREL</th>}
            <th style={{ ...S.th, textAlign: 'right' }}>{st.x_label}</th>
            <th style={S.th}>Port</th>
            {showSrel && <th style={S.thSrel}>SREL</th>}
            <th style={{ ...S.th, textAlign: 'right' }}>{st.y_label}</th>
          </tr>
        </thead>
        <tbody>
          {(st.points || []).map((pt, i) => (
            <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
              <td style={S.tdKey}>{pt.x_port || pt.xk}</td>
              {showSrel && <td style={S.tdSrel}>{pt.x_kks || pt.xk}</td>}
              <td style={S.tdVal}>
                <ValueCell srelKey={pt.xk} value={pt.xv} originalValue={pt.xo}
                  overridden={pt.x_overridden} editable
                  turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
              </td>
              <td style={S.tdKey}>{pt.y_port || pt.yk}</td>
              {showSrel && <td style={S.tdSrel}>{pt.y_kks || pt.yk}</td>}
              <td style={S.tdVal}>
                <ValueCell srelKey={pt.yk} value={pt.yv} originalValue={pt.yo}
                  overridden={pt.y_overridden} editable
                  turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PairedTable({ section, pts, label, disabled, showSrel, turbineId, sheetId, onOverrideSaved }) {
  return (
    <div style={S.tableWrap}>
      <div style={S.tableHdr}>
        <span style={S.tableLabel}>{label}</span>
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Port</th>
            {showSrel && <th style={S.thSrel}>SREL</th>}
            <th style={{ ...S.th, textAlign: 'right' }}>{section.x_label}</th>
            <th style={S.th}>Port</th>
            {showSrel && <th style={S.thSrel}>SREL</th>}
            <th style={{ ...S.th, textAlign: 'right' }}>{section.y_label}</th>
          </tr>
        </thead>
        <tbody>
          {pts.map((pt, i) => (
            <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
              <td style={S.tdKey}>{pt.xs === 'static' ? '◆' : (pt.x_port || pt.xk)}</td>
              {showSrel && <td style={S.tdSrel}>{pt.xs === 'static' ? '' : (pt.x_kks || pt.xk)}</td>}
              <td style={S.tdVal}>
                {pt.xs === 'static' ? (
                  <StaticVal value={pt.xv} />
                ) : (
                  <ValueCell srelKey={pt.xk} value={pt.xv} originalValue={pt.xo}
                    overridden={pt.x_overridden} editable={!disabled}
                    turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                )}
              </td>
              <td style={S.tdKey}>{pt.ys === 'static' ? '◆' : (pt.y_port || pt.yk)}</td>
              {showSrel && <td style={S.tdSrel}>{pt.ys === 'static' ? '' : (pt.y_kks || pt.yk)}</td>}
              <td style={S.tdVal}>
                {pt.ys === 'static' ? (
                  <StaticVal value={pt.yv} />
                ) : (
                  <ValueCell srelKey={pt.yk} value={pt.yv} originalValue={pt.yo}
                    overridden={pt.y_overridden} editable={!disabled}
                    turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionChart({ section }) {
  const loadPts = (section.points || []).filter(p => p.xv != null && p.yv != null)
  const unlPts  = (section.points_u || []).filter(p => p.xv != null && p.yv != null)

  const traces = []
  if (loadPts.length > 1) traces.push({
    x: loadPts.map(p => +p.xv), y: loadPts.map(p => +p.yv),
    type: 'scatter', mode: 'lines+markers', name: 'Loading',
    line: { color: '#5C3D99', width: 2 }, marker: { size: 4 },
  })
  if (unlPts.length > 1) traces.push({
    x: unlPts.map(p => +p.xv), y: unlPts.map(p => +p.yv),
    type: 'scatter', mode: 'lines+markers', name: 'Unloading',
    line: { color: '#6A50A0', width: 2, dash: 'dash' }, marker: { size: 4 },
  })
  if (!traces.length) return null

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: '#F7F3FC', plot_bgcolor: '#ffffff', font: { color: '#9888B8', size: 11 },
        xaxis: { title: section.x_label, gridcolor: '#EDE3F8', zerolinecolor: '#D0C4E8' },
        yaxis: { title: section.y_label, gridcolor: '#EDE3F8', zerolinecolor: '#D0C4E8' },
        margin: { l: 55, r: 20, t: 15, b: 45 },
        legend: { bgcolor: '#ffffff', bordercolor: '#222', font: { size: 10 }, x: 0.01, y: 0.99 },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '260px' }}
    />
  )
}

function GasTemp({ panel }) {
  if (!panel) return null
  const vals = Object.entries(panel.values || {})
  return (
    <div style={S.gasTempWrap}>
      <div style={S.gasTempTable}>
        <div style={S.gasTempTitle}>{panel.title}</div>
        <table style={{ ...S.table, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ ...S.gasTempThGroup, textAlign: 'center' }}>MSPG</th>
            </tr>
            <tr>
              <th style={S.gasTempThKey} />
              <th style={S.gasTempThVal}>{panel.column_label}</th>
            </tr>
          </thead>
          <tbody>
            {vals.map(([name, item], i) => (
              <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                <td style={S.gasTempTdKey}><strong>{name}</strong></td>
                <td style={S.gasTempTdVal}>
                  {item.value != null ? item.value : <span style={{ color: '#aa4444' }}>#N/A</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {panel.note && (
        <div style={S.gasTempNote}>{panel.note}</div>
      )}
    </div>
  )
}

function GasIndexPanel({ panel }) {
  const [hv,      setHv]      = useState(36.67)
  const [nd,      setNd]      = useState(0.769)
  const [temp,    setTemp]    = useState(130)
  const [gi0,     setGi0]     = useState(46.1)
  const [kgi,     setKgi]     = useState(0)
  const [kgiRaw,  setKgiRaw]  = useState('+0.000')
  const [pgSplit, setPgSplit] = useState(8.5)

  const gi    = useMemo(() => { const v = (hv / Math.sqrt(nd / 1.292)) * Math.sqrt((temp + 273.15) / 273.15); return isFinite(v) ? v : null }, [hv, nd, temp])
  const delta = gi  != null ? gi - gi0           : null
  const pgGi  = delta != null ? delta * kgi      : null
  const pgfra = pgGi != null ? pgGi + pgSplit    : null

  const fmt = (v, d = 3) => v != null ? v.toFixed(d) : <span style={{ color: '#aa4444' }}>#N/A</span>

  const handleKgiBlur = () => {
    const v = parseFloat(kgiRaw)
    if (!isNaN(v)) {
      setKgi(v)
      setKgiRaw((v >= 0 ? '+' : '') + v.toFixed(3))
    }
  }

  const InRow = ({ label, value, set, unit, step, desc, idx }) => (
    <tr style={idx % 2 === 0 ? S.rowEven : S.rowOdd}>
      <td style={S.giLabel}>{label}</td>
      <td style={S.giInputCell}>
        <input type="number" step={step} value={value}
          onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) set(v) }}
          style={S.giInputEl} />
      </td>
      <td style={S.giUnit}>{unit}</td>
      <td style={S.giDesc2}>{desc}</td>
    </tr>
  )

  const OutRow = ({ label, value, unit, d = 3, idx }) => (
    <tr style={idx % 2 === 0 ? S.rowEven : S.rowOdd}>
      <td style={{ ...S.giLabel, fontWeight: 700, color: '#3D2270' }}>{label}</td>
      <td style={{ ...S.giInputCell, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: '#3D2270', fontVariantNumeric: 'tabular-nums' }}>
        {fmt(value, d)}
      </td>
      <td style={S.giUnit}>{unit}</td>
      <td />
    </tr>
  )

  const Sep = () => <tr><td colSpan={4} style={{ borderBottom: '1px solid #C4B0E0', padding: 0 }} /></tr>

  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', margin: '0 0 1.5rem' }}>
      <div style={{ ...S.giWrap, margin: 0 }}>
        <div style={S.giTitle}>{panel?.title || 'Gas Index (reference parameters)'}</div>
        <table style={{ ...S.table, minWidth: 300 }}>
          <tbody>
            <InRow label="Heat Value"   value={hv}      set={setHv}      unit="MJ/Nm³" step={0.001} desc=""               idx={0} />
            <InRow label="Norm Density" value={nd}      set={setNd}      unit="kg/Nm³" step={0.001} desc=""               idx={1} />
            <InRow label="Temperature"  value={temp}    set={setTemp}    unit="°C"     step={1}     desc=""               idx={2} />
            <Sep />
            <OutRow label="GI"       value={gi}     unit="MJ/Nm³" idx={0} />
            <tr><td colSpan={4} style={S.giDescRow}>actual gas index; calculated in the governor</td></tr>
            <Sep />
            <InRow  label="GI0"      value={gi0}     set={setGi0}     unit="MJ/Nm³" step={0.001} desc="reference gas index"  idx={1} />
            <OutRow label="Delta"    value={delta}  unit="MJ/Nm³" idx={0} />
            <tr style={S.rowOdd}>
              <td style={S.giLabel}>KGI</td>
              <td style={S.giInputCell}>
                <input type="text" value={kgiRaw}
                  onChange={e => { setKgiRaw(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v)) setKgi(v) }}
                  onFocus={e => e.target.select()}
                  onBlur={handleKgiBlur}
                  style={{ ...S.giInputEl, width: '72px' }} />
              </td>
              <td style={S.giUnit}>—</td>
              <td style={S.giDesc2}>weighing factor</td>
            </tr>
            <OutRow label="PG_GI"   value={pgGi}   unit="kg/sec"  idx={0} />
            <InRow  label="PG-Split" value={pgSplit} set={setPgSplit} unit="kg/sec" step={0.001} desc=""                    idx={1} />
            <OutRow label="PGFRA"   value={pgfra}  unit="kg/sec"  idx={0} />
          </tbody>
        </table>
      </div>

      <div style={S.giNoteWrap}>
        <div style={S.giNoteAlert}>⚠ Gas Index Correction</div>
        <div style={S.giNoteSubtitle}>instead of polygons for cold- and hot gas</div>
        <div style={S.giNoteDivider} />
        <div style={S.giNoteLabel}>PG fraction correction by GI:</div>
        <div style={S.giNoteFormula}>PG_GI = (GI − GI₀) × KGI</div>
        <div style={S.giNoteResultRow}>
          <span style={S.giNoteResultLabel}>PG_GI =</span>
          <span style={S.giNoteResultVal}>
            {pgGi != null ? pgGi.toFixed(3) : <span style={{ color: '#aa4444' }}>#N/A</span>}
          </span>
          <span style={S.giNoteResultUnit}>kg/sec</span>
        </div>
      </div>
    </div>
  )
}

function InfoPanel({ panel, color = '#5C3D99' }) {
  if (!panel) return null
  const vals = panel.values || {}
  return (
    <div style={{ ...S.infoPanel, borderColor: color + '44' }}>
      <div style={{ ...S.infoPanelTitle, color }}>{panel.title}</div>
      {panel.note && <div style={S.infoPanelNote}>{panel.note}</div>}
      <table style={S.table}>
        <tbody>
          {Object.entries(vals).map(([name, item], i) => (
            <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
              <td style={S.tdKey}>{item.key}</td>
              <td style={S.tdDesc}>{name}</td>
              <td style={{ ...S.tdVal, color: item.value != null ? '#c8c8d8' : '#663333', textAlign: 'right' }}>
                {item.value ?? '#N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PilotGasPaired({ data, turbineId, onOverrideSaved }) {
  const sheetId = data.id
  const [showSrel, setShowSrel] = useState(false)

  return (
    <div>
      {/* Gas Temperature definition block (SG121) */}
      {data.gas_temp && <GasTemp panel={data.gas_temp} />}

      {/* Optional gas index panel (SG123) */}
      {data.gas_index && <GasIndexPanel panel={data.gas_index} />}

      {data.sections?.length > 0 && (
        <div style={S.srelToggleRow}>
          <button style={{ ...S.srelToggleBtn, ...(showSrel ? S.srelToggleActive : {}) }}
            onClick={() => setShowSrel(v => !v)}>
            {showSrel ? '− SREL' : '+ SREL'}
          </button>
        </div>
      )}

      {data.sections?.map((section, si) => (
        <div key={si} style={S.section}>
          <div style={S.sectionTitle}>{section.title}</div>
          {section.static_note && (
            <div style={S.staticNote}>◆ {section.static_note}</div>
          )}

          <div style={S.pairRow}>
            <PairedTable
              section={section}
              pts={section.points || []}
              label={section.loading_label || 'Loading'}
              showSrel={showSrel}
              turbineId={turbineId}
              sheetId={sheetId}
              onOverrideSaved={onOverrideSaved}
            />
            <PairedTable
              section={section}
              pts={section.points_u || []}
              label={section.unloading_label || 'Unloading'}
              showSrel={showSrel}
              turbineId={turbineId}
              sheetId={sheetId}
              onOverrideSaved={onOverrideSaved}
            />
            <SideTable
              st={section.side_table}
              showSrel={showSrel}
              turbineId={turbineId}
              sheetId={sheetId}
              onOverrideSaved={onOverrideSaved}
            />
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <SectionChart section={section} />
          </div>
        </div>
      ))}

      {/* Optional LHV/WI panel (SG125) */}
      {data.lhv_panel && <InfoPanel panel={data.lhv_panel} color="#e67e22" />}
    </div>
  )
}

const S = {
  section:          { marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #2A1A4A' },
  sectionTitle:     { fontSize: '0.88rem', fontWeight: 700, color: '#2A1A4A', marginBottom: '0.35rem', letterSpacing: '0.02em' },
  staticNote:       { fontSize: '0.72rem', color: '#667788', marginBottom: '0.4rem', fontStyle: 'italic' },
  pairRow:          { display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' },
  tableWrap:        { flexShrink: 0 },
  tableHdr:         { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' },
  tableLabel:       { fontFamily: 'monospace', color: '#5C3D99', fontWeight: 700, fontSize: '0.8rem' },
  table:            { borderCollapse: 'collapse', fontSize: '0.78rem' },
  th:               { background: '#F7F3FC', color: '#556', padding: '0.25rem 0.5rem', textAlign: 'left', borderBottom: '1px solid #D0C4E8', whiteSpace: 'nowrap', fontWeight: 600 },
  rowEven:          { background: '#F7F3FC' },
  rowOdd:           { background: '#ffffff' },
  tdKey:            { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', color: '#5C3D99', fontFamily: 'monospace', fontSize: '0.72rem', whiteSpace: 'nowrap' },
  tdVal:            { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '64px' },
  tdDesc:           { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', color: '#9888B8', fontSize: '0.75rem' },
  staticVal:        { color: '#7799bb', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem' },
  thSrel:           { background: '#F0EBF8', color: '#9888B8', padding: '0.25rem 0.4rem', textAlign: 'left', borderBottom: '1px solid #D0C4E8', whiteSpace: 'nowrap', fontSize: '0.72rem', fontStyle: 'italic' },
  tdSrel:           { padding: '0.2rem 0.4rem', borderBottom: '1px solid #141420', color: '#9888B8', fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' },
  srelToggleRow:    { marginBottom: '0.5rem' },
  srelToggleBtn:    { background: '#F4F0FA', border: '1px solid #D0C4E8', color: '#6A50A0', borderRadius: '3px', cursor: 'pointer', padding: '0.1rem 0.5rem', fontSize: '0.72rem' },
  srelToggleActive: { background: '#EDE3F8', borderColor: '#5C3D99', color: '#5C3D99' },
  gasTempWrap:      { display: 'flex', alignItems: 'flex-start', gap: '2rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #D0C4E8' },
  gasTempTable:     { flexShrink: 0 },
  gasTempTitle:     { fontSize: '0.82rem', fontWeight: 700, color: '#2A1A4A', marginBottom: '0.4rem' },
  gasTempThGroup:   { background: '#5C3D99', color: '#fff', fontWeight: 700, padding: '0.2rem 0.5rem', border: '1px solid #D0C4E8', fontSize: '0.78rem' },
  gasTempThKey:     { background: '#EDE3F8', color: '#5C3D99', padding: '0.2rem 0.6rem', border: '1px solid #D0C4E8', fontSize: '0.75rem', minWidth: '80px' },
  gasTempThVal:     { background: '#EDE3F8', color: '#5C3D99', padding: '0.2rem 0.6rem', border: '1px solid #D0C4E8', fontSize: '0.75rem', textAlign: 'right', minWidth: '60px', fontWeight: 600 },
  gasTempTdKey:     { padding: '0.2rem 0.6rem', border: '1px solid #D0C4E8', color: '#2A1A4A', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'nowrap' },
  gasTempTdVal:     { padding: '0.2rem 0.6rem', border: '1px solid #D0C4E8', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: '#2A1A4A', fontWeight: 700 },
  gasTempNote:      { fontSize: '0.8rem', color: '#2A1A4A', lineHeight: 1.55, maxWidth: '380px', paddingTop: '1.4rem' },
  giWrap:           { margin: '0 0 1.5rem', padding: '0.6rem 0.85rem', border: '1px solid #C4B0E0', borderRadius: '4px', background: '#F7F3FC', display: 'inline-block' },
  giTitle:          { fontWeight: 700, fontSize: '0.8rem', color: '#3D2270', marginBottom: '0.4rem' },
  giLabel:          { padding: '0.2rem 0.6rem 0.2rem 0', color: '#5C3D99', fontSize: '0.78rem', whiteSpace: 'nowrap' },
  giInputCell:      { padding: '0.12rem 0.3rem', textAlign: 'right' },
  giInputEl:        { width: '80px', textAlign: 'right', border: '1px solid #C4B0E0', borderRadius: '3px', background: '#fff', color: '#2A1A4A', fontSize: '0.78rem', fontFamily: 'monospace', padding: '0.1rem 0.3rem', outline: 'none' },
  giUnit:           { padding: '0.2rem 0 0.2rem 0.35rem', color: '#8877AA', fontSize: '0.74rem', whiteSpace: 'nowrap' },
  giNoteWrap:       { padding: '0.7rem 1rem', border: '1px solid #E0C0C0', borderRadius: '4px', background: '#FFF8F8', maxWidth: '260px' },
  giNoteAlert:      { fontWeight: 700, fontSize: '0.84rem', color: '#cc2222', marginBottom: '0.25rem' },
  giNoteSubtitle:   { fontSize: '0.78rem', color: '#cc2222', lineHeight: 1.45, marginBottom: '0.75rem' },
  giNoteDivider:    { borderBottom: '1px solid #E0C0C0', marginBottom: '0.65rem' },
  giNoteLabel:      { fontSize: '0.73rem', color: '#7A6A9A', fontStyle: 'italic', marginBottom: '0.3rem' },
  giNoteFormula:    { fontFamily: 'monospace', fontSize: '0.83rem', color: '#2A1A4A', fontWeight: 600, letterSpacing: '0.01em', marginBottom: '0.5rem' },
  giNoteResultRow:  { display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.15rem' },
  giNoteResultLabel:{ fontFamily: 'monospace', fontSize: '0.83rem', color: '#5C3D99', fontWeight: 600 },
  giNoteResultVal:  { fontFamily: 'monospace', fontSize: '0.9rem', color: '#3D2270', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  giNoteResultUnit: { fontSize: '0.72rem', color: '#8877AA' },
  giDescRow:        { padding: '0.2rem 0 0.3rem', fontSize: '0.7rem', color: '#7A6A9A', fontStyle: 'italic' },
  giDesc2:          { padding: '0.2rem 0 0.2rem 0.5rem', fontSize: '0.7rem', color: '#7A6A9A', fontStyle: 'italic', whiteSpace: 'nowrap' },
  giDesc:           { padding: '0.35rem 0 0.05rem', fontSize: '0.7rem', color: '#7A6A9A', fontStyle: 'italic' },
  infoPanel:        { margin: '0 0 1.5rem', padding: '0.5rem 0.75rem', border: '1px solid #1e3a5a', borderRadius: '4px', background: '#060610' },
  infoPanelTitle:   { fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.25rem' },
  infoPanelNote:    { fontSize: '0.72rem', color: '#667', marginBottom: '0.5rem', fontStyle: 'italic' },
}
