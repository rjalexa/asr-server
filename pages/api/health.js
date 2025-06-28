/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health Check
 *     description: Check the health status of the ASR server
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Health status
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Current timestamp
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 environment:
 *                   type: string
 *                   description: Current environment
 *                   example: production
 *                 whisperBackend:
 *                   type: string
 *                   description: Whisper backend URL
 *       405:
 *         description: Method not allowed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get available providers from environment variable
  const availableProvidersEnv = process.env.AVAILABLE_PROVIDERS || 'whisper,gemini'
  const availableProviders = availableProvidersEnv.split(',').map(p => p.trim())

  // Basic health check
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    whisperBackend: process.env.WHISPER_API_URL || 'not configured',
    whisperxBackend: process.env.WHISPERX_API_URL || 'not configured',
    availableProviders: availableProviders
  }

  res.status(200).json(healthCheck)
}
