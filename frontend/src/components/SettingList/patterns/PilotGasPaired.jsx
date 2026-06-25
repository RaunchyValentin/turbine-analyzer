import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import ValueCell from '../ValueCell'

function StaticVal({ value }) {
  return <span style={S.staticVal}>◆ {value ?? '—'}</span>
}

function PairedTable({ section, pts, label, disabled, turbineId, sheetId, onOverrideSaved }) {
  return (
    <div style={S.tableWrap}>
      <div style={S.tableHdr}>
        <span style={{ ...S.tableLabel, ...(disabled ? S.tableLabelDim : {}) }}>{label}</span>
        {disabled && <span style={S.deactivatedBadge}>DEACTIVATED</span>}
      </div>
      {disabled && (
        <div style={S.unloadingBanner}>
          ⚠ Initially deactivated. Unloading curve not yet active for this GT.
        </div>
      )}
      <table style={{ ...S.table, opacity: disabled ? 0.5 : 1 }}>
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
    line: { color: '#5b9bd5', width: 2 }, marker: { size: 4 },
  })
  if (unlPts.length > 1) traces.push({
    x: unlPts.map(p => +p.xv), y: unlPts.map(p => +p.yv),
    type: 'scatter', mode: 'lines+markers', name: 'Unloading',
    line: { color: '#888', width: 2, dash: 'dash' }, marker: { size: 4 },
  })
  if (!traces.length) return null

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: '#0a0a18', plot_bgcolor: '#0d0d1e', font: { color: '#aaa', size: 11 },
        xaxis: { title: section.x_label, gridcolor: '#1e1e30', zerolinecolor: '#333' },
        yaxis: { title: section.y_label, gridcolor: '#1e1e30', zerolinecolor: '#333' },
        margin: { l: 55, r: 20, t: 15, b: 45 },
        legend: { bgcolor: '#0d0d1e', bordercolor: '#222', font: { size: 10 }, x: 0.01, y: 0.99 },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '260px' }}
    />
  )
}

function InfoPanel({ panel, color = '#5b9bd5' }) {
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
  const unlDisabled = data.unloading_disabled

  return (
    <div>
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
              disabled={false}
              turbineId={turbineId}
              sheetId={sheetId}
              onOverrideSaved={onOverrideSaved}
            />
            <PairedTable
              section={section}
              pts={section.points_u || []}
              label={section.unloading_label || 'Unloading'}
              disabled={!!unlDisabled}
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
  section:          { marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid #1a1a2e' },
  sectionTitle:     { fontSize: '0.88rem', fontWeight: 700, color: '#c0c8d8', marginBottom: '0.35rem', letterSpacing: '0.02em' },
  staticNote:       { fontSize: '0.72rem', color: '#667788', marginBottom: '0.4rem', fontStyle: 'italic' },
  pairRow:          { display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' },
  tableWrap:        { flexShrink: 0 },
  tableHdr:         { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' },
  tableLabel:       { fontFamily: 'monospace', color: '#5b9bd5', fontWeight: 700, fontSize: '0.8rem' },
  tableLabelDim:    { color: '#445566' },
  deactivatedBadge: { fontSize: '0.62rem', color: '#aa7700', background: '#1a1200', border: '1px solid #443300', borderRadius: '3px', padding: '0.05rem 0.35rem' },
  unloadingBanner:  { fontSize: '0.72rem', color: '#aa7700', background: '#1a1200', border: '1px solid #332200', borderRadius: '3px', padding: '0.25rem 0.5rem', marginBottom: '0.3rem', maxWidth: '320px' },
  table:            { borderCollapse: 'collapse', fontSize: '0.78rem' },
  th:               { background: '#0d0d20', color: '#556', padding: '0.25rem 0.5rem', textAlign: 'left', borderBottom: '1px solid #222', whiteSpace: 'nowrap', fontWeight: 600 },
  rowEven:          { background: '#0a0a18' },
  rowOdd:           { background: '#0d0d1e' },
  tdKey:            { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', color: '#5b9bd5', fontFamily: 'monospace', fontSize: '0.72rem', whiteSpace: 'nowrap' },
  tdVal:            { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '64px' },
  tdDesc:           { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', color: '#aaa', fontSize: '0.75rem' },
  staticVal:        { color: '#7799bb', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem' },
  infoPanel:        { margin: '0 0 1.5rem', padding: '0.5rem 0.75rem', border: '1px solid #1e3a5a', borderRadius: '4px', background: '#060610' },
  infoPanelTitle:   { fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.25rem' },
  infoPanelNote:    { fontSize: '0.72rem', color: '#667', marginBottom: '0.5rem', fontStyle: 'italic' },
}
