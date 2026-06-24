import React from 'react'
import ValueCell from '../ValueCell'

export default function ScalarTable({ data, turbineId, onOverrideSaved }) {
  const sheetId = data.id

  return (
    <div>
      {data.sections?.map((section, si) => (
        <div key={si} style={styles.section}>
          {section.header && (
            <div style={styles.sectionHeader}>{section.header}</div>
          )}
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>SREL / Block</th>
                <th style={styles.th}>Value</th>
                <th style={styles.th}>Unit</th>
                <th style={{ ...styles.th, width: '100%' }}>Explanation</th>
              </tr>
            </thead>
            <tbody>
              {section.rows?.map((row, ri) => (
                <tr key={ri} style={ri % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                  <td style={styles.td}>
                    <span style={row.manual ? styles.manualKey : styles.srelKey}>
                      {row.srel || row.key || '—'}
                    </span>
                  </td>
                  <td style={styles.tdValue}>
                    <ValueCell
                      srelKey={row.srel || row.key}
                      value={row.value}
                      originalValue={row.original_value}
                      overridden={row.overridden}
                      manual={!!row.manual}
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
        </div>
      ))}
    </div>
  )
}

const styles = {
  section:       { marginBottom: '1.5rem' },
  sectionHeader: { background: '#161630', color: '#c0c0e0', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, borderLeft: '3px solid #5b9bd5', marginBottom: '0' },
  table:         { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  th:            { background: '#0d0d20', color: '#666', fontWeight: 600, padding: '0.3rem 0.6rem', textAlign: 'left', borderBottom: '1px solid #222', whiteSpace: 'nowrap' },
  rowEven:       { background: '#0a0a18' },
  rowOdd:        { background: '#0d0d1e' },
  td:            { padding: '0.25rem 0.6rem', borderBottom: '1px solid #151525', whiteSpace: 'nowrap' },
  tdValue:       { padding: '0.25rem 0.6rem', borderBottom: '1px solid #151525', whiteSpace: 'nowrap' },
  tdUnit:        { padding: '0.25rem 0.6rem', borderBottom: '1px solid #151525', color: '#777', whiteSpace: 'nowrap' },
  tdDesc:        { padding: '0.25rem 0.6rem', borderBottom: '1px solid #151525', color: '#aaa' },
  srelKey:       { color: '#5b9bd5', fontFamily: 'monospace', fontSize: '0.8rem' },
  manualKey:     { color: '#888', fontStyle: 'italic', fontSize: '0.75rem' },
}
