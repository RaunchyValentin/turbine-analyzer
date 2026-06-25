import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import ValueCell from '../ValueCell'

export default function RunUpController({ data, turbineId, onOverrideSaved }) {
  const sheetId = data.id
  const blocks = data.blocks || []
  const f2Block    = blocks.find(b => b.name?.includes('|F2'))
  const vbBlock    = blocks.find(b => b.name?.includes('VBNTM'))
  const pilotGas   = data.pilot_gas || []

  const chartF2 = useMemo(() => {
    if (!f2Block) return []
    return f2Block.points
      .filter(p => p.x_value != null && p.y_value != null)
      .map(p => ({ x: +p.x_value, y: +p.y_value }))
      .sort((a, b) => a.x - b.x)
  }, [f2Block])

  const chartVB = useMemo(() => {
    if (!vbBlock) return []
    return vbBlock.points
      .filter(p => p.x_value != null && p.y_value != null)
      .map(p => ({ x: +p.x_value, y: +p.y_value }))
      .sort((a, b) => a.x - b.x)
  }, [vbBlock])

  const chartPG = useMemo(() =>
    pilotGas.filter(p => p.mPilot != null).map(p => ({ x: p.speed, y: p.mPilot })),
    [pilotGas]
  )

  const noData = chartF2.length === 0

  return (
    <div>
      {/* Three tables side-by-side */}
      <div style={S.tablesRow}>
        {/* TABLE 1: F2 */}
        {f2Block && (
          <div style={S.tableWrap}>
            <div style={S.blockHdr}>
              <span style={S.blockName}>{f2Block.name}</span>
              <div style={S.blockDesc}>{f2Block.description}</div>
            </div>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>SREL (n)</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>{f2Block.x_label}</th>
                  <th style={S.th}>SREL (NG)</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>{f2Block.y_label}</th>
                </tr>
              </thead>
              <tbody>
                {f2Block.points.map((pt, i) => (
                  <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                    <td style={S.tdKey}>{pt.x_srel}</td>
                    <td style={S.tdVal}>
                      <ValueCell srelKey={pt.x_srel} value={pt.x_value} originalValue={pt.x_original}
                        overridden={pt.x_overridden} editable={true} turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                    </td>
                    <td style={S.tdKey}>{pt.y_srel}</td>
                    <td style={S.tdVal}>
                      <ValueCell srelKey={pt.y_srel} value={pt.y_value} originalValue={pt.y_original}
                        overridden={pt.y_overridden} editable={true} turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TABLE 2: VBNTM */}
        {vbBlock && (
          <div style={S.tableWrap}>
            <div style={S.blockHdr}>
              <span style={S.blockName}>{vbBlock.name}</span>
              <div style={S.blockDesc}>{vbBlock.description}</div>
            </div>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>SREL (n)</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>{vbBlock.x_label}</th>
                  <th style={S.th}>SREL (VB)</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>{vbBlock.y_label}</th>
                </tr>
              </thead>
              <tbody>
                {vbBlock.points.map((pt, i) => (
                  <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                    <td style={S.tdKey}>{pt.x_srel}</td>
                    <td style={S.tdVal}>
                      <ValueCell srelKey={pt.x_srel} value={pt.x_value} originalValue={pt.x_original}
                        overridden={pt.x_overridden} editable={true} turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                    </td>
                    <td style={S.tdKey}>{pt.y_srel}</td>
                    <td style={S.tdVal}>
                      <ValueCell srelKey={pt.y_srel} value={pt.y_value} originalValue={pt.y_original}
                        overridden={pt.y_overridden} editable={true} turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TABLE 3: Pilot Gas (computed) */}
        {pilotGas.length > 0 && (
          <div style={S.tableWrap}>
            <div style={S.blockHdr}>
              <span style={{ ...S.blockName, color: '#4caf7d' }}>Pilot Gas — COMPUTED</span>
              <div style={S.blockDesc}>= mNG − mPremix (interpolated from VBNTM)</div>
            </div>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, textAlign: 'right' }}>n, Hz</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>mNG, kg/s</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>mVB, kg/s</th>
                  <th style={{ ...S.th, textAlign: 'right', color: '#4caf7d' }}>mPG, kg/s</th>
                </tr>
              </thead>
              <tbody>
                {pilotGas.map((p, i) => (
                  <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                    <td style={{ ...S.tdNum }}>{p.speed ?? '#N/A'}</td>
                    <td style={{ ...S.tdNum, color: '#778' }}>{p.mNG ?? '#N/A'}</td>
                    <td style={{ ...S.tdNum, color: '#778' }}>{p.mPremix != null ? p.mPremix.toFixed(3) : '—'}</td>
                    <td style={{ ...S.tdNum, color: p.mPilot != null ? '#4caf7d' : '#663' }}>
                      {p.mPilot != null ? p.mPilot.toFixed(3) : '#N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Three charts */}
      <div style={S.chartsRow}>
        {[
          { title: 'Total NG Mass Flow — F2', data: chartF2, color: '#5b9bd5', ylabel: 'mNG, kg/s' },
          { title: 'Premix Gas — VBNTM',       data: chartVB, color: '#e67e22', ylabel: 'mVB, kg/s' },
          { title: 'Pilot Gas (computed)',       data: chartPG, color: '#4caf7d', ylabel: 'mPG, kg/s' },
        ].map(({ title, data: pts, color, ylabel }) => (
          <div key={title} style={S.chartBox}>
            <div style={{ ...S.chartTitle, color }}>{title}</div>
            {pts.length > 1 ? (
              <Plot
                data={[{ x: pts.map(p => p.x), y: pts.map(p => p.y), type: 'scatter', mode: 'lines+markers',
                  line: { color, width: 2 }, marker: { size: 4, color } }]}
                layout={{
                  paper_bgcolor: '#0a0a18', plot_bgcolor: '#0d0d1e',
                  font: { color: '#aaa', size: 10 },
                  xaxis: { title: 'Speed, Hz', gridcolor: '#1e1e30', zerolinecolor: '#333' },
                  yaxis: { title: ylabel,       gridcolor: '#1e1e30', zerolinecolor: '#333' },
                  margin: { l: 55, r: 10, t: 8, b: 40 }, showlegend: false,
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '220px' }}
              />
            ) : (
              <div style={S.noData}>No data — all SREL values #N/A</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const S = {
  tablesRow:  { display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '1.5rem' },
  tableWrap:  { flexShrink: 0 },
  blockHdr:   { marginBottom: '0.4rem' },
  blockName:  { fontFamily: 'monospace', color: '#5b9bd5', fontWeight: 700, fontSize: '0.82rem' },
  blockDesc:  { color: '#778', fontSize: '0.74rem', marginTop: '0.1rem' },
  note:       { color: '#446', fontSize: '0.68rem', marginTop: '0.2rem', paddingLeft: '0.2rem' },
  table:      { borderCollapse: 'collapse', fontSize: '0.78rem' },
  th:         { background: '#0d0d20', color: '#556', padding: '0.25rem 0.5rem', textAlign: 'left', borderBottom: '1px solid #222', whiteSpace: 'nowrap', fontWeight: 600 },
  rowEven:    { background: '#0a0a18' },
  rowOdd:     { background: '#0d0d1e' },
  tdKey:      { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', color: '#5b9bd5', fontFamily: 'monospace', fontSize: '0.72rem', whiteSpace: 'nowrap' },
  tdVal:      { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '64px' },
  tdNum:      { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#c8c8d8', fontSize: '0.78rem' },
  chartsRow:  { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
  chartBox:   { flex: '1 1 260px', minWidth: 0 },
  chartTitle: { fontSize: '0.76rem', fontWeight: 600, marginBottom: '0.3rem' },
  noData:     { height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a14', border: '1px solid #1e1e2e', color: '#663', fontSize: '0.78rem' },
}
