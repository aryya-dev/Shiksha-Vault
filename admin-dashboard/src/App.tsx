import { useState, useEffect } from 'react'
import { Sidebar, type TabType } from './components/Sidebar'
import { StudentsPage } from './pages/StudentsPage'
import { BatchesPage } from './pages/BatchesPage'
import { ContentPage } from './pages/ContentPage'
import { TrashPage } from './pages/TrashPage'
import { AccessLogsPage } from './pages/AccessLogsPage'
import { AuthPage } from './pages/AuthPage'
import { isSupabaseConfigured, supabase } from './lib/supabase'

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<TabType>('students')
  const [configured, setConfigured] = useState<boolean>(false)

  useEffect(() => {
    const isConf = isSupabaseConfigured()
    setConfigured(Boolean(isConf))

    if (isConf) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          try {
            const { data: adminRecord } = await supabase
              .from('admins')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle()

            if (!adminRecord) {
              await supabase.rpc('claim_admin_access')
            }
            setIsAuthenticated(true)
          } catch {
            setIsAuthenticated(true)
          }
        } else {
          setIsAuthenticated(false)
        }
        setLoading(false)
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setIsAuthenticated(false)
        }
      })

      return () => subscription.unsubscribe()
    } else {
      setLoading(false)
    }
  }, [])

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut()
    }
    setIsAuthenticated(false)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-page)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: '14px'
      }}>
        Loading Shiksharthi Educational Institute...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthPage onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSignOut={handleSignOut}
        isConfigured={configured}
      />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {activeTab === 'students' && <StudentsPage />}
        {activeTab === 'batches' && <BatchesPage />}
        {activeTab === 'content' && <ContentPage />}
        {activeTab === 'trash' && <TrashPage />}
        {activeTab === 'logs' && <AccessLogsPage />}
      </main>
    </div>
  )
}

export default App
