import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { 
  ssr: false,
  loading: () => <div style={{ padding: '20px', textAlign: 'center' }}>Loading Swagger UI...</div>
})

export default function ApiDocs() {
  const [spec, setSpec] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Fetch the OpenAPI specification
    fetch('/api/docs')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load API specification')
        }
        return response.json()
      })
      .then(data => {
        setSpec(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <>
        <Head>
          <title>ASR API Documentation</title>
          <meta name="description" content="Interactive API documentation for ASR Server" />
        </Head>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div>
            <h2>Loading API Documentation...</h2>
            <p>Please wait while we load the interactive API documentation.</p>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Head>
          <title>ASR API Documentation - Error</title>
        </Head>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ textAlign: 'center', color: '#d32f2f' }}>
            <h2>Error Loading Documentation</h2>
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>ASR API Documentation</title>
        <meta name="description" content="Interactive API documentation for ASR Server" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div style={{ minHeight: '100vh', backgroundColor: '#fafafa' }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#1976d2',
          color: 'white',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ margin: 0, fontSize: '28px' }}>ASR Server API Documentation</h1>
            <p style={{ margin: '10px 0 0 0', opacity: 0.9 }}>
              Interactive documentation for the Automatic Speech Recognition API
            </p>
          </div>
        </div>

        {/* API Key Notice */}
        <div style={{ maxWidth: '1200px', margin: '0 auto 20px auto', padding: '0 20px' }}>
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            padding: '15px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>🔑 API Key Required</h3>
            <p style={{ margin: 0, color: '#856404' }}>
              All API endpoints require authentication. To test the endpoints below:
            </p>
            <ol style={{ margin: '10px 0 0 0', color: '#856404' }}>
              <li>Get your API key from the <code>.secrets</code> file</li>
              <li>Click the &quot;Authorize&quot; button below</li>
              <li>Enter your API key in the format: <code>asr_your_key_here</code></li>
              <li>Click &quot;Authorize&quot; to authenticate your requests</li>
            </ol>
          </div>
        </div>

        {/* Swagger UI */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <SwaggerUI 
            spec={spec}
            docExpansion="list"
            defaultModelsExpandDepth={2}
            defaultModelExpandDepth={2}
            displayRequestDuration={true}
            tryItOutEnabled={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
            requestInterceptor={(request) => {
              // Add any request modifications here if needed
              return request
            }}
            responseInterceptor={(response) => {
              // Add any response modifications here if needed
              return response
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: '40px 20px',
          marginTop: '40px',
          borderTop: '1px solid #e0e0e0'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            <h3>Additional Resources</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
              <div>
                <h4>Setup Guide</h4>
                <p>Complete setup instructions and configuration details</p>
                <a href="/ASR_API_SETUP.md" style={{ color: '#1976d2' }}>View Setup Guide</a>
              </div>
              <div>
                <h4>Rate Limits</h4>
                <p>30 requests per minute per API key</p>
                <p>Burst allowance: 5 additional requests</p>
              </div>
              <div>
                <h4>Support</h4>
                <p>For technical support and questions</p>
                <p>Check logs and configuration files</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
