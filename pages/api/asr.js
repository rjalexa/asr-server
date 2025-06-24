import multer from 'multer'
import FormData from 'form-data'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
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
    await runMiddleware(req, res, upload.single('audio_file'))

    if (!req.file) {
      return res.status(400).json({ 
        error: 'No audio file provided',
        message: 'Please provide an audio file in the "audio_file" field'
      })
    }

    // Proxy request to Whisper backend
    const whisperApiUrl = process.env.WHISPER_API_URL || 'http://whisper-backend:9000'
    
    // Create form data for the request
    const formData = new FormData()
    formData.append('audio_file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    })

    // Forward query parameters
    const queryParams = new URLSearchParams()
    for (const [key, value] of Object.entries(req.query)) {
      queryParams.append(key, value)
    }

    const url = `${whisperApiUrl}/asr?${queryParams}`
    
    console.log(`[ASR Proxy] Forwarding request to: ${url}`)

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
      timeout: 300000 // 5 minute timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Whisper service error (${response.status}): ${errorText}`)
    }

    // Get response content type
    const contentType = response.headers.get('content-type')
    
    // Forward response headers
    res.setHeader('Content-Type', contentType)
    
    // Forward the response
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json()
      res.status(200).json(result)
    } else {
      const result = await response.text()
      res.status(200).send(result)
    }

  } catch (error) {
    console.error('[ASR Proxy] Error:', error)
    
    if (error.message.includes('timeout')) {
      return res.status(408).json({ 
        error: 'Request timeout',
        message: 'Audio file processing timed out'
      })
    }

    if (error.message.includes('Only audio files are allowed')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only audio files are supported'
      })
    }

    res.status(500).json({ 
      error: 'ASR service error',
      message: error.message || 'Internal server error'
    })
  }
}
