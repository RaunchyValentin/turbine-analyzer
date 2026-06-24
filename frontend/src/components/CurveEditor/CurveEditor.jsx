import React, { useEffect, useState, useCallback } from 'react'
import Plot from 'react-plotly.js'
import client from '../../api/client'

export default function CurveEditor({ curveId }) {
  const [points, setPoints] = useState([])

  useEffect(() => {
    if (!curveId) return
    client.get(`/curves/${curveId}/points`).then((r) => setPoints(r.data))
  }, [curveId])

  const save = useCallback(async (newPoints) => {
    await client.put(`/curves/${curveId}/points`, newPoints)
    setPoints(newPoints)
  }, [curveId])

  const onRelayout = (layout) => {
    // reserved for zoom/pan state persistence
  }

  const x = points.map((p) => p.x)
  const y = points.map((p) => p.y)

  return (
    <div>
      <Plot
        data={[{ x, y, mode: 'lines+markers', type: 'scatter' }]}
        layout={{ title: `Curve #${curveId}`, dragmode: 'pan' }}
        config={{ scrollZoom: true }}
        onRelayout={onRelayout}
        style={{ width: '100%', height: 450 }}
      />
      <table>
        <thead>
          <tr><th>X</th><th>Y</th></tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>
                <input
                  type="number"
                  value={p.x}
                  onChange={(e) => {
                    const updated = points.map((pt, j) =>
                      j === i ? { ...pt, x: Number(e.target.value) } : pt
                    )
                    setPoints(updated)
                  }}
                  onBlur={() => save(points)}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={p.y}
                  onChange={(e) => {
                    const updated = points.map((pt, j) =>
                      j === i ? { ...pt, y: Number(e.target.value) } : pt
                    )
                    setPoints(updated)
                  }}
                  onBlur={() => save(points)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
