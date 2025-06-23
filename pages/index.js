import { useState, useRef } from 'react'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('Ready to record')
  const [partialTranscript, setPartialTranscript] = useState('')
  
  const mediaRecorderRef = useRef(null)
  const socketRef = useRef(null)
  const streamRef = useRef(null)

  const startRecording = async () => {
    try {
      setStatus('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        } 
      })
      streamRef.current = stream

      setStatus('Connecting to server...')
      // Connect to WebSocket for streaming
      const ws = new WebSocket('ws://localhost:3001/stream')
      socketRef.current = ws

      ws.onopen = () => {
        setStatus('Connected. Starting recording...')
        setIsRecording(true)
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.transcript) {
          // For final transcriptions, append to main transcript
          if (data.is_final) {
            setTranscript(prev => {
              // Add proper spacing and punctuation
              const newText = data.transcript.trim()
              if (prev && !prev.endsWith(' ')) {
                return prev + ' ' + newText
              }
              return prev + newText
            })
            setPartialTranscript('') // Clear partial
          } else {
            // For partial results (if using streaming)
            setPartialTranscript(data.transcript)
          }
        }
        
        if (data.status) {
          setStatus(data.status)
        }
      }

      ws.onerror = (error) => {
        setStatus('WebSocket error: ' + error.message)
        stopRecording()
      }

      ws.onclose = () => {
        setStatus('Connection closed')
        stopRecording()
      }

      // Setup MediaRecorder for audio streaming
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(event.data)
        }
      }

      // Start recording with 100ms chunks
      mediaRecorder.start(100)
      setStatus('Recording... Speak now!')

    } catch (error) {
      setStatus('Error: ' + error.message)
      console.error('Error accessing microphone:', error)
    }
  }

  const stopRecording = () => {
    setStatus('Stopping...')
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close()
    }

    setIsRecording(false)
    setStatus('Recording stopped')
    setPartialTranscript('')
  }

  const clearTranscript = () => {
    setTranscript('')
    setPartialTranscript('')
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Whisper Streaming Demo</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            backgroundColor: isRecording ? '#ef4444' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            marginRight: '1rem'
          }}
        >
          {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
        </button>
        
        <button
          onClick={clearTranscript}
          disabled={!transcript && !partialTranscript}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: transcript || partialTranscript ? 'pointer' : 'not-allowed',
            opacity: transcript || partialTranscript ? 1 : 0.5,
            transition: 'opacity 0.2s'
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ 
        marginBottom: '1rem',
        padding: '0.5rem 1rem',
        backgroundColor: isRecording ? '#fef3c7' : '#e5e7eb',
        borderRadius: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isRecording ? '#f59e0b' : '#6b7280',
          animation: isRecording ? 'pulse 1.5s infinite' : 'none'
        }} />
        <strong>Status:</strong> {status}
      </div>

      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        minHeight: '300px',
        backgroundColor: '#f9fafb',
        position: 'relative'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151' }}>
          Transcript:
        </h3>
        
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          lineHeight: '1.6',
          color: '#1f2937'
        }}>
          {transcript || (
            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
              Transcribed text will appear here...
            </span>
          )}
          {partialTranscript && (
            <span style={{ color: '#6b7280', fontStyle: 'italic' }}>
              {' '}{partialTranscript}
            </span>
          )}
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
