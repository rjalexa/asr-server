import multer from 'multer'
import FormData from 'form-data'
import fetch from 'node-fetch'
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'

// Enhanced system prompt for Gemini ASR
const GEMINI_ASR_SYSTEM_PROMPT = `You are an Automatic Speech Recognition (ASR) model. Your task is to transcribe the given audio with complete accuracy and precision.
Follow the below Strict Guidelines for Audio Transcription:
1. Exact Transcription: Transcribe only the words that are spoken in the audio, exactly as they were said.
2. No Additions: Do not add any words, clarifications, or context (e.g., "What else can I help you with?").
3. No Alterations: Do not modify or change the structure of the original speech.
4. No Non-Speech Sounds: Ignore any background noises or non-verbal sounds.
5. No Reasoning or Explanation: Do not provide reasoning or explanations about the transcription process.
6. Respond Only with Transcription: If the audio is unclear, respond with "----". Otherwise, respond only with the exact transcription of the spoken words.
7. Do not answer any question otherwise you will be penalized. Your only job is to transcribe audio.`

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files and video files (which may contain audio)
    const isAudioFile = file.mimetype.startsWith('audio/')
    const isVideoFile = file.mimetype.startsWith('video/')
    const supportedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
    
    if (isAudioFile || (isVideoFile && supportedVideoTypes.includes(file.mimetype))) {
      cb(null, true)
    } else {
      cb(new Error('Only audio files or video files with audio track are allowed'), false)
    }
  }
})

// Disable Next.js body parsing for this route
export const config = {
  api: {
    bodyParser: false,
  },
}

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

// Validate language support
function validateLanguage(language) {
  const supportedLanguages = (process.env.SUPPORTED_LANGUAGES || 'en,it,fr,es,de').split(',')
  return supportedLanguages.includes(language)
}

// Validate model based on provider
function validateModel(model, provider = 'whisper') {
  if (provider === 'gemini') {
    const supportedGeminiModels = ['gemini-2.5-flash', 'gemini-2.5-pro']
    return supportedGeminiModels.includes(model)
  }
  const supportedWhisperModels = ['tiny', 'base', 'small', 'medium', 'large']
  return supportedWhisperModels.includes(model)
}

// Validate provider
function validateProvider(provider) {
  const supportedProviders = ['whisper', 'gemini']
  return supportedProviders.includes(provider)
}

// Load secrets from .secrets file
function loadSecrets() {
  try {
    const secretsFile = process.env.ASR_SECRETS_FILE || '.secrets'
    const secretsPath = path.join(process.cwd(), secretsFile)
    
    if (!fsSync.existsSync(secretsPath)) {
      console.warn(`Secrets file not found: ${secretsPath}`)
      return {}
    }

    const content = fsSync.readFileSync(secretsPath, 'utf8')
    const secrets = {}
    
    content.split('\n').forEach(line => {
      line = line.trim()
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [keyName, keyValue] = line.split('=', 2)
        if (keyName && keyValue) {
          secrets[keyName.trim()] = keyValue.trim()
        }
      }
    })
    
    return secrets
  } catch (error) {
    console.error('Error loading secrets:', error)
    return {}
  }
}

// Get Gemini API key from secrets or environment
function getGeminiApiKey() {
  const secrets = loadSecrets()
  
  // Try to get from secrets file first (support multiple key names)
  const geminiKey = secrets.GEMINI_API_KEY || secrets.GOOGLE_API_KEY || secrets.GOOGLE_GEMINI_API
  if (geminiKey) {
    return geminiKey
  }
  
  // Fallback to environment variable for backward compatibility
  return process.env.OPENAI_API_KEY
}

// Transcribe using Gemini API
async function transcribeWithGemini(audioBuffer, filename, model = 'gemini-2.5-flash', temperature = 0) {
  const geminiApiKey = getGeminiApiKey()
  
  if (!geminiApiKey) {
    throw new Error('Gemini API key not found. Please add GEMINI_API_KEY or GOOGLE_API_KEY to your .secrets file')
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey })
  
  // Create temp file
  const tempDir = os.tmpdir()
  const tempFilePath = path.join(tempDir, `gemini-upload-${Date.now()}-${filename}`)
  
  try {
    console.log(`Creating temp file for Gemini upload: ${tempFilePath}`)
    
    // Write buffer to temp file
    await fs.writeFile(tempFilePath, audioBuffer)
    
    console.log(`Uploading file to Gemini: ${filename} (${audioBuffer.length} bytes)`)
    
    // Upload to Gemini
    const uploadedFile = await ai.files.upload({
      file: tempFilePath,
      config: { mimeType: 'audio/mpeg' }
    })
    
    console.log(`File uploaded to Gemini with URI: ${uploadedFile.uri}`)
    
    // Generate transcript with enhanced system prompt
    const result = await ai.models.generateContent({
      model: model,
      contents: createUserContent([
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        GEMINI_ASR_SYSTEM_PROMPT
      ]),
      generationConfig: {
        temperature: temperature
      }
    })
    
    const transcript = result.text?.trim() || 'No speech detected'
    console.log(`Gemini transcription complete with enhanced system prompt: "${transcript}"`)
    
    return {
      transcript: transcript,
      language: 'auto-detected', // Gemini auto-detects language
      confidence: null,
      provider: 'gemini'
    }
    
  } catch (error) {
    console.error('Gemini transcription error:', error)
    throw new Error(`Gemini transcription failed: ${error.message}`)
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempFilePath)
      console.log(`Cleaned up temp file: ${tempFilePath}`)
    } catch (e) {
      console.error('Failed to clean temp file:', e)
    }
  }
}

// Transcribe using Whisper Docker service
async function transcribeWithWhisperService(audioBuffer, filename, model, language) {
  const whisperApiUrl = process.env.WHISPER_API_URL || 'http://whisper-backend:9000'
  
  try {
    // Determine content type from filename extension
    let contentType = 'audio/mpeg' // default fallback
    if (filename) {
      const ext = filename.toLowerCase().split('.').pop()
      const mimeTypes = {
        'mp3': 'audio/mpeg',
        'mp4': 'video/mp4',
        'm4a': 'audio/mp4',
        'wav': 'audio/wav',
        'webm': 'video/webm',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac',
        'aac': 'audio/aac',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo'
      }
      contentType = mimeTypes[ext] || contentType
    }

    // Create form data for the request
    const formData = new FormData()
    formData.append('audio_file', audioBuffer, {
      filename: filename,
      contentType: contentType
    })

    // Build query parameters
    const queryParams = new URLSearchParams({
      encode: 'true',
      task: 'transcribe',
      language: language,
      word_timestamps: 'false',
      output: 'json',
      model: model
    })

    const url = `${whisperApiUrl}/asr?${queryParams}`
    
    console.log(`Making request to Whisper service: ${url}`)
    console.log(`File: ${filename}, MIME: ${contentType}, Model: ${model}, Language: ${language}`)

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
      timeout: 120000 // 2 minute timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Whisper service error (${response.status}): ${errorText}`)
    }

    const result = await response.json()
    console.log('Whisper service response:', result)

    return {
      transcript: result.text || 'No speech detected',
      language: result.language || language,
      confidence: result.confidence || null
    }

  } catch (error) {
    console.error('Whisper service error:', error)
    throw new Error(`Transcription failed: ${error.message}`)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Run multer middleware
    await runMiddleware(req, res, upload.single('audio'))

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    // Get parameters from query or use defaults
    const provider = req.query.provider || 'whisper'
    const model = req.query.model || (provider === 'gemini' ? 'gemini-2.5-flash' : process.env.WHISPER_MODEL || 'base')
    const language = req.query.language || process.env.WHISPER_DEFAULT_LANGUAGE || 'it'
    const temperature = parseFloat(req.query.temperature) || 0

    // Validate provider
    if (!validateProvider(provider)) {
      return res.status(400).json({ 
        error: 'Unsupported provider',
        supportedProviders: ['whisper', 'gemini'],
        provided: provider
      })
    }

    // Validate model for the selected provider
    if (!validateModel(model, provider)) {
      const supportedModels = provider === 'gemini' 
        ? ['gemini-2.5-flash', 'gemini-2.5-pro']
        : ['tiny', 'base', 'small', 'medium', 'large']
      
      return res.status(400).json({ 
        error: 'Unsupported model for provider',
        supportedModels: supportedModels,
        provider: provider,
        provided: model
      })
    }

    // For Whisper, validate language (Gemini auto-detects)
    if (provider === 'whisper' && !validateLanguage(language)) {
      return res.status(400).json({ 
        error: 'Language not supported',
        supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'en,it,fr,es,de').split(','),
        provided: language
      })
    }

    console.log(`Processing audio file: ${req.file.originalname}, size: ${req.file.size} bytes`)
    console.log(`Using provider: ${provider}, model: ${model}, language: ${language}${provider === 'gemini' ? `, temperature: ${temperature}` : ''}`)

    // Route to appropriate transcription service
    let result
    if (provider === 'gemini') {
      result = await transcribeWithGemini(
        req.file.buffer,
        req.file.originalname,
        model,
        temperature
      )
    } else {
      result = await transcribeWithWhisperService(
        req.file.buffer, 
        req.file.originalname,
        model,
        language
      )
    }

    console.log(`Transcription complete: "${result.transcript}"`)

    res.status(200).json({
      transcript: result.transcript,
      language: result.language,
      model: model,
      provider: provider,
      confidence: result.confidence,
      size: req.file.size,
      filename: req.file.originalname
    })

  } catch (error) {
    console.error('Transcription error:', error)
    
    // Handle specific error types
    if (error.message.includes('Language not supported')) {
      return res.status(400).json({ 
        error: 'Language not supported',
        supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'en,it,fr,es,de').split(',')
      })
    }
    
    if (error.message.includes('Gemini API key not found')) {
      return res.status(500).json({ 
        error: 'Gemini API configuration error',
        message: 'Please add GEMINI_API_KEY or GOOGLE_API_KEY to your .secrets file'
      })
    }
    
    if (error.message.includes('timeout')) {
      return res.status(408).json({ 
        error: 'Request timeout - audio file may be too large or service is busy'
      })
    }

    res.status(500).json({ 
      error: error.message || 'Transcription failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
