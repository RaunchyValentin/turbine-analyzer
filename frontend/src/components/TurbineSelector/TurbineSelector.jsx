import React from 'react'
import useAppStore from '../../store/appStore'

export default function TurbineSelector() {
  const { turbines, selectedTurbineIds, selectTurbine, deselectTurbine } = useAppStore()

  return (
    <div>
      <p>Select up to 3 turbines:</p>
      {turbines.map((t) => {
        const selected = selectedTurbineIds.includes(t.id)
        return (
          <label key={t.id} style={{ marginRight: 12 }}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => selected ? deselectTurbine(t.id) : selectTurbine(t.id)}
              disabled={!selected && selectedTurbineIds.length >= 3}
            />
            {' '}{t.name}
          </label>
        )
      })}
    </div>
  )
}
