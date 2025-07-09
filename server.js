const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const ChatMessage = require('./models/ChatMessage')

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // or your frontend domain
  },
});

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Make io available in routes
app.set('io', io);

// ✅ Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/settlements', require('./routes/settlementRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/chat', require('./routes/chatRoutes')); 
app.use('/api/avatars', require('./routes/avatarRoutes'));
app.use('/api/room-avatars', require('./routes/roomAvatarRoutes'));

// ✅ Socket handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on('registerUser', (userId) => {
    socket.join(userId);
    console.log(`🔐 User ${userId} joined personal room`);
  });

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`📥 User joined room: ${roomId}`);
  });

  // ✅ Handle real-time message saving and broadcasting
  socket.on('sendMessage', async (msgData) => {
    const { roomId, senderId, senderName, text } = msgData;

    if (!roomId || !senderId || !senderName || !text) {
      console.log('❌ Invalid message data');
      return;
    }

    try {
      const newMessage = new ChatMessage({
        roomId,
        senderId,
        senderName,
        text,
        timestamp: new Date(),
      });

      await newMessage.save(); // 💾 Save to MongoDB

      io.to(roomId).emit('receiveMessage', newMessage); // 📤 Broadcast to room
      console.log('📨 Message sent to room:', roomId);
    } catch (err) {
      console.error('❌ Error saving message:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('❎ User disconnected:', socket.id);
  });
});

// ✅ Connect DB and start server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => console.log(err));
