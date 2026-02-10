import PDFDocument from 'pdfkit';

const generarPDF = async (estadisticas = {}, periodo = 'actual', aliado = null) => {
  // Validar y preparar datos
  const datosValidados = {
    ventasDiarias: Array.isArray(estadisticas.ventasDiarias) ? estadisticas.ventasDiarias : [],
    ventasTotales: estadisticas.ventasTotales || 0,
    promedioDiario: estadisticas.promedioDiario || 0,
    mejorDia: estadisticas.mejorDia || null,
    metasCumplidas: estadisticas.metasCumplidas || 0,
    notas: Array.isArray(estadisticas.notas) ? estadisticas.notas : []
  };

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true
  });
  
  // Título
  doc.font('Helvetica-Bold')
     .fontSize(24)
     .fillColor('#166534')
     .text('Reporte de Estadísticas', { align: 'center' });
  doc.moveDown(0.5);
  
  // Información del período y aliado
  doc.font('Helvetica')
     .fontSize(14)
     .fillColor('#374151');
  
  doc.text('Período: Mes Actual', { align: 'left' });
  if (aliado) {
    doc.text(`Aliado: ${aliado.nombre}`, { align: 'left' });
  }
  doc.moveDown(1);

  // Métricas principales en grid
  const startY = doc.y;
  const columnWidth = 250;

  // Columna 1: Ventas Totales
  doc.x = 50;
  doc.font('Helvetica-Bold')
     .fontSize(18)
     .fillColor('#166534')
     .text('Ventas Totales del Mes', { width: 150 });
  doc.fontSize(20)
     .text(datosValidados.ventasTotales.toLocaleString(), { width: 150 });

  // Columna 2: Promedio Diario
  doc.y = startY;
  doc.x = 220;
  doc.fontSize(18)
     .text('Promedio Diario', { width: 150 });
  doc.fontSize(20)
     .text(datosValidados.promedioDiario.toLocaleString(), { width: 150 });

  // Columna 3: Mejor Día
  doc.y = startY;
  doc.x = 390;
  if (datosValidados.mejorDia && datosValidados.mejorDia.fecha) {
    doc.fontSize(18)
       .text('Día de Más Ventas', { width: 150 });
    const fechaMejorDia = new Date(datosValidados.mejorDia.fecha);
    doc.fontSize(16)
       .text(fechaMejorDia.toLocaleDateString(), { width: 150 });
    doc.fontSize(14)
       .text(`Ventas totales: ${datosValidados.mejorDia.ventas.toLocaleString()}`, { width: 150 });
  }

  // Columna 4: Metas Cumplidas
  doc.y = startY + 80;
  doc.x = 50;
  doc.fontSize(18)
     .text('Metas Cumplidas', { width: 150 });
  doc.fontSize(20)
     .text(`${Math.round(datosValidados.metasCumplidas * 100)}%`, { width: 150 });
  doc.fontSize(12)
     .text('del mes', { width: 150 });

  // Gráfico de Ventas Diarias
  doc.x = 50;
  doc.y = startY + 200;
  doc.font('Helvetica-Bold')
     .fontSize(16)
     .text('Ventas Diarias', { align: 'left' });
  doc.moveDown(0.5);

  if (datosValidados.ventasDiarias.length > 0) {
    dibujarGraficoBarras(doc, datosValidados.ventasDiarias);
    doc.moveDown(2);
  }

  // Notas y Observaciones
  doc.x = 50;
  doc.moveDown(2);
  
  if (datosValidados.notas && datosValidados.notas.length > 0) {
    doc.font('Helvetica-Bold')
       .fontSize(18)
       .fillColor('#166534')
       .text('Notas y Observaciones', { align: 'left' });
    doc.moveDown(1);
    
    datosValidados.notas.forEach((nota, index) => {
      if (!nota) return;
      
      const fecha = new Date(nota.fecha || new Date()).toLocaleDateString();
      let textoNota = '';
      if (typeof nota.texto === 'string') {
        textoNota = nota.texto;
      } else if (Array.isArray(nota.texto)) {
        textoNota = nota.texto.join(', ');
      } else if (nota.texto && typeof nota.texto === 'object') {
        textoNota = nota.texto.texto || JSON.stringify(nota.texto);
      }
      
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .fillColor('#166534')
         .text(`${nota.aliado_nombre || 'General'} - ${fecha}`);
      
      doc.font('Helvetica')
         .fontSize(11)
         .fillColor('#374151')
         .text(textoNota || 'Sin contenido');
      
      doc.moveDown(1);
    });
  }
  
  return doc;
};

const dibujarGraficoBarras = (doc, datos = [], startX = 50, startY = doc.y, width = 500, height = 300) => {
  if (!Array.isArray(datos) || datos.length === 0) {
    doc.text('No hay datos disponibles para el período seleccionado', { align: 'center' });
    return;
  }

  const margin = 50;
  const chartWidth = width - (2 * margin);
  const chartHeight = height - (2 * margin);
  const maxVentas = Math.max(...datos.map(d => d.ventas || 0), 1);
  const barWidth = Math.min(30, (chartWidth / datos.length) - 10);
  const spacing = (chartWidth - (datos.length * barWidth)) / (datos.length + 1);

  // Dibujar eje Y
  doc.strokeColor('#d1d5db')
     .lineWidth(1)
     .moveTo(startX + margin, startY + margin)
     .lineTo(startX + margin, startY + height - margin)
     .stroke();

  // Dibujar eje X
  doc.moveTo(startX + margin, startY + height - margin)
     .lineTo(startX + width - margin, startY + height - margin)
     .stroke();

  // Dibujar líneas de cuadrícula y etiquetas del eje Y
  const numGridLines = 5;
  for (let i = 0; i <= numGridLines; i++) {
    const y = startY + height - margin - (i * (chartHeight / numGridLines));
    const value = Math.round((maxVentas * i) / numGridLines);

    doc.strokeColor('#e5e7eb')
       .moveTo(startX + margin, y)
       .lineTo(startX + width - margin, y)
       .stroke();

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#374151')
       .text(value.toString(), startX, y - 5, { width: margin - 5, align: 'right' });
  }

  // Dibujar barras y etiquetas
  datos.forEach((dato, index) => {
    const x = startX + margin + spacing + (index * (barWidth + spacing));
    const barHeight = (dato.ventas / maxVentas) * chartHeight;
    const y = startY + height - margin - barHeight;

    // Dibujar barra
    doc.fillColor('#166534')
       .rect(x, y, barWidth, barHeight)
       .fill();

    // Etiqueta del día
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor('#374151')
       .text(new Date(dato.fecha).getDate().toString(), 
             x - 5, 
             startY + height - margin + 5,
             { width: barWidth + 10, align: 'center' });

    // Valor sobre la barra
    doc.fontSize(10)
       .fillColor('#166534')
       .text(dato.ventas.toString(),
             x - 5,
             y - 15,
             { width: barWidth + 10, align: 'center' });
  });

  // Etiqueta "Ventas" rotada 90 grados
  doc.save()
     .translate(startX + 15, startY + height/2)
     .rotate(-90)
     .font('Helvetica-Bold')
     .fontSize(12)
     .fillColor('#374151')
     .text('Ventas', 0, 0, { width: 100, align: 'center' })
     .restore();

  // Etiqueta "Día"
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .fillColor('#374151')
     .text('Día',
           startX + width/2 - 20,
           startY + height - 25,
           { width: 40, align: 'center' });
};

export { generarPDF };