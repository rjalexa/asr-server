import multer from 'multer'
import FormData from 'form-data'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

/**
 * @swagger
 * /api/v1/transcribe-direct:
 *   post:
 *     summary: Enhanced Audio Transcription
 *     description: Transcribe audio files with enhanced features and detailed metadata
 *     tags:
 *       - Enhanced API
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           enum: [en, it, fr, es, de]
 *           default: en
 *         description: Audio language
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *           enum: [tiny, base, small, medium, large]
 *           default: base
 *         description: Whisper model to use
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *                 description: Audio file to transcribe (max 50MB)
 *             required:
 *               - audio
 *     responses:
 *       200:
 *         description: Successful transcription with enhanced metadata
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnhancedTranscriptionResponse'
 *       401:
 *         description: Missing or invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RateLimitError'
 *       400:
 *         description: Bad request (invalid file, parameters, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for direct API
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true)
    } else {
      cb(new Error('Only audio files are allowed'), false)
    }
  }
})

// Disable Next.js body parsing for this route
export const config = {
  api: {
    bodyParser: false,
  },
}

// In-memory rate limiting store
const rateLimitStore = new Map()

// Helper function to run multer middleware
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result)
      }
      return resolve(result)
    })
  })
}

// Load API keys from .secrets file
function loadApiKeys() {
  try {
    const secretsFile = process.env.ASR_SECRETS_FILE || '.secrets'
    const secretsPath = path.join(process.cwd(), secretsFile)
    
    if (!fs.existsSync(secretsPath)) {
      console.warn(`Secrets file not found: ${secretsPath}`)
      return []
    }

    const content = fs.readFileSync(secretsPath, 'utf8')
    const keys = []
    
    content.split('\n').forEach(line => {
      line = line.trim()
      if (line && !line.startsWith('#')) {
        const [keyName, keyValue] = line.split('=')
        if (keyName && keyValue) {
          keys.push(keyValue.trim())
        }
      }
    })
    
    return keys
  } catch (error) {
    console.error('Error loading API keys:', error)
    return []
  }
}

// Validate API key
function validateApiKey(providedKey) {
  if (!providedKey) return false
  
  const validKeys = loadApiKeys()
  return validKeys.includes(providedKey)
}

// Rate limiting check
function checkRateLimit(apiKey) {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute window
  const maxRequests = parseInt(process.env.ASR_RATE_LIMIT_PER_MINUTE) || 30
  
  if (!rateLimitStore.has(apiKey)) {
    rateLimitStore.set(apiKey, { requests: [], windowStart: now })
  }
  
  const keyData = rateLimitStore.get(apiKey)
  
  // Clean old requests outside the window
  keyData.requests = keyData.requests.filter(timestamp => now - timestamp < windowMs)
  
  // Check if limit exceeded
  if (keyData.requests.length >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: keyData.requests[0] + windowMs
    }
  }
  
  // Add current request
  keyData.requests.push(now)
  
  return {
    allowed: true,
    remaining: maxRequests - keyData.requests.length,
    resetTime: now + windowMs
  }
}

// Validate language support
function validateLanguage(language) {
  const supportedLanguages = (process.env.SUPPORTED_LANGUAGES || 'en,it,fr,es,de').split(',')
  return supportedLanguages.includes(language)
}

// Validate model
function validateModel(model) {
  const supportedModels = ['tiny', 'base', 'small', 'medium', 'large']
  return supportedModels.includes(model)
}

// Transcribe using Whisper Docker service
async function transcribeWithWhisperService(audioBuffer, filename, model, language) {
  const whisperApiUrl = process.env.WHISPER_API_URL || 'http://whisper-backend:9000'
  
  try {
    // Create form data for the request
    const formData = new FormData()
    formData.append('audio_file', audioBuffer, {
      filename: filename,
      contentType: 'audio/mpeg'
    })

    // Build query parameters
    const queryParams = new URLSearchParams({
      encode: 'true',
      task: 'transcribe',
      language: language,
      word_timestamps: 'false',
      output: 'json'
    })

    const url = `${whisperApiUrl}/asr?${queryParams}`
    
    console.log(`[Enhanced API v1] Making request to Whisper service: ${url}`)
    console.log(`[Enhanced API v1] Model: ${model}, Language: ${language}`)

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
      timeout: 300000 // 5 minute timeout for direct API
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Whisper service error (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    console.log('[Enhanced API v1] Whisper service response received')

    return {
      transcript: result.text || 'No speech detected',
      language: result.language || language,
      confidence: result.confidence || null
    }

  } catch (error) {
    console.error('[Enhanced API v1] Whisper service error:', error)
    throw new Error(`Transcription failed: ${error.message}`)
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    })
  }

  // Extract API key from headers
  const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key']
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API key',
      message: 'Please provide X-API-Key header'
    })
  }

  // Validate API key
  if (!validateApiKey(apiKey)) {
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    })
  }

  // Check rate limiting
  const rateLimit = checkRateLimit(apiKey)
  if (!rateLimit.allowed) {
    const resetTime = new Date(rateLimit.resetTime).toISOString()
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Rate limit: ${process.env.ASR_RATE_LIMIT_PER_MINUTE || 30} requests per minute`,
      resetTime: resetTime
    })
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', process.env.ASR_RATE_LIMIT_PER_MINUTE || 30)
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining)
  res.setHeader('X-RateLimit-Reset', new Date(rateLimit.resetTime).toISOString())

  try {
    // Run multer middleware
    await runMiddleware(req, res, upload.single('audio'))

    if (!req.file) {
      return res.status(400).json({ 
        error: 'No audio file provided',
        message: 'Please provide an audio file in the "audio" field'
      })
    }

    // Get parameters from query or use defaults
    const model = req.query.model || process.env.WHISPER_MODEL || 'base'
    const language = req.query.language || process.env.WHISPER_DEFAULT_LANGUAGE || 'en'

    // Validate model
    if (!validateModel(model)) {
      return res.status(400).json({ 
        error: 'Unsupported model',
        supportedModels: ['tiny', 'base', 'small', 'medium', 'large'],
        provided: model
      })
    }

    // Validate language
    if (!validateLanguage(language)) {
      return res.status(400).json({ 
        error: 'Language not supported',
        supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'en,it,fr,es,de').split(','),
        provided: language
      })
    }

    console.log(`[Enhanced API v1] Processing audio file: ${req.file.originalname}, size: ${req.file.size} bytes`)
    console.log(`[Enhanced API v1] Using model: ${model}, language: ${language}`)

    // Transcribe using Whisper Docker service
    const result = await transcribeWithWhisperService(
      req.file.buffer, 
      req.file.originalname,
      model,
      language
    )

    console.log(`[Enhanced API v1] Transcription complete for ${req.file.originalname}`)

    // Return standardized response
    res.status(200).json({
      success: true,
      data: {
        transcript: result.transcript,
        language: result.language,
        model: model,
        confidence: result.confidence,
        metadata: {
          filename: req.file.originalname,
          size: req.file.size,
          processedAt: new Date().toISOString()
        }
      },
      rateLimit: {
        remaining: rateLimit.remaining,
        resetTime: new Date(rateLimit.resetTime).toISOString()
      }
    })

  } catch (error) {
    console.error('[Enhanced API v1] Transcription error:', error)
    
    // Handle specific error types
    if (error.message.includes('Language not supported')) {
      return res.status(400).json({ 
        error: 'Language not supported',
        supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'en,it,fr,es,de').split(',')
      })
    }
    
    if (error.message.includes('timeout')) {
      return res.status(408).json({ 
        error: 'Request timeout',
        message: 'Audio file processing timed out - file may be too large or service is busy'
      })
    }

    if (error.message.includes('Only audio files are allowed')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only audio files are supported'
      })
    }

    res.status(500).json({ 
      error: 'Transcription failed',
      message: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
