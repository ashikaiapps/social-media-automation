# Create logs directory for development
mkdir -p logs

# Create uploads directories
mkdir -p uploads/temp uploads/media

# Create database (PostgreSQL must be running)
createdb socialmedia

# Generate Prisma client and setup database
npx prisma generate
npx prisma db push

echo "✅ Local environment setup complete!"
echo "📝 Don't forget to:"
echo "   1. Copy .env.example to .env and fill in your API keys"
echo "   2. Start PostgreSQL and Redis services"
echo "   3. Run 'npm run dev' to start the development server"