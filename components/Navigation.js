export default function Navigation() {
  return (
    <nav style={{
      display: 'flex',
      gap: '1rem',
      marginBottom: '2rem',
      borderBottom: '1px solid #e5e7eb',
      paddingBottom: '1rem'
    }}>
      <div style={{
        padding: '0.5rem 1rem',
        borderRadius: '0.375rem',
        backgroundColor: '#3b82f6',
        color: 'white',
        border: '1px solid #3b82f6'
      }}>
        🎤 MP3 Recording & Transcription
      </div>
    </nav>
  )
}
