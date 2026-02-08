import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document'
import { ServerStyleSheet } from 'styled-components'

export default class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const sheet = new ServerStyleSheet()
    const originalRenderPage = ctx.renderPage

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) =>
            sheet.collectStyles(<App {...props} />),
        })

      const initialProps = await Document.getInitialProps(ctx)
      return {
        ...initialProps,
        styles: (
          <>
            {initialProps.styles}
            {sheet.getStyleElement()}
          </>
        ),
      }
    } finally {
      sheet.seal()
    }
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          <link rel="icon" href="/favicon.ico" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Luckiest+Guy&family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet" />
          <meta name="format-detection" content="telephone=no" />
          <meta name="color-scheme" content="dark" />
          <meta name="theme-color" content="#0066cc" />
          <meta name="description" content="Dory AI - Your AI gaming companion for immersive adventures" />
          <meta name="keywords" content="AI, gaming, companion, voice assistant, gaming companion" />
          <meta property="og:title" content="Dory AI | Your AI Gaming Companion" />
          <meta property="og:description" content="Your AI gaming companion for immersive adventures" />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content="Dory AI | Your AI Gaming Companion" />
          <meta name="twitter:description" content="Your AI gaming companion for immersive adventures" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
