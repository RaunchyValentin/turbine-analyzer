import React, { useState } from 'react'
import client from '../api/client'

export default function Import() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [turbineId, setTurbineId] = useState('')
  const [status, setStatus] = useState('')

  const handlePreview = async () => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    const r = await client.post('/import/preview', fd)
    setPreview(r.data)
  }

  const handleSave = async () => {
    if (!file || !turbineId) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('turbine_id', turbineId)
    await client.post('/import/save', fd)
    setStatus('Saved successfully.')
  }

  return (
    <div>
      <h1>Import</h1>
      <input type="file" accept=".jar,.srel,.xlsx,.xls,.csv,.txt" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handlePreview} disabled={!file}>Preview</button>
      {preview && (
        <div>
          <pre>{JSON.stringify(preview, null, 2).slice(0, 2000)}</pre>
          <input placeholder="Turbine ID" value={turbineId} onChange={(e) => setTurbineId(e.target.value)} />
          <button onClick={handleSave}>Save to Database</button>
        </div>
      )}
      {status && <div>{status}</div>}
    </div>
  )
}
