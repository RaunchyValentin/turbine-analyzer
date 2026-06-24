import React, { useMemo } from 'react'

const COLOR_MAP = {
  green: '#d4edda',
  yellow: '#fff3cd',
  red: '#f8d7da',
}

function diffColor(values) {
  const present = values.filter((v) => v !== undefined && v !== null && v !== '')
  if (present.length < values.length) return 'red'
  if (new Set(present).size === 1) return 'green'
  const nums = present.map(Number).filter((n) => !isNaN(n))
  if (nums.length === present.length) {
    const base = nums[0]
    const maxRel = Math.max(...nums.slice(1).map((n) => Math.abs(n - base) / (Math.abs(base) || 1)))
    return maxRel <= 0.01 ? 'yellow' : 'red'
  }
  return 'red'
}

export default function DiffHighlight({ paramSets = [] }) {
  const allKeys = useMemo(() => {
    const keys = new Set()
    paramSets.forEach((params) => params.forEach((p) => keys.add(p.kks || p.name || '')))
    return [...keys].sort()
  }, [paramSets])

  const indexed = useMemo(() =>
    paramSets.map((params) => Object.fromEntries(params.map((p) => [p.kks || p.name || '', p]))),
    [paramSets]
  )

  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr>
          <th>KKS</th>
          {paramSets.map((_, i) => <th key={i}>Turbine {i + 1}</th>)}
        </tr>
      </thead>
      <tbody>
        {allKeys.map((key) => {
          const values = indexed.map((idx) => idx[key]?.value)
          const color = diffColor(values)
          return (
            <tr key={key} style={{ background: COLOR_MAP[color] }}>
              <td>{key}</td>
              {values.map((v, i) => <td key={i}>{v ?? '—'}</td>)}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
