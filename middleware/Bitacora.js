import { ActividadBitacora } from "../models/ActividadBitacora.js";

// Función principal para registrar actividades
export const registrarActividad = async (
  tipo,
  descripcion,
  opciones = {},
  req = null,
  nivelCriticidad = null
) => {
  try {
    const {
      entidad_tipo = null,
      entidad_id = null,
      entidad_nombre = null,
      aliado_relacionado = null,
      beneficiario_relacionado = null,
      servicio_relacionado = null,
      sucursal_relacionada = null,
      ticket_info = null,
      datos_anteriores = null,
      datos_nuevos = null,
      parametros_accion = null,
      requiere_revision = false,
      etiquetas = [],
      notas_internas = null,
      datos_extra = null,
    } = opciones;

    // 🔥 LOG CRÍTICO: Verificar que los datos llegan correctamente
    console.log('[registrarActividad] Datos recibidos:', {
      tipo,
      tiene_datos_nuevos: !!datos_nuevos,
      keys_datos_nuevos: datos_nuevos ? Object.keys(datos_nuevos) : [],
      tamano_json: datos_nuevos ? JSON.stringify(datos_nuevos).length : 0
    });

    const auditoriaData = {
      requiere_revision,
      etiquetas,
      notas_internas,
    };

    if (nivelCriticidad) {
      auditoriaData.nivel_criticidad = nivelCriticidad;
    }

    // 🔥 CAMBIO CRÍTICO: Construir el objeto metadata correctamente
    const metadataCompleto = {
      entidad_tipo,
      entidad_id,
      entidad_nombre,
      datos_anteriores,
      datos_nuevos, 
      parametros_accion,
      ip_origen: req?.ip,
      user_agent: req?.get("User-Agent"),
      metodo_http: req?.method,
      url_endpoint: req?.originalUrl,
      aliado_relacionado,
      beneficiario_relacionado,
      servicio_relacionado,
      sucursal_relacionada,
      ticket_info,
    };

    // 🔥 LOG: Verificar metadata antes de guardar
    console.log('[registrarActividad] Metadata a guardar:', {
      tiene_datos_nuevos: !!metadataCompleto.datos_nuevos,
      keys_metadata: Object.keys(metadataCompleto),
      tamano_datos_nuevos: metadataCompleto.datos_nuevos 
        ? JSON.stringify(metadataCompleto.datos_nuevos).length 
        : 0
    });

    const nuevaActividad = await ActividadBitacora.crearActividad({
      tipo,
      descripcion,
      metadata: metadataCompleto, // ← Pasar el objeto completo
      usuario: req?.usuario
        ? {
            id: req.usuario._id,
            nombre_usuario: req.usuario.nombre_usuario,
            tipo: req.usuario.tipo,
            correo: req.usuario.correo,
          }
        : null,
      auditoria: auditoriaData,
      datos_extra,
    });

    // 🔥 VERIFICACIÓN POST-GUARDADO: Confirmar que se guardó
    console.log('[registrarActividad] ✅ Actividad guardada:', {
      _id: nuevaActividad._id,
      tipo: nuevaActividad.tipo,
      tiene_metadata: !!nuevaActividad.metadata,
      tiene_datos_nuevos: !!nuevaActividad.metadata?.datos_nuevos,
      keys_datos_guardados: nuevaActividad.metadata?.datos_nuevos 
        ? Object.keys(nuevaActividad.metadata.datos_nuevos).length 
        : 0
    });

    // 🔥 VERIFICACIÓN EXTRA: Leer directamente de la BD
    if (tipo.includes('ticket')) {
      setTimeout(async () => {
        try {
          const actividadVerificada = await ActividadBitacora.findById(nuevaActividad._id).lean();
          console.log('[registrarActividad] 🔍 Verificación en BD:', {
            _id: actividadVerificada._id,
            tiene_metadata: !!actividadVerificada.metadata,
            tiene_datos_nuevos: !!actividadVerificada.metadata?.datos_nuevos,
            keys_en_bd: actividadVerificada.metadata?.datos_nuevos 
              ? Object.keys(actividadVerificada.metadata.datos_nuevos).length 
              : 0,
            primeros_campos: actividadVerificada.metadata?.datos_nuevos 
              ? Object.keys(actividadVerificada.metadata.datos_nuevos).slice(0, 5) 
              : []
          });
        } catch (err) {
          console.error('[registrarActividad] Error en verificación:', err);
        }
      }, 200);
    }

    console.log(`[BITÁCORA] ✅ Actividad registrada: ${tipo} - ${descripcion} - Criticidad: ${nivelCriticidad || 'auto'}`);
    return nuevaActividad;
  } catch (error) {
    console.error("[BITÁCORA] ❌ Error al registrar actividad:", error);
    console.error("[BITÁCORA] Stack:", error.stack);
    return null;
  }
};
export const registrarDocumentoViaje = (req, res, next) => {
  console.log("=== 📄 MIDDLEWARE DOCUMENTO VIAJE ESPECÍFICO ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Método:", req.method, "Path:", req.path);
  console.log("URL completa:", req.originalUrl);
  console.log("Body recibido:", JSON.stringify(req.body, null, 2));
  console.log(
    "Archivo recibido:",
    req.file
      ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          filename: req.file.filename,
        }
      : "No hay archivo"
  );
  console.log("Usuario:", req.usuario?.nombre_usuario || "NO AUTH");
  console.log("Tipo usuario:", req.tipo);

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA DOCUMENTO VIAJE INTERCEPTADA ===");
    console.log("Status code:", res.statusCode);
    console.log(
      "Data preview:",
      typeof data === "string"
        ? data.substring(0, 300)
        : JSON.stringify(data).substring(0, 300)
    );

    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        console.log("Response data parseada:", responseData);

        const tipo = req.body.tipo || responseData.tipo;
        const numero = req.body.numero || responseData.numero;
        const nombre = req.body.nombre || responseData.nombre;
        const pais = req.body.pais || responseData.pais;
        const beneficiario_id =
          req.body.beneficiario_id || responseData.beneficiario_id;
        const fecha_emision =
          req.body.fecha_emision || responseData.fecha_emision;
        const fecha_vencimiento =
          req.body.fecha_vencimiento || responseData.fecha_vencimiento;

        const archivo_info = req.file
          ? {
              nombre_original: req.file.originalname,
              nombre_servidor: req.file.filename,
              tamaño: req.file.size,
              tipo_mime: req.file.mimetype,
            }
          : null;

        console.log("📊 Datos documento extraídos:", {
          tipo,
          numero,
          nombre,
          pais,
          beneficiario_id,
          archivo_info,
        });

        if (tipo && archivo_info) {
          console.log(
            "✅ DOCUMENTO DE VIAJE ENCONTRADO - Registrando subida:",
            tipo
          );

          setImmediate(async () => {
            try {
              let beneficiario_relacionado = null;
              if (beneficiario_id) {
                try {
                  const { Beneficiario } = await import(
                    "../models/Beneficiario.js"
                  );
                  const beneficiario = await Beneficiario.findById(
                    beneficiario_id
                  );
                  if (beneficiario) {
                    beneficiario_relacionado = {
                      id: beneficiario._id,
                      nombre: `${beneficiario.nombre} ${
                        beneficiario.apellido || ""
                      }`.trim(),
                      codigo:
                        beneficiario.codigo?.value || beneficiario.llave_unica,
                    };
                    console.log(
                      "👤 Beneficiario encontrado:",
                      beneficiario_relacionado.nombre
                    );
                  }
                } catch (error) {
                  console.error(
                    "Error buscando beneficiario para documento:",
                    error
                  );
                }
              }

              if (req.tipo === "beneficiario" && !beneficiario_relacionado) {
                try {
                  const { Usuario } = await import("../models/Usuario.js");
                  const { Beneficiario } = await import(
                    "../models/Beneficiario.js"
                  );

                  const usuario = await Usuario.findById(req.usuario.id);
                  if (usuario?.beneficiario_id) {
                    const beneficiario = await Beneficiario.findById(
                      usuario.beneficiario_id
                    );
                    if (beneficiario) {
                      beneficiario_relacionado = {
                        id: beneficiario._id,
                        nombre: `${beneficiario.nombre} ${
                          beneficiario.apellido || ""
                        }`.trim(),
                        codigo:
                          beneficiario.codigo?.value ||
                          beneficiario.llave_unica,
                      };
                    }
                  } else {
                    const beneficiario = await Beneficiario.findOne({
                      usuario_id: req.usuario.id,
                    });
                    if (beneficiario) {
                      beneficiario_relacionado = {
                        id: beneficiario._id,
                        nombre: `${beneficiario.nombre} ${
                          beneficiario.apellido || ""
                        }`.trim(),
                        codigo:
                          beneficiario.codigo?.value ||
                          beneficiario.llave_unica,
                      };
                    }
                  }
                  console.log(
                    "👤 Beneficiario propio encontrado:",
                    beneficiario_relacionado?.nombre
                  );
                } catch (error) {
                  console.error(
                    "Error buscando perfil propio de beneficiario:",
                    error
                  );
                }
              }

              let nombreDocumento = "";
              switch (tipo) {
                case "Contrato":
                  nombreDocumento = "Contrato firmado con BNP";
                  break;
                case "ContratoAliado":
                  nombreDocumento = "Contrato firmado con el Aliado";
                  break;
                case "IdentificacionAliado":
                  nombreDocumento = "Identificación del Aliado";
                  break;
                case "ComprobanteReserva":
                  nombreDocumento =
                    "Comprobante de reserva (Certificados aéreos)";
                  break;
                case "ComprobantePago":
                  nombreDocumento = "Comprobante de pago anticipado";
                  break;
                case "Otro":
                  nombreDocumento = nombre || "Documento personalizado";
                  break;
                default:
                  nombreDocumento = tipo;
              }

              const resultado = await registrarActividad(
                "documento_subido",
                `Documento de viaje subido: ${nombreDocumento}${
                  numero ? ` (${numero})` : ""
                }${
                  beneficiario_relacionado
                    ? ` - Beneficiario: ${beneficiario_relacionado.nombre}`
                    : ""
                } - País: ${pais} (${archivo_info.nombre_original})`,
                {
                  entidad_tipo: "documento",
                  entidad_id: responseData._id || responseData.id,
                  entidad_nombre: nombreDocumento,
                  beneficiario_relacionado,
                  datos_nuevos: {
                    tipo,
                    numero,
                    nombre: tipo === "Otro" ? nombre : undefined,
                    pais,
                    fecha_emision,
                    fecha_vencimiento,
                    archivo: {
                      nombre_original: archivo_info.nombre_original,
                      tamaño_mb: (archivo_info.tamaño / (1024 * 1024)).toFixed(
                        2
                      ),
                      tipo_mime: archivo_info.tipo_mime,
                    },
                    beneficiario_id,
                    subido_por: req.tipo,
                  },
                  parametros_accion: {
                    metodo: "subida_documento_viaje",
                    endpoint: req.originalUrl,
                    tipo_documento: tipo,
                    metodo_acceso:
                      req.tipo === "beneficiario"
                        ? "autosubida"
                        : "subida_equipo",
                    timestamp: new Date().toISOString(),
                  },
                  etiquetas: [
                    "documento",
                    "viaje",
                    "subida",
                    "archivo",
                    "beneficiario",
                    tipo.toLowerCase(),
                    req.tipo,
                  ],
                  datos_extra: {
                    respuesta_servidor:
                      responseData.mensaje ||
                      responseData.message ||
                      "Documento subido exitosamente",
                    respuesta_completa: responseData,
                    request_original: req.body,
                    archivo_detalles: archivo_info,
                    usuario_tipo: req.tipo,
                    status_code: res.statusCode,
                  },
                },
                req
              );
              console.log(
                "🎉✅✅✅ DOCUMENTO VIAJE REGISTRADO EXITOSAMENTE EN BITÁCORA:",
                resultado?._id
              );
            } catch (error) {
              console.error(
                "❌❌❌ ERROR al registrar documento viaje en bitácora:",
                error
              );
              console.error("Stack trace:", error.stack);
            }
          });
        } else {
          console.log(
            "⚠️⚠️⚠️ No se encontraron datos suficientes del documento viaje"
          );
          console.log("Body keys disponibles:", Object.keys(req.body || {}));
          console.log(
            "Response keys disponibles:",
            Object.keys(responseData || {})
          );
          console.log("Archivo presente:", !!req.file);
        }
      } catch (error) {
        console.error(
          "❌ Error al procesar respuesta de documento viaje para bitácora:",
          error
        );
        console.error("Stack trace:", error.stack);
      }
    } else {
      console.log(
        "⚠️ Status code no exitoso para documento viaje, no se registrará:",
        res.statusCode
      );
    }

    originalSend.call(this, data);
  };

  console.log(
    "Middleware de documento viaje configurado, pasando al siguiente..."
  );
  next();
};

// ===============================================
// MIDDLEWARE PARA ACTUALIZACIÓN DE DOCUMENTOS VIAJE
// ===============================================
export const registrarActualizacionDocumentoViaje = (req, res, next) => {
  console.log("=== 🔄 MIDDLEWARE ACTUALIZACIÓN DOCUMENTO VIAJE ===");
  console.log("Documento ID:", req.params.id);
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log(
    "Archivo nuevo:",
    req.file ? req.file.originalname : "Sin archivo nuevo"
  );

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA ACTUALIZACIÓN DOCUMENTO INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        const documentoId = req.params.id;
        const tipo = req.body.tipo || responseData.tipo;
        const numero = req.body.numero || responseData.numero;
        const nombre = req.body.nombre || responseData.nombre;

        setImmediate(async () => {
          try {
            // Buscar el documento actualizado para obtener información del beneficiario
            let beneficiario_relacionado = null;
            try {
              const { Documento } = await import("../models/Documentos.js");
              const { Beneficiario } = await import(
                "../models/Beneficiario.js"
              );

              const documento = await Documento.findById(documentoId);
              if (documento && documento.beneficiario_id) {
                const beneficiario = await Beneficiario.findById(
                  documento.beneficiario_id
                );
                if (beneficiario) {
                  beneficiario_relacionado = {
                    id: beneficiario._id,
                    nombre: `${beneficiario.nombre} ${
                      beneficiario.apellido || ""
                    }`.trim(),
                    codigo:
                      beneficiario.codigo?.value || beneficiario.llave_unica,
                  };
                }
              }
            } catch (error) {
              console.error("Error buscando documento/beneficiario:", error);
            }

            // Determinar nombre del documento
            let nombreDocumento = "";
            switch (tipo) {
              case "Contrato":
                nombreDocumento = "Contrato firmado con BNP";
                break;
              case "ContratoAliado":
                nombreDocumento = "Contrato firmado con el Aliado";
                break;
              case "IdentificacionAliado":
                nombreDocumento = "Identificación del Aliado";
                break;
              case "ComprobanteReserva":
                nombreDocumento = "Comprobante de reserva";
                break;
              case "ComprobantePago":
                nombreDocumento = "Comprobante de pago anticipado";
                break;
              case "Otro":
                nombreDocumento = nombre || "Documento personalizado";
                break;
              default:
                nombreDocumento = tipo;
            }

            await registrarActividad(
              "documento_actualizado",
              `Documento de viaje actualizado: ${nombreDocumento}${
                numero ? ` (${numero})` : ""
              }${
                beneficiario_relacionado
                  ? ` - Beneficiario: ${beneficiario_relacionado.nombre}`
                  : ""
              }${
                req.file
                  ? ` - Archivo reemplazado: ${req.file.originalname}`
                  : ""
              }`,
              {
                entidad_tipo: "documento",
                entidad_id: documentoId,
                entidad_nombre: nombreDocumento,
                beneficiario_relacionado,
                datos_nuevos: {
                  ...req.body,
                  archivo_actualizado: !!req.file,
                  archivo_nuevo: req.file
                    ? {
                        nombre: req.file.originalname,
                        tamaño: req.file.size,
                        tipo: req.file.mimetype,
                      }
                    : null,
                  campos_actualizados: Object.keys(req.body),
                },
                parametros_accion: {
                  metodo: "actualizacion_documento_viaje",
                  endpoint: req.originalUrl,
                  documento_id: documentoId,
                  campos_modificados: Object.keys(req.body).length,
                  archivo_modificado: !!req.file,
                  timestamp: new Date().toISOString(),
                },
                etiquetas: [
                  "documento",
                  "viaje",
                  "actualizacion",
                  "modificacion",
                  tipo.toLowerCase(),
                ],
                datos_extra: {
                  respuesta_completa: responseData,
                  request_original: req.body,
                  archivo_info: req.file
                    ? {
                        nombre: req.file.originalname,
                        tamaño: req.file.size,
                        tipo: req.file.mimetype,
                      }
                    : null,
                },
              },
              req
            );
            console.log(
              "✅ ACTUALIZACIÓN DOCUMENTO VIAJE REGISTRADA:",
              nombreDocumento
            );
          } catch (error) {
            console.error(
              "💥 ERROR registrando actualización documento viaje:",
              error
            );
          }
        });
      } catch (error) {
        console.error(
          "💥 Error procesando actualización documento viaje:",
          error
        );
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// ===============================================
// MIDDLEWARE PARA ELIMINACIÓN DE DOCUMENTOS VIAJE
// ===============================================
export const registrarEliminacionDocumentoViaje = (req, res, next) => {
  console.log("=== 🗑️ MIDDLEWARE ELIMINACIÓN DOCUMENTO VIAJE ===");
  console.log("Documento ID:", req.params.id);

  // Obtener información del documento ANTES de eliminarlo
  let documentoInfo = null;

  setImmediate(async () => {
    try {
      const { Documento } = await import("../models/Documentos.js");
      const { Beneficiario } = await import("../models/Beneficiario.js");

      const documento = await Documento.findById(req.params.id);
      if (documento) {
        documentoInfo = {
          tipo: documento.tipo,
          numero: documento.numero,
          nombre: documento.nombre,
          pais: documento.pais,
          beneficiario_id: documento.beneficiario_id,
        };

        // Buscar beneficiario
        if (documento.beneficiario_id) {
          const beneficiario = await Beneficiario.findById(
            documento.beneficiario_id
          );
          if (beneficiario) {
            documentoInfo.beneficiario = {
              id: beneficiario._id,
              nombre: `${beneficiario.nombre} ${
                beneficiario.apellido || ""
              }`.trim(),
              codigo: beneficiario.codigo?.value || beneficiario.llave_unica,
            };
          }
        }
      }
    } catch (error) {
      console.error(
        "Error obteniendo información del documento antes de eliminar:",
        error
      );
    }
  });

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA ELIMINACIÓN DOCUMENTO INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200) {
      setImmediate(async () => {
        try {
          if (documentoInfo) {
            // Determinar nombre del documento
            let nombreDocumento = "";
            switch (documentoInfo.tipo) {
              case "Contrato":
                nombreDocumento = "Contrato firmado con BNP";
                break;
              case "ContratoAliado":
                nombreDocumento = "Contrato firmado con el Aliado";
                break;
              case "IdentificacionAliado":
                nombreDocumento = "Identificación del Aliado";
                break;
              case "ComprobanteReserva":
                nombreDocumento = "Comprobante de reserva";
                break;
              case "ComprobantePago":
                nombreDocumento = "Comprobante de pago anticipado";
                break;
              case "Otro":
                nombreDocumento =
                  documentoInfo.nombre || "Documento personalizado";
                break;
              default:
                nombreDocumento = documentoInfo.tipo;
            }

            await registrarActividad(
              "documento_eliminado",
              `Documento de viaje eliminado: ${nombreDocumento}${
                documentoInfo.numero ? ` (${documentoInfo.numero})` : ""
              }${
                documentoInfo.beneficiario
                  ? ` - Beneficiario: ${documentoInfo.beneficiario.nombre}`
                  : ""
              }`,
              {
                entidad_tipo: "documento",
                entidad_id: req.params.id,
                entidad_nombre: nombreDocumento,
                beneficiario_relacionado: documentoInfo.beneficiario,
                datos_anteriores: {
                  tipo: documentoInfo.tipo,
                  numero: documentoInfo.numero,
                  nombre: documentoInfo.nombre,
                  pais: documentoInfo.pais,
                },
                parametros_accion: {
                  metodo: "eliminacion_documento_viaje",
                  endpoint: req.originalUrl,
                  documento_id: req.params.id,
                  timestamp: new Date().toISOString(),
                },
                etiquetas: [
                  "documento",
                  "viaje",
                  "eliminacion",
                  "borrado",
                  documentoInfo.tipo.toLowerCase(),
                ],
                datos_extra: {
                  documento_eliminado: documentoInfo,
                  motivo_eliminacion: "solicitud_usuario",
                },
              },
              req
            );
            console.log(
              "✅ ELIMINACIÓN DOCUMENTO VIAJE REGISTRADA:",
              nombreDocumento
            );
          } else {
            console.log(
              "⚠️ No se pudo obtener información del documento eliminado"
            );
          }
        } catch (error) {
          console.error(
            "💥 ERROR registrando eliminación documento viaje:",
            error
          );
        }
      });
    }

    originalSend.call(this, data);
  };

  next();
};

// =====================================
// MIDDLEWARE PARA ALIADOS - MEJORADO
// =====================================
export const registrarNuevoAliado = (req, res, next) => {
  console.log("=== 🏢 MIDDLEWARE ALIADO MEJORADO ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Método:", req.method, "Path:", req.path);
  console.log("Body recibido:", JSON.stringify(req.body, null, 2));
  console.log("Usuario:", req.usuario?.nombre_usuario || "NO AUTH");

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA ALIADO INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        console.log("Response parseada:", responseData);

        // 🔍 BÚSQUEDA EXHAUSTIVA DEL NOMBRE DEL ALIADO
        const nombre =
          req.body.nombre ||
          req.body.name ||
          req.body.razon_social ||
          req.body.business_name ||
          responseData.nombre ||
          responseData.name ||
          responseData.razon_social ||
          responseData.data?.nombre ||
          responseData.aliado?.nombre;

        const ruc =
          req.body.ruc ||
          req.body.documento ||
          responseData.ruc ||
          responseData.documento;

        const servicios =
          req.body.tipo_servicio ||
          req.body.servicios ||
          req.body.services ||
          responseData.servicios ||
          [];

        console.log("📊 Datos extraídos:", { nombre, ruc, servicios });

        if (nombre) {
          console.log(
            "✅ NOMBRE ENCONTRADO - Registrando actividad aliado:",
            nombre
          );

          setImmediate(async () => {
            try {
              const resultado = await registrarActividad(
                "aliado_creado",
                `Nuevo aliado registrado: ${nombre}${
                  ruc ? ` (RUC: ${ruc})` : ""
                }`,
                {
                  entidad_tipo: "aliado",
                  entidad_id: responseData._id || responseData.id,
                  entidad_nombre: nombre,
                  aliado_relacionado: {
                    id: responseData._id || responseData.id,
                    nombre: nombre,
                  },
                  datos_nuevos: {
                    nombre,
                    ruc,
                    razon_social: req.body.razon_social,
                    servicios_count: Array.isArray(servicios)
                      ? servicios.length
                      : 0,
                    telefono: req.body.telefono,
                    correo: req.body.correo,
                  },
                  parametros_accion: {
                    metodo: "api_creacion",
                    endpoint: req.originalUrl,
                    servicios_iniciales: servicios,
                    timestamp: new Date().toISOString(),
                  },
                  etiquetas: ["aliado", "creacion", "registro", "nuevo"],
                  datos_extra: {
                    respuesta_completa: responseData,
                    request_original: req.body,
                    status_code: res.statusCode,
                  },
                },
                req
              );
              console.log("🎉 ALIADO REGISTRADO EN BITÁCORA:", resultado?._id);
            } catch (error) {
              console.error("💥 ERROR registrando aliado en bitácora:", error);
            }
          });
        } else {
          console.log("⚠️ NO SE ENCONTRÓ NOMBRE DE ALIADO");
          console.log("Body keys:", Object.keys(req.body || {}));
          console.log("Response keys:", Object.keys(responseData || {}));
        }
      } catch (error) {
        console.error("💥 Error procesando respuesta aliado:", error);
      }
    } else {
      console.log("❌ Status no exitoso:", res.statusCode);
    }

    originalSend.call(this, data);
  };

  next();
};

// CREACIÓN DE CONTRATOS DIGITALES
export const registrarNuevoContrato = (req, res, next) => {
  console.log("=== 📋 MIDDLEWARE CONTRATO DIGITAL MEJORADO ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Método:", req.method, "Path:", req.path);
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("Usuario:", req.usuario?.nombre_usuario || "NO AUTH");
  console.log("Aliado:", req.aliado?.nombre || "NO ALIADO");

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA CONTRATO INTERCEPTADA ===");
    console.log("Status code:", res.statusCode);
    console.log(
      "Data preview:",
      typeof data === "string"
        ? data.substring(0, 300)
        : JSON.stringify(data).substring(0, 300)
    );

    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        console.log("Response data parseada:", responseData);

        // Extraer información del contrato
        const beneficiario_id = req.body.beneficiario_id;
        const monto = req.body.monto?.valor || req.body.monto;
        const numero_contrato =
          responseData.contrato?.numero_contrato ||
          responseData.numero_contrato;

        console.log("📊 Datos contrato extraídos:", {
          beneficiario_id,
          monto,
          numero_contrato,
        });

        if (beneficiario_id && monto) {
          console.log("✅ CONTRATO ENCONTRADO - Registrando creación");

          setImmediate(async () => {
            try {
              // Buscar información del beneficiario
              let beneficiario_relacionado = null;
              let aliado_relacionado = null;

              if (beneficiario_id) {
                try {
                  const { Beneficiario } = await import(
                    "../models/Beneficiario.js"
                  );
                  const beneficiario = await Beneficiario.findById(
                    beneficiario_id
                  );
                  if (beneficiario) {
                    beneficiario_relacionado = {
                      id: beneficiario._id,
                      nombre: `${beneficiario.nombre} ${
                        beneficiario.apellido || ""
                      }`.trim(),
                      codigo: beneficiario.codigo || beneficiario.llave_unica,
                    };
                    console.log(
                      "👤 Beneficiario encontrado:",
                      beneficiario_relacionado.nombre
                    );
                  }
                } catch (error) {
                  console.error("Error buscando beneficiario:", error);
                }
              }

              // Información del aliado (del middleware isAliado)
              if (req.aliado) {
                aliado_relacionado = {
                  id: req.aliado._id,
                  nombre: req.aliado.nombre,
                };
                console.log("🏢 Aliado encontrado:", aliado_relacionado.nombre);
              }

              const resultado = await registrarActividad(
                "contrato_creado",
                `Contrato creado: ${numero_contrato || "Nuevo contrato"}${
                  beneficiario_relacionado
                    ? ` - Beneficiario: ${beneficiario_relacionado.nombre}`
                    : ""
                }${
                  aliado_relacionado
                    ? ` - Aliado: ${aliado_relacionado.nombre}`
                    : ""
                } (Monto: $${monto})`,
                {
                  entidad_tipo: "contrato",
                  entidad_id: responseData.contrato?._id || responseData._id,
                  entidad_nombre:
                    numero_contrato || `Contrato ${new Date().toISOString()}`,
                  beneficiario_relacionado,
                  aliado_relacionado,
                  datos_nuevos: {
                    numero_contrato,
                    monto,
                    fecha_inicio: req.body.fecha_inicio,
                    fecha_fin: req.body.fecha_fin,
                    metodo_pago: req.body.metodo_pago,
                    servicios_incluidos: req.body.servicios_incluidos,
                    estado: "borrador",
                    tipo_contrato: "digital",
                  },
                  parametros_accion: {
                    metodo: "creacion_contrato_digital",
                    endpoint: req.originalUrl,
                    timestamp: new Date().toISOString(),
                  },
                  etiquetas: [
                    "contrato",
                    "creacion",
                    "digital",
                    "beneficiario",
                  ],
                  datos_extra: {
                    respuesta_servidor:
                      responseData.mensaje ||
                      responseData.message ||
                      "Contrato creado exitosamente",
                    respuesta_completa: responseData,
                    request_original: req.body,
                  },
                },
                req
              );
              console.log(
                "🎉✅✅✅ CONTRATO REGISTRADO EXITOSAMENTE EN BITÁCORA:",
                resultado?._id
              );
            } catch (error) {
              console.error(
                "❌❌❌ ERROR al registrar contrato en bitácora:",
                error
              );
              console.error("Stack trace:", error.stack);
            }
          });
        } else {
          console.log("⚠️⚠️⚠️ No se encontraron datos de contrato suficientes");
        }
      } catch (error) {
        console.error("❌ Error al procesar respuesta de contrato:", error);
      }
    } else {
      console.log("⚠️ Status code no exitoso:", res.statusCode);
    }

    originalSend.call(this, data);
  };

  next();
};

// CONTRATOS MANUALES (SUBIDA DE PDF)
export const registrarContratoManual = (req, res, next) => {
  console.log("=== 📄 MIDDLEWARE CONTRATO MANUAL ===");
  console.log("Archivo:", req.file?.originalname);
  console.log("Tamaño:", req.file?.size);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA CONTRATO MANUAL INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;

        const beneficiario_id = req.body.beneficiario_id;
        const monto = req.body.monto;
        const archivo = req.file;
        const numero_contrato = responseData.numero_contrato;

        if (beneficiario_id && archivo) {
          console.log("✅ CONTRATO MANUAL ENCONTRADO - Registrando subida");

          setImmediate(async () => {
            try {
              // Buscar beneficiario
              let beneficiario_relacionado = null;
              if (beneficiario_id) {
                try {
                  const { Beneficiario } = await import(
                    "../models/Beneficiario.js"
                  );
                  const beneficiario = await Beneficiario.findById(
                    beneficiario_id
                  );
                  if (beneficiario) {
                    beneficiario_relacionado = {
                      id: beneficiario._id,
                      nombre: `${beneficiario.nombre} ${
                        beneficiario.apellido || ""
                      }`.trim(),
                    };
                  }
                } catch (error) {
                  console.error("Error buscando beneficiario:", error);
                }
              }

              // Información del aliado
              let aliado_relacionado = null;
              if (req.aliado) {
                aliado_relacionado = {
                  id: req.aliado._id,
                  nombre: req.aliado.nombre,
                };
              }

              const resultado = await registrarActividad(
                "contrato_creado",
                `Contrato manual subido: ${numero_contrato}${
                  beneficiario_relacionado
                    ? ` - Beneficiario: ${beneficiario_relacionado.nombre}`
                    : ""
                }${
                  aliado_relacionado
                    ? ` - Aliado: ${aliado_relacionado.nombre}`
                    : ""
                } (${archivo.originalname})`,
                {
                  entidad_tipo: "contrato",
                  entidad_nombre: numero_contrato,
                  beneficiario_relacionado,
                  aliado_relacionado,
                  datos_nuevos: {
                    numero_contrato,
                    monto: JSON.parse(monto),
                    tipo_contrato: "manual",
                    estado: "firmado",
                    archivo_nombre: archivo.originalname,
                    archivo_tamaño: archivo.size,
                  },
                  parametros_accion: {
                    metodo: "subida_contrato_manual",
                    endpoint: req.originalUrl,
                    timestamp: new Date().toISOString(),
                  },
                  etiquetas: ["contrato", "manual", "subida", "firmado"],
                  datos_extra: {
                    archivo_info: {
                      nombre: archivo.originalname,
                      tamaño: archivo.size,
                      mimetype: archivo.mimetype,
                    },
                    respuesta_completa: responseData,
                  },
                },
                req
              );
              console.log(
                "🎉 CONTRATO MANUAL REGISTRADO EN BITÁCORA:",
                resultado?._id
              );
            } catch (error) {
              console.error("💥 ERROR registrando contrato manual:", error);
            }
          });
        }
      } catch (error) {
        console.error("💥 Error procesando contrato manual:", error);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// FIRMA DE CONTRATOS
export const registrarFirmaContrato = (req, res, next) => {
  console.log("=== ✍️ MIDDLEWARE FIRMA CONTRATO ===");
  console.log("Token:", req.params.token);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA FIRMA INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        const numero_contrato = responseData.numero_contrato;

        if (numero_contrato) {
          console.log("✅ FIRMA DETECTADA - Registrando:", numero_contrato);

          setImmediate(async () => {
            try {
              const resultado = await registrarActividad(
                "contrato_firmado",
                `Contrato firmado digitalmente: ${numero_contrato}`,
                {
                  entidad_tipo: "contrato",
                  entidad_nombre: numero_contrato,
                  datos_nuevos: {
                    numero_contrato,
                    estado: "firmado",
                    fecha_firma: req.body.fecha_firma || new Date(),
                    metodo_firma: "digital",
                  },
                  parametros_accion: {
                    metodo: "firma_digital_contrato",
                    endpoint: req.originalUrl,
                    token_usado: req.params.token,
                    timestamp: new Date().toISOString(),
                  },
                  etiquetas: ["contrato", "firma", "digital", "completado"],
                  datos_extra: {
                    ip_firma: req.ip,
                    user_agent: req.get("User-Agent"),
                    respuesta_completa: responseData,
                  },
                },
                req
              );
              console.log("🎉 FIRMA REGISTRADA EN BITÁCORA:", resultado?._id);
            } catch (error) {
              console.error("💥 ERROR registrando firma:", error);
            }
          });
        }
      } catch (error) {
        console.error("💥 Error procesando firma:", error);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// ENVÍO DE CONTRATOS
export const registrarEnvioContrato = (req, res, next) => {
  console.log("=== 📧 MIDDLEWARE ENVÍO CONTRATO ===");
  console.log("Contrato ID:", req.params.id);

  const originalSend = res.send;

  res.send = function (data) {
    if (res.statusCode === 200) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        const numero_contrato = responseData.numero_contrato;
        const email_enviado_a = responseData.email_enviado_a;

        if (numero_contrato) {
          setImmediate(async () => {
            try {
              await registrarActividad(
                "contrato_enviado",
                `Contrato enviado por email: ${numero_contrato} → ${email_enviado_a}`,
                {
                  entidad_tipo: "contrato",
                  entidad_nombre: numero_contrato,
                  datos_nuevos: {
                    numero_contrato,
                    estado: "enviado",
                    email_destinatario: email_enviado_a,
                    fecha_envio: responseData.fecha_envio,
                  },
                  etiquetas: ["contrato", "envio", "email"],
                },
                req
              );
              console.log("🎉 ENVÍO REGISTRADO EN BITÁCORA");
            } catch (error) {
              console.error("💥 ERROR registrando envío:", error);
            }
          });
        }
      } catch (error) {
        console.error("💥 Error procesando envío:", error);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// ACTUALIZACIÓN DE CONTRATOS
export const registrarActualizacionContrato = (req, res, next) => {
  console.log("=== 🔄 MIDDLEWARE ACTUALIZACIÓN CONTRATO ===");

  const originalSend = res.send;

  res.send = function (data) {
    if (res.statusCode === 200) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;

        setImmediate(async () => {
          try {
            await registrarActividad(
              "contrato_actualizado",
              `Contrato actualizado: ${req.params.id}`,
              {
                entidad_tipo: "contrato",
                datos_nuevos: req.body,
                etiquetas: ["contrato", "actualizacion"],
              },
              req
            );
            console.log("🎉 ACTUALIZACIÓN REGISTRADA EN BITÁCORA");
          } catch (error) {
            console.error("💥 ERROR registrando actualización:", error);
          }
        });
      } catch (error) {
        console.error("💥 Error procesando actualización:", error);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// CANCELACIÓN DE CONTRATOS
export const registrarCancelacionContrato = (req, res, next) => {
  console.log("=== ❌ MIDDLEWARE CANCELACIÓN CONTRATO ===");

  const originalSend = res.send;

  res.send = function (data) {
    if (res.statusCode === 200) {
      try {
        const motivo = req.body.motivo;

        setImmediate(async () => {
          try {
            await registrarActividad(
              "contrato_cancelado",
              `Contrato cancelado: ${req.params.id} - Motivo: ${motivo}`,
              {
                entidad_tipo: "contrato",
                datos_nuevos: {
                  estado: "cancelado",
                  motivo_cancelacion: motivo,
                },
                etiquetas: ["contrato", "cancelacion"],
              },
              req
            );
            console.log("🎉 CANCELACIÓN REGISTRADA EN BITÁCORA");
          } catch (error) {
            console.error("💥 ERROR registrando cancelación:", error);
          }
        });
      } catch (error) {
        console.error("💥 Error procesando cancelación:", error);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// ==========================================
// MIDDLEWARE PARA BENEFICIARIOS - MEJORADO
// ==========================================
export const registrarNuevoBeneficiario = (req, res, next) => {
  console.log("=== 👤 MIDDLEWARE BENEFICIARIO MEJORADO ===");
  console.log("Método:", req.method, "Path:", req.path);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA BENEFICIARIO INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        console.log("Response beneficiario:", responseData);

        // 🔍 BÚSQUEDA EXHAUSTIVA DE DATOS DEL BENEFICIARIO
        const nombre =
          req.body.nombre ||
          req.body.first_name ||
          responseData.nombre ||
          responseData.data?.nombre;

        const apellido =
          req.body.apellido ||
          req.body.last_name ||
          responseData.apellido ||
          responseData.data?.apellido;

        const aliado_id =
          req.body.aliado_id || req.body.hotel_aliado || responseData.aliado_id;

        const codigo =
          responseData.codigo ||
          responseData.llave_unica ||
          responseData.data?.codigo;

        console.log("📊 Datos beneficiario extraídos:", {
          nombre,
          apellido,
          aliado_id,
          codigo,
        });

        if (nombre) {
          const nombreCompleto = `${nombre} ${apellido || ""}`.trim();
          console.log(
            "✅ BENEFICIARIO ENCONTRADO - Registrando:",
            nombreCompleto
          );

          setImmediate(async () => {
            try {
              // Buscar información del aliado si existe
              let aliado_relacionado = null;
              if (aliado_id) {
                try {
                  const { Aliado } = await import("../models/Aliado.js");
                  const aliado = await Aliado.findById(aliado_id);
                  if (aliado) {
                    aliado_relacionado = {
                      id: aliado._id,
                      nombre: aliado.nombre,
                    };
                  }
                } catch (error) {
                  console.error("Error buscando aliado:", error);
                }
              }

              const resultado = await registrarActividad(
                "beneficiario_creado",
                `Nuevo beneficiario registrado: ${nombreCompleto}${
                  codigo ? ` (Código: ${codigo})` : ""
                }${
                  aliado_relacionado
                    ? ` - Aliado: ${aliado_relacionado.nombre}`
                    : ""
                }`,
                {
                  entidad_tipo: "beneficiario",
                  entidad_id: responseData._id || responseData.id,
                  entidad_nombre: nombreCompleto,
                  beneficiario_relacionado: {
                    id: responseData._id || responseData.id,
                    nombre: nombreCompleto,
                    codigo: codigo,
                  },
                  aliado_relacionado,
                  datos_nuevos: {
                    nombre,
                    apellido,
                    telefono: req.body.telefono,
                    correo: req.body.correo,
                    nacionalidad: req.body.nacionalidad,
                    documento: req.body.documento,
                    enganche_pagado: req.body.enganche_pagado,
                  },
                  parametros_accion: {
                    metodo: "api_creacion",
                    endpoint: req.originalUrl,
                    aliado_asignado: !!aliado_id,
                    timestamp: new Date().toISOString(),
                  },
                  etiquetas: ["beneficiario", "creacion", "registro", "nuevo"],
                  datos_extra: {
                    codigo_generado: codigo,
                    respuesta_completa: responseData,
                    request_original: req.body,
                  },
                },
                req
              );
              console.log(
                "🎉 BENEFICIARIO REGISTRADO EN BITÁCORA:",
                resultado?._id
              );
            } catch (error) {
              console.error("💥 ERROR registrando beneficiario:", error);
            }
          });
        } else {
          console.log("⚠️ NO SE ENCONTRÓ NOMBRE DE BENEFICIARIO");
        }
      } catch (error) {
        console.error("💥 Error procesando respuesta beneficiario:", error);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// =====================================
// MIDDLEWARE PARA SUCURSALES - MEJORADO
// =====================================
export const registrarNuevaSucursal = (req, res, next) => {
  console.log("=== 🏪 MIDDLEWARE SUCURSAL ESPECÍFICO MEJORADO ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Método:", req.method, "Path:", req.path);
  console.log("URL completa:", req.originalUrl);
  console.log("Body recibido:", JSON.stringify(req.body, null, 2));
  console.log("Usuario:", req.usuario?.nombre_usuario || "NO AUTH");

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA SUCURSAL INTERCEPTADA ===");
    console.log("Status code:", res.statusCode);
    console.log("Data type:", typeof data);
    console.log(
      "Data preview:",
      typeof data === "string"
        ? data.substring(0, 300)
        : JSON.stringify(data).substring(0, 300)
    );

    // Solo registrar si la respuesta fue exitosa
    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        console.log("Response data parseada:", responseData);

        // 🔍 BÚSQUEDA EXHAUSTIVA DEL NOMBRE DE LA SUCURSAL (igual que aliados)
        const nombre =
          req.body.nombre ||
          req.body.name ||
          req.body.sucursal_nombre ||
          req.body.branch_name ||
          responseData.nombre ||
          responseData.name ||
          responseData.sucursal_nombre ||
          responseData.data?.nombre;

        const direccion =
          req.body.direccion ||
          req.body.address ||
          req.body.ubicacion ||
          req.body.location ||
          responseData.direccion;

        const aliado_id =
          req.body.aliado_id ||
          req.body.aliadoId ||
          req.body.hotel_id ||
          responseData.aliado_id;

        const ciudad = req.body.ciudad || req.body.city || responseData.ciudad;

        console.log("📊 Datos extraídos de sucursal:", {
          nombre,
          direccion,
          aliado_id,
          ciudad,
        });

        if (nombre) {
          console.log(
            "✅ NOMBRE DE SUCURSAL ENCONTRADO - Registrando actividad:",
            nombre
          );

          // Registrar actividad de forma asíncrona (igual que aliados)
          setImmediate(async () => {
            try {
              // Buscar información del aliado si existe
              let aliado_relacionado = null;
              if (aliado_id) {
                try {
                  const { Aliado } = await import("../models/Aliado.js");
                  const aliado = await Aliado.findById(aliado_id);
                  if (aliado) {
                    aliado_relacionado = {
                      id: aliado._id,
                      nombre: aliado.nombre,
                    };
                    console.log("🏢 Aliado encontrado:", aliado.nombre);
                  }
                } catch (error) {
                  console.error("Error buscando aliado para sucursal:", error);
                }
              }

              const accion =
                req.method === "PUT" || req.method === "PATCH"
                  ? "actualizada"
                  : "creada";
              const tipo_actividad =
                req.method === "PUT" || req.method === "PATCH"
                  ? "sucursal_actualizada"
                  : "sucursal_creada";

              const resultado = await registrarActividad(
                tipo_actividad,
                `Sucursal ${accion}: ${nombre}${
                  direccion ? ` (${direccion})` : ""
                }${ciudad ? ` - ${ciudad}` : ""}${
                  aliado_relacionado
                    ? ` - Aliado: ${aliado_relacionado.nombre}`
                    : ""
                }`,
                {
                  entidad_tipo: "sucursal",
                  entidad_id: responseData._id || responseData.id,
                  entidad_nombre: nombre,
                  sucursal_relacionada: {
                    id: responseData._id || responseData.id,
                    nombre: nombre,
                  },
                  aliado_relacionado,
                  datos_nuevos: {
                    nombre,
                    direccion,
                    ciudad,
                    telefono: req.body.telefono,
                    correo: req.body.correo || req.body.email,
                    estado: req.body.estado,
                    aliado_id,
                    capacidad: req.body.capacidad,
                    tipo_sucursal: req.body.tipo || req.body.type,
                  },
                  parametros_accion: {
                    metodo: `${accion}_sucursal`,
                    endpoint: req.originalUrl,
                    timestamp: new Date().toISOString(),
                  },
                  etiquetas: [
                    "sucursal",
                    accion,
                    "ubicacion",
                    "infraestructura",
                  ],
                  datos_extra: {
                    respuesta_servidor:
                      responseData.mensaje ||
                      responseData.message ||
                      `Sucursal ${accion} exitosamente`,
                    respuesta_completa: responseData,
                    request_original: req.body,
                    status_code: res.statusCode,
                  },
                },
                req
              );
              console.log(
                "🎉✅✅✅ SUCURSAL REGISTRADA EXITOSAMENTE EN BITÁCORA:",
                resultado?._id
              );
            } catch (error) {
              console.error(
                "❌❌❌ ERROR al registrar sucursal en bitácora:",
                error
              );
              console.error("Stack trace:", error.stack);
            }
          });
        } else {
          console.log(
            "⚠️⚠️⚠️ No se encontró nombre de sucursal, no se registrará"
          );
          console.log("Body keys disponibles:", Object.keys(req.body || {}));
          console.log(
            "Response keys disponibles:",
            Object.keys(responseData || {})
          );
        }
      } catch (error) {
        console.error(
          "❌ Error al procesar respuesta de sucursal para bitácora:",
          error
        );
        console.error("Stack trace:", error.stack);
      }
    } else {
      console.log(
        "⚠️ Status code no exitoso para sucursal, no se registrará:",
        res.statusCode
      );
    }

    originalSend.call(this, data);
  };

  console.log("Middleware de sucursal configurado, pasando al siguiente...");
  next();
};

// ==========================================
// MIDDLEWARE PARA CÓDIGOS - CORREGIDO
// ==========================================
export const registrarCodigoActivado = (req, res, next) => {
  console.log("=== 🔑 MIDDLEWARE CÓDIGO ACTIVADO ESPECÍFICO ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Método:", req.method, "Path:", req.path);
  console.log("URL completa:", req.originalUrl);
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("Params:", JSON.stringify(req.params, null, 2));

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA CÓDIGO INTERCEPTADA ===");
    console.log("Status code:", res.statusCode);
    console.log(
      "Data preview:",
      typeof data === "string"
        ? data.substring(0, 200)
        : JSON.stringify(data).substring(0, 200)
    );

    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;

        // 🔍 EXTRACCIÓN EXHAUSTIVA DEL CÓDIGO (igual que nombre de aliado)
        let codigoValor = null;
        let beneficiario_id =
          req.body.beneficiario_id ||
          req.body.beneficiarioId ||
          req.params.beneficiario_id ||
          req.params.id ||
          responseData.beneficiario_id ||
          responseData._id;

        // Buscar código en request body
        if (req.body.codigo) {
          codigoValor =
            typeof req.body.codigo === "string"
              ? req.body.codigo
              : req.body.codigo.value || req.body.codigo.codigo;
        } else if (req.body.code) {
          codigoValor =
            typeof req.body.code === "string"
              ? req.body.code
              : req.body.code.value;
        } else if (req.body.llave_unica) {
          codigoValor = req.body.llave_unica;
        }

        // Buscar código en response
        if (!codigoValor && responseData) {
          if (responseData.codigo) {
            codigoValor =
              typeof responseData.codigo === "string"
                ? responseData.codigo
                : responseData.codigo.value || responseData.codigo.codigo;
          } else if (responseData.llave_unica) {
            codigoValor = responseData.llave_unica;
          } else if (responseData.data?.codigo) {
            codigoValor = responseData.data.codigo;
          }
        }

        console.log("📊 Datos código extraídos:", {
          codigoValor,
          beneficiario_id,
          path: req.path,
          method: req.method,
        });

        if (codigoValor) {
          console.log(
            "✅ CÓDIGO ENCONTRADO - Registrando activación/reactivación:",
            codigoValor
          );

          setImmediate(async () => {
            try {
              // Buscar beneficiario
              let beneficiario_relacionado = null;
              if (beneficiario_id) {
                try {
                  const { Beneficiario } = await import(
                    "../models/Beneficiario.js"
                  );
                  const beneficiario = await Beneficiario.findById(
                    beneficiario_id
                  );
                  if (beneficiario) {
                    beneficiario_relacionado = {
                      id: beneficiario._id,
                      nombre: `${beneficiario.nombre} ${
                        beneficiario.apellido || ""
                      }`.trim(),
                      codigo: beneficiario.codigo || beneficiario.llave_unica,
                    };
                    console.log(
                      "👤 Beneficiario encontrado:",
                      beneficiario_relacionado.nombre
                    );
                  }
                } catch (error) {
                  console.error("Error buscando beneficiario:", error);
                }
              }

              // Determinar tipo de acción
              const esReactivacion =
                req.path.includes("reactivar") ||
                req.path.includes("reactivate") ||
                req.method === "PUT" ||
                req.method === "PATCH";

              const accion = esReactivacion ? "reactivado" : "activado";
              const tipoActividad = "codigo_activado"; // Usar el mismo tipo para ambos

              const resultado = await registrarActividad(
                tipoActividad,
                `Código ${accion}: ${codigoValor}${
                  beneficiario_relacionado
                    ? ` - Beneficiario: ${beneficiario_relacionado.nombre}`
                    : ""
                }`,
                {
                  entidad_tipo: "codigo",
                  entidad_nombre: codigoValor,
                  beneficiario_relacionado,
                  datos_nuevos: {
                    codigo: codigoValor,
                    estado: accion,
                    beneficiario_id,
                    fecha_accion: new Date(),
                  },
                  parametros_accion: {
                    metodo: `${accion}_codigo`,
                    endpoint: req.originalUrl,
                    timestamp: new Date().toISOString(),
                  },
                  etiquetas: ["codigo", accion, "llave_unica", "acceso"],
                  datos_extra: {
                    respuesta_servidor:
                      responseData.mensaje ||
                      responseData.message ||
                      `Código ${accion} exitosamente`,
                    respuesta_completa: responseData,
                    request_original: req.body,
                    tipo_accion: accion,
                  },
                },
                req
              );
              console.log(
                "🎉✅✅✅ CÓDIGO REGISTRADO EXITOSAMENTE EN BITÁCORA:",
                resultado?._id
              );
            } catch (error) {
              console.error(
                "❌❌❌ ERROR al registrar código en bitácora:",
                error
              );
              console.error("Stack trace:", error.stack);
            }
          });
        } else {
          console.log("⚠️⚠️⚠️ NO SE ENCONTRÓ CÓDIGO VÁLIDO");
          console.log("Request body keys:", Object.keys(req.body || {}));
          console.log("Response keys:", Object.keys(responseData || {}));
        }
      } catch (error) {
        console.error("❌ Error procesando código:", error);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

export const registrarCodigoReactivado = registrarCodigoActivado; // Mismo handler

// ===============================================
// MIDDLEWARE PARA DOCUMENTOS - MEJORADO
// ===============================================
export const registrarDocumentoSubido = (req, res, next) => {
  console.log("=== 📄 MIDDLEWARE DOCUMENTO MEJORADO ===");
  console.log("Método:", req.method, "Path:", req.path);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA DOCUMENTO INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        console.log("Response documento:", responseData);

        const beneficiario_id = req.body.beneficiario_id;
        const tipo = req.body.tipo || req.body.type;
        const nombre = req.body.nombre || req.body.name || req.body.filename;

        console.log("📊 Datos documento extraídos:", {
          beneficiario_id,
          tipo,
          nombre,
        });

        if (beneficiario_id && tipo) {
          console.log("✅ DOCUMENTO ENCONTRADO - Registrando subida:", tipo);

          setImmediate(async () => {
            try {
              // Buscar beneficiario
              let beneficiario_relacionado = null;
              try {
                const { Beneficiario } = await import(
                  "../models/Beneficiario.js"
                );
                const beneficiario = await Beneficiario.findById(
                  beneficiario_id
                );
                if (beneficiario) {
                  beneficiario_relacionado = {
                    id: beneficiario._id,
                    nombre: `${beneficiario.nombre} ${
                      beneficiario.apellido || ""
                    }`.trim(),
                    codigo: beneficiario.codigo,
                  };
                }
              } catch (error) {
                console.error(
                  "Error buscando beneficiario para documento:",
                  error
                );
              }

              const resultado = await registrarActividad(
                "documento_subido",
                `Documento subido: ${tipo}${nombre ? ` - ${nombre}` : ""}${
                  beneficiario_relacionado
                    ? ` - Beneficiario: ${beneficiario_relacionado.nombre}`
                    : ""
                }`,
                {
                  entidad_tipo: "documento",
                  entidad_nombre: nombre || tipo,
                  beneficiario_relacionado,
                  datos_nuevos: {
                    tipo,
                    nombre,
                    beneficiario_id,
                    archivo_url: responseData.url || responseData.file_url,
                    tamaño: req.body.size,
                  },
                  parametros_accion: {
                    metodo: "subida_documento",
                    endpoint: req.originalUrl,
                    tipo_documento: tipo,
                    timestamp: new Date().toISOString(),
                  },
                  etiquetas: ["documento", "subida", "archivo", "beneficiario"],
                  datos_extra: {
                    respuesta_completa: responseData,
                    request_original: req.body,
                  },
                },
                req
              );
              console.log(
                "🎉 DOCUMENTO REGISTRADO EN BITÁCORA:",
                resultado?._id
              );
            } catch (error) {
              console.error("💥 ERROR registrando documento:", error);
            }
          });
        } else {
          console.log("⚠️ NO SE ENCONTRARON DATOS DE DOCUMENTO");
        }
      } catch (error) {
        console.error("💥 Error procesando documento:", error);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// ===============================================
// MIDDLEWARE PARA SERVICIOS - MEJORADO
// ===============================================
export const registrarCambioServicios = (req, res, next) => {
  console.log("=== ⚙️ MIDDLEWARE SERVICIOS MEJORADO ===");
  console.log("Método:", req.method, "Path:", req.path);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA SERVICIOS INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;

        // Para aliados
        if (req.body.servicios && Array.isArray(req.body.servicios)) {
          setImmediate(async () => {
            try {
              const { Aliado } = await import("../models/Aliado.js");
              const { Servicio } = await import("../models/Servicio.js");

              // Buscar el aliado
              const aliado = await Aliado.findOne({
                usuario_id: req.usuario._id,
              });
              if (!aliado) return;

              const serviciosAnteriores = aliado.servicios || [];
              const serviciosNuevos = req.body.servicios;

              // Servicios agregados
              const serviciosAgregados = serviciosNuevos.filter(
                (id) => !serviciosAnteriores.includes(id)
              );

              // Servicios removidos
              const serviciosRemovidos = serviciosAnteriores.filter(
                (id) => !serviciosNuevos.includes(id)
              );

              // Registrar servicios agregados
              for (const servicioId of serviciosAgregados) {
                const servicio = await Servicio.findById(servicioId);
                if (servicio) {
                  await registrarActividad(
                    "servicio_asignado",
                    `Servicio "${servicio.nombre}" asignado al aliado: ${aliado.nombre}`,
                    {
                      entidad_tipo: "servicio",
                      entidad_nombre: servicio.nombre,
                      aliado_relacionado: {
                        id: aliado._id,
                        nombre: aliado.nombre,
                      },
                      servicio_relacionado: {
                        id: servicioId,
                        nombre: servicio.nombre,
                      },
                      datos_nuevos: {
                        aliado_id: aliado._id,
                        servicio_id: servicioId,
                        tipo_usuario: "aliado",
                        accion: "asignacion",
                      },
                      parametros_accion: {
                        metodo: "cambio_servicios",
                        endpoint: req.originalUrl,
                        timestamp: new Date().toISOString(),
                      },
                      etiquetas: [
                        "servicio",
                        "asignacion",
                        "aliado",
                        "configuracion",
                      ],
                      datos_extra: {
                        servicios_total: serviciosNuevos.length,
                        respuesta_completa: responseData,
                      },
                    },
                    req
                  );
                  console.log(
                    "✅ SERVICIO ASIGNADO REGISTRADO:",
                    servicio.nombre
                  );
                }
              }

              // Registrar servicios removidos
              for (const servicioId of serviciosRemovidos) {
                const servicio = await Servicio.findById(servicioId);
                if (servicio) {
                  await registrarActividad(
                    "servicio_removido",
                    `Servicio "${servicio.nombre}" removido del aliado: ${aliado.nombre}`,
                    {
                      entidad_tipo: "servicio",
                      entidad_nombre: servicio.nombre,
                      aliado_relacionado: {
                        id: aliado._id,
                        nombre: aliado.nombre,
                      },
                      servicio_relacionado: {
                        id: servicioId,
                        nombre: servicio.nombre,
                      },
                      datos_anteriores: {
                        aliado_id: aliado._id,
                        servicio_id: servicioId,
                        tipo_usuario: "aliado",
                        accion: "remocion",
                      },
                      parametros_accion: {
                        metodo: "cambio_servicios",
                        endpoint: req.originalUrl,
                        timestamp: new Date().toISOString(),
                      },
                      etiquetas: [
                        "servicio",
                        "remocion",
                        "aliado",
                        "configuracion",
                      ],
                      datos_extra: {
                        servicios_restantes: serviciosNuevos.length,
                        respuesta_completa: responseData,
                      },
                    },
                    req
                  );
                  console.log(
                    "✅ SERVICIO REMOVIDO REGISTRADO:",
                    servicio.nombre
                  );
                }
              }
            } catch (error) {
              console.error(
                "💥 ERROR registrando cambios de servicios:",
                error
              );
            }
          });
        }
      } catch (error) {
        console.error("💥 Error procesando cambios de servicios:", error);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// ===============================================
// MIDDLEWARE PARA ASIGNACIONES - MEJORADO
// ===============================================
export const registrarAsignacionBeneficiario = (req, res, next) => {
  console.log("=== 🔗 MIDDLEWARE ASIGNACIÓN MEJORADO ===");
  console.log("Método:", req.method, "Path:", req.path);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA ASIGNACIÓN INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200 || res.statusCode === 201) {
      try {
        const { aliado_id, hotel_aliado } = req.body;
        const aliadoIdFinal = aliado_id || hotel_aliado;

        if (aliadoIdFinal) {
          setImmediate(async () => {
            try {
              const { Aliado } = await import("../models/Aliado.js");

              const aliado = await Aliado.findById(aliadoIdFinal);
              if (aliado) {
                const { nombre, apellido } = req.body;
                const nombreCompleto = `${nombre} ${apellido || ""}`.trim();

                await registrarActividad(
                  "beneficiario_asignado",
                  `Beneficiario ${nombreCompleto} asignado al aliado: ${aliado.nombre}`,
                  {
                    entidad_tipo: "beneficiario",
                    entidad_nombre: nombreCompleto,
                    aliado_relacionado: {
                      id: aliado._id,
                      nombre: aliado.nombre,
                    },
                    beneficiario_relacionado: {
                      nombre: nombreCompleto,
                    },
                    datos_nuevos: {
                      aliado_id: aliadoIdFinal,
                      tipo_asignacion: "manual",
                      beneficiario_datos: {
                        nombre,
                        apellido,
                        telefono: req.body.telefono,
                        correo: req.body.correo,
                      },
                    },
                    parametros_accion: {
                      metodo: "asignacion_beneficiario",
                      endpoint: req.originalUrl,
                      timestamp: new Date().toISOString(),
                    },
                    etiquetas: [
                      "beneficiario",
                      "asignacion",
                      "aliado",
                      "relacion",
                    ],
                    datos_extra: {
                      respuesta_completa:
                        typeof data === "string" ? JSON.parse(data) : data,
                      request_original: req.body,
                    },
                  },
                  req
                );
                console.log(
                  "✅ ASIGNACIÓN REGISTRADA:",
                  nombreCompleto,
                  "->",
                  aliado.nombre
                );
              }
            } catch (error) {
              console.error("💥 ERROR registrando asignación:", error);
            }
          });
        }
      } catch (error) {
        console.error("💥 Error procesando asignación:", error);
      }
    }

    originalSend.call(this, data);
  };

  next();
};

// ===============================================
// MIDDLEWARE PARA ACTUALIZACIONES - MEJORADO
// ===============================================
export const registrarActualizacionAliado = (req, res, next) => {
  console.log("=== 📄 MIDDLEWARE ACTUALIZACIÓN ALIADO MEJORADO ===");
  console.log("Método:", req.method, "Path:", req.path);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA ACTUALIZACIÓN ALIADO INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        const camposActualizados = Object.keys(req.body);
        
        // BUSCAR NOMBRE EN MÚLTIPLES LUGARES
        const nombre = req.body.nombre || 
                      req.body.nombre_usuario ||
                      responseData.nombre || 
                      responseData.nombre_usuario ||
                      'Aliado';
        
        const aliadoId = responseData._id || responseData.id || req.params.id;
        
        const camposInformacion = ['correo', 'telefono', 'direccion'];
        const camposServicios = ['servicios'];
        const camposColaborador = ['colaborador_bnp'];
        
        let tipoActualizacion = "aliado_actualizado";
        let descripcionDetallada = "";
        
        const tieneInformacion = camposActualizados.some(campo => camposInformacion.includes(campo));
        const tieneServicios = camposActualizados.some(campo => camposServicios.includes(campo));
        const tieneColaborador = camposActualizados.some(campo => camposColaborador.includes(campo));
        
        if (tieneInformacion && !tieneServicios && !tieneColaborador) {
          tipoActualizacion = "informacion_actualizada";
          const camposModificados = camposActualizados.filter(c => camposInformacion.includes(c));
          descripcionDetallada = `Información actualizada para aliado ${nombre}: ${camposModificados.join(', ')}`;
        } else if (tieneServicios && !tieneInformacion && !tieneColaborador) {
          tipoActualizacion = "servicios_actualizados";
          descripcionDetallada = `Servicios actualizados para aliado ${nombre}`;
        } else if (tieneColaborador && !tieneInformacion && !tieneServicios) {
          tipoActualizacion = "colaborador_asignado";
          descripcionDetallada = `Colaborador BNP asignado a aliado ${nombre}: ${req.body.colaborador_bnp}`;
        } else {
          descripcionDetallada = `Aliado actualizado: ${nombre}`;
        }

        // SI NO TENEMOS NOMBRE, BUSCAR EN BD
        if (nombre === 'Aliado' && aliadoId) {
          setImmediate(async () => {
            try {
              const { Aliado } = await import("../models/Aliado.js");
              const aliado = await Aliado.findById(aliadoId);
              
              const nombreReal = aliado?.nombre || aliado?.razon_social || 'Aliado sin nombre';
              const descripcionFinal = descripcionDetallada.replace('Aliado', nombreReal);
              
              await registrarActividad(
                tipoActualizacion,
                descripcionFinal,
                {
                  entidad_tipo: "aliado",
                  entidad_nombre: nombreReal,
                  aliado_relacionado: {
                    id: aliadoId,
                    nombre: nombreReal,
                  },
                  datos_nuevos: {
                    ...req.body,
                    campos_actualizados: camposActualizados,
                  },
                  parametros_accion: {
                    metodo: "actualizacion_aliado",
                    endpoint: req.originalUrl,
                    campos_modificados: camposActualizados.length,
                    tipo_cambio: tipoActualizacion,
                    timestamp: new Date().toISOString(),
                  },
                  etiquetas: ["aliado", "actualizacion", "modificacion", "datos", tipoActualizacion],
                  datos_extra: {
                    respuesta_completa: responseData,
                    request_original: req.body,
                  },
                },
                req
              );
              console.log("✅ ACTUALIZACIÓN ALIADO REGISTRADA:", nombreReal, "- Tipo:", tipoActualizacion);
            } catch (error) {
              console.error("💥 ERROR buscando nombre de aliado:", error);
            }
          });
        } else {
          // YA TENEMOS EL NOMBRE, REGISTRAR DIRECTAMENTE
          setImmediate(async () => {
            await registrarActividad(
              tipoActualizacion,
              descripcionDetallada,
              {
                entidad_tipo: "aliado",
                entidad_nombre: nombre,
                aliado_relacionado: {
                  id: aliadoId,
                  nombre: nombre,
                },
                datos_nuevos: {
                  ...req.body,
                  campos_actualizados: camposActualizados,
                },
                parametros_accion: {
                  metodo: "actualizacion_aliado",
                  endpoint: req.originalUrl,
                  campos_modificados: camposActualizados.length,
                  tipo_cambio: tipoActualizacion,
                  timestamp: new Date().toISOString(),
                },
                etiquetas: ["aliado", "actualizacion", "modificacion", "datos", tipoActualizacion],
                datos_extra: {
                  respuesta_completa: responseData,
                  request_original: req.body,
                },
              },
              req
            );
            console.log("✅ ACTUALIZACIÓN ALIADO REGISTRADA:", nombre, "- Tipo:", tipoActualizacion);
          });
        }
      } catch (error) {
        console.error("💥 ERROR registrando actualización aliado:", error);
      }
    }
    originalSend.call(this, data);
  };
  next();
};

export const registrarActualizacionBeneficiario = (req, res, next) => {
  console.log("=== 🔄 MIDDLEWARE ACTUALIZACIÓN BENEFICIARIO MEJORADO ===");
  console.log("Método:", req.method, "Path:", req.path);
  console.log("Body:", JSON.stringify(req.body, null, 2));

  const originalSend = res.send;

  res.send = function (data) {
    console.log("=== 📤 RESPUESTA ACTUALIZACIÓN BENEFICIARIO INTERCEPTADA ===");
    console.log("Status:", res.statusCode);

    if (res.statusCode === 200) {
      try {
        const responseData = typeof data === "string" ? JSON.parse(data) : data;
        const { nombre, apellido } = req.body;
        const nombreCompleto = `${nombre} ${apellido || ""}`.trim();

        if (nombre) {
          setImmediate(async () => {
            await registrarActividad(
              "beneficiario_actualizado",
              `Beneficiario actualizado: ${nombreCompleto}`,
              {
                entidad_tipo: "beneficiario",
                entidad_nombre: nombreCompleto,
                beneficiario_relacionado: {
                  id: responseData._id || responseData.id,
                  nombre: nombreCompleto,
                },
                datos_nuevos: {
                  ...req.body,
                  campos_actualizados: Object.keys(req.body),
                },
                parametros_accion: {
                  metodo: "actualizacion_beneficiario",
                  endpoint: req.originalUrl,
                  campos_modificados: Object.keys(req.body).length,
                  timestamp: new Date().toISOString(),
                },
                etiquetas: [
                  "beneficiario",
                  "actualizacion",
                  "modificacion",
                  "datos",
                ],
                datos_extra: {
                  respuesta_completa: responseData,
                  request_original: req.body,
                },
              },
              req
            );
            console.log(
              "✅ ACTUALIZACIÓN BENEFICIARIO REGISTRADA:",
              nombreCompleto
            );
          });
        }
      } catch (error) {
        console.error(
          "💥 ERROR registrando actualización beneficiario:",
          error
        );
      }
    }
    originalSend.call(this, data);
  };
  next();
};

export default {
  registrarNuevoAliado,
  registrarNuevoBeneficiario,
  registrarCambioServicios,
  registrarAsignacionBeneficiario,
  registrarActualizacionAliado,
  registrarActualizacionBeneficiario,
  registrarCodigoActivado,
  registrarDocumentoSubido,
  registrarNuevaSucursal,
  registrarCodigoReactivado,
  registrarNuevoContrato,
  registrarContratoManual,
  registrarFirmaContrato,
  registrarEnvioContrato,
  registrarActualizacionContrato,
  registrarCancelacionContrato,
  registrarDocumentoViaje,
  registrarActualizacionDocumentoViaje,
  registrarEliminacionDocumentoViaje,
};
