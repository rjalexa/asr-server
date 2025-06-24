import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ASR Server API',
      version: '1.0.0',
      description: 'Automatic Speech Recognition API with Whisper backend',
      contact: {
        name: 'ASR Server Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:9001',
        description: 'API Server'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication. Get your key from the .secrets file.'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Error message'
            }
          },
          required: ['error', 'message']
        },
        RateLimitError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            resetTime: {
              type: 'string',
              format: 'date-time',
              description: 'When the rate limit resets'
            }
          },
          required: ['error', 'message', 'resetTime']
        },
        TranscriptionResponse: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Transcribed text'
            },
            language: {
              type: 'string',
              description: 'Detected or specified language'
            },
            confidence: {
              type: 'number',
              description: 'Confidence score (0-1)'
            }
          }
        },
        EnhancedTranscriptionResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Request success status'
            },
            data: {
              type: 'object',
              properties: {
                transcript: {
                  type: 'string',
                  description: 'Transcribed text'
                },
                language: {
                  type: 'string',
                  description: 'Detected or specified language'
                },
                model: {
                  type: 'string',
                  description: 'Whisper model used'
                },
                confidence: {
                  type: 'number',
                  description: 'Confidence score (0-1)'
                },
                metadata: {
                  type: 'object',
                  properties: {
                    filename: {
                      type: 'string',
                      description: 'Original filename'
                    },
                    size: {
                      type: 'integer',
                      description: 'File size in bytes'
                    },
                    processedAt: {
                      type: 'string',
                      format: 'date-time',
                      description: 'Processing timestamp'
                    }
                  }
                }
              }
            },
            rateLimit: {
              type: 'object',
              properties: {
                remaining: {
                  type: 'integer',
                  description: 'Remaining requests in current window'
                },
                resetTime: {
                  type: 'string',
                  format: 'date-time',
                  description: 'When the rate limit resets'
                }
              }
            }
          }
        },
        LanguageDetectionResponse: {
          type: 'object',
          properties: {
            detected_language: {
              type: 'string',
              description: 'Detected language code'
            },
            confidence: {
              type: 'number',
              description: 'Confidence score (0-1)'
            },
            language_probabilities: {
              type: 'object',
              description: 'Probabilities for all detected languages',
              additionalProperties: {
                type: 'number'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'ASR',
        description: 'Automatic Speech Recognition endpoints'
      },
      {
        name: 'Language Detection',
        description: 'Audio language detection endpoints'
      },
      {
        name: 'Enhanced API',
        description: 'Enhanced transcription with additional features'
      },
      {
        name: 'Health',
        description: 'Service health and status endpoints'
      }
    ]
  },
  apis: [
    './pages/api/v1/*.js',
    './pages/api/transcribe-direct.js',
    './pages/api/health.js',
    './pages/api/docs.js'
  ]
}

const specs = swaggerJsdoc(options)
export default specs
