import React from 'react'

export default function ReadOnlyCalc({ data }) {
  return (
    <div style={styles.wrapper}>
      {data.message && <div style={styles.message}>{data.message}</div>}

      {data.sections?.map((section, si) => (
        <div key={si} style={styles.section}>
          {section.header && <div style={styles.sectionHeader}>{section.header}</div>}
          {section.rows?.length > 0 && (
            <table style={styles.table}>
              <tbody>
                {section.rows.map((row, ri) => (
                  <tr key={ri} style={ri % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                    <td style={styles.tdKey}>{row.label || row.srel || '—'}</td>
                    <td style={styles.tdVal}>{row.value ?? '—'}</td>
                    <td style={styles.tdUnit}>{row.unit || ''}</td>
                    <td style={styles.tdDesc}>{row.desc || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {section.note && <div style={styles.note}>{section.note}</div>}
        </div>
      ))}

      {!data.sections && !data.message && (
        <div style={styles.placeholder}>
          <div style={styles.icon}>⚙</div>
          <div>This sheet contains computed or complex data.</div>
          <div style={styles.sub}>Implementation pending (Priority 3–4).</div>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrapper:       { padding: '0.5rem 0' },
  message:       { color: '#6A50A0', fontSize: '0.85rem', padding: '0.5rem 0', marginBottom: '1rem' },
  section:       { marginBottom: '1.5rem' },
  sectionHeader: { background: '#5C3D99', color: '#6A50A0', padding: '0.3rem 0.75rem', fontSize: '0.78rem', fontWeight: 600, borderLeft: '3px solid #444', marginBottom: 0 },
  table:         { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },
  rowEven:       { background: '#F7F3FC' },
  rowOdd:        { background: '#ffffff' },
  tdKey:         { padding: '0.2rem 0.55rem', borderBottom: '1px solid #D0C4E8', color: '#6A50A0', fontFamily: 'monospace', fontSize: '0.76rem' },
  tdVal:         { padding: '0.2rem 0.55rem', borderBottom: '1px solid #D0C4E8', color: '#9888B8' },
  tdUnit:        { padding: '0.2rem 0.55rem', borderBottom: '1px solid #D0C4E8', color: '#9888B8' },
  tdDesc:        { padding: '0.2rem 0.55rem', borderBottom: '1px solid #D0C4E8', color: '#9888B8' },
  note:          { color: '#9888B8', fontSize: '0.75rem', fontStyle: 'italic', padding: '0.4rem 0.75rem' },
  placeholder:   { textAlign: 'center', padding: '3rem', color: '#9888B8' },
  icon:          { fontSize: '2rem', marginBottom: '0.75rem' },
  sub:           { fontSize: '0.8rem', marginTop: '0.4rem', color: '#D0C4E8' },
}
