import React from 'react'
import { useNavigate } from 'react-router-dom'

const PRIORITY_COLORS = { 1: '#1a4a8a', 2: '#1a5a9a', 3: '#1a7a7a', 4: '#333' }
const PRIORITY_BORDER = { 1: '#4a8aff', 2: '#5b9bd5', 3: '#4caf9a', 4: '#555' }

export default function TrackOverview({ track, turbineId }) {
  const navigate = useNavigate()

  if (!track) return null

  const go = (sheetId) => navigate(`/settings/${turbineId}/${sheetId}`)

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h1 style={s.title}>
          {track.label}
          {track.shortcut && <span style={s.shortcut}>{track.shortcut}</span>}
        </h1>
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
  root:     { padding: '1.25rem', maxWidth: '860px' },
  header:   { marginBottom: '1.5rem' },
  title:    { margin: '0 0 0.5rem', fontSize: '1.6rem', fontWeight: 700, color: '#e0e0ff', display: 'flex', alignItems: 'baseline', gap: '0.75rem' },
  shortcut: { fontSize: '0.8rem', color: '#666', fontWeight: 400, fontStyle: 'italic' },
  hint:     { color: '#666', fontSize: '0.82rem' },

  group:    { marginBottom: '1.25rem' },
  table:    { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', border: '1px solid #1e1e30' },

  thId:     { background: '#161625', color: '#aaa', fontWeight: 700, padding: '0.35rem 0.6rem', textAlign: 'left', borderBottom: '2px solid #1e1e30', width: '90px', whiteSpace: 'nowrap' },
  thLabel:  { background: '#161625', color: '#aaa', fontWeight: 700, padding: '0.35rem 0.6rem', textAlign: 'left', borderBottom: '2px solid #1e1e30' },

  rowEven:  { background: '#0a0a14' },
  rowOdd:   { background: '#0d0d1a' },

  tdId:     { padding: '0.3rem 0.6rem', borderBottom: '1px solid #12121e', whiteSpace: 'nowrap', width: '110px' },
  tdLabel:  { padding: '0.3rem 0.75rem', borderBottom: '1px solid #12121e', color: '#c0c0d8' },

  tag:      { fontStyle: 'italic', color: '#777', fontSize: '0.75rem' },
  sheetBtn: {
    border: '1px solid', borderRadius: '3px', cursor: 'pointer',
    padding: '0.15rem 0.5rem', fontSize: '0.78rem', fontWeight: 700,
    color: '#d0d8ff', fontFamily: 'monospace', whiteSpace: 'nowrap',
    transition: 'filter 0.1s',
  },
}
