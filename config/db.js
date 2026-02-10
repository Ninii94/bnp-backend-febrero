// config/db.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
   console.log('🔄 Intentando conectar a MongoDB...');
    console.log('🔗 MONGODB_URI existe:', !!process.env.MONGODB_URI);
    console.log('🔗 MONGODB_URI primeros caracteres:', process.env.MONGODB_URI?.substring(0, 20));
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000
});
  
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📍 Database: ${conn.connection.name}`);
    console.log(`🔗 MongoDB URI: ${process.env.MONGODB_URI ? 'PRESENTE' : 'FALTANTE'}`);
    
    // Event listeners para la conexión
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    console.error('🔧 Check your MONGODB_URI in environment variables');
    process.exit(1);
  }
};

export default connectDB;