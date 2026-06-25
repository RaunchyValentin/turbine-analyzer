import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import ValueCell from '../ValueCell'

function interp(points, x) {
  const s = points.filter(p => p.x != null && p.y != null).sort((a, b) => a.x - b.x)
  if (!s.length) return null
  if (x <= s[0].x) return s[0].y
  if (x >= s[s.length - 1].x) return s[s.length - 1].y
  for (let i = 0; i < s.length - 1; i++) {
    if (x >= s[i].x && x <= s[i + 1].x) {
      const t = (x - s[i].x) / (s[i + 1].x - s[i].x)
      return s[i].y + t * (s[i + 1].y - s[i].y)
    }
  }
  return null
}

export default function RunUpController({ data, turbineId, onOverrideSaved }) {
  const sheetId  = data.id
  const blocks   = data.blocks || []
  const f2Block  = blocks.find(b => b.name?.includes('|F2'))
  const vbBlock  = blocks.find(b => b.name?.includes('VBNTM'))
  const pilotGas = data.pilot_gas || []

  // Build combined chart data (all speeds from F2 + VBNTM)
  const combinedChart = useMemo(() => {
    const f2pts  = (f2Block?.points  || []).filter(p => p.x_value != null).map(p => ({ x: +p.x_value, y: +p.y_value }))
    const vbpts  = (vbBlock?.points  || []).filter(p => p.x_value != null).map(p => ({ x: +p.x_value, y: +p.y_value }))
    const pgMap  = new Map(pilotGas.filter(p => p.mPilot != null).map(p => [p.speed, p.mPilot]))

    const speedSet = new Map()
    f2pts.forEach(p => speedSet.set(p.x, { n: p.x }))
    vbpts.forEach(p => { if (!speedSet.has(p.x)) speedSet.set(p.x, { n: p.x }) })

    return Array.from(speedSet.values())
      .sort((a, b) => a.n - b.n)
      .map(pt => {
        const f2 = f2pts.find(p => p.x === pt.n)
        const mVB = interp(vbpts, pt.n)
        return { n: pt.n, mNG: f2?.y ?? null, mVB, mPG: pgMap.get(pt.n) ?? null }
      })
      .filter(d => d.mNG !== null || d.mVB !== null || d.mPG !== null)
  }, [f2Block, vbBlock, pilotGas])

  const hasChart = combinedChart.length > 0

  return (
    <div>
      {/* Three tables side-by-side */}
      <div style={S.tablesRow}>

        {/* TABLE 1: F2 — Total NG mass flow */}
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
                        overridden={pt.x_overridden} editable={true}
                        turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                    </td>
                    <td style={S.tdKey}>{pt.y_srel}</td>
                    <td style={S.tdVal}>
                      <ValueCell srelKey={pt.y_srel} value={pt.y_value} originalValue={pt.y_original}
                        overridden={pt.y_overridden} editable={true}
                        turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TABLE 2: VBNTM — Premix Gas */}
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
                        overridden={pt.x_overridden} editable={true}
                        turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                    </td>
                    <td style={S.tdKey}>{pt.y_srel}</td>
                    <td style={S.tdVal}>
                      <ValueCell srelKey={pt.y_srel} value={pt.y_value} originalValue={pt.y_original}
                        overridden={pt.y_overridden} editable={true}
                        turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TABLE 3: PG calculation (computed) */}
        {pilotGas.length > 0 && (
          <div style={S.tableWrap}>
            <div style={{ ...S.blockHdr, background: '#0a1a0a', padding: '3px 6px', borderBottom: '1px solid #1a3a1a' }}>
              <span style={{ ...S.blockName, color: '#4caf7d' }}>PG calculation</span>
              <div style={{ ...S.blockDesc, color: '#3a7a4a' }}>m PG, kg/s = mNG − mVB</div>
            </div>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, textAlign: 'right', background: '#0d2a0d' }}>n, Hz</th>
                  <th style={{ ...S.th, textAlign: 'right', background: '#0d2a0d' }}>NG<br/>mass flow,<br/>kg/s</th>
                  <th style={{ ...S.th, textAlign: 'right', background: '#0d2a0d' }}>Premix Gas<br/>mass flow,<br/>kg/s</th>
                  <th style={{ ...S.th, textAlign: 'right', background: '#0d2a0d', color: '#4caf7d' }}>m PG, kg/s<br/>=mNG−mVB</th>
                </tr>
              </thead>
              <tbody>
                {pilotGas.map((p, i) => (
                  <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                    <td style={S.tdNum}>{p.speed ?? '#N/A'}</td>
                    <td style={{ ...S.tdNum, color: '#778' }}>{p.mNG ?? '#N/A'}</td>
                    <td style={{ ...S.tdNum, color: '#778' }}>
                      {p.mPremix != null ? p.mPremix.toFixed(3) : '—'}
                    </td>
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

      {/* Single combined chart — Run up controller */}
      <div style={{ marginTop: '1.5rem' }}>
        <div style={S.chartTitle}>Run up controller</div>
        {hasChart ? (
          <Plot
            data={[
              {
                x: combinedChart.filter(d => d.mNG != null).map(d => d.n),
                y: combinedChart.filter(d => d.mNG != null).map(d => d.mNG),
                type: 'scatter', mode: 'lines+markers', name: 'NG mass flow',
                line: { color: '#5b9bd5', width: 2 }, marker: { size: 4 },
              },
              {
                x: combinedChart.filter(d => d.mVB != null).map(d => d.n),
                y: combinedChart.filter(d => d.mVB != null).map(d => d.mVB),
                type: 'scatter', mode: 'lines+markers', name: 'Premix Gas mass flow',
                line: { color: '#888', width: 2, dash: 'dash' }, marker: { size: 4 },
              },
              {
                x: combinedChart.filter(d => d.mPG != null).map(d => d.n),
                y: combinedChart.filter(d => d.mPG != null).map(d => d.mPG),
                type: 'scatter', mode: 'lines+markers', name: 'PG mass flow',
                line: { color: '#4caf7d', width: 2 }, marker: { size: 4 },
              },
            ]}
            layout={{
              paper_bgcolor: '#0a0a18', plot_bgcolor: '#0d0d1e',
              font: { color: '#aaa', size: 11 },
              xaxis: { title: 'n, Hz',              gridcolor: '#1e1e30', zerolinecolor: '#333' },
              yaxis: { title: 'gas mass flow, kg/s', gridcolor: '#1e1e30', zerolinecolor: '#333' },
              margin: { l: 60, r: 20, t: 20, b: 45 },
              legend: { bgcolor: '#0d0d1e', bordercolor: '#222', font: { size: 10 }, x: 0.01, y: 0.99 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '300px' }}
          />
        ) : (
          <div style={S.noData}>
            No data — all SREL values #N/A.<br />
            VBNTM static points will appear once F2 speed data is available.
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  tablesRow:  { display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' },
  tableWrap:  { flexShrink: 0 },
  blockHdr:   { marginBottom: '0.4rem' },
  blockName:  { fontFamily: 'monospace', color: '#5b9bd5', fontWeight: 700, fontSize: '0.82rem' },
  blockDesc:  { color: '#778', fontSize: '0.74rem', marginTop: '0.1rem' },
  table:      { borderCollapse: 'collapse', fontSize: '0.78rem' },
  th:         { background: '#0d0d20', color: '#556', padding: '0.25rem 0.5rem', textAlign: 'left', borderBottom: '1px solid #222', whiteSpace: 'nowrap', fontWeight: 600, verticalAlign: 'bottom' },
  rowEven:    { background: '#0a0a18' },
  rowOdd:     { background: '#0d0d1e' },
  tdKey:      { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', color: '#5b9bd5', fontFamily: 'monospace', fontSize: '0.72rem', whiteSpace: 'nowrap' },
  tdVal:      { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '64px' },
  tdNum:      { padding: '0.2rem 0.5rem', borderBottom: '1px solid #141420', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#c8c8d8', fontSize: '0.78rem' },
  chartTitle: { fontSize: '0.82rem', fontWeight: 700, color: '#c0c8d8', textAlign: 'center', marginBottom: '0.4rem', letterSpacing: '0.05em' },
  noData:     { height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: '#0a0a14', border: '1px solid #1e1e2e', color: '#663', fontSize: '0.78rem', lineHeight: 1.6 },
}
