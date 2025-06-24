import dynamic from 'next/dynamic'
import Head from 'next/head'
import 'swagger-ui-react/swagger-ui.css'

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => <div style={{ padding: 20, textAlign: 'center' }}>Loading Swagger UI...</div>
})

export default function ApiDocs() {
  return (
    <>
      <Head>
        <title>ASR API Documentation</title>
        <meta name="description" content="Interactive API documentation for ASR Server" />
        <link rel="stylesheet" href="/swagger-custom.css" />
      </Head>
      <div style={{ background: '#fafafa', padding: 20, minHeight: '100vh' }}>
        <SwaggerUI
          url="/api/docs"
          docExpansion="none"
          deepLinking={true}
          tryItOutEnabled={true}
          displayOperationId={false}
          defaultModelsExpandDepth={1}
          defaultModelExpandDepth={1}
          displayRequestDuration={true}
          filter={true}
          showExtensions={true}
          showCommonExtensions={true}
          supportedSubmitMethods={['get', 'post', 'put', 'delete', 'patch']}
          requestInterceptor={req => {
            // ensure API calls are relative to this host
            if (req.url.startsWith('/api')) {
              req.url = window.location.origin + req.url
            }
            return req
          }}
          onComplete={() => {
            // Ensure expand/collapse functionality works
            console.log('Swagger UI loaded successfully')
          }}
        />
      </div>
    </>
  )
}
