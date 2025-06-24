import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Navigation() {
  const router = useRouter()
  
  const isActive = (path) => router.pathname === path
  
  return (
    <nav style={{
      display: 'flex',
      gap: '1rem',
      marginBottom: '2rem',
      borderBottom: '1px solid #e5e7eb',
      paddingBottom: '1rem'
    }}>
      <Link 
        href="/"
        style={{
          padding: '0.5rem 1rem',
          textDecoration: 'none',
          borderRadius: '0.375rem',
          backgroundColor: isActive('/') ? '#3b82f6' : 'transparent',
          color: isActive('/') ? 'white' : '#374151',
          border: '1px solid',
          borderColor: isActive('/') ? '#3b82f6' : '#d1d5db',
          transition: 'all 0.2s'
        }}
      >
        🎤 Streaming Demo
      </Link>
      
      <Link 
        href="/demo2"
        style={{
          padding: '0.5rem 1rem',
          textDecoration: 'none',
          borderRadius: '0.375rem',
          backgroundColor: isActive('/demo2') ? '#3b82f6' : 'transparent',
          color: isActive('/demo2') ? 'white' : '#374151',
          border: '1px solid',
          borderColor: isActive('/demo2') ? '#3b82f6' : '#d1d5db',
          transition: 'all 0.2s'
        }}
      >
        📁 MP3 Recording Demo
      </Link>
    </nav>
  )
}
