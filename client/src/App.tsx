import { useQuery, useZero } from "@rocicorp/zero/react"
import { ZeroProvider } from "@rocicorp/zero/react"
import { useState } from "react"
import { formatDate } from "./date"
import { randInt } from "./rand"
import { RepeatButton } from "./repeat-button"
import { mutators } from "./mutators"
import { queries } from "./queries"
import { randomMessage } from "./test-data"
import { schema } from "./schema"
import LoginPage from "./pages/LoginPage"
import { authClient } from "./lib/auth"

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
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        Loading...
      </div>
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
      <MainContent onLogout={handleAuthChange} />
    </ZeroProvider>
  )
}

interface MainContentProps {
  onLogout: () => void
}

function MainContent({ onLogout }: MainContentProps) {
  const z = useZero()
  const { data: session } = authClient.useSession()
  const [users] = useQuery(queries.users.all())
  const [mediums] = useQuery(queries.mediums.all())

  const [filterUser, setFilterUser] = useState("")
  const [filterText, setFilterText] = useState("")

  const [allMessages] = useQuery(queries.messages.feed({}))
  const [filteredMessages] = useQuery(
    queries.messages.feed({
      senderID: filterUser || undefined,
      search: filterText || undefined,
    }),
  )

  const hasFilters = filterUser || filterText

  // If initial sync hasn't completed, these can be empty.
  if (!users.length || !mediums.length) {
    return null
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    onLogout()
  }

  return (
    <>
      <div className="controls">
        <div>
          <RepeatButton
            onTrigger={() => {
              z.mutate(mutators.message.insert(randomMessage(users, mediums)))
            }}
          >
            Add Messages
          </RepeatButton>
          <RepeatButton
            onTrigger={(e) => {
              if (!session && !e.shiftKey) {
                alert(
                  "You must be logged in to delete. Hold shift to try anyway.",
                )
                return false
              }
              if (allMessages.length === 0) {
                return false
              }

              const index = randInt(allMessages.length)
              z.mutate(mutators.message.delete({ id: allMessages[index].id }))
              return true
            }}
          >
            Remove Messages
          </RepeatButton>
          <em>(hold down buttons to repeat)</em>
        </div>
        <div
          style={{
            justifyContent: "end",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          {session && (
            <>
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt={session.user.name}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                  }}
                />
              )}
              <span>Logged in as {session.user.name}</span>
              <button onClick={handleSignOut}>Logout</button>
            </>
          )}
        </div>
      </div>
      <div className="controls">
        <div>
          From:
          <select
            onChange={(e) => setFilterUser(e.target.value)}
            style={{ flex: 1 }}
          >
            <option key={""} value="">
              Sender
            </option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          Contains:
          <input
            type="text"
            placeholder="message"
            onChange={(e) => setFilterText(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
      </div>
      <div className="controls">
        <em>
          {!hasFilters ? (
            <>Showing all {filteredMessages.length} messages</>
          ) : (
            <>
              Showing {filteredMessages.length} of {allMessages.length}{" "}
              messages. Try opening{" "}
              <a href="/" target="_blank">
                another tab
              </a>{" "}
              to see them all!
            </>
          )}
        </em>
      </div>
      {filteredMessages.length === 0 ? (
        <h3>
          <em>No posts found 😢</em>
        </h3>
      ) : (
        <table border={1} cellSpacing={0} cellPadding={6} width="100%">
          <thead>
            <tr>
              <th>Sender</th>
              <th>Medium</th>
              <th>Message</th>
              <th>Labels</th>
              <th>Sent</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {filteredMessages.map((message) => (
              <tr key={message.id}>
                <td align="left">{message.sender?.name}</td>
                <td align="left">{message.medium?.name}</td>
                <td align="left">{message.body}</td>
                <td align="left">{message.labels.join(", ")}</td>
                <td align="right">{formatDate(message.timestamp)}</td>
                <td
                  onMouseDown={(e) => {
                    if (message.senderID !== z.userID && !e.shiftKey) {
                      alert(
                        "You aren't logged in as the sender of this message. Editing won't be permitted. Hold the shift key to try anyway.",
                      )
                      return
                    }

                    const body = prompt("Edit message", message.body)
                    if (body === null) {
                      return
                    }
                    z.mutate(
                      mutators.message.update({
                        id: message.id,
                        body,
                      }),
                    )
                  }}
                >
                  ✏️
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

export default App
