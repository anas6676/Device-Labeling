import React, { useEffect, useMemo, useState, useRef } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function App() {
  const [imports, setImports] = useState([])
  const [selectedImportId, setSelectedImportId] = useState('')
  const [devices, setDevices] = useState([])
  const [batchTag, setBatchTag] = useState('')
  const [file, setFile] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const hiddenUploadRef = useRef(null)
  const [editBatchTag, setEditBatchTag] = useState('')

  const selectedImport = useMemo(() => imports.find(i => String(i.id) === String(selectedImportId)), [imports, selectedImportId])

  function hasSavedData(d) {
    return Boolean(
      (d.full_name && d.full_name.trim()) ||
      (d.email && d.email.trim()) ||
      (d.phone_number && d.phone_number.trim()) ||
      (d.work_order && d.work_order.trim()) ||
      (d.device_label && d.device_label.trim()) ||
      (d.items_number && d.items_number.trim()) ||
      (d.address && d.address.trim())
    )
  }

  async function refreshImports() {
    const res = await axios.get(`${API}/imports`)
    setImports(res.data)
  }

  async function refreshDevices(importId) {
    if (!importId) return
    const res = await axios.get(`${API}/imports/${importId}/devices`)
    setDevices(res.data)
  }

  useEffect(() => { refreshImports() }, [])
  useEffect(() => { refreshDevices(selectedImportId) }, [selectedImportId])
  useEffect(() => { setEditBatchTag(selectedImport?.batch_tag || '') }, [selectedImport])

  async function createBatch() {
    if (!batchTag.trim()) return
    await axios.post(`${API}/imports`, { batch_tag: batchTag.trim() })
    setBatchTag('')
    await refreshImports()
  }

  async function renameBatch() {
    if (!selectedImportId || !editBatchTag.trim()) return
    await axios.put(`${API}/imports/${selectedImportId}`, { batch_tag: editBatchTag.trim() })
    await refreshImports()
  }

  async function deleteBatch() {
    if (!selectedImportId) return
    if (!confirm('Delete this batch? This will remove all devices in it.')) return
    await axios.delete(`${API}/imports/${selectedImportId}`)
    setSelectedImportId('')
    await refreshImports()
    setDevices([])
  }

  async function uploadSNFile(f) {
    if (!selectedImportId || !f) return
    const form = new FormData()
    form.append('file', f)
    await axios.post(`${API}/imports/${selectedImportId}/devices/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    await refreshDevices(selectedImportId)
  }

  async function uploadSNs() {
    if (!selectedImportId || !file) return
    await uploadSNFile(file)
    setFile(null)
  }

  async function saveDevice(d) {
    setSavingId(d.id)
    await axios.put(`${API}/devices/${d.id}`, {
      user_info: d.user_info_raw || '',
      items_number: d.items_number || '',
      address: d.address || ''
    })
    setSavingId(null)
    await refreshDevices(selectedImportId)
  }

  function downloadReport(type, format) {
    if (!selectedImportId) return
    const url = `${API}/imports/${selectedImportId}/reports/${type}?format=${format}`
    window.open(url, '_blank')
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16, maxWidth: 1200, margin: '0 auto' }}>
      <h2>Warehouse Device Labeling</h2>

      <section style={{ marginBottom: 16, display: 'grid', gap: 8 }}>
        <h3>Create Batch</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="batch_tag" value={batchTag} onChange={e => setBatchTag(e.target.value)} />
          <button onClick={createBatch}>Create</button>
        </div>
      </section>

      <section style={{ marginBottom: 16, display: 'grid', gap: 8 }}>
        <h3>Select Batch</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={selectedImportId} onChange={e => setSelectedImportId(e.target.value)}>
            <option value="">-- select --</option>
            {imports.map(b => (
              <option key={b.id} value={b.id}>{b.batch_tag} (#{b.id})</option>
            ))}
          </select>
          <button onClick={() => hiddenUploadRef.current?.click()} disabled={!selectedImportId}>Upload Excel SNs</button>
          <input ref={hiddenUploadRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={async e => {
            const f = e.target.files?.[0]
            if (f) {
              await uploadSNFile(f)
              e.target.value = ''
            }
          }} />
        </div>
      </section>

      {selectedImport && (
        <section style={{ marginBottom: 16, display: 'grid', gap: 8 }}>
          <h3>Batch Controls</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={{ width: 280 }} value={editBatchTag} onChange={e => setEditBatchTag(e.target.value)} placeholder="Rename batch_tag" />
            <button onClick={renameBatch}>Rename</button>
            <button onClick={deleteBatch} style={{ color: '#b00020' }}>Delete</button>
          </div>
        </section>
      )}

      {selectedImport && (
        <section style={{ marginBottom: 16, display: 'grid', gap: 8 }}>
          <h3>Upload SNs (Excel)</h3>
          <input type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button onClick={uploadSNs} disabled={!file}>Upload</button>
        </section>
      )}

      {selectedImport && (
        <section style={{ marginBottom: 16 }}>
          <h3>Devices in Batch</h3>
          <div style={{ overflowX: 'auto' }}>
            <table cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>SN</th>
                  <th>User Info (raw)</th>
                  <th>Items number</th>
                  <th>Address</th>
                  <th>Save</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const complete = (
                    (d.full_name && d.full_name.trim()) ||
                    (d.email && d.email.trim()) ||
                    (d.phone_number && d.phone_number.trim()) ||
                    (d.work_order && d.work_order.trim()) ||
                    (d.device_label && d.device_label.trim()) ||
                    (d.items_number && d.items_number.trim()) ||
                    (d.address && d.address.trim())
                  )
                  return (
                    <tr key={d.id} style={{ background: complete ? '#e6ffed' : undefined }}>
                      <td>{d.id}</td>
                      <td>{d.sn_device}</td>
                      <td>
                        <input style={{ width: 320 }} value={d.user_info_raw || ''} onChange={e => setDevices(prev => prev.map(x => x.id === d.id ? { ...x, user_info_raw: e.target.value } : x))} placeholder="full | email | phone | WO.. | LABEL | SN" />
                      </td>
                      <td>
                        <input style={{ width: 240 }} value={d.items_number || ''} onChange={e => setDevices(prev => prev.map(x => x.id === d.id ? { ...x, items_number: e.target.value } : x))} placeholder="ITM.. >> TSK.." />
                      </td>
                      <td>
                        <input style={{ width: 200 }} value={d.address || ''} onChange={e => setDevices(prev => prev.map(x => x.id === d.id ? { ...x, address: e.target.value } : x))} placeholder="Address" />
                      </td>
                      <td>
                        <button onClick={() => saveDevice(d)} disabled={savingId === d.id}>{savingId === d.id ? 'Saving...' : (complete ? 'Update' : 'Save')}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedImport && (
        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ width: '100%' }}>Reports</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => downloadReport('label-carton', 'xlsx')}>Label_Carton (XLSX)</button>
            <button onClick={() => downloadReport('label-carton', 'csv')}>Label_Carton (CSV)</button>
            <button onClick={() => downloadReport('device-label', 'xlsx')}>Device Label (XLSX)</button>
            <button onClick={() => downloadReport('device-label', 'csv')}>Device Label (CSV)</button>
            <button onClick={() => downloadReport('asset-import', 'xlsx')}>Asset Import (XLSX)</button>
            <button onClick={() => downloadReport('asset-import', 'csv')}>Asset Import (CSV)</button>
          </div>
        </section>
      )}
    </div>
  )
}