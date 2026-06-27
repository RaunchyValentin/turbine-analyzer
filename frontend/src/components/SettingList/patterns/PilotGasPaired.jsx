import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import ValueCell from '../ValueCell'

function StaticVal({ value }) {
  return <span style={S.staticVal}>◆ {value ?? '—'}</span>
}

function SideTable({ st, turbineId, sheetId, onOverrideSaved }) {
  if (!st) return null
  return (
    <div style={S.tableWrap}>
      <div style={S.tableHdr}>
        <span style={S.tableLabel}>{st.label}</span>
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={{ ...S.th, textAlign: 'right' }}>{st.x_label}</th>
            <th style={{ ...S.th, textAlign: 'right' }}>{st.y_label}</th>
          </tr>
        </thead>
        <tbody>
          {(st.points || []).map((pt, i) => (
            <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
              <td style={S.tdVal}>
                <ValueCell srelKey={pt.xk} value={pt.xv} originalValue={pt.xo}
                  overridden={pt.x_overridden} editable
                  turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
              </td>
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

function PairedTable({ section, pts, label, disabled, turbineId, sheetId, onOverrideSaved }) {
  return (
    <div style={S.tableWrap}>
      <div style={S.tableHdr}>
        <span style={S.tableLabel}>{label}</span>
      </div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>SREL</th>
            <th style={{ ...S.th, textAlign: 'right' }}>{section.x_label}</th>
            <th style={S.th}>SREL</th>
            <th style={{ ...S.th, textAlign: 'right' }}>{section.y_label}</th>
          </tr>
        </thead>
        <tbody>
          {pts.map((pt, i) => (
            <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
              <td style={S.tdKey}>{pt.xs === 'static' ? '◆' : pt.xk}</td>
              <td style={S.tdVal}>
                {pt.xs === 'static' ? (
                  <StaticVal value={pt.xv} />
                ) : (
                  <ValueCell srelKey={pt.xk} value={pt.xv} originalValue={pt.xo}
                    overridden={pt.x_overridden} editable={!disabled}
                    turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                )}
              </td>
              <td style={S.tdKey}>{pt.ys === 'static' ? '◆' : pt.yk}</td>
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

  return (
    <div>
      {/* Gas Temperature definition block (SG121) */}
      {data.gas_temp && <GasTemp panel={data.gas_temp} />}

      {/* Optional gas index panel (SG123) */}
      {data.gas_index && <InfoPanel panel={data.gas_index} color="#4caf7d" />}

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
              turbineId={turbineId}
              sheetId={sheetId}
              onOverrideSaved={onOverrideSaved}
            />
            <PairedTable
              section={section}
              pts={section.points_u || []}
              label={section.unloading_label || 'Unloading'}
              turbineId={turbineId}
              sheetId={sheetId}
              onOverrideSaved={onOverrideSaved}
            />
            <SideTable
              st={section.side_table}
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
  gasTempWrap:      { display: 'flex', alignItems: 'flex-start', gap: '2rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #D0C4E8' },
  gasTempTable:     { flexShrink: 0 },
  gasTempTitle:     { fontSize: '0.82rem', fontWeight: 700, color: '#2A1A4A', marginBottom: '0.4rem' },
  gasTempThGroup:   { background: '#5C3D99', color: '#fff', fontWeight: 700, padding: '0.2rem 0.5rem', border: '1px solid #D0C4E8', fontSize: '0.78rem' },
  gasTempThKey:     { background: '#EDE3F8', color: '#5C3D99', padding: '0.2rem 0.6rem', border: '1px solid #D0C4E8', fontSize: '0.75rem', minWidth: '80px' },
  gasTempThVal:     { background: '#EDE3F8', color: '#5C3D99', padding: '0.2rem 0.6rem', border: '1px solid #D0C4E8', fontSize: '0.75rem', textAlign: 'right', minWidth: '60px', fontWeight: 600 },
  gasTempTdKey:     { padding: '0.2rem 0.6rem', border: '1px solid #D0C4E8', color: '#2A1A4A', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'nowrap' },
  gasTempTdVal:     { padding: '0.2rem 0.6rem', border: '1px solid #D0C4E8', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: '#2A1A4A', fontWeight: 700 },
  gasTempNote:      { fontSize: '0.8rem', color: '#2A1A4A', lineHeight: 1.55, maxWidth: '380px', paddingTop: '1.4rem' },
  infoPanel:        { margin: '0 0 1.5rem', padding: '0.5rem 0.75rem', border: '1px solid #1e3a5a', borderRadius: '4px', background: '#060610' },
  infoPanelTitle:   { fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.25rem' },
  infoPanelNote:    { fontSize: '0.72rem', color: '#667', marginBottom: '0.5rem', fontStyle: 'italic' },
}
