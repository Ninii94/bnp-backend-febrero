import axios from 'axios';

class DocuSignService {
  constructor() {
    this.baseURL = process.env.DOCUSIGN_BASE_URL;
    this.accessToken = null;
    this.accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  }

  async obtenerAccessToken() {
    try {
      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        grant_type: 'authorization_code',
        client_id: process.env.DOCUSIGN_CLIENT_ID,
        client_secret: process.env.DOCUSIGN_CLIENT_SECRET,
        code: process.env.DOCUSIGN_AUTH_CODE
      });
      
      this.accessToken = response.data.access_token;
      return this.accessToken;
    } catch (error) {
      console.error('Error obteniendo access token:', error);
      throw error;
    }
  }

  async enviarContrato({ contratoId, contenido, signatario, emailMensaje, fechaVencimiento }) {
    try {
      if (!this.accessToken) {
        await this.obtenerAccessToken();
      }

      const envelope = {
        emailSubject: `Contrato de Equipo - ${signatario.nombre}`,
        emailMessage: emailMensaje || 'Por favor revise y firme el contrato adjunto.',
        documents: [{
          documentId: '1',
          name: `Contrato-${contratoId}.pdf`,
          htmlDefinition: {
            source: contenido
          }
        }],
        recipients: {
          signers: [{
            email: signatario.email,
            name: signatario.nombre,
            recipientId: '1',
            tabs: {
              signHereTabs: [{
                documentId: '1',
                pageNumber: '1',
                xPosition: '100',
                yPosition: '100'
              }],
              dateSignedTabs: [{
                documentId: '1',
                pageNumber: '1',
                xPosition: '300',
                yPosition: '100'
              }]
            }
          }]
        },
        status: 'sent'
      };

      if (fechaVencimiento) {
        envelope.notification = {
          expirations: {
            expireEnabled: 'true',
            expireAfter: fechaVencimiento,
            expireWarn: '3'
          }
        };
      }

      const response = await axios.post(
        `${this.baseURL}/v2.1/accounts/${this.accountId}/envelopes`,
        envelope,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        envelopeId: response.data.envelopeId,
        status: response.data.status,
        uri: response.data.uri
      };

    } catch (error) {
      console.error('Error enviando a DocuSign:', error);
      throw error;
    }
  }

  async obtenerEstadoEnvelope(envelopeId) {
    try {
      if (!this.accessToken) {
        await this.obtenerAccessToken();
      }

      const response = await axios.get(
        `${this.baseURL}/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error obteniendo estado de DocuSign:', error);
      throw error;
    }
  }
}

export const docusignService = new DocuSignService();