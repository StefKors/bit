import { AuthorLabel } from "@/components/AuthorLabel"
import { ToolbarSelect } from "@/components/ToolbarSelect"

interface AuthorSelectProps {
  authorFilter: string
  userLogin: string | null
  uniqueAuthors: string[]
  onFilterChange: (value: string) => void
}

export const AuthorSelect = ({
  authorFilter,
  userLogin,
  uniqueAuthors,
  onFilterChange,
}: AuthorSelectProps) => {
  const items: { value: string; label: React.ReactNode }[] = []
  if (userLogin) {
    items.push({
      value: "me",
      label: <AuthorLabel weight={"regular"} login={userLogin} size={12} />,
    })
  }
  items.push({ value: "all", label: "All authors" })
  for (const login of uniqueAuthors) {
    items.push({ value: login, label: <AuthorLabel weight={"regular"} login={login} size={12} /> })
  }

  return (
    <ToolbarSelect
      value={authorFilter}
      onValueChange={onFilterChange}
      items={items}
      defaultValue="all"
      placeholder="All authors"
      emptyLabel="No authors"
      renderValue={(value) =>
        value === "me" && userLogin ? (
          <AuthorLabel weight={"regular"} login={userLogin} size={12} />
        ) : value === "all" || value == null ? (
          "All authors"
        ) : (
          <AuthorLabel weight={"regular"} login={value} size={12} />
        )
      }
    />
  )
}
