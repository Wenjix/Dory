import type { AppProps } from 'next/app'
import { UnifiedAgentProvider } from '@/contexts/UnifiedAgentContext'
import { GlobalStyles } from '@/theme'
import Head from 'next/head'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <UnifiedAgentProvider>
      <Head>
        <title>Dory AI | Your AI Gaming Companion</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyles />
      <Component {...pageProps} />
    </UnifiedAgentProvider>
  )
}
