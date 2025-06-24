import swaggerSpec from '../../lib/swagger.js'

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Get OpenAPI specification
 *     description: Returns the OpenAPI/Swagger specification for the ASR API
 *     tags:
 *       - Documentation
 *     responses:
 *       200:
 *         description: OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json(swaggerSpec)
}
