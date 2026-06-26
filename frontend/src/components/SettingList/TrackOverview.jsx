import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PrintAllSheets from './PrintAllSheets'

const PRIORITY_COLORS = { 1: '#3D2270', 2: '#4A3080', 3: '#3D8080', 4: '#333' }
const PRIORITY_BORDER = { 1: '#7C60CC', 2: '#5C3D99', 3: '#4caf7d', 4: '#555' }

export default function TrackOverview({ track, turbineId }) {
  const navigate = useNavigate()
  const [printing, setPrinting] = useState(false)

  if (!track) return null

  const go = (sheetId) => navigate(`/settings/${turbineId}/${sheetId}`)

  return (
    <div style={s.root}>
      {printing && (
        <PrintAllSheets track={track} turbineId={turbineId} onClose={() => setPrinting(false)} />
      )}

      <div style={s.header}>
        <div style={s.titleRow}>
          <h1 style={s.title}>
            {track.label}
            {track.shortcut && <span style={s.shortcut}>{track.shortcut}</span>}
          </h1>
          <button
            className="no-print"
            onClick={() => setPrinting(true)}
            style={s.printAllBtn}
            title="Распечатать все листы трека в PDF"
          >
            ⎙ Print all sheets
          </button>
        </div>
        <div style={s.hint}>press one of the buttons below to switch directly to required worksheet</div>
      </div>

      {track.groups?.map(group => (
        <div key={group.id} style={s.group}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.thId}>{group.id}</th>
                <th style={{ ...s.thLabel, paddingLeft: '0.75rem' }}>{group.label}</th>
              </tr>
            </thead>
            <tbody>
              {group.sheets?.map((sheet, i) => (
                <tr key={sheet.id} style={i % 2 === 0 ? s.rowEven : s.rowOdd}>
                  <td style={s.tdId}>
                    <button
                      style={{ ...s.sheetBtn, background: PRIORITY_COLORS[sheet.priority] || '#333', borderColor: PRIORITY_BORDER[sheet.priority] || '#555' }}
                      onClick={() => go(sheet.id)}
                    >
                      {sheet.id}
                    </button>
                  </td>
                  <td style={s.tdLabel}>
                    {sheet.label}
                    {sheet.tag && <span style={s.tag}> - {sheet.tag}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

const s = {
  root:        { padding: '1.25rem', maxWidth: '860px' },
  header:      { marginBottom: '1.5rem' },
  titleRow:    { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' },
  title:       { margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#2A1A4A', display: 'flex', alignItems: 'baseline', gap: '0.75rem' },
  shortcut:    { fontSize: '0.8rem', color: '#9888B8', fontWeight: 400, fontStyle: 'italic' },
  hint:        { color: '#9888B8', fontSize: '0.82rem' },
  printAllBtn: {
    marginLeft: 'auto', padding: '0.3rem 0.9rem', fontSize: '0.8rem',
    background: '#F4F0FA', border: '1px solid #D0C4E8', borderRadius: 4,
    color: '#5C3D99', cursor: 'pointer', fontWeight: 600,
    whiteSpace: 'nowrap', flexShrink: 0,
  },

  group:    { marginBottom: '1.25rem' },
  table:    { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', border: '1px solid #D0C4E8' },

  thId:     { background: '#5C3D99', color: '#ffffff', fontWeight: 700, padding: '0.35rem 0.6rem', textAlign: 'left', borderBottom: '2px solid #D0C4E8', width: '90px', whiteSpace: 'nowrap' },
  thLabel:  { background: '#5C3D99', color: '#ffffff', fontWeight: 700, padding: '0.35rem 0.6rem', textAlign: 'left', borderBottom: '2px solid #D0C4E8' },

  rowEven:  { background: '#ffffff' },
  rowOdd:   { background: '#F7F3FC' },

  tdId:     { padding: '0.3rem 0.6rem', borderBottom: '1px solid #D0C4E8', whiteSpace: 'nowrap', width: '110px' },
  tdLabel:  { padding: '0.3rem 0.75rem', borderBottom: '1px solid #D0C4E8', color: '#2A1A4A' },

  tag:      { fontStyle: 'italic', color: '#9888B8', fontSize: '0.75rem' },
  sheetBtn: {
    border: '1px solid', borderRadius: '3px', cursor: 'pointer',
    padding: '0.15rem 0.5rem', fontSize: '0.78rem', fontWeight: 700,
    color: '#ffffff', fontFamily: 'monospace', whiteSpace: 'nowrap',
    transition: 'filter 0.1s',
  },
}
