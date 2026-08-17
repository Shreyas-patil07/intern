require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { initializeRealtime } = require('./src/services/realtimeService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const httpServer = http.createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: '*'
      }
    });

    initializeRealtime(io);

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('Socket.IO real-time notifications enabled');
    });
  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exit(1);
  }
};

startServer();
