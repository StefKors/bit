import { ZeroProvider } from "@rocicorp/zero/react"
import { useState } from "react"
import { Route, Switch } from "wouter"
import { mutators } from "@/db/mutators"
import { schema } from "@/db/schema"
import "@/db/types" // Import to register DefaultTypes
import { Layout } from "@/layout"
import LoginPage from "@/pages/LoginPage"
import { OverviewPage } from "./pages/OverviewPage"
import { OwnerPage } from "./pages/OwnerPage"
import { RepoPage } from "./pages/RepoPage"
import { PRListPage } from "./pages/PRListPage"
import { PRDetailPage } from "./pages/PRDetailPage"
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
        <Switch>
          <Route
            path="/"
            component={() => <OverviewPage onLogout={handleAuthChange} />}
          />
          <Route path="/:owner/:repo/pulls" component={PRListPage} />
          <Route path="/:owner/:repo/pull/:number" component={PRDetailPage} />
          <Route path="/:owner/:repo" component={RepoPage} />
          <Route path="/:owner" component={OwnerPage} />
          <Route>
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <h1>404 - Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
            </div>
          </Route>
        </Switch>
      </Layout>
    </ZeroProvider>
  )
}

export default App
