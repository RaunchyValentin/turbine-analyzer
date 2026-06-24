import React from 'react'
import ValueCell from '../ValueCell'

export default function SequenceTable({ data, turbineId, onOverrideSaved }) {
  const sheetId = data.id

  return (
    <div>
      {data.sections?.map((section, si) => (
        <div key={si} style={styles.section}>
          {section.header && <div style={styles.sectionHeader}>{section.header}</div>}
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>SREL</th>
                <th style={styles.th}>Speed, Hz</th>
                <th style={styles.th}>OTC, °C</th>
                <th style={styles.th}>IGV, %</th>
                <th style={{ ...styles.th, width: '100%' }}>Event / Mode</th>
              </tr>
            </thead>
            <tbody>
              {section.rows?.map((row, ri) => (
                <tr key={ri} style={{ ...(ri % 2 === 0 ? styles.rowEven : styles.rowOdd), ...(row.is_section ? styles.subSection : {}) }}>
                  {row.is_section
                    ? <td colSpan={5} style={styles.subSectionCell}>{row.label}</td>
                    : <>
                        <td style={styles.tdKey}>{row.srel || '—'}</td>
                        <td style={styles.tdVal}>
                          {row.srel_speed
                            ? <ValueCell srelKey={row.srel_speed} value={row.speed_value} originalValue={row.speed_original}
                                overridden={row.speed_overridden} editable={true} turbineId={turbineId} sheetId={sheetId} onSaved={onOverrideSaved} />
                            : <span style={styles.static}>{row.speed || ''}</span>
                          }
                        </td>
                        <td style={styles.tdVal}>{row.otc || ''}</td>
                        <td style={styles.tdVal}>{row.igv || ''}</td>
                        <td style={styles.tdDesc}>{row.desc || row.label || ''}</td>
                      </>
                  }
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {!data.sections && (
        <div style={styles.notImpl}>Sequence table — config not yet available for this sheet.</div>
      )}
    </div>
  )
}

const styles = {
  section:       { marginBottom: '1.5rem' },
  sectionHeader: { background: '#161630', color: '#c0c0e0', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, borderLeft: '3px solid #e67e22', marginBottom: 0 },
  table:         { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th:            { background: '#0d0d20', color: '#666', padding: '0.25rem 0.55rem', textAlign: 'left', borderBottom: '1px solid #222', whiteSpace: 'nowrap' },
  rowEven:       { background: '#0a0a18' },
  rowOdd:        { background: '#0d0d1e' },
  subSection:    { background: '#111120' },
  subSectionCell:{ padding: '0.3rem 0.55rem', color: '#9b59b6', fontWeight: 600, fontSize: '0.78rem', borderBottom: '1px solid #1e1e30' },
  tdKey:         { padding: '0.22rem 0.55rem', borderBottom: '1px solid #151525', color: '#5b9bd5', fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap' },
  tdVal:         { padding: '0.22rem 0.55rem', borderBottom: '1px solid #151525', whiteSpace: 'nowrap' },
  tdDesc:        { padding: '0.22rem 0.55rem', borderBottom: '1px solid #151525', color: '#aaa' },
  static:        { color: '#e0e0e0' },
  notImpl:       { color: '#555', fontSize: '0.85rem', padding: '2rem', textAlign: 'center' },
}
