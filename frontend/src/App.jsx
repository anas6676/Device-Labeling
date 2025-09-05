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
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [activeTab, setActiveTab] = useState('main')
  const [dbDevices, setDbDevices] = useState([])
  const [dbImports, setDbImports] = useState([])
  const [editingDevice, setEditingDevice] = useState(null)
  const [editingImport, setEditingImport] = useState(null)
  const hiddenUploadRef = useRef(null)
  const batchUploadRef = useRef(null)
  const [editBatchTag, setEditBatchTag] = useState('')
  const [deviceFilter, setDeviceFilter] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [apiHealthy, setApiHealthy] = useState(null)
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
    // Health check
    axios.get(`${API}/health`).then(() => setApiHealthy(true)).catch(() => setApiHealthy(false))
    // Set page title
    document.title = 'Abby-Label - Device Management System'
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
    const tag = batchTag.trim()
    if (!tag) return
    try {
      const res = await axios.post(`${API}/imports`, { batch_tag: tag })
      const created = res.data
      setBatchTag('')
      await refreshImports()
      if (created && created.id != null) {
        setSelectedImportId(String(created.id))
        setEditBatchTag(created.batch_tag || '')
      }
    } catch (err) {
      console.error('Failed to create batch:', err)
      const status = err?.response?.status
      const msg = err?.response?.data?.error || err?.message || 'Unknown error'
      alert(`Failed to create batch${status ? ` (HTTP ${status})` : ''}: ${msg}`)
    }
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
    try {
      setIsUploading(true)
      const form = new FormData()
      form.append('file', f)
      await axios.post(`${API}/imports/${selectedImportId}/devices/upload`, form)
      await refreshDevices(selectedImportId)
    } catch (err) {
      console.error('Upload failed:', err)
      const status = err?.response?.status
      const msg = err?.response?.data?.error || err?.message || 'Unknown error'
      alert(`Upload failed${status ? ` (HTTP ${status})` : ''}: ${msg}`)
      throw err
    } finally {
      setIsUploading(false)
    }
  }

  async function uploadSNs() {
    if (!selectedImportId || !file) return
    try {
      await uploadSNFile(file)
    } finally {
      setFile(null)
      if (batchUploadRef.current) {
        batchUploadRef.current.value = ''
      }
    }
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
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: '0',
      maxWidth: '100%',
      margin: '0',
      background: isDarkMode 
        ? '#1D2125'
        : '#F4F5F7',
      minHeight: '100vh',
      color: isDarkMode ? '#B3BAC5' : '#172B4D',
      transition: 'all 0.2s ease'
    },
    header: {
      background: isDarkMode ? '#161A1D' : '#FFFFFF',
      borderBottom: isDarkMode ? '1px solid #2C3E50' : '1px solid #E1E5E9',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      top: '0',
      zIndex: '100',
      boxShadow: isDarkMode 
        ? '0 1px 3px rgba(0, 0, 0, 0.3)'
        : '0 1px 3px rgba(0, 0, 0, 0.1)'
    },
    themeToggle: {
      background: isDarkMode ? '#0052CC' : '#F4F5F7',
      color: isDarkMode ? '#FFFFFF' : '#172B4D',
      border: isDarkMode ? '1px solid #0052CC' : '1px solid #E1E5E9',
      borderRadius: '6px',
      width: '40px',
      height: '40px',
      cursor: 'pointer',
      fontSize: '16px',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
      right: '24px',
      top: '50%',
      transform: 'translateY(-50%)',
      '&:hover': {
        background: isDarkMode ? '#0065FF' : '#EBECF0'
      }
    },
    appIcon: {
      width: '64px',
      height: '64px',
      borderRadius: '8px',
      marginRight: '20px',
      display: 'block',
      objectFit: 'cover',
      background: isDarkMode ? '#0052CC' : '#F4F5F7',
      padding: '8px',
      transition: 'all 0.2s ease'
    },
    title: {
      fontSize: '20px',
      fontWeight: '600',
      margin: '0',
      color: isDarkMode ? '#FFFFFF' : '#172B4D',
      display: 'flex',
      alignItems: 'center',
      transition: 'all 0.2s ease'
    },
    subtitle: {
      fontSize: '14px',
      color: isDarkMode ? '#B3BAC5' : '#6B778C',
      marginTop: '4px',
      transition: 'all 0.2s ease'
    },
    tabContainer: {
      display: 'flex',
      background: isDarkMode ? '#161A1D' : '#FFFFFF',
      borderBottom: isDarkMode ? '1px solid #2C3E50' : '1px solid #E1E5E9',
      padding: '0 24px',
      gap: '0'
    },
    tab: {
      padding: '12px 16px',
      borderRadius: '0',
      border: 'none',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      background: 'transparent',
      color: isDarkMode ? '#B3BAC5' : '#6B778C',
      borderBottom: '2px solid transparent',
      '&:hover': {
        background: isDarkMode ? '#22272B' : '#F4F5F7',
        color: isDarkMode ? '#FFFFFF' : '#172B4D'
      }
    },
    activeTab: {
      background: 'transparent',
      color: isDarkMode ? '#FFFFFF' : '#172B4D',
      borderBottom: isDarkMode ? '2px solid #0052CC' : '2px solid #0052CC',
      fontWeight: '600'
    },
    section: {
      background: isDarkMode ? '#22272B' : '#FFFFFF',
      borderRadius: '8px',
      padding: '20px',
      margin: '16px 24px',
      border: isDarkMode ? '1px solid #2C3E50' : '1px solid #E1E5E9',
      transition: 'all 0.2s ease',
      '&:hover': {
        borderColor: isDarkMode ? '#3C4A56' : '#C1C7D0'
      }
    },
    sectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '16px',
      color: isDarkMode ? '#FFFFFF' : '#172B4D',
      borderBottom: 'none',
      paddingBottom: '0',
      transition: 'all 0.2s ease'
    },
    input: {
      padding: '8px 12px',
      borderRadius: '6px',
      border: isDarkMode 
        ? '1px solid #2C3E50'
        : '1px solid #C1C7D0',
      fontSize: '14px',
      transition: 'all 0.2s ease',
      outline: 'none',
      flex: '1',
      minWidth: '200px',
      background: isDarkMode ? '#1D2125' : '#FFFFFF',
      color: isDarkMode ? '#B3BAC5' : '#172B4D',
      '&:focus': {
        borderColor: '#0052CC',
        boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.2)'
      }
    },
    button: {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      textTransform: 'none',
      letterSpacing: '0',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px'
    },
    primaryButton: {
      background: '#0052CC',
      color: '#FFFFFF',
      '&:hover': {
        background: '#0065FF'
      },
      '&:disabled': {
        background: isDarkMode ? '#2C3E50' : '#C1C7D0',
        color: isDarkMode ? '#6B778C' : '#6B778C',
        cursor: 'not-allowed'
      }
    },
    secondaryButton: {
      background: isDarkMode ? '#2C3E50' : '#F4F5F7',
      color: isDarkMode ? '#B3BAC5' : '#172B4D',
      border: isDarkMode ? '1px solid #2C3E50' : '1px solid #C1C7D0',
      '&:hover': {
        background: isDarkMode ? '#3C4A56' : '#EBECF0'
      }
    },
    dangerButton: {
      background: '#DE350B',
      color: '#FFFFFF',
      '&:hover': {
        background: '#FF5630'
      }
    },
    successButton: {
      background: '#00875A',
      color: '#FFFFFF',
      '&:hover': {
        background: '#00A86B'
      }
    },
    select: {
      padding: '8px 12px',
      borderRadius: '6px',
      border: isDarkMode 
        ? '1px solid #2C3E50'
        : '1px solid #C1C7D0',
      fontSize: '14px',
      backgroundColor: isDarkMode ? '#1D2125' : '#FFFFFF',
      color: isDarkMode ? '#B3BAC5' : '#172B4D',
      cursor: 'pointer',
      outline: 'none',
      minWidth: '200px',
      transition: 'all 0.2s ease',
      '&:focus': {
        borderColor: '#0052CC',
        boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.2)'
      }
    },
    fileInput: {
      padding: '8px 12px',
      borderRadius: '6px',
      border: isDarkMode 
        ? '1px solid #2C3E50'
        : '1px solid #C1C7D0',
      fontSize: '14px',
      background: isDarkMode ? '#1D2125' : '#FFFFFF',
      color: isDarkMode ? '#B3BAC5' : '#172B4D',
      transition: 'all 0.2s ease'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      borderRadius: '8px',
      overflow: 'hidden',
      border: isDarkMode ? '1px solid #2C3E50' : '1px solid #E1E5E9',
      transition: 'all 0.2s ease'
    },
    tableHeader: {
      background: isDarkMode ? '#161A1D' : '#F4F5F7',
      color: isDarkMode ? '#B3BAC5' : '#6B778C',
      padding: '12px',
      textAlign: 'left',
      fontWeight: '600',
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderBottom: isDarkMode ? '1px solid #2C3E50' : '1px solid #E1E5E9'
    },
    tableRow: {
      transition: 'all 0.2s ease',
      '&:hover': {
        background: isDarkMode ? '#22272B' : '#F4F5F7'
      }
    },
    tableCell: {
      padding: '12px',
      borderBottom: isDarkMode 
        ? '1px solid #2C3E50'
        : '1px solid #E1E5E9',
      fontSize: '14px',
      transition: 'all 0.2s ease'
    },
    tableInput: {
      width: '100%',
      padding: '6px 8px',
      borderRadius: '4px',
      border: isDarkMode 
        ? '1px solid #2C3E50'
        : '1px solid #C1C7D0',
      fontSize: '13px',
      transition: 'all 0.2s ease',
      background: isDarkMode ? '#1D2125' : '#FFFFFF',
      color: isDarkMode ? '#B3BAC5' : '#172B4D',
      '&:focus': {
        borderColor: '#0052CC',
        boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.2)'
      }
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
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    completeBadge: {
      background: '#00875A',
      color: '#FFFFFF'
    },
    incompleteBadge: {
      background: '#FF8B00',
      color: '#FFFFFF'
    },
    actionButton: {
      padding: '6px 12px',
      borderRadius: '4px',
      border: 'none',
      fontSize: '12px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      margin: '0 4px'
    },
    filterSection: {
      marginBottom: '16px',
      padding: '16px',
      borderRadius: '6px',
      background: isDarkMode ? '#161A1D' : '#F4F5F7',
      border: isDarkMode ? '1px solid #2C3E50' : '1px solid #E1E5E9'
    },
    filterRow: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      marginBottom: '12px'
    },
    filterInput: {
      flex: 1,
      padding: '8px 12px',
      borderRadius: '6px',
      border: isDarkMode 
        ? '1px solid #2C3E50'
        : '1px solid #C1C7D0',
      fontSize: '14px',
      transition: 'all 0.2s ease',
      background: isDarkMode ? '#1D2125' : '#FFFFFF',
      color: isDarkMode ? '#B3BAC5' : '#172B4D',
      '&:focus': {
        borderColor: '#0052CC',
        boxShadow: '0 0 0 2px rgba(0, 82, 204, 0.2)'
      }
    },
    filterInfo: {
      padding: '8px 12px',
      borderRadius: '4px',
      background: isDarkMode ? '#1D2125' : '#FFFFFF',
      border: isDarkMode ? '1px solid #2C3E50' : '1px solid #E1E5E9',
      color: isDarkMode ? '#B3BAC5' : '#172B4D'
    },
    noResults: {
      textAlign: 'center',
      padding: '40px 20px',
      background: isDarkMode ? '#161A1D' : '#F4F5F7',
      borderRadius: '6px',
      border: isDarkMode ? '1px solid #2C3E50' : '1px solid #E1E5E9',
      color: isDarkMode ? '#6B778C' : '#6B778C'
    }
  }

  const renderMainApp = () => (
    <>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Create New Batch</h3>
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
            disabled={!batchTag.trim() || apiHealthy === false}
          >
            Create Batch
          </button>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Select & Manage Batch</h3>
        <div style={styles.flexRow}>
          <select 
            style={styles.select} 
            value={selectedImportId} 
            onChange={e => setSelectedImportId(e.target.value)}
          >
            <option value="">-- Select a batch --</option>
            {imports.map(b => (
              <option key={b.id} value={b.id}>
                {b.batch_tag} (ID: #{b.id})
              </option>
            ))}
          </select>
          <button 
            style={{...styles.button, ...styles.successButton}}
            onClick={() => hiddenUploadRef.current?.click()} 
            disabled={!selectedImportId}
          >
            Upload Excel SNs
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
          <h3 style={styles.sectionTitle}>Batch Controls</h3>
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
              Rename
            </button>
            <button 
              style={{...styles.button, ...styles.dangerButton}}
              onClick={deleteBatch}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {selectedImport && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Upload Device Serial Numbers</h3>
          <div style={styles.flexRow}>
            <input 
              type="file" 
              accept=".xlsx,.xls,.csv" 
              style={styles.fileInput}
              ref={batchUploadRef}
              onChange={e => {
                const picked = (e.target && e.target.files && e.target.files[0]) || null
                setFile(picked)
              }} 
            />
            <button 
              style={{...styles.button, ...styles.successButton}}
              onClick={uploadSNs} 
              disabled={!file || isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        </div>
      )}

      {selectedImport && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            Devices in Batch: {devices.length} total
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
                          {savingId === d.id ? 'Saving...' : (complete ? 'Update' : 'FuckOff')}
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
          <h3 style={styles.sectionTitle}>Generate Reports</h3>
          <div style={styles.reportGrid}>
            <button 
              style={{...styles.button, ...styles.primaryButton}}
              onClick={() => downloadReport('label-carton', 'xlsx')}
            >
              Label Carton (XLSX)
            </button>
            <button 
              style={{...styles.button, ...styles.primaryButton}}
              onClick={() => downloadReport('label-carton', 'csv')}
            >
              Label Carton (CSV)
            </button>
            <button 
              style={{...styles.button, ...styles.successButton}}
              onClick={() => downloadReport('device-label', 'xlsx')}
            >
              Device Label (XLSX)
            </button>
            <button 
              style={{...styles.button, ...styles.successButton}}
              onClick={() => downloadReport('device-label', 'csv')}
            >
              Device Label (CSV)
            </button>
            <button 
              style={{...styles.button, ...styles.secondaryButton}}
              onClick={() => downloadReport('asset-import', 'xlsx')}
            >
              Asset Import (XLSX)
            </button>
            <button 
              style={{...styles.button, ...styles.secondaryButton}}
              onClick={() => downloadReport('asset-import', 'csv')}
            >
              Asset Import (CSV)
            </button>
          </div>
        </div>
      )}
    </>
  )

  const renderDatabaseManager = () => (
    <>
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Database Management</h3>
        <p style={{ color: isDarkMode ? '#bdc3c7' : '#7f8c8d', marginBottom: '16px' }}>
          Direct database editing - be careful with changes!
        </p>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          Imports Table 
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
              placeholder="Quick filter by ID or Batch Tag..."
              value={importFilter}
              onChange={(e) => setImportFilter(e.target.value)}
            />
            <button
              style={{...styles.button, ...styles.secondaryButton, padding: '8px 16px'}}
              onClick={() => setImportFilter('')}
              title="Clear filter"
            >
              Clear
            </button>
          </div>
          {importFilter && (
            <div style={styles.filterInfo}>
              <span style={{ color: isDarkMode ? '#27ae60' : '#27ae60', fontWeight: '600' }}>
                Filtering: "{importFilter}" • Showing {filteredImports.length} of {dbImports.length} imports
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
                          FuckOff
                        </button>
                        <button
                          style={{...styles.actionButton, ...styles.secondaryButton}}
                          onClick={() => setEditingImport(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          style={{...styles.actionButton, ...styles.primaryButton}}
                          onClick={() => setEditingImport(imp)}
                        >
                          Edit
                        </button>
                        <button
                          style={{...styles.actionButton, ...styles.dangerButton}}
                          onClick={() => deleteImportFromDb(imp.id)}
                        >
                          Delete
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
          Devices Table 
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '400', 
            marginLeft: '12px',
            color: isDarkMode ? '#bdc3c7' : '#7f8c8d'
          }}>
            ({filteredDevices.length} of {dbDevices.length} devices)
          </span>
        </h3>
        
        {/* Bulk Update from Excel */}
        <div style={{ ...styles.filterSection, marginBottom: '16px' }}>
          <div style={styles.filterRow}>
            <input
              ref={batchUploadRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={styles.fileInput}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  setIsUploading(true)
                  const form = new FormData()
                  form.append('file', f)
                  await axios.post(`${API}/devices/bulk-update`, form)
                  await refreshAllDevices()
                  alert('Bulk update completed')
                } catch (err) {
                  console.error('Bulk update failed:', err)
                  const status = err?.response?.status
                  const msg = err?.response?.data?.error || err?.message || 'Unknown error'
                  alert(`Bulk update failed${status ? ` (HTTP ${status})` : ''}: ${msg}`)
                } finally {
                  setIsUploading(false)
                  if (batchUploadRef.current) batchUploadRef.current.value = ''
                }
              }}
            />
            <div style={{ fontSize: '12px', color: isDarkMode ? '#bdc3c7' : '#7f8c8d' }}>
              Expected headers: Serial, FRDC, taskCode, name, address, userEmail, userPhone
            </div>
          </div>
        </div>

        {/* Quick Filter Section */}
        <div style={styles.filterSection}>
          <div style={styles.filterRow}>
            <input
              style={styles.filterInput}
              placeholder="Quick filter by ID, SN, Name, Email, Phone, Work Order, Device Label, Items, or Address..."
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
            />
            <button
              style={{...styles.button, ...styles.secondaryButton, padding: '8px 16px'}}
              onClick={() => setDeviceFilter('')}
              title="Clear filter"
            >
              Clear
            </button>
          </div>
          {deviceFilter && (
            <div style={styles.filterInfo}>
              <span style={{ color: isDarkMode ? '#27ae60' : '#27ae60', fontWeight: '600' }}>
                Filtering: "{deviceFilter}" • Showing {filteredDevices.length} of {dbDevices.length} devices
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
                {deviceFilter ? `No devices found matching "${deviceFilter}"` : 'No devices available'}
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
                          FuckOff
                        </button>
                        <button
                          style={{...styles.actionButton, ...styles.secondaryButton}}
                          onClick={() => setEditingDevice(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          style={{...styles.actionButton, ...styles.primaryButton}}
                          onClick={() => setEditingDevice(device)}
                        >
                          Edit
                        </button>
                        <button
                          style={{...styles.actionButton, ...styles.dangerButton}}
                          onClick={() => deleteDeviceFromDb(device.id)}
                        >
                          Delete
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img 
            src="/src/assets/3C20C8BC-A864-4744-9E42-AC17F49C2423_1_105_c.jpeg" 
            alt="Abby-Label App Icon" 
            style={styles.appIcon}
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
          <div>
            <h1 style={styles.title}>Abby-Label</h1>
            <p style={styles.subtitle}>Professional Device Management & Labeling System</p>
          </div>
        </div>
        
        <button 
          style={styles.themeToggle}
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div style={styles.tabContainer}>
        <button
          style={{...styles.tab, ...(activeTab === 'main' ? styles.activeTab : {})}}
          onClick={() => setActiveTab('main')}
        >
          Main App
        </button>
        <button
          style={{...styles.tab, ...(activeTab === 'database' ? styles.activeTab : {})}}
          onClick={() => setActiveTab('database')}
        >
          Database Manager
        </button>
      </div>

      {activeTab === 'main' ? renderMainApp() : renderDatabaseManager()}
    </div>
  )
}