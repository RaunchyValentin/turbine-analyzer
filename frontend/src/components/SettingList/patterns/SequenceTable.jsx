import React from 'react'
import ValueCell from '../ValueCell'

export default function SequenceTable({ data, turbineId, onOverrideSaved }) {
  const sheetId = data.id
  const cols = data.columns || ['Speed, Hz', 'OTC, °C', 'IGV, %']

  return (
    <div>
      {data.sections?.map((section, si) => (
        <div key={si} style={styles.section}>
          {section.header && <div style={styles.sectionBanner}>{section.header}</div>}
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.thTag }}>Tag</th>
                {cols.map((c, i) => <th key={i} style={{ ...styles.th, ...styles.thNum }}>{c}</th>)}
                <th style={{ ...styles.th, width: '100%' }}>Operational Mode / Event</th>
              </tr>
            </thead>
            <tbody>
              {section.rows?.map((row, ri) => {
                if (row.is_section) {
                  return (
                    <tr key={ri} style={styles.rowSection}>
                      <td colSpan={cols.length + 2} style={styles.tdSection}>{row.label}</td>
                    </tr>
                  )
                }
                const vals = [row.speed ?? '', row.otc ?? '', row.igv ?? '']
                return (
                  <tr key={ri} style={ri % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                    <td style={styles.tdTag}>{row.srel || ''}</td>
                    {vals.slice(0, cols.length).map((v, i) => (
                      <td key={i} style={styles.tdNum}>{v}</td>
                    ))}
                    <td style={{ ...styles.tdDesc, ...(row.emphasis ? styles.tdEmphasis : {}) }}>
                      {row.desc || ''}
                    </td>
                  </tr>
                )
              })}
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
  section:      { marginBottom: '0' },
  sectionBanner:{ background: '#EDE3F8', color: '#2A1A4A', padding: '0.4rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, borderLeft: '3px solid #e67e22', marginBottom: 0 },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  th:           { background: '#0d0d22', color: '#556', padding: '0.3rem 0.55rem', textAlign: 'left', borderBottom: '2px solid #222', whiteSpace: 'nowrap', fontWeight: 600 },
  thTag:        { minWidth: '100px', color: '#667' },
  thNum:        { width: '72px', textAlign: 'right', color: '#667' },

  rowSection:   { background: '#111128' },
  tdSection:    { padding: '0.28rem 0.6rem', color: '#c8c8ee', fontWeight: 700, fontSize: '0.79rem', borderTop: '1px solid #252540', borderBottom: '1px solid #1e1e38', letterSpacing: '0.01em' },

  rowEven:      { background: '#09090f' },
  rowOdd:       { background: '#0c0c18' },

  tdTag:        { padding: '0.2rem 0.55rem', borderBottom: '1px solid #141420', color: '#5C3D99', fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'nowrap', minWidth: '100px' },
  tdNum:        { padding: '0.2rem 0.55rem', borderBottom: '1px solid #141420', color: '#c8c8d8', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', width: '72px' },
  tdDesc:       { padding: '0.2rem 0.75rem', borderBottom: '1px solid #141420', color: '#9888B8', lineHeight: 1.4 },
  tdEmphasis:   { color: '#ddd', fontWeight: 600 },

  notImpl:      { color: '#9888B8', fontSize: '0.85rem', padding: '2rem', textAlign: 'center' },
}
