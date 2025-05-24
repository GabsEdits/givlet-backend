import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.resolve('./treeData.json');
const PORT = process.env.PORT || 3000;

// Load or initialize the JSON array
let treeData;
try {
  treeData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch {
  treeData = Array(2000).fill(null);
  fs.writeFileSync(DATA_FILE, JSON.stringify(treeData, null, 2));
}

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
    cors: {
      origin: 'http://localhost:5173',  // or '*' for wide-open
      methods: ['GET','POST'],
      credentials: true
    }
  });

// Serve built client in production
app.use(express.static(path.resolve('./dist')));
app.use(express.json());

// REST endpoint (optional)
app.get('/api/trees', (req, res) => res.json(treeData));

// WebSocket logic
io.on('connection', socket => {
  socket.emit('init', treeData);
  socket.on('placeTree', ({ index, uuid, name, pfp }) => {
    if (treeData[index] === null) {
      treeData[index] = [uuid, name, pfp];
      fs.writeFileSync(DATA_FILE, JSON.stringify(treeData, null, 2));
      io.emit('treePlaced', { index, uuid });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
