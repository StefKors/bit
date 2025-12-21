import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "@/App"
import "@/theme.css"
import "@/index.css"
import { authClient } from "@/lib/auth"

async function init() {
  // Try to get the session from Better Auth
  const session = await authClient.getSession()
  const userID = session?.data?.user?.id ?? null

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App userID={userID} />
    </StrictMode>,
  )
}

init()
