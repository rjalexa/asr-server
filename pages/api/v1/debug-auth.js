import fs from 'fs'
import path from 'path'

// Load API keys from .secrets file (same logic as asr.js)
function loadApiKeys() {
  try {
    const secretsFile = process.env.ASR_SECRETS_FILE || '.secrets'
    const secretsPath = path.join(process.cwd(), secretsFile)
    
    console.log(`[DEBUG] Looking for secrets file at: ${secretsPath}`)
    
    if (!fs.existsSync(secretsPath)) {
      console.warn(`[DEBUG] Secrets file not found: ${secretsPath}`)
      return []
    }

    const content = fs.readFileSync(secretsPath, 'utf8')
    console.log(`[DEBUG] Secrets file content:\n${content}`)
    
    const keys = []
    
    content.split('\n').forEach((line, index) => {
      line = line.trim()
      console.log(`[DEBUG] Processing line ${index + 1}: "${line}"`)
      
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [keyName, keyValue] = line.split('=')
        if (keyName && keyValue) {
          const trimmedValue = keyValue.trim()
          keys.push(trimmedValue)
          console.log(`[DEBUG] Added key: ${keyName} = ${trimmedValue}`)
        }
      }
    })
    
    console.log(`[DEBUG] Total keys loaded: ${keys.length}`)
    console.log(`[DEBUG] Keys: ${JSON.stringify(keys, null, 2)}`)
    
    return keys
  } catch (error) {
    console.error('[DEBUG] Error loading API keys:', error)
    return []
  }
}

// Validate API key (same logic as asr.js)
function validateApiKey(providedKey) {
  console.log(`[DEBUG] Validating provided key: "${providedKey}"`)
  
  if (!providedKey) {
    console.log('[DEBUG] No key provided')
    return false
  }
  
  const validKeys = loadApiKeys()
  const isValid = validKeys.includes(providedKey)
  
  console.log(`[DEBUG] Key validation result: ${isValid}`)
  
  if (!isValid) {
    console.log('[DEBUG] Key not found in valid keys list')
    validKeys.forEach((key, index) => {
      console.log(`[DEBUG] Valid key ${index + 1}: "${key}" (length: ${key.length})`)
      console.log(`[DEBUG] Provided key: "${providedKey}" (length: ${providedKey.length})`)
      console.log(`[DEBUG] Keys match: ${key === providedKey}`)
    })
  }
  
  return isValid
}

export default async function handler(req, res) {
  console.log('[DEBUG] Debug auth endpoint called')
  console.log(`[DEBUG] Method: ${req.method}`)
  console.log(`[DEBUG] Headers:`, req.headers)
  console.log(`[DEBUG] Working directory: ${process.cwd()}`)
  console.log(`[DEBUG] ASR_SECRETS_FILE env var: ${process.env.ASR_SECRETS_FILE || 'not set'}`)

  // Extract API key from headers
  const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key']
  console.log(`[DEBUG] Extracted API key: "${apiKey}"`)
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API key',
      message: 'Please provide X-API-Key header',
      debug: {
        headers: req.headers,
        extractedKey: apiKey
      }
    })
  }

  // Validate API key
  const isValid = validateApiKey(apiKey)
  
  return res.status(200).json({
    message: 'Debug authentication check',
    providedKey: apiKey,
    keyLength: apiKey.length,
    isValid: isValid,
    workingDirectory: process.cwd(),
    secretsFile: process.env.ASR_SECRETS_FILE || '.secrets',
    timestamp: new Date().toISOString()
  })
}
