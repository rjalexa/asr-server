import { useState, useRef } from 'react'
import Navigation from '../components/Navigation'
import { splitTranscriptIntoPhrases, getPhraseStats } from '../lib/phraseSplitter'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [transcripts, setTranscripts] = useState([])
  const [status, setStatus] = useState('Ready to record or upload audio')
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('whisper')
  const [selectedModel, setSelectedModel] = useState('base')
  const [selectedLanguage, setSelectedLanguage] = useState('it')
  const [temperature, setTemperature] = useState(0)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [audioSource, setAudioSource] = useState(null) // 'recorded' or 'uploaded'
  const [showPhrases, setShowPhrases] = useState({}) // toggle for phrase view per transcript
  
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const audioChunksRef = useRef([])
  const fileInputRef = useRef(null)

  const startRecording = async () => {
    // Check if there are existing transcripts and warn user
    if (transcripts.length > 0) {
      const confirmed = window.confirm(
        `Starting a new recording will delete all existing transcripts (${transcripts.length} transcripts).\n\nDo you want to proceed?`
      )
      if (!confirmed) {
        return
      }
    }

    // Always clear transcripts when starting new recording (whether there were existing ones or not)
    setTranscripts([])
    setShowPhrases({})

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
        setAudioSource('recorded')
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

  const checkForDuplicateTranscript = () => {
    return transcripts.some(transcript => 
      transcript.provider === selectedProvider &&
      transcript.model === selectedModel &&
      transcript.language === selectedLanguage
    )
  }

  const transcribeAudio = async (blob = audioBlob) => {
    if (!blob) return

    // Check for duplicate configuration
    if (checkForDuplicateTranscript()) {
      const providerName = selectedProvider === 'gemini' ? 'Gemini AI' : 'Whisper'
      const confirmed = window.confirm(
        `A transcript with ${providerName} (${selectedModel}) - ${selectedLanguage.toUpperCase()} already exists.\n\nDo you want to create another transcript with the same configuration?`
      )
      if (!confirmed) {
        return
      }
    }

    setIsProcessing(true)
    const startTime = Date.now()
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

      // Add temperature parameter for Gemini
      if (selectedProvider === 'gemini') {
        queryParams.append('temperature', temperature.toString())

      }

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

      const endTime = Date.now()
      const elapsedSeconds = (endTime - startTime) / 1000

      // Create new transcript object
      const newTranscript = {
        id: Date.now(),
        transcript: result.transcript,
        provider: result.provider,
        model: result.model,
        language: result.language,
        timestamp: new Date().toLocaleString(),
        transcriptionTime: elapsedSeconds,
        confidence: result.confidence
      }

      // Add to transcripts array
      setTranscripts(prev => [newTranscript, ...prev])

      const providerDisplay = result.provider === 'gemini' ? 'Gemini AI' : 'Whisper'
      setStatus(`Transcription complete! (${providerDisplay}: ${result.model}, Lang: ${result.language})`)

    } catch (error) {
      setStatus('Error: ' + error.message)
      console.error('Transcription error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Check if it's an audio file
    if (!file.type.startsWith('audio/')) {
      setStatus('Error: Please select an audio file')
      return
    }

    // Check file size (10MB limit to match API)
    if (file.size > 10 * 1024 * 1024) {
      setStatus('Error: File size must be less than 10MB')
      return
    }

    setUploadedFile(file)
    setAudioBlob(file)
    setAudioSource('uploaded')
    setStatus(`Audio file loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`)
  }

  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  const clearAll = () => {
    setAudioBlob(null)
    setUploadedFile(null)
    setTranscripts([])
    setStatus('Ready to record or upload audio')
    setAudioSource(null)
    setShowPhrases({})
    audioChunksRef.current = []
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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

  const downloadAllTranscripts = () => {
    if (transcripts.length === 0) return
    
    transcripts.forEach((transcript, index) => {
      const providerName = transcript.provider === 'gemini' ? 'gemini' : 'whisper'
      // Use transcript ID as timestamp since timestamp is a locale string
      const timestamp = transcript.id.toString()
      const filename = `${providerName}_${transcript.model}_${transcript.language}_${timestamp}.txt`
      
      const textToDownload = showPhrases[transcript.id] 
        ? splitTranscriptIntoPhrases(transcript.transcript) 
        : transcript.transcript
      
      const blob = new Blob([textToDownload], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  }

  const downloadSingleTranscript = (transcript) => {
    const providerName = transcript.provider === 'gemini' ? 'gemini' : 'whisper'
    // Use transcript ID as timestamp since timestamp is a locale string
    const timestamp = transcript.id.toString()
    const filename = `${providerName}_${transcript.model}_${transcript.language}_${timestamp}.txt`
    
    const textToDownload = showPhrases[transcript.id] 
      ? splitTranscriptIntoPhrases(transcript.transcript) 
      : transcript.transcript
    
    const blob = new Blob([textToDownload], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const removeTranscript = (transcriptId) => {
    setTranscripts(prev => prev.filter(t => t.id !== transcriptId))
    setShowPhrases(prev => {
      const newState = { ...prev }
      delete newState[transcriptId]
      return newState
    })
  }

  const togglePhrases = (transcriptId) => {
    setShowPhrases(prev => ({
      ...prev,
      [transcriptId]: !prev[transcriptId]
    }))
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
                setSelectedModel(e.target.value === 'gemini' ? 'gemini-2.5-flash' : 'base')
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
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Latest & Fast)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Highest Quality)</option>
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
          
          {selectedProvider === 'gemini' && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#374151' }}>
                Temperature: {temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                disabled={isRecording || isProcessing}
                style={{
                  width: '120px',
                  cursor: (isRecording || isProcessing) ? 'not-allowed' : 'pointer',
                  opacity: (isRecording || isProcessing) ? 0.5 : 1
                }}
              />
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                0.0 = Deterministic, 2.0 = Very Creative
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Display */}
      <div style={{ 
        marginBottom: '2rem',
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
      
      {/* Initial Action Buttons */}
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
          onClick={triggerFileUpload}
          disabled={isRecording || isProcessing}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: (isRecording || isProcessing) ? 'not-allowed' : 'pointer',
            opacity: (isRecording || isProcessing) ? 0.5 : 1,
            transition: 'all 0.2s',
            marginRight: '1rem'
          }}
        >
          📁 Upload Audio
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

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

      {/* Transcribe Button - Shown after audio is loaded */}
      {audioBlob && (
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => transcribeAudio()}
            disabled={isProcessing}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.2rem',
              backgroundColor: transcripts.length > 0 ? '#0ea5e9' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              opacity: isProcessing ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            {transcripts.length > 0 ? '🔄 Add New Transcription' : '🎯 Transcribe'}
          </button>
          {transcripts.length > 0 && (
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280', 
              marginTop: '0.5rem',
              marginBottom: 0
            }}>
              Apply current configuration settings to create a new transcript ({transcripts.length} existing)
            </p>
          )}
        </div>
      )}

      {/* Audio Preview - Only shown after audio is loaded */}
      {audioBlob && (
        <div style={{
          marginBottom: '2rem',
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

      {/* Multiple Transcripts Display */}
      {transcripts.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ margin: 0, color: '#374151' }}>
              Transcripts ({transcripts.length})
            </h3>
            
            {/* Download All Button */}
            <button
              onClick={downloadAllTranscripts}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              📦 Download All ({transcripts.length} files)
            </button>
          </div>

          {transcripts.map((transcript, index) => {
            const providerDisplay = transcript.provider === 'gemini' ? 'Gemini AI' : 'Whisper'
            const isPhrasesActive = showPhrases[transcript.id] || false
            
            return (
              <div 
                key={transcript.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  backgroundColor: '#f9fafb',
                  position: 'relative',
                  marginBottom: '1.5rem'
                }}
              >
                {/* Transcript Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div>
                    <h4 style={{ 
                      margin: '0 0 0.25rem 0', 
                      color: '#374151',
                      fontSize: '1.1rem'
                    }}>
                      {providerDisplay} ({transcript.model}) - {transcript.language.toUpperCase()}
                    </h4>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: '#6b7280'
                    }}>
                      {transcript.timestamp}
                      {transcript.confidence && ` • Confidence: ${(transcript.confidence * 100).toFixed(1)}%`}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* Phrase Toggle Button */}
                    <button
                      onClick={() => togglePhrases(transcript.id)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        backgroundColor: isPhrasesActive ? '#8b5cf6' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isPhrasesActive ? '📝' : '🔤'}
                    </button>
                    
                    {/* Remove Button */}
                    <button
                      onClick={() => removeTranscript(transcript.id)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                {/* Phrase Statistics - Only shown in phrase mode */}
                {isPhrasesActive && (() => {
                  const stats = getPhraseStats(transcript.transcript)
                  return (
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      marginBottom: '1rem',
                      padding: '0.5rem',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '0.25rem'
                    }}>
                      {stats.phraseCount} phrases • {stats.avgWordsPerPhrase} avg words per phrase
                    </div>
                  )
                })()}
                
                {/* Transcript Content */}
                <div style={{ 
                  whiteSpace: 'pre-wrap', 
                  lineHeight: isPhrasesActive ? '1.8' : '1.6',
                  color: '#1f2937',
                  minHeight: '100px',
                  marginBottom: '3rem',
                  fontSize: '0.9rem'
                }}>
                  {isPhrasesActive ? splitTranscriptIntoPhrases(transcript.transcript) : transcript.transcript}
                </div>
                
                {/* Stats in bottom right */}
                <div style={{
                  position: 'absolute',
                  bottom: '1rem',
                  right: '1rem',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  textAlign: 'right'
                }}>
                  <div>{transcript.transcript.split(' ').length} words</div>
                  <div style={{ marginTop: '0.25rem' }}>
                    {transcript.transcriptionTime < 1 
                      ? `${(transcript.transcriptionTime * 1000).toFixed(0)}ms` 
                      : `${transcript.transcriptionTime.toFixed(1)}s`} elapsed
                  </div>
                </div>

                {/* Download button in bottom left */}
                <div style={{
                  position: 'absolute',
                  bottom: '1rem',
                  left: '1rem'
                }}>
                  <button
                    onClick={() => downloadSingleTranscript(transcript)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    📄 Download
                  </button>
                </div>
              </div>
            )
          })}
          
          {/* Audio Download Button - Only shown if audio was recorded */}
          {audioSource === 'recorded' && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                onClick={downloadAudio}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                💾 Download Original Audio
              </button>
            </div>
          )}
        </div>
      )}
      
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
