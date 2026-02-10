import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

// Definir el esquema de Sucursal
const sucursalSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  direccion: {
    type: String,
    required: true
  },
  telefono: String,
  correo: String,
  aliado_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Aliado'
  },
  activo: {
    type: Boolean,
    default: true
  },
  fecha_creacion: {
    type: Date,
    default: Date.now
  }
});

const Sucursal = mongoose.model('Sucursal', sucursalSchema);

const sucursales = [
  {
    nombre: "Sucursal Principal BNP",
    direccion: "Av. Principal #123",
    telefono: "123-456-7890",
    correo: "principal@bnp.com",
    activo: true
  },
  {
    nombre: "Sucursal Norte BNP",
    direccion: "Calle Norte #456",
    telefono: "123-456-7891",
    correo: "norte@bnp.com",
    activo: true
  },
  {
    nombre: "Sucursal Sur BNP",
    direccion: "Av. Sur #789",
    telefono: "123-456-7892",
    correo: "sur@bnp.com",
    activo: true
  },
  {
    nombre: "Sucursal Este BNP",
    direccion: "Calle Este #012",
    telefono: "123-456-7893",
    correo: "este@bnp.com",
    activo: true
  },
  {
    nombre: "Sucursal Oeste BNP",
    direccion: "Av. Oeste #345",
    telefono: "123-456-7894",
    correo: "oeste@bnp.com",
    activo: true
  }
];

async function initSucursales() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conexión exitosa a MongoDB');
    
    // Primero eliminar sucursales existentes
    await Sucursal.deleteMany({});
    console.log('Sucursales previas eliminadas');
    
    // Insertar nuevas sucursales
    await Sucursal.insertMany(sucursales);
    console.log('Sucursales inicializadas correctamente');
    
    await mongoose.connection.close();
    console.log('Conexión a MongoDB cerrada');
    process.exit(0);
  } catch (error) {
    console.error('Error al inicializar sucursales:', error);
    process.exit(1);
  }
}

initSucursales();