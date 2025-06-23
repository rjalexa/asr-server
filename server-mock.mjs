import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const port = 3001;
const server = createServer();
const wss = new WebSocketServer({ server });

console.log('Starting Mock WebSocket server...');

wss.on('connection', (ws, req) => {
  console.log(`New client connected from ${req.socket.remoteAddress}`);
  
  let mockInterval = null;
  
  ws.on('message', (data) => {
    console.log(`Received audio chunk: ${data.byteLength || data.length} bytes`);
    
    if (!mockInterval) {
      console.log('Starting mock transcription stream...');
      mockInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          const mockData = {
            transcript: 'This is a mock transcription. ',
            timestamp: Date.now(),
            is_final: true
          };
          ws.send(JSON.stringify(mockData));
          console.log('Sent:', mockData.transcript);
        }
      }, 2000);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    if (mockInterval) {
      clearInterval(mockInterval);
      mockInterval = null;
    }
  });
});

server.listen(port, () => {
  console.log(`Mock WebSocket server is running on ws://localhost:${port}/stream`);
  console.log('Press Ctrl+C to stop the server');
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});

process.stdin.resume();
