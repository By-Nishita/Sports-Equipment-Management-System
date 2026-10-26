// Sends email through an email API over HTTPS (Resend here; Brevo/SendGrid work the same way).
// We use an API and not SMTP, because many hosts (e.g. Render free) block SMTP ports.
//
// .env needs:  EMAIL_API_KEY=...   EMAIL_FROM="Sports Room <no-reply@yourdomain>"
// With no EMAIL_API_KEY (your laptop), the email is printed in the backend terminal instead.

async function sendMail({ to, subject, text, html }) {
  const key = process.env.EMAIL_API_KEY;

  if (!key) {
    console.log('\n[EMAIL not configured: printing instead of sending]');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log(text, '\n');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text, html })
  });

  if (!response.ok) {
    throw new Error(`Email API error ${response.status}: ${await response.text()}`);
  }
}

module.exports = { sendMail };
