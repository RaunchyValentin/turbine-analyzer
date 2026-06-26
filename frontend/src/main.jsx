import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { ModuleRegistry, ClientSideRowModelModule } from 'ag-grid-community'

ModuleRegistry.registerModules([ClientSideRowModelModule])

import './print.css'
import NavBar from './components/NavBar/NavBar'
import Dashboard from './pages/Dashboard'
import Parameters from './pages/Parameters'
import Comparison from './pages/Comparison'
import Curves from './pages/Curves'
import Import from './pages/Import'
import Turbines from './pages/Turbines'
import Export from './pages/Export'
import Settings from './pages/Settings'

function Layout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F4F0FA' }}>
      <NavBar />
      <main style={{ flex: 1, padding: '1rem 1.25rem' }}>
        <Outlet />
      </main>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/parameters/:turbineId" element={<Parameters />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/curves" element={<Curves />} />
          <Route path="/import" element={<Import />} />
          <Route path="/turbines" element={<Turbines />} />
          <Route path="/export" element={<Export />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/:turbineId" element={<Settings />} />
          <Route path="/settings/:turbineId/:sheetId" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
