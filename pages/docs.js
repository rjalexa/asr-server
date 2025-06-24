import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { 
  ssr: false,
  loading: () => <div style={{ padding: '20px', textAlign: 'center' }}>Loading Swagger UI...</div>
})

// Import Swagger UI CSS
import 'swagger-ui-react/swagger-ui.css'

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
        <link rel="stylesheet" href="/swagger-custom.css" />
        <style jsx global>{`
          /* Hide Swagger UI banner/info section */
          .swagger-ui .info {
            display: none !important;
          }
          
          /* Style the authorize button - NOT authorized (red) */
          .swagger-ui .auth-wrapper .authorize.locked {
            background-color: #dc3545 !important;
            border-color: #dc3545 !important;
            color: white !important;
          }
          
          /* Style the authorize button when authorized (green) */
          .swagger-ui .auth-wrapper .authorize.unlocked {
            background-color: #28a745 !important;
            border-color: #28a745 !important;
            color: white !important;
          }
          
          /* Style the authorize button on hover - NOT authorized */
          .swagger-ui .auth-wrapper .authorize.locked:hover {
            background-color: #c82333 !important;
            border-color: #bd2130 !important;
          }
          
          /* Style the authorize button when authorized on hover */
          .swagger-ui .auth-wrapper .authorize.unlocked:hover {
            background-color: #218838 !important;
            border-color: #1e7e34 !important;
          }
          
          /* Additional specificity for authorize button states */
          .swagger-ui .auth-wrapper .authorize.locked svg {
            fill: white !important;
          }
          
          .swagger-ui .auth-wrapper .authorize.unlocked svg {
            fill: white !important;
          }
          
          /* Fix for operation expansion */
          .swagger-ui .opblock .opblock-summary {
            cursor: pointer !important;
          }
          
          .swagger-ui .opblock.is-open .opblock-summary {
            border-bottom: 1px solid #000;
          }
          
          /* Ensure arrow rotation works */
          .swagger-ui .opblock .arrow {
            transition: transform 0.3s !important;
          }
          
          .swagger-ui .opblock.is-open .arrow {
            transform: rotate(90deg) !important;
          }
          
          /* Hide the Swagger UI topbar */
          .swagger-ui .topbar {
            display: none !important;
          }
          
          /* Improve overall styling */
          .swagger-ui {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          }
          
          /* Style operation blocks */
          .swagger-ui .opblock {
            border-radius: 8px !important;
            margin-bottom: 15px !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
          }
          
          /* Style the try it out button */
          .swagger-ui .btn.try-out__btn {
            background-color: #007bff !important;
            border-color: #007bff !important;
            color: white !important;
          }
          
          /* Style the execute button */
          .swagger-ui .btn.execute {
            background-color: #28a745 !important;
            border-color: #28a745 !important;
            color: white !important;
          }
          
          /* Style the clear button */
          .swagger-ui .btn.btn-clear {
            background-color: #6c757d !important;
            border-color: #6c757d !important;
            color: white !important;
          }
          
          /* Improve parameter styling */
          .swagger-ui .parameters-col_description p {
            margin: 0 !important;
          }
          
          /* Style the models section */
          .swagger-ui .model-box {
            background-color: #f8f9fa !important;
            border-radius: 6px !important;
          }
          
          /* Fix deep linking and ensure operations are clickable */
          .swagger-ui .opblock-tag-section {
            display: block !important;
          }
          
          .swagger-ui .opblock {
            display: block !important;
          }
          
          .swagger-ui .opblock-body {
            display: none;
          }
          
          .swagger-ui .opblock.is-open .opblock-body {
            display: block;
          }
        `}</style>
      </Head>
      
      <div style={{ minHeight: '100vh', backgroundColor: '#fafafa' }}>
        {/* API Key Notice */}
        <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 20px' }}>
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#856404', fontSize: '18px' }}>🔑 API Key Required</h3>
            <p style={{ margin: '0 0 15px 0', color: '#856404' }}>
              All API endpoints require authentication. To test the endpoints below:
            </p>
            <ol style={{ margin: '0 0 15px 0', color: '#856404', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '5px' }}>Get your API key from the <code style={{ backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>.secrets</code> file</li>
              <li style={{ marginBottom: '5px' }}>Click the <strong>&quot;Authorize&quot;</strong> button in the Swagger UI</li>
              <li style={{ marginBottom: '5px' }}>Enter the complete API key value exactly as it appears in the file</li>
              <li>Click <strong>&quot;Authorize&quot;</strong> to authenticate your requests</li>
            </ol>
            <div style={{ 
              backgroundColor: '#e3f2fd', 
              border: '1px solid #2196f3', 
              borderRadius: '6px', 
              padding: '15px'
            }}>
              <strong style={{ color: '#1976d2' }}>Example:</strong>
              <br />
              <span style={{ color: '#1976d2', fontSize: '14px' }}>
                If your .secrets file contains: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>ASR_API_KEY_1=asr_prod_abc123def456ghi789</code>
                <br />
                Enter in authorization: <code style={{ backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>asr_prod_abc123def456ghi789</code>
              </span>
            </div>
          </div>
        </div>

        {/* Swagger UI */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <SwaggerUI 
            spec={spec}
            docExpansion="list"
            defaultModelsExpandDepth={1}
            defaultModelExpandDepth={1}
            displayRequestDuration={true}
            tryItOutEnabled={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
            deepLinking={true}
            displayOperationId={false}
            defaultModelRendering="example"
            showMutatedRequest={true}
            supportedSubmitMethods={['get', 'post', 'put', 'delete', 'patch']}
            validatorUrl={null}
            persistAuthorization={true}
            // presets removed due to compatibility issue with swagger-ui-react v5.x
            plugins={[
              SwaggerUI.plugins.DownloadUrl
            ]}
            layout="BaseLayout"
            requestInterceptor={(request) => {
              // Add any request modifications here if needed
              return request
            }}
            responseInterceptor={(response) => {
              // Add any response modifications here if needed
              return response
            }}
            onComplete={(system) => {
              // Ensure all operations are properly rendered
              console.log('Swagger UI loaded successfully')
              
              // Fix for endpoint expansion
              setTimeout(() => {
                // Add click handlers to all operation summaries
                const summaries = document.querySelectorAll('.opblock-summary')
                summaries.forEach(summary => {
                  // Remove any existing click handlers
                  const newSummary = summary.cloneNode(true)
                  summary.parentNode.replaceChild(newSummary, summary)
                  
                  // Add new click handler
                  newSummary.addEventListener('click', function(e) {
                    e.preventDefault()
                    e.stopPropagation()
                    const opblock = this.closest('.opblock')
                    if (opblock) {
                      opblock.classList.toggle('is-open')
                      // Update the URL hash
                      const operationId = opblock.getAttribute('id')
                      if (operationId) {
                        window.location.hash = `#/${operationId}`
                      }
                    }
                  })
                })
                
                // Handle deep linking
                const hash = window.location.hash
                if (hash) {
                  const element = document.querySelector(hash)
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' })
                    // Try to expand the operation if it's an operation link
                    const opblock = element.closest('.opblock')
                    if (opblock && !opblock.classList.contains('is-open')) {
                      opblock.classList.add('is-open')
                    }
                  }
                }
                
                // Add mutation observer to handle dynamically added elements
                const observer = new MutationObserver((mutations) => {
                  mutations.forEach((mutation) => {
                    if (mutation.addedNodes.length) {
                      mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.classList && node.classList.contains('opblock')) {
                          const summary = node.querySelector('.opblock-summary')
                          if (summary) {
                            summary.addEventListener('click', function(e) {
                              e.preventDefault()
                              e.stopPropagation()
                              const opblock = this.closest('.opblock')
                              if (opblock) {
                                opblock.classList.toggle('is-open')
                                const operationId = opblock.getAttribute('id')
                                if (operationId) {
                                  window.location.hash = `#/${operationId}`
                                }
                              }
                            })
                          }
                        }
                      })
                    }
                  })
                })
                
                // Start observing
                const targetNode = document.querySelector('.swagger-ui')
                if (targetNode) {
                  observer.observe(targetNode, { childList: true, subtree: true })
                }
              }, 500)
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
