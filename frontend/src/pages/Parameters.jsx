import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'
import ParameterTable from '../components/ParameterTable/ParameterTable'

export default function Parameters() {
  const { turbineId } = useParams()
  const [parameters, setParameters] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    client
      .get('/parameters', { params: { turbine_id: turbineId, search: search || undefined } })
      .then((r) => setParameters(r.data))
      .finally(() => setLoading(false))
  }, [turbineId, search])

  return (
    <div>
      <h1>Parameters — Turbine #{turbineId}</h1>
      <input
        placeholder="Search KKS / name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading ? <div>Loading...</div> : <ParameterTable rows={parameters} />}
    </div>
  )
}
