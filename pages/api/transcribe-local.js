import multer from 'multer'
import { promises as fs } from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { randomBytes } from 'crypto'

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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

// Helper function to convert audio to WAV format using FFmpeg
async function convertToWav(inputBuffer) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'webm', '-i', 'pipe:0',
      '-ac', '1', '-ar', '16000',
      '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1'
    ])

    const chunks = []
    let errorOutput = ''

    ffmpeg.stdout.on('data', chunk => chunks.push(chunk))
    ffmpeg.stderr.on('data', data => {
      errorOutput += data.toString()
    })

    ffmpeg.on('close', code => {
      if (code === 0) {
        resolve(Buffer.concat(chunks))
      } else {
        reject(new Error(`FFmpeg failed: ${errorOutput}`))
      }
    })

    ffmpeg.on('error', err => {
      reject(new Error(`FFmpeg process error: ${err.message}`))
    })

    // Write input and close stdin
    ffmpeg.stdin.end(inputBuffer)
  })
}

// Helper function to transcribe using whisper.cpp
async function transcribeWithWhisperCpp(audioBuffer) {
  const tempDir = '/tmp'
  const tempId = randomBytes(8).toString('hex')
  const tempAudioPath = path.join(tempDir, `audio_${tempId}.wav`)
  
  try {
    // Write audio buffer to temporary file
    await fs.writeFile(tempAudioPath, audioBuffer)
    
    // Run whisper.cpp
    return new Promise((resolve, reject) => {
      const whisperCmd = './whisper' // Use symbolic link
      const modelPath = './models/ggml-small.bin' // Use symbolic link to models
      
      console.log(`Running whisper.cpp: ${whisperCmd} with model: ${modelPath}`)
      
      const whisper = spawn(whisperCmd, [
        '-m', modelPath,
        '-f', tempAudioPath,
        '--output-txt',
        '--no-timestamps',
        '--language', 'it', // Set language to Italian (transcribe in Italian)
        '--threads', '4' // Use 4 threads for better performance
      ])

      let output = ''
      let errorOutput = ''

      whisper.stdout.on('data', data => {
        const text = data.toString()
        output += text
        console.log('Whisper stdout:', text.trim())
      })

      whisper.stderr.on('data', data => {
        const text = data.toString()
        errorOutput += text
        console.log('Whisper stderr:', text.trim())
      })

      whisper.on('close', code => {
        // Clean up temp file
        fs.unlink(tempAudioPath).catch(console.error)
        
        console.log(`Whisper process finished with code: ${code}`)
        console.log('Full output:', output)
        console.log('Full error output:', errorOutput)
        
        if (code === 0) {
          // Extract transcript from output - whisper.cpp outputs the transcript directly
          const lines = output.split('\n')
          const transcript = lines
            .filter(line => line.trim() && !line.includes('whisper_') && !line.includes('load time'))
            .map(line => line.trim())
            .join(' ')
            .trim()
          
          resolve(transcript || 'No speech detected')
        } else {
          reject(new Error(`Whisper failed (code ${code}): ${errorOutput || 'Unknown error'}`))
        }
      })

      whisper.on('error', err => {
        // Clean up temp file
        fs.unlink(tempAudioPath).catch(console.error)
        console.error('Whisper process error:', err)
        reject(new Error(`Whisper process error: ${err.message}`))
      })
    })
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempAudioPath)
    } catch {}
    throw error
  }
}

// Fallback transcription using whisper-node package
async function transcribeWithWhisperNode(audioBuffer) {
  try {
    // This is a fallback - whisper-node package integration
    // For now, return a placeholder
    return "Whisper.cpp not available - please install whisper.cpp and download the small model to ./models/ggml-small.bin"
  } catch (error) {
    throw new Error(`Whisper-node error: ${error.message}`)
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

    console.log(`Processing audio file: ${req.file.originalname}, size: ${req.file.size} bytes`)

    // Convert audio to WAV format if needed
    let audioBuffer = req.file.buffer
    
    // If the file is not already WAV, convert it
    if (!req.file.mimetype.includes('wav')) {
      console.log('Converting audio to WAV format...')
      audioBuffer = await convertToWav(req.file.buffer)
    }

    // Transcribe using whisper.cpp (with fallback)
    let transcript
    try {
      transcript = await transcribeWithWhisperCpp(audioBuffer)
    } catch (error) {
      console.warn('Whisper.cpp failed, trying fallback:', error.message)
      transcript = await transcribeWithWhisperNode(audioBuffer)
    }

    console.log(`Transcription complete: "${transcript}"`)

    res.status(200).json({
      transcript: transcript,
      duration: Math.round(audioBuffer.length / (16000 * 2)), // Rough estimate
      size: req.file.size
    })

  } catch (error) {
    console.error('Transcription error:', error)
    res.status(500).json({ 
      error: error.message || 'Transcription failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
