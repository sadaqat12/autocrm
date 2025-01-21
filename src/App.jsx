import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import './App.css'

function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <h1>React + Supabase</h1>
        {session ? (
          <p>Logged in as: {session.user.email}</p>
        ) : (
          <p>Not logged in</p>
        )}
      </header>
    </div>
  )
}

export default App 