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
  val:         { color: '#2A1A4A' },
  overridden:  { color: '#B06000', borderBottom: '1px dashed #B0600080' },
  empty:       { color: '#D0C4E8' },
  badge:       { fontSize: '0.65rem', color: '#B06000', verticalAlign: 'super' },
  resetBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: '#6A50A0', fontSize: '0.8rem', padding: '0', lineHeight: 1 },
  readonly:    { color: '#9888B8' },
  editWrapper: { display: 'inline-flex', alignItems: 'center', gap: '2px' },
  input:       { background: '#F4F0FA', color: '#2A1A4A', border: '1px solid #5C3D99', borderRadius: '3px', padding: '1px 4px', fontSize: '0.82rem', width: '90px' },
  btnOk:       { background: '#e8f5e9', border: '1px solid #4caf7d', color: '#4caf7d', borderRadius: '3px', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem' },
  btnCancel:   { background: 'none', border: '1px solid #D0C4E8', color: '#6A50A0', borderRadius: '3px', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem' },
}
