import React, { useState, useEffect, useCallback } from 'react'
import { Header } from '../components/Header'
import { 
  Eye, 
  Camera, 
  VideoOff, 
  RefreshCw, 
  Download, 
  Search, 
  ShieldCheck, 
  ShieldAlert,
  Users
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatUserError } from '../lib/errorHandler'

export interface AccessLogItem {
  id: string
  student_id: string
  file_id: string
  event_type: 'view_file' | 'screenshot_attempt' | 'screen_record_detected' | string
  ip_address: string | null
  user_agent: string | null
  metadata: any
  created_at: string
  students?: {
    full_name: string
    student_code: string
    class_name?: string
    board?: string
  } | null
  files?: {
    name: string
    version: number
  } | null
}

export const AccessLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AccessLogItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchLogs = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('access_logs')
        .select(`
          id,
          student_id,
          file_id,
          event_type,
          ip_address,
          user_agent,
          metadata,
          created_at,
          students (
            full_name,
            student_code,
            class_name,
            board
          ),
          files (
            name,
            version
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setLogs((data as unknown as AccessLogItem[]) || [])
    } catch (err: any) {
      console.error('[AccessLogsPage] Fetch error:', err)
      alert(formatUserError(err, 'Failed to fetch access logs'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()

    if (isSupabaseConfigured()) {
      // Real-time listener for live access events from mobile students
      const channel = supabase
        .channel('realtime_access_logs')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'access_logs' },
          () => {
            fetchLogs()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [fetchLogs])

  // Summary Metrics
  const totalViews = logs.filter((l) => l.event_type === 'view_file').length
  const screenshotAttempts = logs.filter((l) => l.event_type === 'screenshot_attempt').length
  const screenRecordAttempts = logs.filter((l) => l.event_type === 'screen_record_detected').length
  const uniqueStudents = new Set(logs.map((l) => l.student_id).filter(Boolean)).size

  // Filtering
  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filterType === 'all' || log.event_type === filterType
    const query = searchQuery.trim().toLowerCase()
    if (!query) return matchesFilter

    const studentName = log.students?.full_name?.toLowerCase() || ''
    const studentCode = log.students?.student_code?.toLowerCase() || ''
    const fileName = log.files?.name?.toLowerCase() || ''
    const ip = log.ip_address?.toLowerCase() || ''

    const matchesSearch =
      studentName.includes(query) ||
      studentCode.includes(query) ||
      fileName.includes(query) ||
      ip.includes(query)

    return matchesFilter && matchesSearch
  })

  // Export CSV Audit Report
  const handleExportCsv = () => {
    if (logs.length === 0) {
      alert('No log entries available to export.')
      return
    }

    const headers = ['Timestamp', 'Student Name', 'Student Code', 'Class', 'Document Name', 'Event Type', 'IP Address']
    const rows = filteredLogs.map((log) => [
      `"${new Date(log.created_at).toISOString()}"`,
      `"${log.students?.full_name || 'Unknown'}"`,
      `"${log.students?.student_code || ''}"`,
      `"${log.students?.class_name || ''}"`,
      `"${log.files?.name || 'Deleted Document'}"`,
      `"${log.event_type}"`,
      `"${log.ip_address || ''}"`
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Shiksha-Vault-Security-Audit-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'screenshot_attempt':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(255, 106, 31, 0.15)',
              color: 'var(--accent-secondary)',
              border: '1px solid rgba(255, 106, 31, 0.3)',
              gap: '6px',
              fontWeight: 500
            }}
          >
            <Camera size={13} />
            Screenshot Intercepted (FLAG_SECURE)
          </span>
        )
      case 'screen_record_detected':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(255, 77, 77, 0.15)',
              color: 'var(--danger)',
              border: '1px solid rgba(255, 77, 77, 0.3)',
              gap: '6px',
              fontWeight: 500
            }}
          >
            <VideoOff size={13} />
            Screen Record Intercepted
          </span>
        )
      case 'view_file':
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(46, 204, 113, 0.12)',
              color: 'var(--success)',
              border: '1px solid rgba(46, 204, 113, 0.25)',
              gap: '6px',
              fontWeight: 500
            }}
          >
            <Eye size={13} />
            Document Opened
          </span>
        )
      default:
        return (
          <span
            className="badge"
            style={{
              backgroundColor: 'var(--surface-raised)',
              color: 'var(--text-secondary)',
              gap: '6px'
            }}
          >
            <ShieldAlert size={13} />
            {type}
          </span>
        )
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Security & Access Logs"
        subtitle="Live audit trail of student document access, session tokens, and anti-leak defense interceptions."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn-secondary"
              onClick={handleExportCsv}
              disabled={logs.length === 0}
              title="Export audit logs to CSV"
            >
              <Download size={15} />
              Export Audit CSV
            </button>
            <button
              className="btn-secondary"
              onClick={fetchLogs}
              disabled={isLoading}
              title="Refresh Logs"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Security Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* Card 1: Total Document Views */}
          <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(46, 204, 113, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)'
              }}
            >
              <Eye size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Document Views
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {totalViews}
              </div>
            </div>
          </div>

          {/* Card 2: Screenshot Interceptions */}
          <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 179, 0, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)'
              }}
            >
              <Camera size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Screenshots Blocked
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {screenshotAttempts}
              </div>
            </div>
          </div>

          {/* Card 3: Screen Record Interceptions */}
          <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 77, 77, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--danger)'
              }}
            >
              <VideoOff size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Recordings Blocked
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {screenRecordAttempts}
              </div>
            </div>
          </div>

          {/* Card 4: Active Students Viewing */}
          <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: 'rgba(91, 141, 239, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5B8DEF'
              }}
            >
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Viewers
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                {uniqueStudents}
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search by student name, student code, document name, or IP..."
              className="input-field"
              style={{ paddingLeft: '40px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="input-field"
            style={{ width: '240px' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Events ({logs.length})</option>
            <option value="view_file">Document Views ({totalViews})</option>
            <option value="screenshot_attempt">Screenshot Interceptions ({screenshotAttempts})</option>
            <option value="screen_record_detected">Screen Record Interceptions ({screenRecordAttempts})</option>
          </select>
        </div>

        {/* Logs Table / Empty State */}
        {isLoading && logs.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '60px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Loading security audit trail from database...
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '60px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)'
              }}
            >
              <ShieldCheck size={32} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {logs.length === 0 ? 'No Access Logs Recorded Yet' : 'No Logs Match Your Filter'}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '420px' }}>
              {logs.length === 0
                ? 'When enrolled students view documents or trigger anti-leak defenses in the Shiksha Vault mobile app, real-time audit logs will appear here automatically.'
                : 'Try adjusting your search query or event filter to see other security events.'}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table-container">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Student</th>
                  <th style={{ width: '32%' }}>Document</th>
                  <th style={{ width: '20%' }}>Event Defenses</th>
                  <th style={{ width: '13%' }}>IP / Network</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const studentName = log.students?.full_name || 'Enrolled Student'
                  const studentCode = log.students?.student_code || 'SHK-STUDENT'
                  const fileName = log.files?.name || 'Document'
                  const dateObj = new Date(log.created_at)

                  return (
                    <tr key={log.id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{studentName}</div>
                          <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                            {studentCode}
                            {log.students?.class_name && (
                              <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                                • Class {log.students.class_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {fileName}
                          </span>
                          {log.files?.version && (
                            <span className="badge" style={{ backgroundColor: 'var(--surface-raised)', fontSize: '10px' }}>
                              v{log.files.version}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{getEventBadge(log.event_type)}</td>
                      <td style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {log.ip_address || 'Encrypted App Session'}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <div>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
