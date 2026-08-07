import { useState, useCallback, useRef, useEffect } from "react"
import { useAccount, useWalletClient, usePublicClient } from "wagmi"

// ─── Types ────────────────────────────────────────────────────────────────────
interface UnsignedTx {
  to:          `0x${string}`
  data:        `0x${string}`
  value?:      string
  chainId:     number
  description: string
}

interface PrepareResult {
  success:      boolean
  action:       string
  userAddress:  string
  transactions: UnsignedTx[]
  summary:      string
  error?:       string
}

interface TxStatus {
  step:    number
  total:   number
  hash:    string | null
  status:  "idle" | "pending" | "signing" | "confirming" | "success" | "error"
  message: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePreparedTx() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  // Ref so a delayed retry (below) reads the latest walletClient without
  // needing it in executePrepared's useCallback deps — same pattern as
  // App.tsx's walletClientRef.
  const walletClientRef = useRef(walletClient)
  useEffect(() => { walletClientRef.current = walletClient }, [walletClient])

  const [txStatus, setTxStatus] = useState<TxStatus>({
    step:    0,
    total:   0,
    hash:    null,
    status:  "idle",
    message: "",
  })

  /**
   * Execute a prepared transaction set from the backend.
   * Signs and submits each TX in sequence using the user's wallet.
   */
  const executePrepared = useCallback(async (prepared: PrepareResult): Promise<string> => {
    // Give wagmi 500ms to fully initialize walletClient after address detection —
    // same race/fix as App.tsx's sendMessage defiAction path.
    if (address && !walletClientRef.current) {
      await new Promise<void>(resolve => setTimeout(resolve, 500))
    }
    const wc = walletClientRef.current
    if (!address || !wc || !publicClient) {
      return "❌ Wallet not connected. Please connect your wallet first."
    }

    if (!prepared.success || prepared.transactions.length === 0) {
      return `❌ ${prepared.error ?? "No transactions to execute"}`
    }

    const total = prepared.transactions.length
    let lastHash = ""

    try {
      for (let i = 0; i < total; i++) {
        const tx = prepared.transactions[i]

        setTxStatus({
          step:    i + 1,
          total,
          hash:    null,
          status:  "signing",
          message: `Signing transaction ${i + 1}/${total}: ${tx.description}`,
        })

        // Send transaction via user's wallet
        const hash = await wc.sendTransaction({
          to:      tx.to,
          data:    tx.data as `0x${string}`,
          value:   tx.value ? BigInt(tx.value) : undefined,
          chainId: tx.chainId,
          account: address,
        })

        lastHash = hash

        setTxStatus({
          step:    i + 1,
          total,
          hash,
          status:  "confirming",
          message: `Confirming transaction ${i + 1}/${total}...`,
        })

        // Wait for confirmation before next TX
        await publicClient.waitForTransactionReceipt({ hash })

        setTxStatus({
          step:    i + 1,
          total,
          hash,
          status:  i === total - 1 ? "success" : "signing",
          message: i === total - 1
            ? `✅ All done! ${tx.description}`
            : `✅ Step ${i + 1} confirmed. Preparing step ${i + 2}...`,
        })
      }

      return `✅ ${prepared.summary}
> TX: https://celoscan.io/tx/${lastHash}
> Signed by YOUR wallet: ${address.slice(0, 6)}...${address.slice(-4)}`

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)

      // User rejected
      if (msg.includes("User rejected") || msg.includes("user rejected")) {
        setTxStatus(s => ({ ...s, status: "error", message: "Transaction cancelled by user." }))
        return "❌ Transaction cancelled."
      }

      setTxStatus(s => ({ ...s, status: "error", message: `Error: ${msg}` }))
      return `❌ Transaction failed: ${msg}`
    }
  }, [address, walletClient, publicClient])

  const reset = useCallback(() => {
    setTxStatus({ step: 0, total: 0, hash: null, status: "idle", message: "" })
  }, [])

  return { txStatus, executePrepared, reset }
}

// ─── TxStatusBanner component ─────────────────────────────────────────────────
export function TxStatusBanner({ status }: { status: TxStatus }) {
  if (status.status === "idle") return null

  const colors = {
    pending:    "#ffbe0b",
    signing:    "#00d4ff",
    confirming: "#8338ec",
    success:    "#00ff9f",
    error:      "#ff006e",
  } as Record<string, string>

  const color = colors[status.status] ?? "#00ff9f"

  return (
    <div style={{
      padding:      "8px 16px",
      background:   `${color}10`,
      border:       `1px solid ${color}40`,
      borderRadius: 2,
      fontSize:     11,
      color,
      fontFamily:   "monospace",
      letterSpacing: "0.05em",
      display:      "flex",
      alignItems:   "center",
      gap:          8,
    }}>
      {status.status === "signing" && <span style={{ animation: "blink 1s infinite" }}>⟳</span>}
      {status.status === "confirming" && <span style={{ animation: "blink 0.5s infinite" }}>■</span>}
      {status.status === "success" && <span>✅</span>}
      {status.status === "error" && <span>❌</span>}
      <span>{status.message}</span>
      {status.hash && (
        <a
          href={`https://celoscan.io/tx/${status.hash}`}
          target="_blank"
          rel="noreferrer"
          style={{ marginLeft: "auto", color, fontSize: 10, opacity: 0.7 }}
        >
          VIEW ↗
        </a>
      )}
    </div>
  )
}