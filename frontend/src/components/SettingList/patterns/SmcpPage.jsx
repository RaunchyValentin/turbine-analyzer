import React, { useState, useMemo } from 'react'
import Plot from 'react-plotly.js'
import ValueCell from '../ValueCell'

// ── helpers ──────────────────────────────────────────────────────────────────

function SV({ k, srel, turbineId, sheetId, onSaved }) {
  const item = srel?.[k] || {}
  return (
    <ValueCell
      srelKey={k}
      value={item.value ?? null}
      originalValue={item.original ?? null}
      overridden={!!item.overridden}
      editable
      turbineId={turbineId}
      sheetId={sheetId}
      onSaved={onSaved}
    />
  )
}

function fv(srel, k) {
  const n = parseFloat(srel?.[k]?.value)
  return Number.isFinite(n) ? n : null
}

// ── Condition chip ────────────────────────────────────────────────────────────

function CondChip({ k, label, op, unit, hystK, srel, turbineId, sheetId, onSaved }) {
  return (
    <div style={S.condChip}>
      {label && <span style={S.condLabel}>{label}</span>}
      <span style={S.srelKey}>{k}</span>
      <span style={S.condOp}>{op || '>'}</span>
      <SV k={k} srel={srel} turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />
      <span style={S.condUnit}>{unit}</span>
      {hystK && (
        <span style={S.hystGroup}>
          <span style={S.condUnit}>±</span>
          <SV k={hystK} srel={srel} turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />
        </span>
      )}
    </div>
  )
}

// ── Action row ────────────────────────────────────────────────────────────────

function ActionRow({ srelKey, label, dir, delaySrelKey, noDelay, srel, turbineId, sheetId, onSaved }) {
  const isUp = dir === 'up'
  return (
    <div style={S.actionRow}>
      <span style={S.arrow}>→</span>
      <div style={{ ...S.actionBadge, ...(isUp ? S.actionUp : S.actionDown) }}>{label}</div>
      <span style={S.srelKey}>{srelKey}</span>
      <span style={S.condOp}>=</span>
      <SV k={srelKey} srel={srel} turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />
      <span style={S.condUnit}>kg/s²</span>
      {delaySrelKey && (
        <>
          <span style={{ ...S.condUnit, marginLeft: '0.6rem' }}>delay:</span>
          <SV k={delaySrelKey} srel={srel} turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />
          <span style={S.condUnit}>ms</span>
        </>
      )}
      {noDelay && <span style={S.noDelay}>no delay</span>}
    </div>
  )
}

// ── Extras strip ──────────────────────────────────────────────────────────────

function Extras({ items, srel, turbineId, sheetId, onSaved }) {
  if (!items?.length) return null
  return (
    <div style={S.extrasRow}>
      {items.map(({ k, label, unit }, i) => (
        <div key={i} style={S.extraItem}>
          <span style={S.extraLabel}>{label}:</span>
          <span style={S.srelKey}>{k}</span>
          <span style={S.condOp}>=</span>
          <SV k={k} srel={srel} turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />
          <span style={S.condUnit}>{unit}</span>
        </div>
      ))}
    </div>
  )
}

// ── Condition block ───────────────────────────────────────────────────────────

function CondBlock({ title, color, conditions, exceptNot, action, extras, srel, turbineId, sheetId, onSaved }) {
  const cp = { srel, turbineId, sheetId, onSaved }
  return (
    <div style={{ ...S.condBlock, borderColor: color || S.condBlock.borderColor }}>
      <div style={{ ...S.condTitle, background: color || '#7B68B8' }}>{title}</div>
      <div style={S.condBody}>
        <div style={S.ifRow}>
          <span style={S.ifLabel}>IF</span>
          {conditions.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && c.andOr && <span style={S.andOr}>{c.andOr}</span>}
              <CondChip k={c.k} label={c.label} op={c.op} unit={c.unit} hystK={c.hystK} {...cp} />
            </React.Fragment>
          ))}
        </div>
        {exceptNot?.length > 0 && (
          <div style={{ ...S.ifRow, paddingLeft: '2rem' }}>
            <span style={{ ...S.ifLabel, color: '#9888B8', fontSize: '0.72rem' }}>AND NOT (</span>
            {exceptNot.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && c.andOr && <span style={S.andOr}>{c.andOr}</span>}
                <CondChip k={c.k} label={c.label} op={c.op} unit={c.unit} hystK={c.hystK} {...cp} />
              </React.Fragment>
            ))}
            <span style={{ ...S.ifLabel, color: '#9888B8', fontSize: '0.72rem' }}>)</span>
          </div>
        )}
        <ActionRow {...action} {...cp} />
        <Extras items={extras} {...cp} />
      </div>
    </div>
  )
}

// ── Polynomial table + chart ──────────────────────────────────────────────────

function SmcpPoly({ title, prefix, isUp, srel, turbineId, sheetId, onSaved }) {
  const pairs = Array.from({ length: 10 }, (_, i) => ({
    ak: `${prefix}.A${i + 1}`, bk: `${prefix}.B${i + 1}`
  }))

  const chartPts = useMemo(() => {
    const pts = pairs
      .map(({ ak, bk }) => ({ x: fv(srel, ak), y: fv(srel, bk) }))
      .filter(p => p.x != null && p.y != null)
    return pts.sort((a, b) => a.x - b.x)
  }, [srel, prefix]) // eslint-disable-line

  const color = isUp ? '#4caf7d' : '#e74c3c'
  const cp = { srel, turbineId, sheetId, onSaved }

  return (
    <div style={{ ...S.polyBox, borderColor: isUp ? '#4caf7d55' : '#e74c3c55', background: isUp ? '#f4fff8' : '#fff4f4' }}>
      <div style={{ ...S.polyTitle, color }}>{title}</div>
      <div style={S.polyLayout}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>SREL (IGV)</th>
              <th style={S.th}>IGV [%]</th>
              <th style={S.th}>SREL (ΔPG)</th>
              <th style={S.th}>ΔPG [kg/s]</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map(({ ak, bk }, i) => (
              <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                <td style={S.tdKey}>{ak}</td>
                <td style={S.tdVal}><SV k={ak} {...cp} /></td>
                <td style={S.tdKey}>{bk}</td>
                <td style={S.tdVal}><SV k={bk} {...cp} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {chartPts.length > 1 && (
          <Plot
            data={[{
              x: chartPts.map(p => p.x),
              y: chartPts.map(p => p.y),
              type: 'scatter', mode: 'lines+markers',
              line: { color, width: 2 },
              marker: { size: 5, color },
              name: 'ΔPG',
            }]}
            layout={{
              paper_bgcolor: '#F7F3FC', plot_bgcolor: '#ffffff',
              font: { color: '#9888B8', size: 11 },
              xaxis: { title: 'IGV [%]', gridcolor: '#EDE3F8', zerolinecolor: '#D0C4E8' },
              yaxis: { title: 'ΔPG [kg/s]', gridcolor: '#EDE3F8', zerolinecolor: '#D0C4E8' },
              margin: { l: 55, r: 15, t: 15, b: 45 },
              showlegend: false,
              shapes: [{
                type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 0,
                line: { color: '#AAA', dash: 'dot', width: 1 },
              }],
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '380px', height: '240px' }}
          />
        )}
      </div>
    </div>
  )
}

// ── Gradient row ──────────────────────────────────────────────────────────────

function GradRow({ k, label, dir, srel, turbineId, sheetId, onSaved }) {
  const bg = dir === 'up' ? '#f0fff4' : dir === 'down' ? '#fff4f4' : '#F7F3FC'
  const tc = dir === 'up' ? '#1a4d1a' : dir === 'down' ? '#4d1a1a' : '#6A50A0'
  return (
    <tr style={{ background: bg }}>
      <td style={S.tdKey}>{k}</td>
      <td style={S.tdVal}>
        <SV k={k} srel={srel} turbineId={turbineId} sheetId={sheetId} onSaved={onSaved} />
      </td>
      <td style={S.tdUnit}>kg/s²</td>
      <td style={{ ...S.tdDesc, color: tc, fontWeight: 700 }}>{label}</td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SmcpPage({ data, turbineId, onOverrideSaved }) {
  const [tab, setTab] = useState('3.3.1')
  const { srel = {} } = data
  const sheetId = data.id
  const onSaved = onOverrideSaved

  const cp = { srel, turbineId, sheetId, onSaved }

  const TABS = [
    { id: '3.3.1', label: '3.3.1 General' },
    { id: '3.3.2', label: '3.3.2 IGV closed' },
    { id: '3.3.3', label: '3.3.3 IGV range' },
    { id: '3.3.4', label: '3.3.4 Base Load' },
  ]

  const BANDS = [
    { b: 'Band 1', f: '5–45 Hz',    sensor: 'humming flg', signal: 'amplitude [mbar]', name: 'dyn1' },
    { b: 'Band 2', f: '80–100 Hz',  sensor: 'humming flg', signal: 'amplitude [mbar]', name: 'dyn2' },
    { b: 'Band 3', f: '105–125 Hz', sensor: 'humming flg', signal: 'LN90/',            name: 'LN23' },
    { b: 'Band 4', f: '130–145 Hz', sensor: 'humming flg', signal: 'LN90/',            name: 'LN24' },
    { b: 'Band 5', f: '150–180 Hz', sensor: 'humming flg', signal: 'LN90/165',         name: 'LN25' },
    { b: 'Band 6', f: '210–235 Hz', sensor: 'acc',         signal: 'amplitude [g]',    name: 'acc6' },
    { b: 'Band 7', f: '250–280 Hz', sensor: 'acc',         signal: 'amplitude [g]',    name: 'acc7' },
    { b: 'Band 8', f: '315–355 Hz', sensor: 'humming flg', signal: 'amplitude [g]',    name: 'dyn8' },
  ]

  const GRADIENTS = [
    { k: 'SMPVSUP.X',   label: 'PG Up – Very Slow',  dir: 'up' },
    { k: 'SMPSUP.X',    label: 'PG Up – Slow',        dir: 'up' },
    { k: 'SMPFUP.X',    label: 'PG Up – Fast',        dir: 'up' },
    { k: 'SMPSDOWN.X',  label: 'PG Down – Slow',      dir: 'down' },
    { k: 'SMPFDOWN.X',  label: 'PG Down – Fast',      dir: 'down' },
    { k: 'SMPVFDOWN.X', label: 'PG Down – Very Fast', dir: 'down' },
    { k: 'SMPFLT.X',    label: 'PG Reset',             dir: 'reset' },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id}
            style={{ ...S.tabBtn, ...(tab === t.id ? S.tabActive : {}) }}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 3.3.1 General ── */}
      {tab === '3.3.1' && (
        <div>
          <div style={S.secLabel}>Signal Band Definitions (static reference – Definitions in ARGUS)</div>
          <table style={{ ...S.table, marginBottom: '1.5rem', width: 'auto' }}>
            <thead>
              <tr>
                <th style={S.th}>Band</th>
                <th style={S.th}>Frequency</th>
                <th style={S.th}>Sensor</th>
                <th style={S.th}>Signal</th>
                <th style={S.th}>Name</th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map((b, i) => (
                <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                  <td style={{ ...S.tdKey, fontWeight: 700 }}>{b.b}</td>
                  <td style={S.tdKey}>{b.f}</td>
                  <td style={S.tdDesc}>{b.sensor}</td>
                  <td style={S.tdDesc}>{b.signal}</td>
                  <td style={S.tdKey}>{b.name}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={S.secLabel}>PG Gradients [kg/s²]</div>
          <table style={{ ...S.table, width: 'auto' }}>
            <thead>
              <tr>
                <th style={S.th}>SREL key</th>
                <th style={S.th}>Value</th>
                <th style={S.th}>Unit</th>
                <th style={S.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {GRADIENTS.map(({ k, label, dir }, i) => (
                <GradRow key={i} k={k} label={label} dir={dir} {...cp} />
              ))}
            </tbody>
          </table>

          <div style={S.note}>
            All gradient values are applied by the T3000 controller as ramp rates for pilot gas adjustment.
            Positive = increase PG, Negative = decrease PG.
            SMPVFDOWN is the fastest reduction – used in alarm situations.
          </div>
        </div>
      )}

      {/* ── 3.3.2 IGV closed ── */}
      {tab === '3.3.2' && (
        <div>
          <div style={S.tabNote}>Active ONLY when IGV is closed (compressor start-up mode). Logic: IF signal exceeds threshold → adjust PG.</div>

          <CondBlock title="LFD High – Low Frequency Dynamics alarm"
            color="#6688cc"
            conditions={[{ k: 'DY1LV1.X', label: 'LFD', op: '>', unit: 'mbar', hystK: 'DY1HY1.X' }]}
            exceptNot={[
              { k: 'AC6LV1.X', label: '220Hz', op: '>', unit: 'g', hystK: 'AC6HY1.X', andOr: 'OR' },
              { k: 'AC7LV1.X', label: '265Hz', op: '>', unit: 'g', hystK: 'AC7HY1.X' },
            ]}
            action={{ srelKey: 'SMPSUP.X', label: 'Slow Up', dir: 'up', noDelay: true }}
            extras={[
              { k: 'SMPLU1.X', label: 'ΔPG step', unit: 'kg/s' },
              { k: 'SMPT04.X', label: 'delay', unit: 'ms' },
            ]}
            {...cp} />

          <CondBlock title="220 Hz High – Level 1 (Moderate)"
            color="#B37B40"
            conditions={[{ k: 'AC6LV1.X', label: '220Hz', op: '>', unit: 'g', hystK: 'AC6HY2.X' }]}
            action={{ srelKey: 'SMPFDOWN.X', label: 'Fast Down', dir: 'down', delaySrelKey: 'TACLU2.X' }}
            extras={[
              { k: 'SMPLU2AC.X', label: 'AC up step', unit: 'kg/s' },
              { k: 'TPACLU2.X',  label: 'post-delay',     unit: 'ms' },
              { k: 'SMPLU2.X',   label: 'main up step',   unit: 'kg/s' },
              { k: 'TAC6LU1.X',  label: '220Hz timer 1',  unit: 'ms' },
            ]}
            {...cp} />

          <CondBlock title="220 Hz High – Level 2 (Severe)"
            color="#994422"
            conditions={[{ k: 'AC6LV2.X', label: '220Hz', op: '>', unit: 'g', hystK: 'AC6HY1.X' }]}
            action={{ srelKey: 'SMPVFDOWN.X', label: 'Very Fast Down', dir: 'down', delaySrelKey: 'TACLU2.X' }}
            extras={[
              { k: 'TPACLU2.X', label: 'post-delay', unit: 'ms' },
              { k: 'SMPLU2.X',  label: 'up step',    unit: 'kg/s' },
            ]}
            {...cp} />

          <CondBlock title="270 Hz High – Level 1 (Moderate)"
            color="#B37B40"
            conditions={[{ k: 'AC7LV1.X', label: '270Hz', op: '>', unit: 'g', hystK: 'AC7HY2.X' }]}
            action={{ srelKey: 'SMPFDOWN.X', label: 'Fast Down', dir: 'down', delaySrelKey: 'TACLU2.X' }}
            extras={[
              { k: 'SMPLU2AC.X', label: 'AC up step',    unit: 'kg/s' },
              { k: 'TPACLU2.X',  label: 'post-delay',    unit: 'ms' },
              { k: 'SMPLU2.X',   label: 'main up step',  unit: 'kg/s' },
              { k: 'TAC7LU1.X',  label: '270Hz timer 1', unit: 'ms' },
            ]}
            {...cp} />

          <CondBlock title="270 Hz High – Level 2 (Severe)"
            color="#994422"
            conditions={[{ k: 'AC7LV2.X', label: '270Hz', op: '>', unit: 'g', hystK: 'AC7HY1.X' }]}
            action={{ srelKey: 'SMPVFDOWN.X', label: 'Very Fast Down', dir: 'down', delaySrelKey: 'TACLU2.X' }}
            extras={[
              { k: 'TPACLU2.X', label: 'post-delay', unit: 'ms' },
              { k: 'SMPLU2.X',  label: 'up step',    unit: 'kg/s' },
            ]}
            {...cp} />

          <CondBlock title="220 Hz + 265 Hz low – Piloting Improvement"
            color="#448844"
            conditions={[
              { k: 'AC6LV0.X', label: '220Hz', op: '<', unit: 'g', hystK: 'AC6HY0.X', andOr: 'AND' },
              { k: 'AC7LV0.X', label: '265Hz', op: '<', unit: 'g', hystK: 'AC7HY0.X' },
            ]}
            action={{ srelKey: 'SMPSDOWN.X', label: 'Slow Down', dir: 'down', delaySrelKey: 'TAC6LL0.X' }}
            extras={[
              { k: 'SMPLL0AC.X', label: 'down step',       unit: 'kg/s' },
              { k: 'TAC7LL0.X',  label: '265Hz timer low', unit: 'ms' },
            ]}
            {...cp} />
        </div>
      )}

      {/* ── 3.3.3 IGV range ── */}
      {tab === '3.3.3' && (
        <div>
          <div style={S.tabNote}>Active in IGV range (part load through base load with IGV open). PG adjustments use IGV-dependent polynomials (block MBM10DU071C/SMCP).</div>

          <CondBlock title="High 90Hz (Alarm) – Combustion instability, Large Up"
            color="#cc2222"
            conditions={[{ k: 'DY2PLV2.X', label: '90Hz', op: '>', unit: 'mbar', hystK: 'DY2PHY2.X' }]}
            action={{ srelKey: 'SMPFUP.X', label: 'Fast Up', dir: 'up', noDelay: true }}
            {...cp} />
          <SmcpPoly title="Large UP polynomial – SMPPLU2" prefix="SMPPLU2" isUp={true} {...cp} />

          <CondBlock title="Increased 90Hz – Dynamics elevated, Small Up"
            color="#cc6600"
            conditions={[
              { k: 'DY2PLV1.X', label: '90Hz', op: '>', unit: 'mbar', hystK: 'DY2PHY1.X', andOr: 'AND' },
              { k: 'ACPLV1.X',  label: 'Acc',  op: '>', unit: 'g',    hystK: 'ACPHY1.X' },
            ]}
            action={{ srelKey: 'SMPSUP.X', label: 'Slow Up', dir: 'up', delaySrelKey: 'TDY2PLU1.X' }}
            {...cp} />
          <SmcpPoly title="Small UP polynomial – SMPPLU1" prefix="SMPPLU1" isUp={true} {...cp} />

          <CondBlock title="90Hz high enough + NOx high – Emission Improvement, Slow Down"
            color="#448844"
            conditions={[
              { k: 'DY2PLV0.X', label: '90Hz', op: '>', unit: 'mbar', hystK: 'DY2PHY0.X', andOr: 'AND' },
              { k: 'NOXLV1.X',  label: 'NOx',  op: '>', unit: 'ppm',  hystK: 'NOXHY1.X' },
            ]}
            action={{ srelKey: 'SMPSDOWN.X', label: 'Slow Down', dir: 'down', delaySrelKey: 'TDY2PLL0.X' }}
            {...cp} />
          <SmcpPoly title="DOWN polynomial – SMPPLL0" prefix="SMPPLL0" isUp={false} {...cp} />
        </div>
      )}

      {/* ── 3.3.4 Base Load ── */}
      {tab === '3.3.4' && (
        <div>
          <div style={S.tabNote}>Base load variant – uses single scalars instead of IGV polynomials. Conditions mirror IGV range but trigger different scalars.</div>

          <CondBlock title="High 90Hz (Alarm) BL – Large Up (scalar)"
            color="#cc2222"
            conditions={[{ k: 'DY2BLV2.X', label: '90Hz', op: '>', unit: 'mbar', hystK: 'DY2BHY2.X' }]}
            action={{ srelKey: 'SMPFUP.X', label: 'Fast Up', dir: 'up', noDelay: true }}
            extras={[{ k: 'SMPBLU2.X', label: 'BL up step (large)', unit: 'kg/s' }]}
            {...cp} />

          <CondBlock title="Increased 90Hz BL – Small Up (scalar)"
            color="#cc6600"
            conditions={[
              { k: 'DY2BLV1.X', label: '90Hz', op: '>', unit: 'mbar', hystK: 'DY2BHY1.X', andOr: 'AND' },
              { k: 'ACBLV1.X',  label: 'Acc',  op: '>', unit: 'g',    hystK: 'ACBHY1.X' },
            ]}
            action={{ srelKey: 'SMPSUP.X', label: 'Slow Up', dir: 'up', delaySrelKey: 'TDY2BLU1.X' }}
            extras={[{ k: 'SMPBLU1.X', label: 'BL up step (small)', unit: 'kg/s' }]}
            {...cp} />

          <CondBlock title="90Hz low + NOx high BL – Emission Improvement, Slow Down"
            color="#448844"
            conditions={[
              { k: 'DY2BLV0.X', label: '90Hz', op: '<', unit: 'mbar', hystK: 'DY2BHY0.X', andOr: 'AND' },
              { k: 'NOXLV1.X',  label: 'NOx',  op: '>', unit: 'ppm',  hystK: 'NOXHY1.X' },
            ]}
            action={{ srelKey: 'SMPSDOWN.X', label: 'Slow Down', dir: 'down', delaySrelKey: 'TDY2PLL0.X' }}
            extras={[{ k: 'SMPBLL0.X', label: 'BL down step', unit: 'kg/s' }]}
            {...cp} />

          <div style={S.summaryBox}>
            <div style={S.secLabel}>Base Load scalar summary</div>
            <table style={{ ...S.table, width: 'auto' }}>
              <thead>
                <tr>
                  <th style={S.th}>SREL key</th>
                  <th style={S.th}>Value [kg/s]</th>
                  <th style={S.th}>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { k: 'SMPBLU2.X', d: 'Large UP step – High 90Hz alarm (no polynomial for BL)' },
                  { k: 'SMPBLU1.X', d: 'Small UP step – Increased 90Hz + Acc' },
                  { k: 'SMPBLL0.X', d: 'DOWN step – 90Hz low enough + NOx high' },
                ].map(({ k, d }, i) => (
                  <tr key={i} style={i % 2 === 0 ? S.rowEven : S.rowOdd}>
                    <td style={S.tdKey}>{k}</td>
                    <td style={S.tdVal}><SV k={k} {...cp} /></td>
                    <td style={S.tdDesc}>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  tabBar:       { display: 'flex', gap: '2px', marginBottom: '1rem', borderBottom: '2px solid #D0C4E8' },
  tabBtn:       { padding: '0.4rem 1rem', border: '1px solid #D0C4E8', borderRadius: '4px 4px 0 0', cursor: 'pointer', background: '#F7F3FC', color: '#6A50A0', fontSize: '0.8rem', borderBottom: 'none', marginBottom: -2 },
  tabActive:    { background: '#5C3D99', color: '#fff', borderColor: '#5C3D99' },
  secLabel:     { fontSize: '0.82rem', fontWeight: 700, color: '#2A1A4A', marginBottom: '0.5rem', marginTop: '0.25rem' },
  tabNote:      { fontSize: '0.75rem', color: '#9888B8', marginBottom: '0.75rem', fontStyle: 'italic' },
  note:         { marginTop: '0.75rem', color: '#9888B8', fontSize: '0.74rem', fontStyle: 'italic', padding: '0.5rem 0.75rem', background: '#F7F3FC', borderRadius: '4px' },

  condBlock:    { border: '1px solid #B0C0E0', borderRadius: '6px', marginBottom: '0.6rem', overflow: 'hidden' },
  condTitle:    { padding: '0.3rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#fff' },
  condBody:     { padding: '0.55rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  ifRow:        { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' },
  ifLabel:      { fontSize: '0.78rem', fontWeight: 700, color: '#5C3D99', flexShrink: 0 },
  andOr:        { fontSize: '0.7rem', fontWeight: 700, color: '#9888B8', margin: '0 0.1rem' },

  condChip:     { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#fff', border: '1px solid #D0C4E8', borderRadius: '4px', padding: '0.18rem 0.45rem', fontSize: '0.76rem' },
  condLabel:    { fontSize: '0.68rem', color: '#9888B8' },
  condOp:       { color: '#9888B8', margin: '0 0.1rem' },
  condUnit:     { fontSize: '0.7rem', color: '#9888B8' },
  hystGroup:    { display: 'inline-flex', alignItems: 'center', gap: '0.1rem', marginLeft: '0.15rem', borderLeft: '1px solid #EDE3F8', paddingLeft: '0.3rem' },
  srelKey:      { fontFamily: 'monospace', fontSize: '0.7rem', color: '#5C3D99' },
  noDelay:      { fontSize: '0.7rem', color: '#9888B8', fontStyle: 'italic' },

  actionRow:    { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' },
  arrow:        { fontSize: '1rem', color: '#9888B8' },
  actionBadge:  { padding: '0.18rem 0.6rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.76rem' },
  actionUp:     { background: '#e8f4e8', border: '1px solid #4caf7d', color: '#1a4d1a' },
  actionDown:   { background: '#fde8e8', border: '1px solid #cc3333', color: '#4d1a1a' },

  extrasRow:    { display: 'flex', flexWrap: 'wrap', gap: '0.65rem', paddingTop: '0.35rem', borderTop: '1px solid #EDE3F8' },
  extraItem:    { display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.76rem' },
  extraLabel:   { color: '#9888B8', fontSize: '0.7rem' },

  table:        { borderCollapse: 'collapse', fontSize: '0.8rem', flexShrink: 0 },
  th:           { background: '#F7F3FC', color: '#9888B8', padding: '0.25rem 0.55rem', textAlign: 'left', borderBottom: '1px solid #D0C4E8', whiteSpace: 'nowrap', fontWeight: 600 },
  rowEven:      { background: '#F7F3FC' },
  rowOdd:       { background: '#ffffff' },
  tdKey:        { padding: '0.22rem 0.55rem', borderBottom: '1px solid #D0C4E8', color: '#5C3D99', fontFamily: 'monospace', fontSize: '0.74rem', whiteSpace: 'nowrap' },
  tdVal:        { padding: '0.22rem 0.55rem', borderBottom: '1px solid #D0C4E8', whiteSpace: 'nowrap', textAlign: 'right', minWidth: '64px' },
  tdUnit:       { padding: '0.22rem 0.4rem', borderBottom: '1px solid #D0C4E8', color: '#9888B8', fontSize: '0.74rem', whiteSpace: 'nowrap' },
  tdDesc:       { padding: '0.22rem 0.55rem', borderBottom: '1px solid #D0C4E8', color: '#9888B8', fontSize: '0.75rem' },

  polyBox:      { border: '1px solid #D0C4E8', borderRadius: '6px', marginBottom: '0.6rem', marginTop: '0.2rem', padding: '0.6rem 0.75rem' },
  polyTitle:    { fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem' },
  polyLayout:   { display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'nowrap' },

  summaryBox:   { marginTop: '0.75rem', background: '#F7F3FC', border: '1px solid #D0C4E8', borderRadius: '6px', padding: '0.75rem' },
}
