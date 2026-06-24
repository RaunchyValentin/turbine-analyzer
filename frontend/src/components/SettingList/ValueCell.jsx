import React, { useState, useRef, useEffect } from 'react'
import client from '../../api/client'

export default function ValueCell({ srelKey, value, originalValue, overridden, manual, editable, turbineId, sheetId, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { setDraft(value ?? '') }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  if (!editable) {
    return <span style={styles.readonly}>{value || '—'}</span>
  }

  const save = async () => {
    if (draft === (value ?? '')) { setEditing(false); return }
    setSaving(true)
    try {
      await client.put(`/settings/${turbineId}/${sheetId}/override`, {
        srel_key: srelKey,
        value: draft,
      })
      onSaved?.()
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const reset = async () => {
    setSaving(true)
    try {
      await client.delete(`/settings/${turbineId}/${sheetId}/override/${encodeURIComponent(srelKey)}`)
      onSaved?.()
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <span style={styles.editWrapper}>
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          style={styles.input}
          disabled={saving}
        />
        <button onClick={save}    style={styles.btnOk}  disabled={saving}>✓</button>
        <button onClick={() => setEditing(false)} style={styles.btnCancel}>✕</button>
      </span>
    )
  }

  return (
    <span style={styles.wrapper} onClick={() => setEditing(true)} title={overridden ? `Original: ${originalValue}` : undefined}>
      <span style={{ ...styles.val, ...(overridden ? styles.overridden : {}) }}>
        {value || <span style={styles.empty}>—</span>}
      </span>
      {overridden && (
        <button
          style={styles.resetBtn}
          title={`Reset to original: ${originalValue}`}
          onClick={e => { e.stopPropagation(); reset() }}
        >↺</button>
      )}
      {overridden && <span style={styles.badge}>*</span>}
    </span>
  )
}

const styles = {
  wrapper:     { display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'text', minWidth: '60px' },
  val:         { color: '#e0e0e0' },
  overridden:  { color: '#f0c060', borderBottom: '1px dashed #f0c06080' },
  empty:       { color: '#444' },
  badge:       { fontSize: '0.65rem', color: '#f0c060', verticalAlign: 'super' },
  resetBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.8rem', padding: '0', lineHeight: 1 },
  readonly:    { color: '#aaa' },
  editWrapper: { display: 'inline-flex', alignItems: 'center', gap: '2px' },
  input:       { background: '#1e1e2e', color: '#e0e0e0', border: '1px solid #5b9bd5', borderRadius: '3px', padding: '1px 4px', fontSize: '0.82rem', width: '90px' },
  btnOk:       { background: '#1a3a2a', border: '1px solid #4caf7d', color: '#4caf7d', borderRadius: '3px', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem' },
  btnCancel:   { background: 'none', border: '1px solid #444', color: '#888', borderRadius: '3px', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem' },
}
