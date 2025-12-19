import LoginPage from "./pages/LoginPage"
import { ZeroProvider } from "@rocicorp/zero/react"
import type { ZeroOptions } from "@rocicorp/zero"
import { schema } from "./zero/schema.ts"

const opts: ZeroOptions = {
  cacheURL: "http://localhost:4848",
  schema,
}

function App() {
  return (
    <ZeroProvider {...opts}>
      <LoginPage />
    </ZeroProvider>
  )
}

export default App
