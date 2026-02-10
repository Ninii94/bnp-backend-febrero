
// generar el template de email 
const generarTemplateEmailContrato = (
  contrato,
  beneficiario,
  aliado,
  linkFirma
) => {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrato de Colaboración</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }
        
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #059669, #34d399);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .content {
            padding: 30px 20px;
        }
        
        .greeting {
            font-size: 16px;
            color: #059669;
            font-weight: 600;
            margin-bottom: 15px;
        }
        
        .intro-text {
            font-size: 14px;
            color: #555;
            margin-bottom: 25px;
            line-height: 1.5;
        }
        
        .contract-details {
            background-color: #f0fdf4;
            border-left: 4px solid #059669;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
        }
        
        .details-title {
            font-size: 16px;
            font-weight: 600;
            color: #059669;
            margin-bottom: 15px;
        }
        
        .details-list {
            list-style: none;
            padding: 0;
        }
        
        .details-list li {
            font-size: 14px;
            color: #333;
            margin-bottom: 8px;
            position: relative;
            padding-left: 15px;
        }
        
        .details-list li:before {
            content: "•";
            color: #059669;
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        
        .review-instruction {
            font-size: 14px;
            color: #555;
            margin: 25px 0 30px 0;
            text-align: center;
        }
        
        .cta-button {
            display: block;
            width: 280px;
            margin: 0 auto;
            background: linear-gradient(135deg, #059669, #34d399);
            color: white !important;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 8px;
            text-align: center;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4);
        }
        
        .contact-info {
            font-size: 13px;
            color: #666;
            margin-top: 30px;
            text-align: center;
        }
        
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
        }
        
        .footer-text {
            font-size: 13px;
            color: #6b7280;
        }
        
        .logo {
            font-size: 20px;
            font-weight: bold;
            color: white;
            margin-bottom: 5px;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                margin: 10px;
                border-radius: 8px;
            }
            
            .header {
                padding: 20px 15px;
            }
            
            .content {
                padding: 20px 15px;
            }
            
            .cta-button {
                width: 100%;
                max-width: 280px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <div class="logo">BNP</div>
            <h1>Contrato de Colaboración</h1>
        </div>
        
        <!-- Content -->
        <div class="content">
            <div class="greeting">
                Estimado/a ${beneficiario.nombre} ${beneficiario.apellido},
            </div>
            
            <div class="intro-text">
                Esperamos que se encuentre bien. Le enviamos el contrato de colaboración para su revisión y firma.
            </div>
            
            <!-- Contract Details -->
            <div class="contract-details">
                <div class="details-title">Detalles del contrato:</div>
                <ul class="details-list">
                    <li><strong>Número de contrato:</strong> ${
                      contrato.numero_contrato
                    }</li>
                    <li><strong>Fecha de inicio:</strong> ${new Date(
                      contrato.fecha_inicio
                    ).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}</li>
                    <li><strong>Fecha de fin:</strong> ${new Date(
                      contrato.fecha_fin
                    ).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}</li>
                    <li><strong>Monto:</strong> ${contrato.monto.valor} ${
    contrato.monto.moneda
  }</li>
                    <li><strong>Método de pago:</strong> ${
                      contrato.metodo_pago.tipo
                    }</li>
                    ${
                      contrato.observaciones
                        ? `<li><strong>Observaciones:</strong> ${contrato.observaciones}</li>`
                        : ""
                    }
                </ul>
            </div>
            
            <div class="review-instruction">
                Para revisar y firmar el contrato, haga clic en el siguiente enlace:
            </div>
            
            <!-- CTA Button -->
            <a href="${linkFirma}" class="cta-button">
                Revisar y Firmar Contrato
            </a>
            
            <div class="contact-info">
                Si tiene alguna pregunta o necesita aclaración sobre algún punto del contrato, no dude en contactarnos.
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="footer-text">
                Saludos cordiales,<br>
                <strong>Equipo BNP</strong>
            </div>
        </div>
    </div>
</body>
</html>
  `;
};

// Función auxiliar para generar email de texto plano (fallback)
const generarTextoPlanoContrato = (
  contrato,
  beneficiario,
  aliado,
  linkFirma
) => {
  return `
CONTRATO DE COLABORACIÓN

Estimado/a ${beneficiario.nombre} ${beneficiario.apellido},

Esperamos que se encuentre bien. Le enviamos el contrato de colaboración para su revisión y firma.

DETALLES DEL CONTRATO:
• Número de contrato: ${contrato.numero_contrato}
• Fecha de inicio: ${new Date(contrato.fecha_inicio).toLocaleDateString(
    "es-ES"
  )}
• Fecha de fin: ${new Date(contrato.fecha_fin).toLocaleDateString("es-ES")}
• Monto: ${contrato.monto.valor} ${contrato.monto.moneda}
• Método de pago: ${contrato.metodo_pago.tipo}
${contrato.observaciones ? `• Observaciones: ${contrato.observaciones}` : ""}

Para revisar y firmar el contrato, acceda al siguiente enlace:
${linkFirma}

Si tiene alguna pregunta o necesita aclaración sobre algún punto del contrato, no dude en contactarnos.

Saludos cordiales,
Equipo BNP
  `;
};

export { generarTemplateEmailContrato, generarTextoPlanoContrato };
