// Any SMTP relay works here. Gmail uses an App Password; Brevo uses its SMTP key.
// Without credentials, emails are printed to the backend terminal for local development.

async function sendMail({ to, subject, text, html }) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_APP_PASSWORD;

  if (!user || !pass) {
    console.log('\n[EMAIL not configured: printing instead of sending]');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log(text, '\n');
    return;
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : (Number(process.env.SMTP_PORT) || 465) === 465,
    auth: { user, pass }
  });
  await transporter.sendMail({ from: process.env.EMAIL_FROM || user, to, subject, text, html });
}

module.exports = { sendMail };
