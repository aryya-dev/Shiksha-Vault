import React, { useState } from 'react'
import { Lock, Mail, ArrowRight } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatUserError } from '../lib/errorHandler'

interface AuthPageProps {
  onLoginSuccess: () => void
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password
        })
        if (error) throw error
        
        // Verify admin role
        if (data.user) {
          let { data: adminRecord } = await supabase
            .from('admins')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle()

          // If no admin record exists, try self-healing claim_admin_access RPC
          if (!adminRecord) {
            try {
              const { data: claimRes } = await supabase.rpc('claim_admin_access')
              if (claimRes?.success) {
                const { data: refreshed } = await supabase
                  .from('admins')
                  .select('*')
                  .eq('id', data.user.id)
                  .maybeSingle()
                adminRecord = refreshed
              }
            } catch (rpcErr) {
              console.warn('claim_admin_access RPC not yet available:', rpcErr)
            }
          }

          // If still no admin record, provide helpful guidance
          if (!adminRecord) {
            const isStudent = Boolean(data.user.email?.includes('@student.shiksharthi.in'))
            await supabase.auth.signOut()
            if (isStudent) {
              throw new Error('This account belongs to a student. Please use the Shiksha Vault mobile app to log in.')
            }
            throw new Error('Administrator privileges not yet assigned. Please run Migration 16 in your Supabase SQL Editor.')
          }
        }
        onLoginSuccess()
      } catch (err: any) {
        setErrorMsg(formatUserError(err, 'Sign in failed'))
      } finally {
        setLoading(false)
      }
    } else {
      // Mock login demo mode
      setTimeout(() => {
        setLoading(false)
        onLoginSuccess()
      }, 400)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-page)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        className="card"
        style={{
          width: '420px',
          backgroundColor: 'var(--surface-card)',
          padding: '36px 32px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '12px 20px',
              display: 'inline-block',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              marginBottom: '16px'
            }}
          >
            <img
              src="/shiksharthi_logo.png"
              alt="Shiksharthi Educational Institute"
              style={{ height: '52px', width: 'auto', display: 'block' }}
            />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Shiksha Vault • Administrator Portal
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(255, 77, 77, 0.1)',
              border: '1px solid rgba(255, 77, 77, 0.3)',
              borderRadius: '6px',
              color: 'var(--danger)',
              fontSize: '13px',
              marginBottom: '18px'
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Staff Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="email"
                placeholder="admin@shiksharthi.in"
                className="input-field"
                style={{ paddingLeft: '38px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="password"
                placeholder="••••••••••••"
                className="input-field"
                style={{ paddingLeft: '38px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '10px', height: '42px' }}
            disabled={loading}
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {!isSupabaseConfigured() && (
          <div
            style={{
              marginTop: '20px',
              padding: '10px',
              backgroundColor: 'var(--surface-raised)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center'
            }}
          >
            💡 Demo Mode active. Enter any email & password to test.
          </div>
        )}
      </div>
    </div>
  )
}
