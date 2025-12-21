import { ZeroProvider } from "@rocicorp/zero/react"
import { lazy, Suspense, useState } from "react"
import { Route, Switch } from "wouter"
import { mutators } from "@/db/mutators"
import { schema } from "@/db/schema"
import "@/db/types" // Import to register DefaultTypes
import { Layout } from "@/layout"
import { LoadingCube } from "@/components/LoadingCube"
import LoginPage from "@/pages/LoginPage"
import { authClient } from "@/lib/auth"

const OverviewPage = lazy(() =>
  import("./pages/OverviewPage").then((m) => ({ default: m.OverviewPage })),
)
const OwnerPage = lazy(() =>
  import("./pages/OwnerPage").then((m) => ({ default: m.OwnerPage })),
)
const RepoPage = lazy(() =>
  import("./pages/RepoPage").then((m) => ({ default: m.RepoPage })),
)
const RepoPullsPage = lazy(() =>
  import("./pages/RepoPullsPage").then((m) => ({ default: m.RepoPullsPage })),
)
const RepoIssuesPage = lazy(() =>
  import("./pages/RepoIssuesPage").then((m) => ({ default: m.RepoIssuesPage })),
)
const PRDetailPage = lazy(() =>
  import("./pages/PRDetailPage").then((m) => ({ default: m.PRDetailPage })),
)

const cacheURL = import.meta.env.VITE_PUBLIC_ZERO_CACHE_URL as string

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
        <LoadingCube />
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
        <Suspense fallback={<LoadingCube />}>
          <Switch>
            <Route
              path="/"
              component={() => <OverviewPage onLogout={handleAuthChange} />}
            />
            <Route path="/:owner/:repo/pulls" component={RepoPullsPage} />
            <Route path="/:owner/:repo/issues" component={RepoIssuesPage} />
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
        </Suspense>
      </Layout>
    </ZeroProvider>
  )
}

export default App
