import { hydrateRoot } from "react-dom/client"
import { StartClient } from "@tanstack/react-start/client"
import { createRouter } from "./router"
import "@/theme.css"
import "@/index.css"

const router = createRouter()

hydrateRoot(document.getElementById("root")!, <StartClient router={router} />)

