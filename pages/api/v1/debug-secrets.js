import fs from 'fs'
import path from 'path'

export default async function handler(req, res) {
  const secretsFile = process.env.ASR_SECRETS_FILE || '.secrets'
  const secretsPath = path.join(process.cwd(), secretsFile)
  
  const debug = {
    workingDirectory: process.cwd(),
    secretsFile: secretsFile,
    secretsPath: secretsPath,
    fileExists: fs.existsSync(secretsPath),
    timestamp: new Date().toISOString()
  }
  
  if (fs.existsSync(secretsPath)) {
    try {
      const content = fs.readFileSync(secretsPath, 'utf8')
      debug.fileContent = content
      debug.fileSize = content.length
      
      // Parse keys
      const keys = []
      content.split('\n').forEach(line => {
        line = line.trim()
        if (line && !line.startsWith('#') && line.includes('=')) {
          const [keyName, keyValue] = line.split('=')
          if (keyName && keyValue) {
            keys.push({
              name: keyName,
              value: keyValue.trim(),
              length: keyValue.trim().length
            })
          }
        }
      })
      debug.parsedKeys = keys
    } catch (error) {
      debug.readError = error.message
    }
  } else {
    // List directory contents to see what's there
    try {
      debug.directoryContents = fs.readdirSync(process.cwd())
    } catch (error) {
      debug.directoryError = error.message
    }
  }
  
  return res.status(200).json(debug)
}
