import { useState, useRef } from 'react'
import Navigation from '../components/Navigation'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('Ready to record')
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('whisper')
  const [selectedModel, setSelectedModel] = useState('base')
  const [selectedLanguage, setSelectedLanguage] = useState('en')
  
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioChunksRef = useRef([])

  const startRecording = async () => {
    try {
      setStatus('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 44100, // Higher quality for MP3
        } 
      })
      streamRef.current = stream

      // Reset state
      audioChunksRef.current = []
      setAudioBlob(null)
      setTranscript('')

      // Setup MediaRecorder for MP3 recording
      let mimeType = 'audio/mpeg'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm;codecs=opus'
        console.log('MP3 not supported, using WebM')
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(audioBlob)
        setStatus('Recording complete - starting transcription...')
        
        // Stop the microphone stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }

        // Auto-start transcription
        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setStatus('Recording... Speak now!')

    } catch (error) {
      setStatus('Error: ' + error.message)
      console.error('Error accessing microphone:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const transcribeAudio = async (blob = audioBlob) => {
    if (!blob) return

    setIsProcessing(true)
    const providerName = selectedProvider === 'gemini' ? 'Gemini AI' : 'Docker Whisper'
    const languageText = selectedProvider === 'gemini' ? 'auto-detect' : selectedLanguage
    setStatus(`Processing with ${providerName} (${selectedModel}, ${languageText})...`)

    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.mp3')

      // Build URL with provider, model and language parameters
      const queryParams = new URLSearchParams({
        provider: selectedProvider,
        model: selectedModel,
        language: selectedLanguage
      })

      const response = await fetch(`/api/transcribe?${queryParams}`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 400 && errorData.error === 'Language not supported') {
          throw new Error(`Language '${selectedLanguage}' is not supported. Supported languages: ${errorData.supportedLanguages?.join(', ')}`)
        }
        if (response.status === 500 && errorData.error === 'Gemini API configuration error') {
          throw new Error('Gemini API key not configured. Please set OPENAI_API_KEY environment variable.')
        }
        throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      setTranscript(result.transcript)
      const providerDisplay = result.provider === 'gemini' ? 'Gemini AI' : 'Whisper'
      setStatus(`Transcription complete! (${providerDisplay}: ${result.model}, Lang: ${result.language})`)

    } catch (error) {
      setStatus('Error: ' + error.message)
      console.error('Transcription error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const clearAll = () => {
    setAudioBlob(null)
    setTranscript('')
    setStatus('Ready to record')
    audioChunksRef.current = []
  }

  const downloadAudio = () => {
    if (!audioBlob) return
    
    const url = URL.createObjectURL(audioBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'recording.mp3'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadText = () => {
    if (!transcript) return
    
    const blob = new Blob([transcript], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transcript.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1>ASR Server - Audio Transcription</h1>
      <Navigation />
      
      {/* Configuration Controls */}
      <div style={{ 
        marginBottom: '2rem', 
        padding: '1rem', 
        backgroundColor: '#f8fafc', 
        borderRadius: '0.5rem',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: '#374151' }}>Configuration</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#374151' }}>
              Provider:
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value)
                // Reset model to default for the new provider
                setSelectedModel(e.target.value === 'gemini' ? 'gemini-2.0-flash' : 'base')
              }}
              disabled={isRecording || isProcessing}
              style={{
                padding: '0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                cursor: (isRecording || isProcessing) ? 'not-allowed' : 'pointer',
                opacity: (isRecording || isProcessing) ? 0.5 : 1
              }}
            >
              <option value="whisper">Whisper (Local Docker)</option>
              <option value="gemini">Gemini (Google AI)</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#374151' }}>
              Model:
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isRecording || isProcessing}
              style={{
                padding: '0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                cursor: (isRecording || isProcessing) ? 'not-allowed' : 'pointer',
                opacity: (isRecording || isProcessing) ? 0.5 : 1
              }}
            >
              {selectedProvider === 'gemini' ? (
                <>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast & Accurate)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro (High Quality)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Latest)</option>
                </>
              ) : (
                <>
                  <option value="tiny">Tiny (fastest, least accurate)</option>
                  <option value="base">Base (balanced)</option>
                  <option value="small">Small (good accuracy)</option>
                  <option value="medium">Medium (better accuracy)</option>
                  <option value="large">Large (best accuracy, slowest)</option>
                </>
              )}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#374151' }}>
              Output lang:
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={isRecording || isProcessing}
              style={{
                padding: '0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                cursor: (isRecording || isProcessing) ? 'not-allowed' : 'pointer',
                opacity: (isRecording || isProcessing) ? 0.5 : 1
              }}
            >
              <option value="en">English</option>
              <option value="it">Italian</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="de">German</option>
            </select>
          </div>
        </div>
      </div>
      
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            backgroundColor: isRecording ? '#ef4444' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.5 : 1,
            transition: 'all 0.2s',
            marginRight: '1rem'
          }}
        >
          {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
        </button>

        <button
          onClick={downloadAudio}
          disabled={!audioBlob}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: !audioBlob ? 'not-allowed' : 'pointer',
            opacity: !audioBlob ? 0.5 : 1,
            transition: 'all 0.2s',
            marginRight: '1rem'
          }}
        >
          💾 Download audio
        </button>

        <button
          onClick={downloadText}
          disabled={!transcript}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: !transcript ? 'not-allowed' : 'pointer',
            opacity: !transcript ? 0.5 : 1,
            transition: 'all 0.2s',
            marginRight: '1rem'
          }}
        >
          📄 Download text
        </button>
        
        <button
          onClick={clearAll}
          disabled={isProcessing}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            opacity: isProcessing ? 0.5 : 1,
            transition: 'all 0.2s'
          }}
        >
          Clear
        </button>
      </div>

      {/* Status Display */}
      <div style={{ 
        marginBottom: '1rem',
        padding: '0.5rem 1rem',
        backgroundColor: isRecording ? '#fef3c7' : audioBlob ? '#d1fae5' : '#e5e7eb',
        borderRadius: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isRecording ? '#f59e0b' : audioBlob ? '#10b981' : '#6b7280',
          animation: isRecording ? 'pulse 1.5s infinite' : 'none'
        }} />
        <strong>Status:</strong> {status}
      </div>

      {/* Audio Preview */}
      {audioBlob && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#f0f9ff',
          borderRadius: '0.5rem',
          border: '1px solid #0ea5e9'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#0c4a6e' }}>Audio Preview</h4>
          <audio 
            controls 
            src={URL.createObjectURL(audioBlob)}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '0.875rem', color: '#0369a1', marginTop: '0.5rem' }}>
            Size: {(audioBlob.size / 1024).toFixed(1)} KB
          </div>
        </div>
      )}

      {/* Transcript Display */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        minHeight: '300px',
        backgroundColor: '#f9fafb',
        position: 'relative'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151' }}>
          Transcript
        </h3>
        
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          lineHeight: '1.6',
          color: '#1f2937',
          minHeight: '200px'
        }}>
          {transcript || (isProcessing ? 
            `Processing with ${selectedProvider === 'gemini' ? 'Gemini AI' : 'Docker Whisper'} (${selectedModel} model)...` : 
            'Transcript will appear here after recording')}
        </div>
        
        {transcript && (
          <div style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            {transcript.split(' ').length} words
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
