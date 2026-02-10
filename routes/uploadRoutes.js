// routes/uploadRoutes.js
import express from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

// Configurar multer para almacenamiento en memoria
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // Límite de 5MB
    }
});

router.post('/', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha subido ninguna imagen' });
        }

        // Convertir el buffer a base64
        const fileStr = req.file.buffer.toString('base64');
        const fileType = req.file.mimetype;
        const uploadStr = `data:${fileType};base64,${fileStr}`;

        // Subir a Cloudinary
        const uploadResponse = await cloudinary.uploader.upload(uploadStr, {
            folder: 'perfiles',
            resource_type: 'auto',
        });

        res.json({ 
            url: uploadResponse.secure_url,
            public_id: uploadResponse.public_id
        });

    } catch (error) {
        console.error('Error al subir imagen:', error);
        res.status(500).json({ 
            message: 'Error al subir la imagen',
            error: error.message 
        });
    }
});

export default router;