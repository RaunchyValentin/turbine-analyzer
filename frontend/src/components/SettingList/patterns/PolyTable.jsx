import React, { useState, useMemo } from 'react'
import Plot from 'react-plotly.js'
import ValueCell from '../ValueCell'

export default function PolyTable({ data, turbineId, onOverrideSaved }) {
  const [interpolation, setInterpolation] = useState('linear')
  const sheetId = data.id

  return (
    <div>
      {data.blocks?.map((block, bi) => (
        <BlockSection
          key={bi}
          block={block}
          turbineId={turbineId}
          sheetId={sheetId}
          interpolation={interpolation}
          onInterpolationChange={setInterpolation}
          onOverrideSaved={onOverrideSaved}
          showToggle={bi === 0}
        />
      ))}
    </div>
  )
}

function BlockSection({ block, turbineId, sheetId, interpolation, onInterpolationChange, onOverrideSaved, showToggle }) {
  const chartData = useMemo(() => {
    const xs = [], ys = []
    block.points?.forEach(pt => {
      const x = parseFloat(pt.x_value)
      const y = parseFloat(pt.y_value)
      if (!isNaN(x) && !isNaN(y)) { xs.push(x); ys.push(y) }
    })
    return { xs, ys }
  }, [block.points])

  const hasData = chartData.xs.length > 1

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <span style={styles.blockName}>{block.name}</span>
        <span style={styles.blockDesc}>{block.description}</span>
        {showToggle && (
          <span style={styles.toggleGroup}>
            {['linear', 'spline'].map(mode => (
              <button
                key={mode}
                style={{ ...styles.toggleBtn, ...(interpolation === mode ? styles.toggleActive : {}) }}
                onClick={() => onInterpolationChange(mode)}
              >{mode}</button>
            ))}
          </span>
        )}
      </div>

      <div style={styles.layout}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>X key</th>
              <th style={styles.th}>{block.x_label || 'X'}</th>
              <th style={styles.th}>Y key</th>
              <th style={styles.th}>{block.y_label || 'Y'}</th>
            </tr>
          </thead>
          <tbody>
            {block.points?.map((pt, pi) => (
              <tr key={pi} style={pi % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                <td style={styles.tdKey}>{pt.x_srel}</td>
                <td style={styles.tdVal}>
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
                </td>
                <td style={styles.tdKey}>{pt.y_srel}</td>
                <td style={styles.tdVal}>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {hasData && (
          <Plot
            data={[{
              x: chartData.xs,
              y: chartData.ys,
              type: 'scatter',
              mode: 'lines+markers',
              line: { shape: interpolation, color: '#5C3D99', width: 2 },
              marker: { size: 6, color: '#4caf7d' },
              name: block.name,
            }]}
            layout={{
              paper_bgcolor: '#F7F3FC',
              plot_bgcolor: '#ffffff',
              font: { color: '#9888B8', size: 11 },
              xaxis: { title: block.x_label, gridcolor: '#EDE3F8', zerolinecolor: '#D0C4E8' },
              yaxis: { title: block.y_label, gridcolor: '#EDE3F8', zerolinecolor: '#D0C4E8' },
              margin: { l: 50, r: 20, t: 20, b: 45 },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '360px', height: '280px' }}
          />
        )}
      </div>

      {block.notes?.length > 0 && (
        <div style={styles.notes}>{block.notes.join(' · ')}</div>
      )}
    </div>
  )
}

const styles = {
  block:       { marginBottom: '2rem' },
  blockHeader: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' },
  blockName:   { fontFamily: 'monospace', color: '#5C3D99', fontWeight: 700, fontSize: '0.85rem' },
  blockDesc:   { color: '#6A50A0', fontSize: '0.8rem' },
  toggleGroup: { marginLeft: 'auto', display: 'flex', gap: '2px' },
  toggleBtn:   { background: '#F4F0FA', border: '1px solid #D0C4E8', color: '#6A50A0', borderRadius: '3px', cursor: 'pointer', padding: '0.1rem 0.5rem', fontSize: '0.72rem' },
  toggleActive:{ background: '#EDE3F8', borderColor: '#5C3D99', color: '#5C3D99' },
  layout:      { display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  table:       { borderCollapse: 'collapse', fontSize: '0.8rem', flexShrink: 0 },
  th:          { background: '#F7F3FC', color: '#9888B8', padding: '0.25rem 0.55rem', textAlign: 'left', borderBottom: '1px solid #D0C4E8', whiteSpace: 'nowrap' },
  rowEven:     { background: '#F7F3FC' },
  rowOdd:      { background: '#ffffff' },
  tdKey:       { padding: '0.22rem 0.55rem', borderBottom: '1px solid #D0C4E8', color: '#5C3D99', fontFamily: 'monospace', fontSize: '0.76rem', whiteSpace: 'nowrap' },
  tdVal:       { padding: '0.22rem 0.55rem', borderBottom: '1px solid #D0C4E8', whiteSpace: 'nowrap' },
  notes:       { marginTop: '0.4rem', color: '#9888B8', fontSize: '0.75rem', fontStyle: 'italic' },
}
