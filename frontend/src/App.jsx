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
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [activeTab, setActiveTab] = useState('main')
  const [dbDevices, setDbDevices] = useState([])
  const [dbImports, setDbImports] = useState([])
  const [editingDevice, setEditingDevice] = useState(null)
  const [editingImport, setEditingImport] = useState(null)
  const hiddenUploadRef = useRef(null)
  const [editBatchTag, setEditBatchTag] = useState('')
  const [deviceFilter, setDeviceFilter] = useState('')
  const [importFilter, setImportFilter] = useState('')

  const selectedImport = useMemo(() => imports.find(i => String(i.id) === String(selectedImportId)), [imports, selectedImportId])
  
  const filteredDevices = useMemo(() => {
    if (!deviceFilter.trim()) return dbDevices
    
    const filter = deviceFilter.toLowerCase().trim()
    return dbDevices.filter(device => 
      String(device.id).includes(filter) ||
      (device.sn_device && device.sn_device.toLowerCase().includes(filter)) ||
      (device.full_name && device.full_name.toLowerCase().includes(filter)) ||
      (device.email && device.email.toLowerCase().includes(filter)) ||
      (device.phone_number && device.phone_number.toLowerCase().includes(filter)) ||
      (device.work_order && device.work_order.toLowerCase().includes(filter)) ||
      (device.device_label && device.device_label.toLowerCase().includes(filter)) ||
      (device.items_number && device.items_number.toLowerCase().includes(filter)) ||
      (device.address && device.address.toLowerCase().includes(filter))
    )
  }, [dbDevices, deviceFilter])
  
  // Helper function to highlight filtered text
  const highlightText = (text, filter) => {
    if (!filter || !text) return text
    const regex = new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.toString().replace(regex, '<mark style="background: #ffeb3b; padding: 2px 4px; border-radius: 3px;">$1</mark>')
  }
  
  const filteredImports = useMemo(() => {
    if (!importFilter.trim()) return dbImports
    
    const filter = importFilter.toLowerCase().trim()
    return dbImports.filter(imp => 
      String(imp.id).includes(filter) ||
      (imp.batch_tag && imp.batch_tag.toLowerCase().includes(filter))
    )
  }, [dbImports, importFilter])

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
    setDbImports(res.data)
  }

  async function refreshDevices(importId) {
    if (!importId) return
    const res = await axios.get(`${API}/imports/${importId}/devices`)
    setDevices(res.data)
  }

  async function refreshAllDevices() {
    try {
      const res = await axios.get(`${API}/devices/all`)
      setDbDevices(res.data)
    } catch (err) {
      console.error('Failed to fetch all devices:', err)
    }
  }

  useEffect(() => { 
    refreshImports() 
    refreshAllDevices()
  }, [])
  useEffect(() => { refreshDevices(selectedImportId) }, [selectedImportId])
  
  // Keyboard shortcuts for quick filtering
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        if (activeTab === 'database') {
          // Focus the appropriate filter based on which table is visible
          const deviceFilterInput = document.querySelector('input[placeholder*="Quick filter by ID, SN"]')
          const importFilterInput = document.querySelector('input[placeholder*="Quick filter by ID or Batch"]')
          
          if (deviceFilterInput) deviceFilterInput.focus()
          if (importFilterInput) importFilterInput.focus()
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeTab])

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

  async function updateDeviceInDb(device) {
    try {
      await axios.put(`${API}/devices/${device.id}`, {
        sn_device: device.sn_device,
        import_id: device.import_id,
        full_name: device.full_name,
        email: device.email,
        phone_number: device.phone_number,
        work_order: device.work_order,
        device_label: device.device_label,
        items_number: device.items_number,
        address: device.address,
        user_info: device.user_info_raw
      })
      setEditingDevice(null)
      await refreshAllDevices()
      await refreshImports()
    } catch (err) {
      console.error('Failed to update device:', err)
      alert('Failed to update device')
    }
  }

  async function updateImportInDb(importItem) {
    try {
      await axios.put(`${API}/imports/${importItem.id}`, {
        batch_tag: importItem.batch_tag
      })
      setEditingImport(null)
      await refreshImports()
    } catch (err) {
      console.error('Failed to update import:', err)
      alert('Failed to update import')
    }
  }

  async function deleteDeviceFromDb(deviceId) {
    if (!confirm('Delete this device?')) return
    try {
      await axios.delete(`${API}/devices/${deviceId}`)
      await refreshAllDevices()
      await refreshImports()
    } catch (err) {
      console.error('Failed to delete device:', err)
      alert('Failed to delete device')
    }
  }

  async function deleteImportFromDb(importId) {
    if (!confirm('Delete this import and all its devices?')) return
    try {
      await axios.delete(`${API}/imports/${importId}`)
      await refreshImports()
      await refreshAllDevices()
    } catch (err) {
      console.error('Failed to delete import:', err)
      alert('Failed to delete import')
    }
  }

  function downloadReport(type, format) {
    if (!selectedImportId) return
    const url = `${API}/imports/${selectedImportId}/reports/${type}?format=${format}`
    window.open(url, '_blank')
  }

  const styles = {
    container: {
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
      background: isDarkMode 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      color: isDarkMode ? '#e0e0e0' : '#333',
      transition: 'all 0.3s ease'
    },
    header: {
      textAlign: 'center',
      marginBottom: '32px',
      color: 'white',
      textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
      position: 'relative'
    },
    themeToggle: {
      position: 'absolute',
      top: '0',
      right: '0',
      background: isDarkMode 
        ? 'linear-gradient(45deg, #ffd700, #ffed4e)'
        : 'linear-gradient(45deg, #2c3e50, #34495e)',
      color: isDarkMode ? '#1a1a2e' : 'white',
      border: 'none',
      borderRadius: '50%',
      width: '50px',
      height: '50px',
      cursor: 'pointer',
      fontSize: '20px',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
      transition: 'all 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    appIcon: {
      width: '120px',
      height: '120px',
      borderRadius: '50%',
      margin: '0 auto 20px',
      display: 'block',
      boxShadow: isDarkMode 
        ? '0 8px 32px rgba(0, 0, 0, 0.5)'
        : '0 8px 32px rgba(0, 0, 0, 0.3)',
      border: isDarkMode 
        ? '4px solid rgba(255, 255, 255, 0.1)'
        : '4px solid rgba(255, 255, 255, 0.3)',
      objectFit: 'cover',
      background: isDarkMode 
        ? 'linear-gradient(45deg, #2c3e50, #34495e)'
        : 'linear-gradient(45deg, #fff, #f0f8ff)',
      padding: '8px',
      transition: 'all 0.3s ease'
    },
    title: {
      fontSize: '2.5rem',
      fontWeight: '700',
      margin: '0',
      background: isDarkMode 
        ? 'linear-gradient(45deg, #ffd700, #ffed4e)'
        : 'linear-gradient(45deg, #fff, #f0f8ff)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      transition: 'all 0.3s ease'
    },
    subtitle: {
      fontSize: '1.1rem',
      opacity: '0.9',
      marginTop: '8px',
      transition: 'all 0.3s ease'
    },
    tabContainer: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: '24px',
      gap: '8px'
    },
    tab: {
      padding: '12px 24px',
      borderRadius: '8px 8px 0 0',
      border: 'none',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      background: isDarkMode ? 'rgba(44, 62, 80, 0.7)' : 'rgba(255, 255, 255, 0.7)',
      color: isDarkMode ? '#e0e0e0' : '#333'
    },
    activeTab: {
      background: isDarkMode ? 'rgba(44, 62, 80, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      color: isDarkMode ? '#ffd700' : '#2c3e50',
      boxShadow: isDarkMode 
        ? '0 4px 15px rgba(0, 0, 0, 0.3)'
        : '0 4px 15px rgba(0, 0, 0, 0.1)'
    },
    section: {
      background: isDarkMode 
        ? 'rgba(44, 62, 80, 0.95)'
        : 'rgba(255, 255, 255, 0.95)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: isDarkMode 
        ? '0 8px 32px rgba(0, 0, 0, 0.3)'
        : '0 8px 32px rgba(0, 0, 0, 0.1)',
      backdropFilter: 'blur(10px)',
      border: isDarkMode 
        ? '1px solid rgba(255, 255, 255, 0.1)'
        : '1px solid rgba(255, 255, 255, 0.2)',
      transition: 'all 0.3s ease'
    },
    sectionTitle: {
      fontSize: '1.4rem',
      fontWeight: '600',
      marginBottom: '16px',
      color: isDarkMode ? '#ffd700' : '#2c3e50',
      borderBottom: isDarkMode 
        ? '3px solid #ffd700'
        : '3px solid #3498db',
      paddingBottom: '8px',
      transition: 'all 0.3s ease'
    },
    input: {
      padding: '12px 16px',
      borderRadius: '8px',
      border: isDarkMode 
        ? '2px solid #34495e'
        : '2px solid #e1e8ed',
      fontSize: '14px',
      transition: 'all 0.3s ease',
      outline: 'none',
      flex: '1',
      minWidth: '200px',
      background: isDarkMode ? '#2c3e50' : 'white',
      color: isDarkMode ? '#e0e0e0' : '#333'
    },
    inputFocus: {
      borderColor: isDarkMode ? '#ffd700' : '#3498db',
      boxShadow: isDarkMode 
        ? '0 0 0 3px rgba(255, 215, 0, 0.1)'
        : '0 0 0 3px rgba(52, 152, 219, 0.1)'
    },
    button: {
      padding: '12px 24px',
      borderRadius: '8px',
      border: 'none',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    primaryButton: {
      background: isDarkMode 
        ? 'linear-gradient(45deg, #ffd700, #ffed4e)'
        : 'linear-gradient(45deg, #3498db, #2980b9)',
      color: isDarkMode ? '#1a1a2e' : 'white',
      boxShadow: isDarkMode 
        ? '0 4px 15px rgba(255, 215, 0, 0.3)'
        : '0 4px 15px rgba(52, 152, 219, 0.3)'
    },
    secondaryButton: {
      background: isDarkMode 
        ? 'linear-gradient(45deg, #95a5a6, #7f8c8d)'
        : 'linear-gradient(45deg, #95a5a6, #7f8c8d)',
      color: 'white',
      boxShadow: '0 4px 15px rgba(149, 165, 166, 0.3)'
    },
    dangerButton: {
      background: 'linear-gradient(45deg, #e74c3c, #c0392b)',
      color: 'white',
      boxShadow: '0 4px 15px rgba(231, 76, 60, 0.3)'
    },
    successButton: {
      background: isDarkMode 
        ? 'linear-gradient(45deg, #27ae60, #2ecc71)'
        : 'linear-gradient(45deg, #27ae60, #229954)',
      color: 'white',
      boxShadow: '0 4px 15px rgba(39, 174, 96, 0.3)'
    },
    select: {
      padding: '12px 16px',
      borderRadius: '8px',
      border: isDarkMode 
        ? '2px solid #34495e'
        : '2px solid #e1e8ed',
      fontSize: '14px',
      backgroundColor: isDarkMode ? '#2c3e50' : 'white',
      color: isDarkMode ? '#e0e0e0' : '#333',
      cursor: 'pointer',
      outline: 'none',
      minWidth: '200px',
      transition: 'all 0.3s ease'
    },
    fileInput: {
      padding: '8px',
      borderRadius: '8px',
      border: isDarkMode 
        ? '2px solid #34495e'
        : '2px solid #e1e8ed',
      fontSize: '14px',
      background: isDarkMode ? '#2c3e50' : 'white',
      color: isDarkMode ? '#e0e0e0' : '#333',
      transition: 'all 0.3s ease'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      borderRadius: '8px',
      overflow: 'hidden',
      boxShadow: isDarkMode 
        ? '0 4px 32px rgba(0, 0, 0, 0.4)'
        : '0 4px 32px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.3s ease'
    },
    tableHeader: {
      background: isDarkMode 
        ? 'linear-gradient(45deg, #1a1a2e, #16213e)'
        : 'linear-gradient(45deg, #34495e, #2c3e50)',
      color: 'white',
      padding: '16px 12px',
      textAlign: 'left',
      fontWeight: '600',
      fontSize: '14px'
    },
    tableRow: {
      transition: 'all 0.2s ease'
    },
    tableCell: {
      padding: '12px',
      borderBottom: isDarkMode 
        ? '1px solid #34495e'
        : '1px solid #ecf0f1',
      fontSize: '14px',
      transition: 'all 0.3s ease'
    },
    tableInput: {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: isDarkMode 
        ? '1px solid #34495e'
        : '1px solid #ddd',
      fontSize: '13px',
      transition: 'all 0.2s ease',
      background: isDarkMode ? '#2c3e50' : 'white',
      color: isDarkMode ? '#e0e0e0' : '#333'
    },
    flexRow: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    flexColumn: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    reportGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '12px',
      marginTop: '16px'
    },
    statusBadge: {
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase'
    },
    completeBadge: {
      background: 'linear-gradient(45deg, #27ae60, #2ecc71)',
      color: 'white'
    },
    incompleteBadge: {
      background: isDarkMode 
        ? 'linear-gradient(45deg, #f39c12, #e67e22)'
        : 'linear-gradient(45deg, #f39c12, #e67e22)',
      color: 'white'
    },
    actionButton: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: 'none',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      margin: '0 4px'
    },
    filterSection: {
      marginBottom: '20px',
      padding: '16px',
      borderRadius: '8px',
      background: isDarkMode 
        ? 'linear-gradient(135deg, #2c3e50, #34495e)'
        : 'linear-gradient(135deg, #ecf0f1, #bdc3c7)',
      border: isDarkMode 
        ? '1px solid #34495e'
        : '1px solid #bdc3c7'
    },
    filterRow: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      marginBottom: '12px'
    },
    filterInput: {
      flex: 1,
      padding: '12px 16px',
      borderRadius: '8px',
      border: isDarkMode 
        ? '1px solid #34495e'
        : '1px solid #ddd',
      fontSize: '14px',
      transition: 'all 0.2s ease',
      background: isDarkMode ? '#2c3e50' : 'white',
      color: isDarkMode ? '#e0e0e0' : '#333',
      boxShadow: isDarkMode 
        ? '0 2px 8px rgba(0,0,0,0.3)'
        : '0 2px 8px rgba(0,0,0,0.1)'
    },
    filterInfo: {
      padding: '8px 12px',
      borderRadius: '6px',
      background: isDarkMode 
        ? 'rgba(39, 174, 96, 0.1)'
        : 'rgba(39, 174, 96, 0.1)',
      border: isDarkMode 
        ? '1px solid rgba(39, 174, 96, 0.3)'
        : '1px solid rgba(39, 174, 96, 0.3)'
    },
    noResults: {
      textAlign: 'center',
      padding: '20px',
      background: isDarkMode 
        ? 'rgba(52, 73, 94, 0.1)'
        : 'rgba(236, 240, 241, 0.5)',
      borderRadius: '8px',
      border: isDarkMode 
        ? '1px solid rgba(52, 73, 94, 0.3)'
        : '1px solid rgba(189, 195, 199, 0.3)'
    }
  }

  const renderMainApp = () => (
    <>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🚀 Create New Batch</h3>
        <div style={styles.flexRow}>
          <input 
            style={styles.input} 
            placeholder="Enter batch tag (e.g., upload_2025_08_25)" 
            value={batchTag} 
            onChange={e => setBatchTag(e.target.value)} 
          />
          <button 
            style={{...styles.button, ...styles.primaryButton}}
            onClick={createBatch}
          >
            ✨ Create Batch
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📋 Select & Manage Batch</h3>
        <div style={styles.flexRow}>
          <select 
            style={styles.select} 
            value={selectedImportId} 
            onChange={e => setSelectedImportId(e.target.value)}
          >
            <option value="">-- Select a batch --</option>
            {imports.map(b => (
              <option key={b.id} value={b.id}>
                📦 {b.batch_tag} (ID: #{b.id})
              </option>
            ))}
          </select>
          <button 
            style={{...styles.button, ...styles.successButton}}
            onClick={() => hiddenUploadRef.current?.click()} 
            disabled={!selectedImportId}
          >
            📤 Upload Excel SNs
          </button>
          <input 
            ref={hiddenUploadRef} 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            style={{ display: 'none' }} 
            onChange={async e => {
              const f = e.target.files?.[0]
              if (f) {
                await uploadSNFile(f)
                e.target.value = ''
              }
            }} 
          />
        </div>
      </div>

      {selectedImport && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>⚙️ Batch Controls</h3>
          <div style={styles.flexRow}>
            <input 
              style={styles.input} 
              value={editBatchTag} 
              onChange={e => setEditBatchTag(e.target.value)} 
              placeholder="Rename batch tag" 
            />
            <button 
              style={{...styles.button, ...styles.secondaryButton}}
              onClick={renameBatch}
            >
              ✏️ Rename
            </button>
            <button 
              style={{...styles.button, ...styles.dangerButton}}
              onClick={deleteBatch}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}

      {selectedImport && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>📁 Upload Device Serial Numbers</h3>
          <div style={styles.flexRow}>
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              style={styles.fileInput}
              onChange={e => setFile(e.target.files?.[0] || null)} 
            />
            <button 
              style={{...styles.button, ...styles.successButton}}
              onClick={uploadSNs} 
              disabled={!file}
            >
              📥 Upload File
            </button>
          </div>
        </div>
      )}

      {selectedImport && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            📱 Devices in Batch: {devices.length} total
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>ID</th>
                  <th style={styles.tableHeader}>Serial Number</th>
                  <th style={styles.tableHeader}>User Info (raw)</th>
                  <th style={styles.tableHeader}>Items Number</th>
                  <th style={styles.tableHeader}>Address</th>
                  <th style={styles.tableHeader}>Status</th>
                  <th style={styles.tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const complete = hasSavedData(d)
                  return (
                    <tr 
                      key={d.id} 
                      style={{
                        ...styles.tableRow,
                        background: complete 
                          ? (isDarkMode ? 'rgba(39, 174, 96, 0.2)' : 'rgba(39, 174, 96, 0.1)')
                          : (isDarkMode ? 'rgba(44, 62, 80, 0.8)' : 'rgba(255, 255, 255, 0.8)'),
                        borderLeft: complete 
                          ? '4px solid #27ae60' 
                          : (isDarkMode ? '4px solid #34495e' : '4px solid #ecf0f1')
                      }}
                    >
                      <td style={styles.tableCell}>#{d.id}</td>
                      <td style={styles.tableCell}>
                        <strong style={{ color: isDarkMode ? '#ffd700' : '#2c3e50' }}>{d.sn_device}</strong>
                      </td>
                      <td style={styles.tableCell}>
                        <input 
                          style={styles.tableInput} 
                          value={d.user_info_raw || ''} 
                          onChange={e => setDevices(prev => prev.map(x => x.id === d.id ? { ...x, user_info_raw: e.target.value } : x))} 
                          placeholder="full | email | phone | WO.. | LABEL | SN" 
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <input 
                          style={styles.tableInput} 
                          value={d.items_number || ''} 
                          onChange={e => setDevices(prev => prev.map(x => x.id === d.id ? { ...x, items_number: e.target.value } : x))} 
                          placeholder="ITM.. >> TSK.." 
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <input 
                          style={styles.tableInput} 
                          value={d.address || ''} 
                          onChange={e => setDevices(prev => prev.map(x => x.id === d.id ? { ...x, address: e.target.value } : x))} 
                          placeholder="Address" 
                        />
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{...styles.statusBadge, ...(complete ? styles.completeBadge : styles.incompleteBadge)}}>
                          {complete ? '✅ Complete' : '⏳ Pending'}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <button 
                          style={{
                            ...styles.button,
                            ...(complete ? styles.secondaryButton : styles.primaryButton),
                            padding: '8px 16px',
                            fontSize: '12px'
                          }}
                          onClick={() => saveDevice(d)} 
                          disabled={savingId === d.id}
                        >
                          {savingId === d.id ? '⏳ Saving...' : (complete ? '🔄 Update' : '💾 Save')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedImport && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>📊 Generate Reports</h3>
          <div style={styles.reportGrid}>
            <button 
              style={{...styles.button, ...styles.primaryButton}}
              onClick={() => downloadReport('label-carton', 'xlsx')}
            >
              📋 Label Carton (XLSX)
            </button>
            <button 
              style={{...styles.button, ...styles.primaryButton}}
              onClick={() => downloadReport('label-carton', 'csv')}
            >
              📋 Label Carton (CSV)
            </button>
            <button 
              style={{...styles.button, ...styles.successButton}}
              onClick={() => downloadReport('device-label', 'xlsx')}
            >
              🏷️ Device Label (XLSX)
            </button>
            <button 
              style={{...styles.button, ...styles.successButton}}
              onClick={() => downloadReport('device-label', 'csv')}
            >
              🏷️ Device Label (CSV)
            </button>
            <button 
              style={{...styles.button, ...styles.secondaryButton}}
              onClick={() => downloadReport('asset-import', 'xlsx')}
            >
              💼 Asset Import (XLSX)
            </button>
            <button 
              style={{...styles.button, ...styles.secondaryButton}}
              onClick={() => downloadReport('asset-import', 'csv')}
            >
              💼 Asset Import (CSV)
            </button>
          </div>
        </div>
      )}
    </>
  )

  const renderDatabaseManager = () => (
    <>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🗄️ Database Management</h3>
        <p style={{ color: isDarkMode ? '#bdc3c7' : '#7f8c8d', marginBottom: '16px' }}>
          Direct database editing - be careful with changes!
        </p>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          📦 Imports Table 
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '400', 
            marginLeft: '12px',
            color: isDarkMode ? '#bdc3c7' : '#7f8c8d'
          }}>
            ({filteredImports.length} of {dbImports.length} imports)
          </span>
        </h3>
        
        {/* Quick Filter Section for Imports */}
        <div style={styles.filterSection}>
          <div style={styles.filterRow}>
            <input
              style={styles.filterInput}
              placeholder="🔍 Quick filter by ID or Batch Tag..."
              value={importFilter}
              onChange={(e) => setImportFilter(e.target.value)}
            />
            <button
              style={{...styles.button, ...styles.secondaryButton, padding: '8px 16px'}}
              onClick={() => setImportFilter('')}
              title="Clear filter"
            >
              🗑️ Clear
            </button>
          </div>
          {importFilter && (
            <div style={styles.filterInfo}>
              <span style={{ color: isDarkMode ? '#27ae60' : '#27ae60', fontWeight: '600' }}>
                🔍 Filtering: "{importFilter}" • Showing {filteredImports.length} of {dbImports.length} imports
              </span>
            </div>
          )}
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>ID</th>
                <th style={styles.tableHeader}>Batch Tag</th>
                <th style={styles.tableHeader}>Created At</th>
                <th style={styles.tableHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredImports.map((imp) => (
                <tr key={imp.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>#{imp.id}</td>
                  <td style={styles.tableCell}>
                    {editingImport?.id === imp.id ? (
                      <input
                        style={styles.tableInput}
                        value={editingImport.batch_tag}
                        onChange={(e) => setEditingImport({...editingImport, batch_tag: e.target.value})}
                      />
                    ) : (
                      imp.batch_tag
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {new Date(imp.created_at).toLocaleString()}
                  </td>
                  <td style={styles.tableCell}>
                    {editingImport?.id === imp.id ? (
                      <>
                        <button
                          style={{...styles.actionButton, ...styles.successButton}}
                          onClick={() => updateImportInDb(editingImport)}
                        >
                          💾 Save
                        </button>
                        <button
                          style={{...styles.actionButton, ...styles.secondaryButton}}
                          onClick={() => setEditingImport(null)}
                        >
                          ❌ Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          style={{...styles.actionButton, ...styles.primaryButton}}
                          onClick={() => setEditingImport(imp)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          style={{...styles.actionButton, ...styles.dangerButton}}
                          onClick={() => deleteImportFromDb(imp.id)}
                        >
                          🗑️ Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          📱 Devices Table 
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '400', 
            marginLeft: '12px',
            color: isDarkMode ? '#bdc3c7' : '#7f8c8d'
          }}>
            ({filteredDevices.length} of {dbDevices.length} devices)
          </span>
        </h3>
        
        {/* Quick Filter Section */}
        <div style={styles.filterSection}>
          <div style={styles.filterRow}>
            <input
              style={styles.filterInput}
              placeholder="🔍 Quick filter by ID, SN, Name, Email, Phone, Work Order, Device Label, Items, or Address..."
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
            />
            <button
              style={{...styles.button, ...styles.secondaryButton, padding: '8px 16px'}}
              onClick={() => setDeviceFilter('')}
              title="Clear filter"
            >
              🗑️ Clear
            </button>
          </div>
          {deviceFilter && (
            <div style={styles.filterInfo}>
              <span style={{ color: isDarkMode ? '#27ae60' : '#27ae60', fontWeight: '600' }}>
                🔍 Filtering: "{deviceFilter}" • Showing {filteredDevices.length} of {dbDevices.length} devices
              </span>
            </div>
          )}
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          {filteredDevices.length === 0 ? (
            <div style={styles.noResults}>
              <p style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: isDarkMode ? '#bdc3c7' : '#7f8c8d',
                fontSize: '16px'
              }}>
                {deviceFilter ? `🔍 No devices found matching "${deviceFilter}"` : '📱 No devices available'}
              </p>
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>ID</th>
                  <th style={styles.tableHeader}>SN Device</th>
                  <th style={styles.tableHeader}>Import ID</th>
                  <th style={styles.tableHeader}>Full Name</th>
                  <th style={styles.tableHeader}>Email</th>
                  <th style={styles.tableHeader}>Phone</th>
                  <th style={styles.tableHeader}>Work Order</th>
                  <th style={styles.tableHeader}>Device Label</th>
                  <th style={styles.tableHeader}>Items Number</th>
                  <th style={styles.tableHeader}>Address</th>
                  <th style={styles.tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((device) => (
                <tr key={device.id} style={styles.tableRow}>
                  <td style={styles.tableCell}>#{device.id}</td>
                  <td style={styles.tableCell}>
                    {editingDevice?.id === device.id ? (
                      <input
                        style={styles.tableInput}
                        value={editingDevice.sn_device}
                        onChange={(e) => setEditingDevice({...editingDevice, sn_device: e.target.value})}
                      />
                    ) : (
                      device.sn_device
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {editingDevice?.id === device.id ? (
                      <input
                        style={styles.tableInput}
                        type="number"
                        value={editingDevice.import_id}
                        onChange={(e) => setEditingDevice({...editingDevice, import_id: parseInt(e.target.value)})}
                      />
                    ) : (
                      device.import_id
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {editingDevice?.id === device.id ? (
                      <input
                        style={styles.tableInput}
                        value={editingDevice.full_name || ''}
                        onChange={(e) => setEditingDevice({...editingDevice, full_name: e.target.value})}
                      />
                    ) : (
                      device.full_name || '-'
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {editingDevice?.id === device.id ? (
                      <input
                        style={styles.tableInput}
                        value={editingDevice.email || ''}
                        onChange={(e) => setEditingDevice({...editingDevice, email: e.target.value})}
                      />
                    ) : (
                      device.email || '-'
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {editingDevice?.id === device.id ? (
                      <input
                        style={styles.tableInput}
                        value={editingDevice.phone_number || ''}
                        onChange={(e) => setEditingDevice({...editingDevice, phone_number: e.target.value})}
                      />
                    ) : (
                      device.phone_number || '-'
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {editingDevice?.id === device.id ? (
                      <input
                        style={styles.tableInput}
                        value={editingDevice.work_order || ''}
                        onChange={(e) => setEditingDevice({...editingDevice, work_order: e.target.value})}
                      />
                    ) : (
                      device.work_order || '-'
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {editingDevice?.id === device.id ? (
                      <input
                        style={styles.tableInput}
                        value={editingDevice.device_label || ''}
                        onChange={(e) => setEditingDevice({...editingDevice, device_label: e.target.value})}
                      />
                    ) : (
                      device.device_label || '-'
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {editingDevice?.id === device.id ? (
                      <input
                        style={styles.tableInput}
                        value={editingDevice.items_number || ''}
                        onChange={(e) => setEditingDevice({...editingDevice, items_number: e.target.value})}
                      />
                    ) : (
                      device.items_number || '-'
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {editingDevice?.id === device.id ? (
                      <input
                        style={styles.tableInput}
                        value={editingDevice.address || ''}
                        onChange={(e) => setEditingDevice({...editingDevice, address: e.target.value})}
                      />
                    ) : (
                      device.address || '-'
                    )}
                  </td>
                  <td style={styles.tableCell}>
                    {editingDevice?.id === device.id ? (
                      <>
                        <button
                          style={{...styles.actionButton, ...styles.successButton}}
                          onClick={() => updateDeviceInDb(editingDevice)}
                        >
                          💾 Save
                        </button>
                        <button
                          style={{...styles.actionButton, ...styles.secondaryButton}}
                          onClick={() => setEditingDevice(null)}
                        >
                          ❌ Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          style={{...styles.actionButton, ...styles.primaryButton}}
                          onClick={() => setEditingDevice(device)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          style={{...styles.actionButton, ...styles.dangerButton}}
                          onClick={() => deleteDeviceFromDb(device.id)}
                        >
                          🗑️ Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button 
          style={styles.themeToggle}
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
        
        <img 
          src="/src/assets/3C20C8BC-A864-4744-9E42-AC17F49C2423_1_105_c.jpeg" 
          alt="Warehouse Labeler App Icon" 
          style={styles.appIcon}
          onError={(e) => {
            e.target.style.display = 'none'
          }}
        />
        <h1 style={styles.title}>🏭 Warehouse Device Labeling</h1>
        <p style={styles.subtitle}>Professional Device Management & Labeling System</p>
      </div>

      <div style={styles.tabContainer}>
        <button
          style={{...styles.tab, ...(activeTab === 'main' ? styles.activeTab : {})}}
          onClick={() => setActiveTab('main')}
        >
          🏠 Main App
        </button>
        <button
          style={{...styles.tab, ...(activeTab === 'database' ? styles.activeTab : {})}}
          onClick={() => setActiveTab('database')}
        >
          🗄️ Database Manager
        </button>
      </div>

      {activeTab === 'main' ? renderMainApp() : renderDatabaseManager()}
    </div>
  )
}