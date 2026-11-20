// api/send-otp.js
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { canal, destino, nombre } = req.body || {};

  if (!canal || !destino) {
    return res.status(400).json({ error: 'Faltan datos de contacto para enviar el código.' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expiraEn = Date.now() + 5 * 60 * 1000;

  try {
    if (canal === 'email') {
      if (process.env.RESEND_API_KEY) {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Sigma Fitness <seguridad@tudominio.com>',
            to: [destino],
            subject: 'Código de recuperación - Sigma Fitness',
            html: `
              <div style="background:#09090B;color:#F4F4F5;padding:24px;font-family:sans-serif;border-radius:10px;">
                <h2 style="color:#DC143C;margin-top:0;">SIGMA FITNESS</h2>
                <p>Hola <strong>${nombre || 'Atleta'}</strong>,</p>
                <p>Tu código de verificación de seguridad es:</p>
                <div style="font-size:28px;font-weight:900;letter-spacing:6px;color:#DC143C;margin:16px 0;">
                  ${otp}
                </div>
                <p style="font-size:12px;color:#A1A1AA;">Expira en 5 minutos. Si no solicitaste este cambio, ignora este mensaje.</p>
              </div>
            `
          })
        });

        if (!emailResponse.ok) {
          throw new Error('No se pudo despachar el correo desde el proveedor.');
        }
      }

      return res.status(200).json({
        ok: true,
        canal: 'email',
        mensaje: 'Código generado y despachado al correo.',
        tokenVerificacion: Buffer.from(`${destino}:${otp}:${expiraEn}`).toString('base64')
      });
    }

    if (canal === 'whatsapp') {
      if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
        const telefonoLimpio = destino.replace(/[^\d]/g, '');
        await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: telefonoLimpio,
            type: 'text',
            text: {
              body: `Sigma Fitness - Tu código de recuperación es: *${otp}*. Válido por 5 minutos.`
            }
          })
        });
      }

      return res.status(200).json({
        ok: true,
        canal: 'whatsapp',
        mensaje: 'Código generado en servidor para WhatsApp.',
        tokenVerificacion: Buffer.from(`${destino}:${otp}:${expiraEn}`).toString('base64')
      });
    }

    return res.status(400).json({ error: 'Canal no soportado.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error interno en el servidor.' });
  }
}
