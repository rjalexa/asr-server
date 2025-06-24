// Local transcription endpoint - disabled in favor of backend service
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Local transcription is not available - use the main transcribe endpoint instead
  res.status(501).json({ 
    error: 'Local transcription not available',
    message: 'This deployment uses a backend whisper service. Please use the /api/transcribe endpoint instead.',
    redirect: '/api/transcribe'
  })
}
