import express from "express";
import mongoose from "mongoose";
import { Aliado } from "../models/Aliado.js";
import { Beneficiario } from "../models/Beneficiario.js";
import { Usuario } from "../models/Usuario.js";
import { Estado } from "../models/Estado.js";
import { Sucursal } from "../models/Sucursal.js";
import { Servicio } from "../models/Servicio.js";
import { HistorialServicio } from "../models/HistorialServicio.js";
import { checkAuth, isAliado } from "../middleware/auth.js";
import { registrarActividad } from "../middleware/Bitacora.js";

const router = express.Router();

const procesarParejaParaGuardar = (parejaData) => {
  if (!parejaData || typeof parejaData !== 'object') {
    return null;
  }

  const tieneContenido = 
    (parejaData.nombre_completo && parejaData.nombre_completo.trim() !== "") ||
    (parejaData.nombre && parejaData.nombre.trim() !== "") ||
    (parejaData.telefono && parejaData.telefono.trim() !== "") ||
    (parejaData.correo && parejaData.correo.trim() !== "");

  if (!tieneContenido) {
    return null;
  }

  // Parsear nombre_completo → nombre + apellido
  let nombre = "";
  let apellido = "";

  if (parejaData.nombre_completo) {
    const partes = parejaData.nombre_completo.trim().split(" ");
    nombre = partes[0] || "";
    apellido = partes.slice(1).join(" ") || "";
    console.log(`📝 Parseando pareja: "${parejaData.nombre_completo}" → nombre="${nombre}", apellido="${apellido}"`);
  } else {
    nombre = parejaData.nombre || "";
    apellido = parejaData.apellido || "";
  }

  // ⭐ CONSTRUIR OBJETO SIN CAMPOS NULL EN ENUMS
  const parejaObj = {
    nombre,
    apellido,
    telefono: parejaData.telefono || "",
    correo: parejaData.correo || "",
  };

  // ⭐ SOLO AGREGAR CAMPOS OPCIONALES SI TIENEN VALOR VÁLIDO
  if (parejaData.fecha_nacimiento) {
    parejaObj.fecha_nacimiento = parejaData.fecha_nacimiento;
  }

  // Género - solo agregar si tiene un valor válido
  if (parejaData.genero && ['masculino', 'femenino', 'prefiero no decirlo'].includes(parejaData.genero)) {
    parejaObj.genero = parejaData.genero;
  }

  // Estado civil - solo agregar si tiene un valor válido
  if (parejaData.estado_civil && ['soltero', 'casado', 'divorciado', 'viudo', 'no especificado'].includes(parejaData.estado_civil)) {
    parejaObj.estado_civil = parejaData.estado_civil;
  }

  if (parejaData.nacionalidad) {
    parejaObj.nacionalidad = parejaData.nacionalidad;
  }

  if (parejaData.documento_identidad) {
    parejaObj.documento_identidad = parejaData.documento_identidad;
  }

  return parejaObj;
};
const procesarFotoIdentificacion = (fotoData) => {
  if (!fotoData || typeof fotoData !== 'object') {
    console.log('⚠️ procesarFotoIdentificacion: No hay datos de foto');
    return null;
  }

  // ⭐ VALIDAR que tenga al menos nombre
  if (!fotoData.nombre && !fotoData.ruta && !fotoData.url) {
    console.log('⚠️ procesarFotoIdentificacion: Foto sin nombre ni URL');
    return null;
  }

  // ⭐ CONSTRUIR URL CORRECTA PARA CLOUDINARY
  let rutaFinal = null;
  
  if (fotoData.ruta) {
    rutaFinal = fotoData.ruta;
  } else if (fotoData.url) {
    rutaFinal = fotoData.url;
  } else if (fotoData.nombre && fotoData.public_id) {
    // Si tiene public_id pero no URL, construir la URL de Cloudinary
    rutaFinal = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${fotoData.public_id}`;
  } else if (fotoData.nombre) {
    // Si solo tiene nombre pero parece una URL de Cloudinary
    if (fotoData.nombre.includes('cloudinary.com') || fotoData.nombre.startsWith('http')) {
      rutaFinal = fotoData.nombre;
    } else {
      // Intentar construir URL basado en la estructura estándar de Cloudinary
      const nombreLimpio = fotoData.nombre.replace(/\s+/g, '%20');
      rutaFinal = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/beneficiarios/identificacion/${nombreLimpio}`;
    }
  }

  const resultado = {
    nombre: fotoData.nombre || 'documento.jpg',
    ruta: rutaFinal, // ⭐ IMPORTANTE: Incluir ruta
    tipo: fotoData.tipo || fotoData.mimetype || 'image/jpeg',
    tamaño: fotoData.tamaño || fotoData.size || 0,
    fecha_subida: fotoData.fecha_subida || new Date(),
    public_id: fotoData.public_id || null
  };

  console.log('📷 Foto procesada:', {
    nombre: resultado.nombre,
    tiene_ruta: !!resultado.ruta,
    ruta: resultado.ruta || 'SIN RUTA'
  });

  return resultado;
};

const transformarParejaParaRespuesta = (pareja) => {
  if (!pareja) return null;

  // ⭐ RECONSTRUIR nombre_completo desde nombre + apellido
  const nombreCompleto = `${pareja.nombre || ''} ${pareja.apellido || ''}`.trim();
  
  return {
    nombre_completo: nombreCompleto || pareja.correo || pareja.telefono || '',
    nombre: pareja.nombre || '',
    apellido: pareja.apellido || '',
    telefono: pareja.telefono || '',
    correo: pareja.correo || '',
    fecha_nacimiento: pareja.fecha_nacimiento,
    genero: pareja.genero,
    estado_civil: pareja.estado_civil,
    nacionalidad: pareja.nacionalidad,
    documento_identidad: pareja.documento_identidad
  };
};
// Función auxiliar para registrar historial de servicios

const registrarHistorialServicios = async (
  usuarioId,
  serviciosIds,
  accion,
  usuarioEjecutor,
  tipoUsuario = 'beneficiario'  // ⭐ PARÁMETRO AGREGADO
) => {
  try {
    if (!serviciosIds || serviciosIds.length === 0) {
      console.log('⚠️ No hay servicios para registrar en historial');
      return;
    }

    console.log(`📝 Registrando historial de ${serviciosIds.length} servicios...`);
    console.log(`   Usuario: ${usuarioId}`);
    console.log(`   Acción: ${accion}`);
    console.log(`   Tipo: ${tipoUsuario}`);
    console.log(`   Ejecutor: ${usuarioEjecutor}`);

    const serviciosInfo = await Servicio.find({ _id: { $in: serviciosIds } });
    
    if (serviciosInfo.length === 0) {
      console.log('⚠️ No se encontraron servicios con los IDs proporcionados');
      return;
    }

    const entradasHistorial = serviciosInfo.map((servicio) => ({
      usuarioId,
      servicioId: servicio._id,
      servicioNombre: servicio.nombre,
      accion,
      fecha: new Date(),
      fecha_asignacion: accion === 'asignado' ? new Date() : null,
      fecha_activacion: accion === 'activado' ? new Date() : null,
      usuario: usuarioEjecutor,
      tipo_usuario: tipoUsuario,  // ⭐ CAMPO REQUERIDO
      estado_actual: accion === 'activado' ? 'activo' : 
                     accion === 'desactivado' ? 'inactivo' : 
                     'asignado',
      notas: `Servicio ${accion} por ${usuarioEjecutor}`
    }));

    console.log(`📋 Insertando ${entradasHistorial.length} registros en historial...`);
    await HistorialServicio.insertMany(entradasHistorial);
    
    console.log(`✅ Historial registrado exitosamente: ${accion} ${serviciosIds.length} servicios para usuario ${usuarioId} (${tipoUsuario})`);
  } catch (error) {
    console.error("❌ Error registrando historial de servicios:", error);
    console.error("   Stack:", error.stack);
    // NO throw - solo log para no romper el flujo principal
  }
};
// Obtener servicios disponibles para beneficiarios
router.get("/servicios", checkAuth, isAliado, async (req, res) => {
  try {
    const servicios = await Servicio.find({
      $or: [{ tipoUsuario: "beneficiario" }, { tipoUsuario: "ambos" }],
    });

    console.log(`Enviando ${servicios.length} servicios para beneficiarios`);
    res.json(servicios);
  } catch (error) {
    console.error("Error al obtener servicios:", error);
    res.status(500).json({ error: "Error al obtener servicios" });
  }
});

// Obtener estados disponibles para beneficiarios
router.get("/estados-beneficiarios", checkAuth, isAliado, async (req, res) => {
  try {
    const estados = await Estado.find({ tipo: "BENEFICIARIO" });
    res.json(estados);
  } catch (error) {
    console.error("Error al obtener estados de beneficiarios:", error);
    res.status(500).json({ error: "Error al obtener estados" });
  }
});

// Obtener sucursales del aliado autenticado
router.get("/mis-sucursales", checkAuth, isAliado, async (req, res) => {
  try {
    const aliado_id = req.aliado._id;

    // Buscar sucursales del aliado
    const sucursales = await Sucursal.find({
      aliado_id: aliado_id,
      activo: true,
    });

    res.json(sucursales);
  } catch (error) {
    console.error("Error al obtener sucursales del aliado:", error);
    res.status(500).json({ error: "Error al obtener sucursales" });
  }
});

// Crear nuevo beneficiario para el aliado autenticado

router.post("/crear-beneficiario", checkAuth, isAliado, async (req, res) => {
  console.log("=== 🆕 CREACIÓN DE BENEFICIARIO POR ALIADO ===");
  console.log("Aliado:", req.aliado.nombre);
  console.log("Usuario executor:", req.usuario.nombre_usuario);
  console.log("Datos recibidos:", {
    nombre: req.body.nombre,
    apellido: req.body.apellido,
    correo: req.body.usuario?.correo,
    servicios_count: req.body.servicios?.length || 0,
  });

  try {
    const aliado_id = req.aliado._id;
    const usuario_id = req.usuario._id;

    // ⭐ DESTRUCTURACIÓN COMPLETA CON TODOS LOS CAMPOS
    const {
      // Información personal
      nombre,
      apellido,
      genero,
      estado_civil,
      telefono,
      nacionalidad,
      direccion,
      fecha_nacimiento,
      
      // Ubicación
      pais,
      estado_provincia,
      ciudad,
      
      // Hotel/Aliado
      sucursal,
      
      // Pago
      enganche_pagado,
      moneda_enganche,
      
      // Pareja
      pareja,
      
      // Usuario
      usuario,
      
      // Estado
      estado_id,
      
      // Servicios
      servicios,
      
      // ⭐ CAMPOS ADMINISTRATIVOS
      director,
      gerente,
      cerrador,
      colaborador_bnp,
      departamento,
      fecha_registro,
      monto_venta,
      vigencia_membresia_anos,
      
      // ⭐ MEMBRESÍA
      membresia,
      
      // ⭐ IDIOMA Y DOCUMENTOS
      idioma_preferencia,
      foto_identificacion_beneficiario,
      foto_identificacion_pareja
    } = req.body;

    console.log(`🏢 Aliado ${req.aliado.nombre} creando beneficiario:`, {
      nombre,
      apellido,
      correo: usuario.correo,
      estado_id: estado_id,
      servicios_solicitados: servicios?.length || 0,
    });

    // ⭐ LOG DE DEBUG ADICIONAL
    console.log('📦 DATOS COMPLETOS RECIBIDOS:', {
      tiene_membresia: !!membresia,
      tiene_sucursal: !!sucursal,
      tiene_director: !!director,
      tiene_idioma: !!idioma_preferencia,
      tiene_fotos: !!(foto_identificacion_beneficiario || foto_identificacion_pareja),
      vigencia_anos: vigencia_membresia_anos
    });

    // Validaciones básicas
    if (!nombre || !apellido || !usuario.nombre_usuario || !usuario.correo) {
      console.log("❌ Faltan campos obligatorios");
      return res.status(400).json({
        error: "Los campos nombre, apellido, nombre de usuario y correo son obligatorios",
      });
    }

    // Verificar que el correo no esté en uso
    const usuarioExistente = await Usuario.findOne({ correo: usuario.correo });
    if (usuarioExistente) {
      console.log("❌ Correo ya existe:", usuario.correo);
      return res.status(400).json({
        error: "Ya existe un usuario con ese correo electrónico",
      });
    }

    // Verificar que el nombre de usuario no esté en uso
    const nombreUsuarioExistente = await Usuario.findOne({
      nombre_usuario: usuario.nombre_usuario,
    });
    if (nombreUsuarioExistente) {
      console.log("❌ Nombre de usuario ya existe:", usuario.nombre_usuario);
      return res.status(400).json({
        error: "Ya existe un usuario con ese nombre de usuario",
      });
    }

    // Validar servicios si se proporcionan
    let serviciosValidados = [];
    if (servicios && Array.isArray(servicios) && servicios.length > 0) {
      try {
        const serviciosExistentes = await Servicio.find({
          _id: { $in: servicios },
          $or: [{ tipoUsuario: "beneficiario" }, { tipoUsuario: "ambos" }],
        });

        serviciosValidados = serviciosExistentes.map((s) => s._id);
        console.log(
          `✅ Servicios validados: ${serviciosValidados.length} de ${servicios.length} solicitados`
        );
      } catch (error) {
        console.error("Error validando servicios:", error);
        return res.status(400).json({
          error: "Error al validar los servicios seleccionados",
        });
      }
    }

    // Validar que el estado_id sea válido si se proporciona
    let estadoValidado = null;
    let estadoNombre = "Sin estado";
    if (estado_id && estado_id.trim() !== "") {
      try {
        estadoValidado = new mongoose.Types.ObjectId(estado_id);
        // Verificar que el estado existe y es para beneficiarios
        const estadoExiste = await Estado.findOne({
          _id: estadoValidado,
          tipo: "BENEFICIARIO",
        });
        if (!estadoExiste) {
          return res.status(400).json({
            error: "El estado seleccionado no es válido para beneficiarios",
          });
        }
        estadoNombre = estadoExiste.nombre;
        console.log("✅ Estado validado correctamente:", estadoNombre);
      } catch (error) {
        return res.status(400).json({
          error: "El ID del estado no es válido",
        });
      }
    }

    // ⭐ VALIDAR Y CONVERTIR SUCURSAL
    let sucursalValidada = null;
    if (sucursal) {
      try {
        // Verificar que la sucursal existe y pertenece al aliado
        const sucursalExiste = await Sucursal.findOne({
          _id: sucursal,
          aliado_id: aliado_id,
          activo: true
        });
        
        if (sucursalExiste) {
          sucursalValidada = new mongoose.Types.ObjectId(sucursal);
          console.log("✅ Sucursal validada y convertida:", sucursalExiste.nombre);
        } else {
          console.log("⚠️ Sucursal no encontrada o no pertenece al aliado");
        }
      } catch (error) {
        console.error("❌ Error validando sucursal:", error);
      }
    } else {
      console.log("ℹ️ No se proporcionó sucursal");
    }

    // Crear el usuario del beneficiario
    console.log("📝 Creando usuario del beneficiario...");
    const nuevoUsuario = new Usuario({
      nombre_usuario: usuario.nombre_usuario,
      contrasena: usuario.contrasena,
      telefono: telefono,
      correo: usuario.correo,
      tipo: "beneficiario",
    });

    await nuevoUsuario.save();
    console.log("✅ Usuario creado exitosamente:", nuevoUsuario._id);

    // Procesar enganche pagado
    let enganchePagadoObj = {
      valor: 0,
      moneda: "USD",
    };

    if (enganche_pagado) {
      if (
        typeof enganche_pagado === "object" &&
        "valor" in enganche_pagado &&
        "moneda" in enganche_pagado
      ) {
        enganchePagadoObj = enganche_pagado;
      } else if (
        typeof enganche_pagado === "number" ||
        typeof enganche_pagado === "string"
      ) {
        enganchePagadoObj = {
          valor: parseFloat(enganche_pagado) || 0,
          moneda: moneda_enganche || "USD",
        };
      }
    }

    // Validar y procesar información de pareja
 const parejaObj = procesarParejaParaGuardar(pareja);
if (parejaObj) {
  console.log("✅ Pareja procesada:", `${parejaObj.nombre} ${parejaObj.apellido}`);
} else {
  console.log("ℹ️ No se proporcionó información de pareja");
}

    // ⭐ PROCESAR MEMBRESÍA
    let membresiaObj = null;
    if (membresia && typeof membresia === 'object') {
      membresiaObj = {
        fecha_compra: membresia.fecha_compra || null,
        socio_desde: membresia.socio_desde || null,
        costo_total: {
          valor: parseFloat(membresia.costo_total?.valor || 0),
          moneda: membresia.costo_total?.moneda || 'USD'
        },
        costo_contrato_cierre: {
          valor: parseFloat(membresia.costo_contrato_cierre?.valor || 0),
          moneda: membresia.costo_contrato_cierre?.moneda || 'USD'
        },
        liquidada: membresia.liquidada || false,
        tipo_membresia: membresia.tipo_membresia || '',
        tamano_habitacion: membresia.tamano_habitacion || '',
        mantenimiento_pagar: {
          valor: parseFloat(membresia.mantenimiento_pagar?.valor || 0),
          moneda: membresia.mantenimiento_pagar?.moneda || 'USD'
        },
        periodicidad_mantenimiento: membresia.periodicidad_mantenimiento || '',
        temporada_uso: membresia.temporada_uso || ''
      };
      console.log('✅ Información de membresía procesada');
    }

    // ⭐ PROCESAR FOTOS
  console.log('📸 Procesando fotos de identificación...');
const fotoBeneficiario = procesarFotoIdentificacion(foto_identificacion_beneficiario);
const fotoPareja = procesarFotoIdentificacion(foto_identificacion_pareja);

if (fotoBeneficiario) {
  console.log("📷 Foto beneficiario:", fotoBeneficiario.nombre, 
    fotoBeneficiario.ruta ? "✅ con URL" : "⚠️ sin URL");
}
if (fotoPareja) {
  console.log("📷 Foto pareja:", fotoPareja.nombre, 
    fotoPareja.ruta ? "✅ con URL" : "⚠️ sin URL");
}
    // Preparar el historial de estados
    const historialEstados = [];
    if (estadoValidado) {
      historialEstados.push({
        estado_id: estadoValidado,
        motivo: `Creación inicial por aliado ${req.aliado.nombre}`,
        fecha: new Date(),
      });
    }

    // ⭐ CREAR BENEFICIARIO CON TODOS LOS CAMPOS CORREGIDOS
    console.log("📝 Creando beneficiario...");
    const nuevoBeneficiario = new Beneficiario({
      // Información personal
      nombre,
      apellido: apellido || "",
      genero: genero || "prefiero no decirlo",
      estado_civil: estado_civil || "no especificado",
      telefono,
      nacionalidad,
      direccion,
      fecha_nacimiento: fecha_nacimiento || null,
      
      // Ubicación
      pais: pais || "",
      estado_provincia: estado_provincia || "",
      ciudad: ciudad || "",
      
      // Pareja
      pareja: parejaObj,
      
      // Estado
      estado_id: estadoValidado,
      
      // ⭐ SUCURSAL - CONVERTIDA A ObjectId
      sucursal: sucursalValidada,
      aliado_sucursal: sucursalValidada,
      
      // ⭐ ALIADO - CONVERTIDO A ObjectId (CRÍTICO)
      aliado_id: new mongoose.Types.ObjectId(aliado_id),
      hotel_aliado: new mongoose.Types.ObjectId(aliado_id),
      
      // Pago
      enganche_pagado: enganchePagadoObj,
      
      // Usuario
      usuario_id: nuevoUsuario._id,
      correo: usuario.correo,
      
      // Servicios
      servicios: serviciosValidados,
      
      // Historial
      historialEstados: historialEstados,
      
      // Código
      codigo: {
        activo: false,
        fecha_activacion: null,
      },
      
      // ⭐ CAMPOS ADMINISTRATIVOS
      director: director || null,
      gerente: gerente || null,
      cerrador: cerrador || null,
      colaborador_bnp: colaborador_bnp || null,
      departamento: departamento || null,
      fecha_registro: fecha_registro || new Date(),
      monto_venta: parseFloat(monto_venta) || 0,
      vigencia_membresia_anos: parseInt(vigencia_membresia_anos) || 1,
      
      // ⭐ MEMBRESÍA
      membresia: membresiaObj,
      
      // ⭐ IDIOMA Y FOTOS
      idioma_preferencia: idioma_preferencia || 'esp',
  foto_identificacion_beneficiario: fotoBeneficiario,
foto_identificacion_pareja: fotoPareja
    });

    console.log('📝 Beneficiario a crear con campos:', {
      aliado_id: nuevoBeneficiario.aliado_id?.toString(),
      sucursal: nuevoBeneficiario.sucursal?.toString(),
      tiene_membresia: !!nuevoBeneficiario.membresia,
      director: nuevoBeneficiario.director,
      vigencia_anos: nuevoBeneficiario.vigencia_membresia_anos
    });

    await nuevoBeneficiario.save();
    console.log("✅ Beneficiario creado exitosamente:", nuevoBeneficiario._id);

    // ⭐ REGISTRAR SERVICIOS EN HISTORIAL (CORREGIDO)
    if (serviciosValidados.length > 0) {
      try {
        await registrarHistorialServicios(
          nuevoUsuario._id,
          serviciosValidados,
          "asignado",  // ⭐ CAMBIADO DE "activado" A "asignado"
          `Aliado: ${req.aliado.nombre}`,
          'beneficiario'  // ⭐ AGREGADO tipo_usuario
        );
        console.log("✅ Historial de servicios registrado");
      } catch (error) {
        console.error("Error registrando historial de servicios:", error);
        // No fallar la creación del beneficiario por error en el historial
      }
    }

    // ⭐ RECUPERAR BENEFICIARIO COMPLETO (VERIFICAR POPULATE)
    const beneficiarioCompleto = await Beneficiario.findById(
      nuevoBeneficiario._id
    )
      .populate("aliado_id", "nombre direccion telefono")  // ⭐ CRÍTICO
      .populate("sucursal", "nombre direccion")
      .populate("estado_id", "nombre")
      .populate("servicios", "nombre descripcion");

    console.log("✅ Beneficiario completo obtenido:", {
      _id: beneficiarioCompleto._id,
      aliado: beneficiarioCompleto.aliado_id?.nombre || 'NO ASOCIADO ❌',
      sucursal: beneficiarioCompleto.sucursal?.nombre || 'Sin sucursal',
      servicios_count: beneficiarioCompleto.servicios?.length || 0
    });

    // REGISTRAR EN BITÁCORA
    console.log("📋 Registrando actividad en bitácora...");
    const nombreCompleto = `${nombre} ${apellido || ""}`.trim();
    const codigoGenerado =
      beneficiarioCompleto.llave_unica ||
      beneficiarioCompleto.codigo?.value ||
      "Pendiente";

    try {
      await registrarActividad(
        "beneficiario_creado",
        `Beneficiario creado por aliado: ${nombreCompleto} (${usuario.correo}) - Estado: ${estadoNombre} - Servicios: ${serviciosValidados.length} - Código: ${codigoGenerado}`,
        {
          entidad_tipo: "beneficiario",
          entidad_id: beneficiarioCompleto._id,
          entidad_nombre: nombreCompleto,
          beneficiario_relacionado: {
            id: beneficiarioCompleto._id,
            nombre: nombreCompleto,
            codigo: codigoGenerado,
          },
          aliado_relacionado: {
            id: req.aliado._id,
            nombre: req.aliado.nombre,
          },
          datos_nuevos: {
            nombre,
            apellido,
            correo: usuario.correo,
            telefono,
            estado: estadoNombre,
            servicios_asignados: serviciosValidados.length,
            enganche_pagado: enganchePagadoObj,
            sucursal_asignada: sucursalValidada ? "Sí" : "No",
            pareja_registrada: parejaObj ? "Sí" : "No",
            codigo_generado: codigoGenerado,
          },
          parametros_accion: {
            metodo: "creacion_por_aliado",
            endpoint: req.originalUrl,
            timestamp: new Date().toISOString(),
            aliado_creador: req.aliado.nombre,
            usuario_ejecutor: req.usuario.nombre_usuario,
          },
          etiquetas: ["beneficiario", "creacion", "aliado", "registro"],
          datos_extra: {
            servicios_nombres:
              beneficiarioCompleto.servicios?.map((s) => s.nombre) || [],
            estado_asignado: estadoNombre,
            enganche_monto: enganchePagadoObj.valor,
            enganche_moneda: enganchePagadoObj.moneda,
            tiene_pareja: !!parejaObj,
            metodo_creacion: "formulario_aliado",
          },
        },
        req
      );
      console.log("🎉 ✅ BENEFICIARIO REGISTRADO EN BITÁCORA EXITOSAMENTE");
    } catch (bitacoraError) {
      console.error("❌ Error registrando en bitácora:", bitacoraError);
      // No fallar la creación del beneficiario por error en bitácora
    }

    // Respuesta exitosa
    console.log("🎉 Proceso de creación completado exitosamente");
    res.status(201).json({
      mensaje: "Beneficiario creado exitosamente",
      beneficiario: {
        _id: beneficiarioCompleto._id,
        nombre: beneficiarioCompleto.nombre,
        apellido: beneficiarioCompleto.apellido,
        correo: beneficiarioCompleto.correo,
        telefono: beneficiarioCompleto.telefono,
        aliado: beneficiarioCompleto.aliado_id?.nombre,
        sucursal: beneficiarioCompleto.sucursal?.nombre,
        estado: beneficiarioCompleto.estado_id?.nombre,
        servicios: beneficiarioCompleto.servicios?.map((s) => s.nombre) || [],
        servicios_count: beneficiarioCompleto.servicios?.length || 0,
      },
      codigo: codigoGenerado,
      pareja: beneficiarioCompleto.pareja,
    });
  } catch (error) {
    console.error("❌ Error al crear beneficiario por aliado:", error);

    // Manejo específico de errores
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error:
          "Error de validación: " +
          Object.values(error.errors)
            .map((e) => e.message)
            .join(", "),
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        error: "Error: Ya existe un beneficiario con esos datos únicos",
      });
    }

    res.status(500).json({
      error: "Error interno al crear beneficiario: " + error.message,
    });
  }
});

// Obtener beneficiarios del aliado autenticado
router.get("/mis-beneficiarios", checkAuth, isAliado, async (req, res) => {
  try {
    const aliado_id = req.aliado._id;
    const { page = 1, limit = 10, search = "", sucursal = "" } = req.query;

    console.log("🔍 Obteniendo beneficiarios para aliado:", aliado_id);

    let filtros = { aliado_id: aliado_id };

    if (search) {
      filtros.$or = [
        { nombre: { $regex: search, $options: "i" } },
        { apellido: { $regex: search, $options: "i" } },
        { correo: { $regex: search, $options: "i" } },
        { telefono: { $regex: search, $options: "i" } },
        { llave_unica: { $regex: search, $options: "i" } },
        { "codigo.value": { $regex: search, $options: "i" } },
      ];
    }

    if (sucursal) {
      filtros.sucursal = sucursal;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const beneficiarios = await Beneficiario.find(filtros)
      .populate("estado_id", "nombre codigo")
      .populate("servicios", "nombre descripcion")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const sucursalIds = beneficiarios
      .map((b) => b.sucursal)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    const sucursalesMap = {};
    if (sucursalIds.length > 0) {
      const sucursales = await Sucursal.find({
        _id: { $in: sucursalIds },
      }).lean();
      sucursales.forEach((s) => {
        sucursalesMap[s._id.toString()] = s;
      });
    }

    const beneficiariosConSucursal = beneficiarios.map((b) => ({
      ...b,
      sucursal: sucursalesMap[b.sucursal?.toString()] || null,
    }));

    const total = await Beneficiario.countDocuments(filtros);

    console.log(
      `📋 Enviando ${beneficiarios.length} beneficiarios con sucursales resueltas`
    );

    res.json({
      beneficiarios: beneficiariosConSucursal,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_items: total,
        items_per_page: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error al obtener beneficiarios del aliado:", error);
    res.status(500).json({ error: "Error al obtener beneficiarios" });
  }
});


// Obtener detalles de un beneficiario específico del aliad
// Obtener detalles de un beneficiario específico del aliado
router.get("/beneficiario/:id", checkAuth, isAliado, async (req, res) => {
  try {
    const { id } = req.params;
    const aliado_id = req.aliado._id;

    console.log(`🔍 Obteniendo detalles del beneficiario ${id} para aliado ${aliado_id}`);

    // Buscar beneficiario que pertenezca al aliado
    const beneficiario = await Beneficiario.findOne({
      _id: id,
      aliado_id: aliado_id,
    })
      .populate("estado_id", "nombre codigo")
      .populate("usuario_id", "nombre_usuario correo")
      .populate("servicios", "nombre descripcion")
      .populate("aliado_id", "nombre telefono correo")
      .lean();

    if (!beneficiario) {
      console.log(`❌ Beneficiario ${id} no encontrado o no pertenece al aliado`);
      return res.status(404).json({
        error: "Beneficiario no encontrado o no pertenece a este aliado",
      });
    }

    console.log(`✅ Beneficiario encontrado: ${beneficiario.nombre}`);

    // Resolver sucursal manualmente
    let sucursalInfo = null;
    if (beneficiario.sucursal && mongoose.Types.ObjectId.isValid(beneficiario.sucursal)) {
      sucursalInfo = await Sucursal.findById(beneficiario.sucursal)
        .select("nombre correo telefono direccion")
        .lean();
      console.log(`🏢 Sucursal encontrada:`, sucursalInfo?.nombre);
    }

    // Resolver hotel aliado
    let hotelAliadoNombre = beneficiario.hotel_aliado;
    if (beneficiario.hotel_aliado && mongoose.Types.ObjectId.isValid(beneficiario.hotel_aliado)) {
      const hotelAliado = await Aliado.findById(beneficiario.hotel_aliado).select("nombre");
      if (hotelAliado) {
        hotelAliadoNombre = hotelAliado.nombre;
      }
    }

    // ⭐ TRANSFORMAR PAREJA (manejando ambos formatos)
   const parejaTransformada = transformarParejaParaRespuesta(beneficiario.pareja);
if (parejaTransformada) {
  console.log(`💑 Pareja: ${parejaTransformada.nombre_completo}`);
}
    // ⭐ PROCESAR FOTOS (agregar ruta si solo tienen nombre)
    let fotoBeneficiario = null;
    if (beneficiario.foto_identificacion_beneficiario) {
      fotoBeneficiario = {
        ...beneficiario.foto_identificacion_beneficiario
      };
      
      // Si no tiene ruta pero tiene nombre, construir URL de Cloudinary
      if (!fotoBeneficiario.ruta && fotoBeneficiario.nombre) {
        // Construir URL usando el public_id o el nombre del archivo
        fotoBeneficiario.ruta = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/beneficiarios/identificacion/${fotoBeneficiario.nombre}`;
        console.log(`📸 Foto beneficiario - construyendo URL desde nombre`);
      }
    }

    let fotoPareja = null;
    if (beneficiario.foto_identificacion_pareja) {
      fotoPareja = {
        ...beneficiario.foto_identificacion_pareja
      };
      
      if (!fotoPareja.ruta && fotoPareja.nombre) {
        fotoPareja.ruta = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/beneficiarios/parejas/${fotoPareja.nombre}`;
        console.log(`📸 Foto pareja - construyendo URL desde nombre`);
      }
    }

    // Construir respuesta COMPLETA
    const respuesta = {
      _id: beneficiario._id,
      nombre: beneficiario.nombre,
      apellido: beneficiario.apellido,
      genero: beneficiario.genero,
      estado_civil: beneficiario.estado_civil,
      fecha_nacimiento: beneficiario.fecha_nacimiento,
      pais: beneficiario.pais,
      estado_provincia: beneficiario.estado_provincia,
      ciudad: beneficiario.ciudad,
      correo: beneficiario.correo || beneficiario.usuario_id?.correo,
      telefono: beneficiario.telefono,
      nacionalidad: beneficiario.nacionalidad,
      direccion: beneficiario.direccion,
      
      // ⭐ PAREJA TRANSFORMADA
      pareja: parejaTransformada,
      
      // ⭐ IDIOMA Y FOTOS CON RUTAS
      idioma_preferencia: beneficiario.idioma_preferencia,
      foto_identificacion_beneficiario: fotoBeneficiario,
      foto_identificacion_pareja: fotoPareja,
      
      // Estado
      estado_id: beneficiario.estado_id,
      
      // Código
      llave_unica: beneficiario.llave_unica,
      codigo: beneficiario.codigo,
      
      // Servicios
      servicios: beneficiario.servicios || [],
      
      // ⭐ SUCURSAL RESUELTA
      sucursal: sucursalInfo,
      sucursal_nombre: sucursalInfo?.nombre,
      sucursal_correo: sucursalInfo?.correo,
      sucursal_telefono: sucursalInfo?.telefono,
      
      // Aliado
      aliado_id: beneficiario.aliado_id?._id,
      aliado_nombre: beneficiario.aliado_id?.nombre,
      aliado_telefono: beneficiario.aliado_id?.telefono,
      aliado_correo: beneficiario.aliado_id?.correo,
      hotel_aliado: hotelAliadoNombre,
      aliado_sucursal: beneficiario.aliado_sucursal,
      
      // Financiero
      enganche_pagado: beneficiario.enganche_pagado,
      
      // ⭐ MEMBRESÍA COMPLETA
      membresia: {
        ...beneficiario.membresia,
        vigencia_anos: beneficiario.vigencia_membresia_anos || beneficiario.membresia?.vigencia_anos || 1
      },
      vigencia_membresia_anos: beneficiario.vigencia_membresia_anos,
      
      // ⭐ CAMPOS ADMINISTRATIVOS
      director: beneficiario.director,
      gerente: beneficiario.gerente,
      cerrador: beneficiario.cerrador,
      colaborador_bnp: beneficiario.colaborador_bnp,
      departamento: beneficiario.departamento,
      fecha_registro: beneficiario.fecha_registro,
      monto_venta: beneficiario.monto_venta,
      
      // ⭐ FECHAS IMPORTANTES
      fecha_creacion: beneficiario.createdAt || beneficiario.fecha_creacion,
      createdAt: beneficiario.createdAt,
      updatedAt: beneficiario.updatedAt,
      
      // Usuario
      usuario_id: beneficiario.usuario_id,
      nombre_usuario: beneficiario.usuario_id?.nombre_usuario,
      
      // Estado nombre
      estado_nombre: beneficiario.estado_id?.nombre || 'Sin estado asignado'
    };

    console.log(`📤 Enviando respuesta completa:`);
    console.log(`   - Pareja: ${respuesta.pareja?.nombre_completo || 'Sin pareja'}`);
    console.log(`   - Sucursal: ${respuesta.sucursal_nombre || 'No asignada'}`);
    console.log(`   - Foto beneficiario: ${respuesta.foto_identificacion_beneficiario?.ruta ? 'CON RUTA ✅' : 'SIN RUTA ❌'}`);
    console.log(`   - Foto pareja: ${respuesta.foto_identificacion_pareja?.ruta ? 'CON RUTA ✅' : 'SIN RUTA ❌'}`);
    console.log(`   - Fecha creación: ${respuesta.fecha_creacion}`);
    console.log(`   - Idioma: ${respuesta.idioma_preferencia}`);

    res.json(respuesta);
  } catch (error) {
    console.error("❌ Error al obtener beneficiario específico:", error);
    res.status(500).json({ error: "Error al obtener beneficiario" });
  }
});

// Actualizar beneficiario del aliado
router.put("/beneficiario/:id", checkAuth, isAliado, async (req, res) => {
  console.log("=== 🔄 ACTUALIZACIÓN DE BENEFICIARIO POR ALIADO ===");
  console.log("Aliado:", req.aliado.nombre);
  console.log("Beneficiario ID:", req.params.id);

  try {
    const { id } = req.params;
    const aliado_id = req.aliado._id;
    const datosActualizacion = req.body;

    // Verificar que el beneficiario pertenezca al aliado
    const beneficiario = await Beneficiario.findOne({
      _id: id,
      aliado_id: aliado_id,
    }).populate("estado_id", "nombre");

    if (!beneficiario) {
      return res.status(404).json({
        error: "Beneficiario no encontrado o no pertenece a este aliado",
      });
    }

    const nombreCompleto = `${beneficiario.nombre} ${
      beneficiario.apellido || ""
    }`.trim();
    console.log("📝 Actualizando beneficiario:", nombreCompleto);

    // Campos que el aliado puede actualizar
    const camposPermitidos = [
      "telefono",
      "nacionalidad",
      "direccion",
      "pais",
      "estado_provincia",
      "ciudad",
      "sucursal",
      "aliado_sucursal",
      "enganche_pagado",
      "pareja",
      "estado_id",
      "servicios",
    ];

    let actualizado = false;
    let serviciosAnteriores = [...(beneficiario.servicios || [])];
    let estadoAnterior = beneficiario.estado_id?.nombre || "Sin estado";
    let cambiosRealizados = [];

    for (const campo of camposPermitidos) {
      if (datosActualizacion[campo] !== undefined) {
        if (campo === "estado_id" && datosActualizacion[campo]) {
          // Validar que el estado existe
          const estadoExiste = await Estado.findOne({
            _id: datosActualizacion[campo],
            tipo: "BENEFICIARIO",
          });
          if (estadoExiste) {
            beneficiario[campo] = datosActualizacion[campo];
            // Agregar al historial
            beneficiario.historialEstados.push({
              estado_id: datosActualizacion[campo],
              motivo: `Actualización por aliado ${req.aliado.nombre}`,
              fecha: new Date(),
            });
            cambiosRealizados.push(
              `Estado: ${estadoAnterior} → ${estadoExiste.nombre}`
            );
            actualizado = true;
          }
        } else if (
          campo === "servicios" &&
          Array.isArray(datosActualizacion[campo])
        ) {
          // Validar servicios
          const serviciosValidos = await Servicio.find({
            _id: { $in: datosActualizacion[campo] },
            $or: [{ tipoUsuario: "beneficiario" }, { tipoUsuario: "ambos" }],
          });

          if (serviciosValidos.length > 0) {
            beneficiario.servicios = serviciosValidos.map((s) => s._id);
            cambiosRealizados.push(
              `Servicios: ${serviciosAnteriores.length} → ${serviciosValidos.length}`
            );
            actualizado = true;
          }
        } else {
          beneficiario[campo] = datosActualizacion[campo];
          cambiosRealizados.push(`${campo}: actualizado`);
          actualizado = true;
        }
      }
    }

    // Sincronizar campos relacionados
    if (datosActualizacion.sucursal) {
      beneficiario.aliado_sucursal = datosActualizacion.sucursal;
    }

    if (actualizado) {
      await beneficiario.save();
      console.log("✅ Beneficiario actualizado en BD");

      // Registrar cambios en servicios si hubo cambios
      if (datosActualizacion.servicios !== undefined) {
        try {
          const serviciosActuales = beneficiario.servicios.map((id) =>
            id.toString()
          );
          const serviciosAnterioresStr = serviciosAnteriores.map((id) =>
            id.toString()
          );

          // Servicios agregados
          const serviciosAgregados = serviciosActuales.filter(
            (id) => !serviciosAnterioresStr.includes(id)
          );
          // Servicios removidos
          const serviciosRemovidos = serviciosAnterioresStr.filter(
            (id) => !serviciosActuales.includes(id)
          );

          // Registrar activaciones
          if (serviciosAgregados.length > 0) {
            await registrarHistorialServicios(
              beneficiario.usuario_id,
              serviciosAgregados,
              "activado",
              `Aliado: ${req.aliado.nombre}`
            );
          }

          // Registrar desactivaciones
          if (serviciosRemovidos.length > 0) {
            await registrarHistorialServicios(
              beneficiario.usuario_id,
              serviciosRemovidos,
              "desactivado",
              `Aliado: ${req.aliado.nombre}`
            );
          }
        } catch (error) {
          console.error(
            "Error registrando historial de cambios en servicios:",
            error
          );
        }
      }

      // 🎯 REGISTRAR ACTUALIZACIÓN EN BITÁCORA
      console.log("📋 Registrando actualización en bitácora...");
      try {
        await registrarActividad(
          "beneficiario_actualizado",
          `Beneficiario actualizado por aliado: ${nombreCompleto} - Cambios: ${cambiosRealizados.join(
            ", "
          )}`,
          {
            entidad_tipo: "beneficiario",
            entidad_id: beneficiario._id,
            entidad_nombre: nombreCompleto,
            beneficiario_relacionado: {
              id: beneficiario._id,
              nombre: nombreCompleto,
              codigo: beneficiario.llave_unica || beneficiario.codigo?.value,
            },
            aliado_relacionado: {
              id: req.aliado._id,
              nombre: req.aliado.nombre,
            },
            datos_nuevos: datosActualizacion,
            parametros_accion: {
              metodo: "actualizacion_por_aliado",
              endpoint: req.originalUrl,
              timestamp: new Date().toISOString(),
              campos_modificados: Object.keys(datosActualizacion),
            },
            etiquetas: ["beneficiario", "actualizacion", "aliado"],
            datos_extra: {
              cambios_realizados: cambiosRealizados,
              campos_actualizados: Object.keys(datosActualizacion),
            },
          },
          req
        );
        console.log("🎉 ✅ ACTUALIZACIÓN REGISTRADA EN BITÁCORA");
      } catch (bitacoraError) {
        console.error(
          "❌ Error registrando actualización en bitácora:",
          bitacoraError
        );
      }

      // Obtener beneficiario actualizado con poblaciones
      const beneficiarioActualizado = await Beneficiario.findById(id)
        .populate("estado_id", "nombre codigo")
        .populate("sucursal", "nombre direccion")
        .populate("servicios", "nombre descripcion");

      res.json({
        mensaje: "Beneficiario actualizado correctamente",
        beneficiario: beneficiarioActualizado,
      });
    } else {
      res.status(400).json({
        error: "No se proporcionaron campos válidos para actualizar",
      });
    }
  } catch (error) {
    console.error("❌ Error al actualizar beneficiario:", error);
    res.status(500).json({ error: "Error al actualizar beneficiario" });
  }
});

// Obtener estadísticas de beneficiarios del aliado
router.get("/estadisticas", checkAuth, isAliado, async (req, res) => {
  try {
    const aliado_id = req.aliado._id;

    // Estadísticas básicas
    const totalBeneficiarios = await Beneficiario.countDocuments({ aliado_id });

    // Beneficiarios por estado
    const beneficiariosPorEstado = await Beneficiario.aggregate([
      { $match: { aliado_id: new mongoose.Types.ObjectId(aliado_id) } },
      {
        $lookup: {
          from: "estados",
          localField: "estado_id",
          foreignField: "_id",
          as: "estado",
        },
      },
      { $unwind: { path: "$estado", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$estado.nombre",
          count: { $sum: 1 },
        },
      },
    ]);

    // Beneficiarios creados en los últimos 30 días
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const beneficiariosRecientes = await Beneficiario.countDocuments({
      aliado_id,
      createdAt: { $gte: hace30Dias },
    });

    res.json({
      total_beneficiarios: totalBeneficiarios,
      beneficiarios_recientes: beneficiariosRecientes,
      beneficiarios_por_estado: beneficiariosPorEstado,
    });
  } catch (error) {
    console.error("Error al obtener estadísticas:", error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

export default router;