import React from 'react'
import useAppStore from '../store/appStore'
import TurbineSelector from '../components/TurbineSelector/TurbineSelector'

export default function Export() {
  const { selectedTurbineIds } = useAppStore()

  const download = (url) => {
    const params = selectedTurbineIds.map((id) => `turbine_ids=${id}`).join('&')
    window.open(`http://127.0.0.1:8000/api/${url}?${params}`)
  }

  return (
    <div>
      <h1>Export</h1>
      <TurbineSelector />
      <button onClick={() => download('export/parameters')} disabled={!selectedTurbineIds.length}>
        Export Parameters (.xlsx)
      </button>
      <button onClick={() => download('export/comparison')} disabled={selectedTurbineIds.length < 2}>
        Export Comparison (.xlsx)
      </button>
    </div>
  )
}
