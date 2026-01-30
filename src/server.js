const app = require('./app');
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const { Queue } = require('bullmq');

const prisma = new PrismaClient();
const PORT = process.env.APP_PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Test Redis connection  
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redis.ping();
    console.log('✅ Redis connected successfully');

    // Initialize job queue
    const postQueue = new Queue('post-scheduler', { 
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    });
    console.log('✅ Job queue initialized');

    // Make queue available globally for routes
    app.locals.postQueue = postQueue;
    app.locals.prisma = prisma;

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🛑 Shutting down gracefully...');
      await postQueue.close();
      await redis.disconnect();
      await prisma.$disconnect();
      process.exit(0);
    });

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Using default'}`);
      console.log(`🔄 Redis: ${process.env.REDIS_URL ? 'Connected' : 'Using default'}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          console.error(`❌ Port ${PORT} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`❌ Port ${PORT} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();