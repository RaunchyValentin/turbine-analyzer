import React, { useState, useMemo } from 'react'
import Plot from 'react-plotly.js'
import ValueCell from '../ValueCell'

const COLORS = ['#5b9bd5', '#4caf7d', '#e67e22', '#9b59b6', '#e74c3c']

export default function PolyTablePaired({ data, turbineId, onOverrideSaved }) {
  const [interpolation, setInterpolation] = useState('linear')
  const [mode, setMode] = useState('standard')
  const sheetId = data.id
  const hasModeToggle = !!data.mode_toggle
  const activeBlocks = hasModeToggle && mode === 'split' ? (data.blocks_split || []) : (data.blocks || [])

  const chartTraces = useMemo(() => {
    return activeBlocks.map((block, i) => {
      const xs = [], ys = []
      block.points?.forEach(pt => {
        const x = parseFloat(pt.x_value)
        const y = parseFloat(pt.y_value)
        if (!isNaN(x) && !isNaN(y)) { xs.push(x); ys.push(y) }
      })
      return { xs, ys, name: block.name, color: COLORS[i % COLORS.length] }
    })
  }, [activeBlocks])

  const hasChart = chartTraces.some(t => t.xs.length > 1)

  return (
    <div>
      <div style={styles.controls}>
        {hasModeToggle && <>
          <button
            style={{ ...styles.toggleBtn, ...(mode === 'standard' ? styles.modeActive : {}) }}
            onClick={() => setMode('standard')}
          >{data.mode_toggle.standard || 'Standard'}</button>
          <button
            style={{ ...styles.toggleBtn, ...(mode === 'split' ? styles.modeActive : {}) }}
            onClick={() => setMode('split')}
          >{data.mode_toggle.split || 'Split Control'}</button>
          <span style={{ flex: 1 }} />
        </>}
        {['linear', 'spline'].map(m => (
          <button
            key={m}
            style={{ ...styles.toggleBtn, ...(interpolation === m ? styles.toggleActive : {}) }}
            onClick={() => setInterpolation(m)}
          >{m}</button>
        ))}
      </div>

      <div style={styles.tablesRow}>
        {activeBlocks.map((block, bi) => (
          <div key={bi} style={styles.blockWrap}>
            <div style={styles.blockHeader}>
              <span style={styles.blockName}>{block.name}</span>
              <div style={styles.blockDesc}>{block.description}</div>
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{block.x_label || 'X key'}</th>
                  <th style={styles.th}>X</th>
                  <th style={styles.th}>{block.y_label || 'Y key'}</th>
                  <th style={styles.th}>Y</th>
                </tr>
              </thead>
              <tbody>
                {block.points?.map((pt, pi) => (
                  <tr key={pi} style={pi % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                    <td style={styles.tdKey}>{block.static ? (pt.x_label || '◆') : pt.x_srel}</td>
                    <td style={styles.tdVal}>
                      {block.static ? (
                        <span style={styles.staticVal}>{pt.x_value ?? '—'}</span>
                      ) : (
                        <ValueCell
                          srelKey={pt.x_srel}
                          value={pt.x_value}
                          originalValue={pt.x_original}
                          overridden={pt.x_overridden}
                          editable={true}
                          turbineId={turbineId}
                          sheetId={sheetId}
                          onSaved={onOverrideSaved}
                        />
                      )}
                    </td>
                    <td style={styles.tdKey}>{block.static ? (pt.y_label || '◆') : pt.y_srel}</td>
                    <td style={styles.tdVal}>
                      {block.static ? (
                        <span style={styles.staticVal}>{pt.y_value ?? '—'}</span>
                      ) : (
                        <ValueCell
                          srelKey={pt.y_srel}
                          value={pt.y_value}
                          originalValue={pt.y_original}
                          overridden={pt.y_overridden}
                          editable={true}
                          turbineId={turbineId}
                          sheetId={sheetId}
                          onSaved={onOverrideSaved}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {hasChart && (
        <div style={{ marginTop: '1rem' }}>
          <Plot
            data={chartTraces.filter(t => t.xs.length > 1).map((t, i) => ({
              x: t.xs, y: t.ys, type: 'scatter', mode: 'lines+markers',
              name: t.name,
              line: { shape: interpolation, color: t.color, width: 2 },
              marker: { size: 5, color: t.color },
            }))}
            layout={{
              paper_bgcolor: '#0a0a18', plot_bgcolor: '#0d0d1e',
              font: { color: '#aaa', size: 11 },
              xaxis: { title: activeBlocks[0]?.x_label, gridcolor: '#1e1e30', zerolinecolor: '#333' },
              yaxis: { title: activeBlocks[0]?.y_label, gridcolor: '#1e1e30', zerolinecolor: '#333' },
              margin: { l: 50, r: 20, t: 20, b: 45 },
              legend: { bgcolor: '#0d0d1e', bordercolor: '#222', font: { size: 10 } },
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '300px' }}
          />
        </div>
      )}
    </div>
  )
}

const styles = {
  controls:    { display: 'flex', gap: '2px', marginBottom: '0.75rem' },
  toggleBtn:   { background: '#1e1e2e', border: '1px solid #333', color: '#888', borderRadius: '3px', cursor: 'pointer', padding: '0.1rem 0.5rem', fontSize: '0.72rem' },
  toggleActive:{ background: '#1a2a3a', borderColor: '#5b9bd5', color: '#5b9bd5' },
  modeActive:  { background: '#1a2a1a', borderColor: '#4caf7d', color: '#4caf7d' },
  tablesRow:   { display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' },
  staticVal:   { color: '#8899bb', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace', fontSize: '0.82rem' },
  blockWrap:   { flexShrink: 0 },
  blockHeader: { marginBottom: '0.4rem' },
  blockName:   { fontFamily: 'monospace', color: '#5b9bd5', fontWeight: 700, fontSize: '0.82rem' },
  blockDesc:   { color: '#888', fontSize: '0.76rem', marginTop: '0.1rem' },
  table:       { borderCollapse: 'collapse', fontSize: '0.8rem' },
  th:          { background: '#0d0d20', color: '#666', padding: '0.25rem 0.5rem', textAlign: 'left', borderBottom: '1px solid #222', whiteSpace: 'nowrap' },
  rowEven:     { background: '#0a0a18' },
  rowOdd:      { background: '#0d0d1e' },
  tdKey:       { padding: '0.2rem 0.5rem', borderBottom: '1px solid #151525', color: '#5b9bd5', fontFamily: 'monospace', fontSize: '0.74rem', whiteSpace: 'nowrap' },
  tdVal:       { padding: '0.2rem 0.5rem', borderBottom: '1px solid #151525', whiteSpace: 'nowrap' },
}
