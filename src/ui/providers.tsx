import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { defineChain } from 'viem'
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector'
import '@rainbow-me/rainbowkit/styles.css'

const celo = defineChain({
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: ['https://forno.celo.org'] } },
  blockExplorers: { default: { name: 'CeloScan', url: 'https://celoscan.io' } },
})

const config = getDefaultConfig({
  appName: 'CeloBank Agent',
  projectId: 'celobank',
  chains: [celo],
  // 🟣 Connecteur Farcaster en premier — auto-connect dans Warpcast
  // RainbowKit garde ses propres connecteurs en fallback pour le browser normal
  connectors: [injected(), farcasterMiniApp()],
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}