// MODULO DE BIENVENIDA//
import mongoose from 'mongoose';

const SolicitudAyudaSchema = new mongoose.Schema({
    usuario_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: true,
        index: true
    },
    mensaje_ayuda: {
        type: String,
        required: true
    },
    contacto_preferido: { 
        type: String,
        enum: ['email', 'telefono'],
        default: 'email'
    },
    valor_contacto: { 
        type: String,
        required: true
    },
    // Estad para el equipo
    estado_gestion: {
        type: String,
        enum: ['pendiente', 'contactado', 'seguir_contactando', 'eliminado'],
        default: 'pendiente'
    },
    fecha_solicitud: {
        type: Date,
        default: Date.now
    },
    fecha_ultima_gestion: {
        type: Date
    },
    gestionado_por: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario', 
        default: null
    }
}, { timestamps: true });

export const SolicitudAyuda = mongoose.model('SolicitudAyuda', SolicitudAyudaSchema);