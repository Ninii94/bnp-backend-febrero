// DE FINANCIAMIENTO DE SENA // 
import nodemailer from 'nodemailer';
import Financiamiento from '../models/Financiamiento.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const plantillaDefault = `
Estimado/a [NOMBRE],

📅 Te recordamos que mañana vence el pago de tu crédito "Financiamiento de Seña de Membresía Vacacional".

✅ Evita recargos realizando tu pago a tiempo. Puedes transferir a la cuenta de BNP Capital o pagar vía Pix.

💰 Monto a pagar: [MONEDA] [MONTO]
📆 Fecha de vencimiento: [FECHA]

📌 No olvides incluir tu nombre de usuario ([USERNAME]) en el campo de notas y subir tu comprobante en la plataforma: www.beneficiosbnp.com.br

📬 Para cualquier duda o aclaración, contáctanos por correo electrónico: consulta@bnp-capital.com

📞 O llámanos al teléfono: 55 (11) 2844-2565, horario São Paulo de 9:00 a 17:00.

🌴 ¡Sigue disfrutando de vacaciones inolvidables!

BNP Capital
`;

export const enviarRecordatorioPago = async (financiamiento, cuota) => {
  const beneficiario = await financiamiento.populate('beneficiario');
  
  const plantilla = financiamiento.notificaciones?.plantilla || plantillaDefault;
  
  const mensaje = plantilla
    .replace('[NOMBRE]', beneficiario.nombre)
    .replace('[USERNAME]', beneficiario.usuario?.username || beneficiario.email)
    .replace('[MONEDA]', financiamiento.moneda)
    .replace('[MONTO]', (cuota.monto + (cuota.intereseMoratorio || 0)).toFixed(2))
    .replace('[FECHA]', new Date(cuota.fechaVencimiento).toLocaleDateString());

  const mailOptions = {
    from: `"BNP Capital" <${process.env.SMTP_USER}>`,
    to: beneficiario.email,
    subject: 'Recordatorio de Pago - BNP Capital',
    text: mensaje,
    html: mensaje.replace(/\n/g, '<br>')
  };

  try {
    await transporter.sendMail(mailOptions);
    
    financiamiento.notificaciones.ultimoEnvio = new Date();
    await financiamiento.save();
    
    return { success: true };
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return { success: false, error: error.message };
  }
};

export const verificarPagosProximos = async () => {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const financiamientos = await Financiamiento.find({
    estadoGeneral: 'Activo'
  }).populate('beneficiario');

  for (const financiamiento of financiamientos) {
    for (const cuota of financiamiento.cuotas) {
      if (cuota.estado === 'En espera de pago') {
        const fechaVencimiento = new Date(cuota.fechaVencimiento);
        const diasAntes = financiamiento.notificaciones?.diasAntes || 1;
        const fechaNotificacion = new Date(fechaVencimiento);
        fechaNotificacion.setDate(fechaNotificacion.getDate() - diasAntes);

        if (
          fechaNotificacion.toDateString() === hoy.toDateString() &&
          (!financiamiento.notificaciones?.ultimoEnvio ||
            new Date(financiamiento.notificaciones.ultimoEnvio).toDateString() !== hoy.toDateString())
        ) {
          await enviarRecordatorioPago(financiamiento, cuota);
        }
      }
    }
  }
};

export const configurarCronJob = () => {
  setInterval(async () => {
    console.log('Verificando pagos próximos...');
    await verificarPagosProximos();
  }, 60 * 60 * 1000);
};