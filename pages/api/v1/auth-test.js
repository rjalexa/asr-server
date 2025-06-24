/**
 * @swagger
 * /api/v1/auth-test:
 *   get:
 *     summary: Test API authentication
 *     description: Simple endpoint to test if API key authentication is working
 *     tags:
 *       - Authentication
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Authentication status
 *                 message:
 *                   type: string
 *                   description: Success message
 *                 apiKey:
 *                   type: string
 *                   description: The API key that was used (masked)
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Request timestamp
 *       401:
 *         description: Missing or invalid API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import fs from 'fs'
import path from 'path'

// Load API keys from .secrets file (same logic as asr.js)
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
      if (line && !line.startsWith('#') && line.includes('=')) {
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

// Mask API key for display (show first 8 and last 4 characters)
function maskApiKey(key) {
  if (!key || key.length < 12) return '***'
  return key.substring(0, 8) + '***' + key.substring(key.length - 4)
}

export default async function handler(req, res) {
  // Allow both GET and POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET and POST requests are supported'
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

  // Authentication successful
  return res.status(200).json({
    success: true,
    message: 'Authentication successful',
    apiKey: maskApiKey(apiKey),
    timestamp: new Date().toISOString(),
    method: req.method
  })
}
