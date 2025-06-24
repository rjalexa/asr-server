import { useState, useRef, useEffect } from 'react'
import Navigation from '../components/Navigation'

export default function Demo2() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('Ready to record')
  const [timeLeft, setTimeLeft] = useState(15)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const audioChunksRef = useRef([])

  // Timer countdown effect
  useEffect(() => {
    if (isRecording && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (isRecording && timeLeft === 0) {
      stopRecording()
    }
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [isRecording, timeLeft])

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
      setTimeLeft(15)

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

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(audioBlob)
        setStatus('Recording complete - ready to transcribe')
        
        // Stop the microphone stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
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
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
  }

  const transcribeAudio = async () => {
    if (!audioBlob) return

    setIsProcessing(true)
    setStatus('Uploading and processing audio...')

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.mp3')

      const response = await fetch('/api/transcribe-local', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.error) {
        throw new Error(result.error)
      }

      setTranscript(result.transcript)
      setStatus('Transcription complete!')

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
    setTimeLeft(15)
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

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1>MP3 Recording Demo</h1>
      <Navigation />
      
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
          onClick={transcribeAudio}
          disabled={!audioBlob || isProcessing}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: (!audioBlob || isProcessing) ? 'not-allowed' : 'pointer',
            opacity: (!audioBlob || isProcessing) ? 0.5 : 1,
            transition: 'all 0.2s',
            marginRight: '1rem'
          }}
        >
          {isProcessing ? '⏳ Processing...' : '📝 Transcribe'}
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
          💾 Download
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

      {/* Timer Display */}
      {isRecording && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#fef3c7',
          borderRadius: '0.5rem',
          textAlign: 'center',
          border: '2px solid #f59e0b'
        }}>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: timeLeft <= 5 ? '#ef4444' : '#f59e0b',
            fontFamily: 'monospace'
          }}>
            {timeLeft}s
          </div>
          <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
            Recording will stop automatically
          </div>
        </div>
      )}

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
            Duration: ~{Math.min(15 - timeLeft, 15)}s | 
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
          Transcript (Local Whisper)
        </h3>
        
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          lineHeight: '1.6',
          color: '#1f2937',
          minHeight: '200px'
        }}>
          {transcript || (isProcessing ? 'Processing with local Whisper model...' : 'Transcript will appear here after processing')}
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
