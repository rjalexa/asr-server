import multer from 'multer'
import FormData from 'form-data'
import fetch from 'node-fetch'

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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
    
    console.log(`Making request to Whisper service: ${url}`)
    console.log(`Model: ${model}, Language: ${language}`)

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

    console.log(`Processing audio file: ${req.file.originalname}, size: ${req.file.size} bytes`)
    console.log(`Using model: ${model}, language: ${language}`)

    // Transcribe using Whisper Docker service
    const result = await transcribeWithWhisperService(
      req.file.buffer, 
      req.file.originalname,
      model,
      language
    )

    console.log(`Transcription complete: "${result.transcript}"`)

    res.status(200).json({
      transcript: result.transcript,
      language: result.language,
      model: model,
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
