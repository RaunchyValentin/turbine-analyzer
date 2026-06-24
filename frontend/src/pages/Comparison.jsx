import React, { useState } from 'react'
import client from '../api/client'
import useAppStore from '../store/appStore'
import TurbineSelector from '../components/TurbineSelector/TurbineSelector'
import DiffHighlight from '../components/DiffHighlight/DiffHighlight'

export default function Comparison() {
  const { selectedTurbineIds } = useAppStore()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const loadComparison = async () => {
    if (selectedTurbineIds.length < 2) return
    setLoading(true)
    try {
      const results = await Promise.all(
        selectedTurbineIds.map((id) =>
          client.get('/parameters', { params: { turbine_id: id } }).then((r) => r.data)
        )
      )
      // Client-side comparison preview; full comparison is also available via /export/comparison
      setRows(results)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Comparison</h1>
      <TurbineSelector />
      <button onClick={loadComparison} disabled={selectedTurbineIds.length < 2}>
        Compare
      </button>
      {loading && <div>Loading...</div>}
      {rows.length > 0 && <DiffHighlight paramSets={rows} />}
    </div>
  )
}
