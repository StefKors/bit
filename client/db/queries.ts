import { defineQueries, defineQuery } from "@rocicorp/zero"
import { zql } from "@/schema"

export const queries = defineQueries({
  users: {
    all: defineQuery(() => zql.user.orderBy("name", "asc")),
  },
})
