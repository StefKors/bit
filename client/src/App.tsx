import { ZeroProvider } from "@rocicorp/zero/react"
import { useState } from "react"
import { mutators } from "@/db/mutators"
import { schema } from "@/schema"
import { Layout } from "@/layout"
import LoginPage from "@/pages/LoginPage"
import { HomePage } from "@/pages/HomePage"
import { authClient } from "@/lib/auth"

const cacheURL = import.meta.env.VITE_PUBLIC_ZERO_CACHE_URL

interface AppProps {
  userID: string | null
}

function App({ userID: initialUserID }: AppProps) {
  const { data: session, isPending } = authClient.useSession()
  const [forceReload, setForceReload] = useState(0)

  // Use session user ID if available, otherwise use initial
  const userID = session?.user?.id ?? initialUserID
  const context = { userID }

  const handleAuthChange = () => {
    // Trigger a re-render to pick up new session
    setForceReload((prev) => prev + 1)
    window.location.reload()
  }

  if (isPending) {
    return (
      <Layout>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
          }}
        >
          Loading...
        </div>
      </Layout>
    )
  }

  // If not logged in, show login page
  if (!session) {
    return <LoginPage onLogin={handleAuthChange} />
  }

  return (
    <ZeroProvider
      key={`${userID}-${forceReload}`}
      {...{
        userID: userID ?? "anon",
        cacheURL,
        schema,
        mutators,
        context,
      }}
    >
      <Layout>
        <HomePage onLogout={handleAuthChange} />
      </Layout>
    </ZeroProvider>
  )
}

export default App
