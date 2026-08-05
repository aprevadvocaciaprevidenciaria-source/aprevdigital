import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>APREV Advocacia Previdenciária</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#022251" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
