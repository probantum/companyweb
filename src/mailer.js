const nodemailer = require('nodemailer');
const db = require('./db');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

// Emails everyone configured in admin Settings when a new contact form
// submission comes in. Silently no-ops if SMTP isn't configured yet, or no
// notify addresses are set — the contact form must keep working either way.
async function notifyNewSubmission(submission) {
  const mail = getTransporter();
  if (!mail) {
    console.warn('[mailer] SMTP_HOST not set — skipping new-submission notification email.');
    return;
  }

  const settings = await db.getById('settings', 'default');
  const recipients = settings?.notifyEmails || [];
  if (!recipients.length) return;

  await mail.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients.join(', '),
    subject: `New contact form submission: ${submission.subject}`,
    text: [
      `Name: ${submission.name}`,
      `Email: ${submission.email}`,
      `Topic: ${submission.topic}`,
      `Date: ${submission.date}`,
      '',
      submission.message,
    ].join('\n'),
  });
}

module.exports = { notifyNewSubmission };
