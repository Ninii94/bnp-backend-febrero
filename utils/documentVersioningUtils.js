import crypto from "crypto";
import fs from "fs";

export const generarHashArchivo = (filePath) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  } catch (error) {
    console.error('Error al generar hash del archivo:', error);
    return null;
  }
};

export const verificarIntegridadArchivo = (filePath, hashOriginal) => {
  try {
    const hashActual = generarHashArchivo(filePath);
    return {
      integro: hashActual === hashOriginal,
      hash_original: hashOriginal,
      hash_actual: hashActual,
      fecha_verificacion: new Date()
    };
  } catch (error) {
    return {
      integro: false,
      error: error.message,
      fecha_verificacion: new Date()
    };
  }
};

export const crearVersionDocumento = (archivoInfo, usuarioId, ipCliente, razon = 'Carga inicial') => {
  return {
    version_numero: 1,
    fecha_creacion: new Date(),
    archivo: {
      nombre: archivoInfo.nombre,
      url: archivoInfo.url,
      ruta: archivoInfo.ruta,
      tamano: archivoInfo.tamano,
      hash_sha256: archivoInfo.hash
    },
    validez_legal_brasil: {
      hash_archivo: archivoInfo.hash,
      timestamp_upload: new Date(),
      ip_origen: ipCliente,
      usuario_id: usuarioId,
      pais_jurisdiccion: 'BR',
      cumple_lgpd: true,
      certificado_integridad: true
    },
    metadata: {
      tipo_operacion: razon === 'Carga inicial' || razon === 'Carga inicial del contrato firmado' ? 'CREACION_INICIAL' : 'ACTUALIZACION',
      motivo: razon,
      usuario_modificador: usuarioId
    }
  };
};

export const registrarNuevaVersion = (
  versionesAnteriores, 
  nuevoArchivo, 
  usuarioId, 
  ipCliente, 
  motivoCambio
) => {
  const ultimaVersion = versionesAnteriores[versionesAnteriores.length - 1];
  const numeroVersion = ultimaVersion ? ultimaVersion.version_numero + 1 : 1;

  return {
    version_numero: numeroVersion,
    fecha_creacion: new Date(),
    archivo: {
      nombre: nuevoArchivo.nombre,
      url: nuevoArchivo.url,
      ruta: nuevoArchivo.ruta,
      tamano: nuevoArchivo.tamano,
      hash_sha256: nuevoArchivo.hash
    },
    validez_legal_brasil: {
      hash_archivo: nuevoArchivo.hash,
      timestamp_upload: new Date(),
      ip_origen: ipCliente,
      usuario_id: usuarioId,
      pais_jurisdiccion: 'BR',
      cumple_lgpd: true,
      certificado_integridad: true,
      hash_version_anterior: ultimaVersion?.archivo.hash_sha256 || null
    },
    metadata: {
      tipo_operacion: 'ACTUALIZACION',
      motivo: motivoCambio || 'Actualización de documento',
      usuario_modificador: usuarioId,
      version_anterior: ultimaVersion?.version_numero || 0
    }
  };
};

export const generarCertificadoLGPD = (contrato) => {
  const versiones = contrato.versiones_documento || [];
  const versionActual = versiones[versiones.length - 1];
  
  if (!versionActual) return null;

  return {
    numero_contrato: contrato.numero_contrato,
    tipo_documento: 'CONTRATO_BENEFICIARIO',
    
    informacion_version_actual: {
      version: versionActual.version_numero,
      hash_sha256: versionActual.archivo.hash_sha256,
      fecha_carga: versionActual.fecha_creacion,
      tamaño_bytes: versionActual.archivo.tamano
    },
    
    trazabilidad_completa: {
      total_versiones: versiones.length,
      total_modificaciones: versiones.length - 1,
      historial_hashes: versiones.map(v => ({
        version: v.version_numero,
        hash: v.archivo.hash_sha256,
        fecha: v.fecha_creacion,
        ip: v.validez_legal_brasil.ip_origen
      }))
    },
    
    cumplimiento_lgpd: {
      cumple_requisitos: true,
      fecha_emision_certificado: new Date(),
      pais_jurisdiccion: 'BR',
      integridad_verificada: true,
      cadena_custodia_completa: versiones.length > 0
    },
    
    datos_validacion: {
      primera_carga: versiones[0]?.fecha_creacion,
      ultima_modificacion: versionActual.fecha_creacion,
      usuario_ultima_modificacion: versionActual.metadata.usuario_modificador,
      ip_ultima_modificacion: versionActual.validez_legal_brasil.ip_origen
    }
  };
};

export const compararVersiones = (version1, version2) => {
  return {
    versiones_comparadas: {
      version_antigua: version1.version_numero,
      version_nueva: version2.version_numero
    },
    cambios_detectados: {
      hash_cambio: version1.archivo.hash_sha256 !== version2.archivo.hash_sha256,
      tamaño_cambio: version1.archivo.tamano !== version2.archivo.tamano,
      nombre_cambio: version1.archivo.nombre !== version2.archivo.nombre
    },
    diferencia_temporal: {
      dias: Math.floor((new Date(version2.fecha_creacion) - new Date(version1.fecha_creacion)) / (1000 * 60 * 60 * 24)),
      fecha_version1: version1.fecha_creacion,
      fecha_version2: version2.fecha_creacion
    },
    metadata: {
      motivo_cambio: version2.metadata.motivo,
      usuario: version2.metadata.usuario_modificador
    }
  };
};