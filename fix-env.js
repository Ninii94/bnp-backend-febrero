import fs from 'fs';

// Leer .env manualmente
const envContent = fs.readFileSync('.env', 'utf8');
envContent.split('\n').forEach(line => {
    if (line.includes('CLOUDINARY') && line.includes('=')) {
        const [key, value] = line.split('=');
        process.env[key.trim()] = value.trim();
    }
});

console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY);
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');