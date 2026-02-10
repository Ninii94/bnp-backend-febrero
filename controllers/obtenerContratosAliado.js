//  contratos específicos de un aliado autenticado
export const obtenerContratosAliado = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      estado, 
      fecha_desde, 
      fecha_hasta 
    } = req.query;

    const userId = req.usuario._id;

    // Buscar el aliado por usuario_id
    const aliado = await Aliado.findOne({ usuario_id: userId });
    
    if (!aliado) {
      return res.status(404).json({
        success: false,
        message: 'Información de aliado no encontrada'
      });
    }

    console.log(`Buscando contratos para aliado: ${aliado.nombre} (ID: ${aliado._id})`);

    // Construir filtros
    const filtros = { 
      tipo_contrato: 'equipo',
      aliado_id: aliado._id
    };
    
    if (estado) {
      filtros.estado = estado;
    }
    
    if (fecha_desde || fecha_hasta) {
      filtros.fecha_creacion = {};
      if (fecha_desde) filtros.fecha_creacion.$gte = new Date(fecha_desde);
      if (fecha_hasta) filtros.fecha_creacion.$lte = new Date(fecha_hasta);
    }

    // Pipeline de agregación para obtener contratos del aliado
    const pipeline = [
      { $match: filtros },
      {
        $lookup: {
          from: 'aliados',
          localField: 'aliado_id',
          foreignField: '_id',
          as: 'aliado'
        }
      },
      {
        $unwind: { 
          path: '$aliado', 
          preserveNullAndEmptyArrays: true 
        }
      },
      { $sort: { fecha_creacion: -1 } }
    ];

    // Paginación
    const skip = (page - 1) * limit;
    const pipelineWithPagination = [
      ...pipeline,
      { $skip: skip }, 
      { $limit: parseInt(limit) }
    ];

    // Proyección final - solo mostrar campos necesarios para el aliado
    pipelineWithPagination.push({
      $project: {
        _id: 1,
        contenido: 1,
        estado: 1,
        fecha_creacion: 1,
        fecha_envio: 1,
        fecha_firma: 1,
        signnow_document_id: 1,
        signnow_status: 1,
        plantilla_usada: 1,
        notas: 1,
        'aliado._id': 1,
        'aliado.nombre': 1,
        'aliado.correo': 1,
        'aliado.razon_social': 1,
        'aliado.ruc': 1
      }
    });

    const contratos = await ContratoEquipo.aggregate(pipelineWithPagination);

    // Contar total para paginación
    const totalContratos = await ContratoEquipo.countDocuments(filtros);

    console.log(`Encontrados ${contratos.length} contratos para el aliado ${aliado.nombre}`);

    res.status(200).json({
      success: true,
      data: contratos,
      aliado: {
        _id: aliado._id,
        nombre: aliado.nombre,
        correo: aliado.correo,
        razon_social: aliado.razon_social,
        ruc: aliado.ruc
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalContratos / limit),
        totalContratos,
        limit: parseInt(limit)
      },
      message: totalContratos === 0 ? 'No tienes contratos de equipo aún' : undefined
    });

  } catch (error) {
    console.error('Error al obtener contratos del aliado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

// ===========================================
// FUNCIÓN ADICIONAL: Obtener dashboard del aliado
// ===========================================
export const obtenerDashboardAliado = async (req, res) => {
  try {
    const userId = req.usuario._id;

    // Buscar el aliado
    const aliado = await Aliado.findOne({ usuario_id: userId });
    
    if (!aliado) {
      return res.status(404).json({
        success: false,
        message: 'Información de aliado no encontrada'
      });
    }

    // Estadísticas de contratos del aliado
    const estadisticas = await ContratoEquipo.aggregate([
      {
        $match: { 
          tipo_contrato: 'equipo',
          aliado_id: aliado._id
        }
      },
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 }
        }
      }
    ]);

    // Contratos recientes
    const contratosRecientes = await ContratoEquipo.find({
      tipo_contrato: 'equipo',
      aliado_id: aliado._id
    })
    .sort({ fecha_creacion: -1 })
    .limit(5)
    .select('estado fecha_creacion fecha_firma signnow_status');

    // Formatear estadísticas
    const stats = {
      total: 0,
      borrador: 0,
      enviado: 0,
      firmado: 0,
      cancelado: 0
    };

    estadisticas.forEach(stat => {
      stats[stat._id] = stat.count;
      stats.total += stat.count;
    });

    res.status(200).json({
      success: true,
      aliado: {
        _id: aliado._id,
        nombre: aliado.nombre,
        correo: aliado.correo,
        razon_social: aliado.razon_social,
        ruc: aliado.ruc
      },
      estadisticas: stats,
      contratosRecientes: contratosRecientes.map(contrato => ({
        _id: contrato._id,
        estado: contrato.estado,
        fecha_creacion: contrato.fecha_creacion,
        fecha_firma: contrato.fecha_firma,
        tiene_signnow: !!contrato.signnow_status
      }))
    });

  } catch (error) {
    console.error('Error al obtener dashboard del aliado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};