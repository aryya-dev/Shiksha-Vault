import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Layers, 
  FolderTree, 
  Trash2, 
  ShieldAlert, 
  LogOut,
  Smartphone,
  Download,
  Copy,
  Check,
  ExternalLink,
  QrCode
} from 'lucide-react'
import { DownloadAppModal } from './DownloadAppModal'
import { supabase } from '../lib/supabase'

const APK_URL = 'https://hgsfflqydnnhghfvfmrc.supabase.co/storage/v1/object/public/app-release/Shiksharthi-Educational-Institute.apk'
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(APK_URL)}`

export type TabType = 'students' | 'batches' | 'content' | 'trash' | 'logs'

interface SidebarProps {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  onSignOut: () => void
  isConfigured: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onSignOut,
  isConfigured
}) => {
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [apkSize, setApkSize] = useState('23.6 MB')
  const [currentUser, setCurrentUser] = useState<{
    name: string
    email: string
    role: string
  }>({
    name: 'Staff Admin',
    email: 'admin@shiksharthi.in',
    role: 'super_admin'
  })

  useEffect(() => {
    if (!isConfigured) return

    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const userEmail = user.email || ''
          let userName = user.user_metadata?.full_name || userEmail.split('@')[0] || 'Staff Admin'
          let userRole = 'super_admin'

          // Fetch name and role from public.admins
          const { data: adminRecord } = await supabase
            .from('admins')
            .select('full_name, role')
            .eq('id', user.id)
            .maybeSingle()

          if (adminRecord?.full_name) {
            userName = adminRecord.full_name
          }
          if (adminRecord?.role) {
            userRole = adminRecord.role
          }

          setCurrentUser({
            name: userName,
            email: userEmail,
            role: userRole
          })
        }
      } catch (err) {
        console.warn('Could not load current admin profile:', err)
      }
    }

    loadProfile()
  }, [isConfigured])

  // Fetch live APK file size on mount
  useEffect(() => {
    fetch(APK_URL, { method: 'HEAD' })
      .then((res) => {
        const len = res.headers.get('content-length')
        if (len) setApkSize(`${(parseInt(len) / (1024 * 1024)).toFixed(1)} MB`)
      })
      .catch(() => {})
  }, [])

  const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'students', label: 'Students Roster', icon: <Users size={18} /> },
    { id: 'batches', label: 'Batches & Subjects', icon: <Layers size={18} /> },
    { id: 'content', label: 'Content Manager', icon: <FolderTree size={18} /> },
    { id: 'trash', label: 'Trash / Recovery', icon: <Trash2 size={18} /> },
    { id: 'logs', label: 'Access & Security', icon: <ShieldAlert size={18} /> }
  ]

  return (
    <aside style={{
      width: '260px',
      backgroundColor: 'var(--surface-card)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          flexShrink: 0
        }}>
          <img
            src="/shiksharthi_icon.png"
            alt="Shiksharthi"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Shiksharthi
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Educational Institute
          </p>
        </div>
      </div>

      {/* Database connection badge */}
      <div style={{ padding: '12px 20px' }}>
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          backgroundColor: isConfigured ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 179, 0, 0.1)',
          border: `1px solid ${isConfigured ? 'rgba(46, 204, 113, 0.3)' : 'rgba(255, 179, 0, 0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: isConfigured ? 'var(--success)' : 'var(--accent-primary)'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: isConfigured ? 'var(--success)' : 'var(--accent-primary)'
          }} />
          <span>{isConfigured ? 'Supabase Connected' : 'Demo / Mock Mode'}</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                fontSize: '14px',
                fontWeight: isActive ? 500 : 400,
                backgroundColor: isActive ? 'var(--surface-raised)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent'
              }}
            >
              <span style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* App Download — Inline QR + Link Card */}
      <div style={{ padding: '0 12px 12px 12px' }}>
        <div style={{
          borderRadius: '12px',
          background: 'linear-gradient(160deg, rgba(255, 179, 0, 0.1), rgba(255, 179, 0, 0.02))',
          border: '1px solid rgba(255, 179, 0, 0.28)',
          overflow: 'hidden'
        }}>
          {/* Card Header */}
          <div style={{ padding: '10px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '6px',
                backgroundColor: 'rgba(255,179,0,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent-primary)', flexShrink: 0
              }}>
                <Smartphone size={14} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>Shiksharthi App</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Latest • {apkSize}</div>
              </div>
            </div>
            <button
              onClick={() => setShowDownloadModal(true)}
              title="Open full download panel"
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255,179,0,0.3)',
                borderRadius: '5px',
                color: 'var(--accent-primary)',
                fontSize: '10px', fontWeight: 500,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,179,0,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ExternalLink size={11} />
              <span>Details</span>
            </button>
          </div>

          {/* Live QR Code */}
          <div style={{
            margin: '0 12px 10px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
          }}>
            <img
              src={QR_URL}
              alt="QR Code to download Shiksharthi Educational Institute app"
              style={{ width: '130px', height: '130px', display: 'block', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#1e293b', fontSize: '10px', fontWeight: 600 }}>
              <QrCode size={12} style={{ color: '#0f172a' }} />
              <span>Scan to install on Android</span>
            </div>
          </div>

          {/* Direct Link + Copy */}
          <div style={{
            margin: '0 12px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '5px 8px'
          }}>
            <Download size={12} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <a
              href={APK_URL}
              download="Shiksharthi-Educational-Institute.apk"
              title="Direct APK download"
              style={{
                flex: 1, fontSize: '10px', color: 'var(--text-secondary)',
                fontFamily: 'monospace', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
                textDecoration: 'none'
              }}
            >
              Shiksharthi-Educational-Institute.apk
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(APK_URL)
                setCopiedLink(true)
                setTimeout(() => setCopiedLink(false), 2500)
              }}
              title="Copy download link"
              style={{
                display: 'flex', alignItems: 'center',
                padding: '3px 6px',
                backgroundColor: copiedLink ? 'rgba(46,204,113,0.15)' : 'var(--surface)',
                color: copiedLink ? 'var(--success)' : 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: '4px', fontSize: '10px',
                cursor: 'pointer', gap: '3px', flexShrink: 0
              }}
            >
              {copiedLink ? <Check size={11} /> : <Copy size={11} />}
              <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      <DownloadAppModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
      />

      {/* Footer Profile & Sign Out */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span 
              title={currentUser.name}
              style={{ 
                fontSize: '13px', 
                fontWeight: 600, 
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {currentUser.name}
            </span>
            <span style={{
              fontSize: '9px',
              fontWeight: 700,
              textTransform: 'uppercase',
              padding: '1px 5px',
              borderRadius: '4px',
              backgroundColor: 'rgba(255, 179, 0, 0.15)',
              color: 'var(--accent-primary)',
              letterSpacing: '0.04em',
              flexShrink: 0
            }}>
              {currentUser.role.replace('_', ' ')}
            </span>
          </div>
          <span 
            title={currentUser.email}
            style={{ 
              fontSize: '11px', 
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '1px'
            }}
          >
            {currentUser.email}
          </span>
        </div>
        <button
          onClick={onSignOut}
          title="Sign Out"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
