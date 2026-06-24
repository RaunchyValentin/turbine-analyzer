import React, { useState, useMemo } from 'react'
import Plot from 'react-plotly.js'
import ValueCell from '../ValueCell'

export default function MixedSection({ data, turbineId, onOverrideSaved }) {
  const [interpolation, setInterpolation] = useState('linear')
  const sheetId = data.id

  return (
    <div>
      {data.sections?.map((section, si) => {
        const type = section.type || 'scalar'
        return (
          <div key={si} style={styles.section}>
            {section.header && <div style={styles.sectionHeader}>{section.header}</div>}
            {type === 'scalar' && (
              <ScalarRows rows={section.rows} turbineId={turbineId} sheetId={sheetId} onOverrideSaved={onOverrideSaved} />
            )}
            {type === 'poly' && (
              <PolyRows
                section={section}
                turbineId={turbineId}
                sheetId={sheetId}
                interpolation={interpolation}
                onInterpolationChange={setInterpolation}
                onOverrideSaved={onOverrideSaved}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ScalarRows({ rows, turbineId, sheetId, onOverrideSaved }) {
  return (
    <table style={styles.table}>
      <thead>
        <tr>
          <th style={styles.th}>SREL</th>
          <th style={styles.th}>Value</th>
          <th style={styles.th}>Unit</th>
          <th style={{ ...styles.th, width: '100%' }}>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows?.map((row, ri) => (
          <tr key={ri} style={ri % 2 === 0 ? styles.rowEven : styles.rowOdd}>
            <td style={styles.tdKey}>{row.srel || '—'}</td>
            <td style={styles.tdVal}>
              <ValueCell
                srelKey={row.srel}
                value={row.value}
                originalValue={row.original_value}
                overridden={row.overridden}
                editable={!!row.editable}
                turbineId={turbineId}
                sheetId={sheetId}
                onSaved={onOverrideSaved}
              />
            </td>
            <td style={styles.tdUnit}>{row.unit || ''}</td>
            <td style={styles.tdDesc}>{row.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PolyRows({ section, turbineId, sheetId, interpolation, onInterpolationChange, onOverrideSaved }) {
  const chartData = useMemo(() => {
    const xs = [], ys = []
    section.points?.forEach(pt => {
      const x = parseFloat(pt.x_value)
      const y = parseFloat(pt.y_value)
      if (!isNaN(x) && !isNaN(y)) { xs.push(x); ys.push(y) }
    })
    return { xs, ys }
  }, [section.points])

  return (
    <div>
      <div style={styles.polyHeader}>
        <span style={styles.blockName}>{section.block_name}</span>
        <span style={styles.blockDesc}>{section.description}</span>
        <span style={styles.toggleGroup}>
          {['linear', 'spline'].map(m => (
            <button key={m} style={{ ...styles.toggleBtn, ...(interpolation === m ? styles.toggleActive : {}) }}
              onClick={() => onInterpolationChange(m)}>{m}</button>
          ))}
        </span>
      </div>
      <div style={styles.polyLayout}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>X key</th>
              <th style={styles.th}>{section.x_label || 'X'}</th>
              <th style={styles.th}>Y key</th>
              <th style={styles.th}>{section.y_label || 'Y'}</th>
            </tr>
          </thead>
          <tbody>
            {section.points?.map((pt, pi) => (
              <tr key={pi} style={pi % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                <td style={styles.tdKey}>{pt.x_label || pt.x_srel}</td>
                <td style={styles.tdVal}>
                  <ValueCell srelKey={pt.x_srel} value={pt.x_value} originalValue={pt.x_original}
                    overridden={pt.x_overridden} editable={true} turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                </td>
                <td style={styles.tdKey}>{pt.y_label || pt.y_srel}</td>
                <td style={styles.tdVal}>
                  <ValueCell srelKey={pt.y_srel} value={pt.y_value} originalValue={pt.y_original}
                    overridden={pt.y_overridden} editable={true} turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {chartData.xs.length > 1 && (
          <Plot
            data={[{ x: chartData.xs, y: chartData.ys, type: 'scatter', mode: 'lines+markers',
              line: { shape: interpolation, color: '#5b9bd5', width: 2 }, marker: { size: 5, color: '#4caf7d' } }]}
            layout={{
              paper_bgcolor: '#0a0a18', plot_bgcolor: '#0d0d1e', font: { color: '#aaa', size: 11 },
              xaxis: { title: section.x_label, gridcolor: '#1e1e30' },
              yaxis: { title: section.y_label, gridcolor: '#1e1e30' },
              margin: { l: 50, r: 20, t: 20, b: 45 }, showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '340px', height: '260px' }}
          />
        )}
      </div>
    </div>
  )
}

const styles = {
  section:      { marginBottom: '1.5rem' },
  sectionHeader:{ background: '#161630', color: '#c0c0e0', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, borderLeft: '3px solid #5b9bd5', marginBottom: '0' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th:           { background: '#0d0d20', color: '#666', padding: '0.25rem 0.55rem', textAlign: 'left', borderBottom: '1px solid #222', whiteSpace: 'nowrap' },
  rowEven:      { background: '#0a0a18' },
  rowOdd:       { background: '#0d0d1e' },
  tdKey:        { padding: '0.22rem 0.55rem', borderBottom: '1px solid #151525', color: '#5b9bd5', fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap' },
  tdVal:        { padding: '0.22rem 0.55rem', borderBottom: '1px solid #151525', whiteSpace: 'nowrap' },
  tdUnit:       { padding: '0.22rem 0.55rem', borderBottom: '1px solid #151525', color: '#777', whiteSpace: 'nowrap' },
  tdDesc:       { padding: '0.22rem 0.55rem', borderBottom: '1px solid #151525', color: '#aaa' },
  polyHeader:   { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' },
  blockName:    { fontFamily: 'monospace', color: '#5b9bd5', fontWeight: 700, fontSize: '0.82rem' },
  blockDesc:    { color: '#888', fontSize: '0.78rem' },
  toggleGroup:  { marginLeft: 'auto', display: 'flex', gap: '2px' },
  toggleBtn:    { background: '#1e1e2e', border: '1px solid #333', color: '#888', borderRadius: '3px', cursor: 'pointer', padding: '0.1rem 0.5rem', fontSize: '0.72rem' },
  toggleActive: { background: '#1a2a3a', borderColor: '#5b9bd5', color: '#5b9bd5' },
  polyLayout:   { display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' },
}
