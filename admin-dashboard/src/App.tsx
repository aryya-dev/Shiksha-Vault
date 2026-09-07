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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<TabType>('students')
  const [configured, setConfigured] = useState<boolean>(false)

  useEffect(() => {
    const isConf = isSupabaseConfigured()
    setConfigured(Boolean(isConf))

    if (isConf) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsAuthenticated(!!session)
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session)
      })

      return () => subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut()
    }
    setIsAuthenticated(false)
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
