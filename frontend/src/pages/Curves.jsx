import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'
import CurveEditor from '../components/CurveEditor/CurveEditor'

export default function Curves() {
  const { turbineId } = useParams()
  const [curves, setCurves] = useState([])
  const [selectedCurve, setSelectedCurve] = useState(null)

  useEffect(() => {
    client.get('/curves', { params: { turbine_id: turbineId } }).then((r) => setCurves(r.data))
  }, [turbineId])

  return (
    <div>
      <h1>Curves — Turbine #{turbineId}</h1>
      <select onChange={(e) => setSelectedCurve(Number(e.target.value))}>
        <option value="">Select curve...</option>
        {curves.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {selectedCurve && <CurveEditor curveId={selectedCurve} />}
    </div>
  )
}
