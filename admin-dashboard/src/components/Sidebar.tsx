import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Layers, 
  FolderTree, 
  Trash2, 
  ShieldAlert, 
  LogOut,
  Smartphone,
  Download
} from 'lucide-react'
import { DownloadAppModal } from './DownloadAppModal'
import { supabase } from '../lib/supabase'

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
          <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Shiksha Vault
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Admin Console v1.0
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

      {/* Student App Release Card */}
      <div style={{ padding: '0 12px 12px 12px' }}>
        <div style={{
          padding: '12px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(255, 179, 0, 0.12), rgba(255, 179, 0, 0.02))',
          border: '1px solid rgba(255, 179, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 179, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              flexShrink: 0
            }}>
              <Smartphone size={16} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Shiksha Vault App
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                v1.0 • 30.7 MB Release
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowDownloadModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '7px 10px',
              backgroundColor: 'var(--accent-primary)',
              color: '#000000',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1.0')}
          >
            <Download size={14} />
            <span>Download & QR</span>
          </button>
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
