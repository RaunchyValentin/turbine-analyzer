import React, { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

const COLUMN_DEFS = [
  { field: 'kks', headerName: 'KKS', width: 160, sortable: true, filter: true },
  { field: 'name', headerName: 'Name', flex: 1, sortable: true, filter: true },
  { field: 'value', headerName: 'Value', width: 140 },
  { field: 'unit', headerName: 'Unit', width: 80 },
  { field: 'data_type', headerName: 'Type', width: 90 },
  { field: 'group', headerName: 'Group', width: 140, sortable: true, filter: true },
  { field: 'source', headerName: 'Source', width: 90 },
]

export default function ParameterTable({ rows = [] }) {
  const defaultColDef = useMemo(() => ({ resizable: true }), [])

  return (
    <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
      <AgGridReact
        rowData={rows}
        columnDefs={COLUMN_DEFS}
        defaultColDef={defaultColDef}
        pagination
        paginationPageSize={100}
      />
    </div>
  )
}
