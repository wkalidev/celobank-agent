import React from "react"
import ReactDOM from "react-dom/client"
import { Providers } from "./providers.js"
import App from "./App.js"
import '@rainbow-me/rainbowkit/styles.css'

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>
)