const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,       // mail.aldanexglobal.org
  port: Number(process.env.SMTP_PORT), // 465
  secure: process.env.SMTP_SECURE === 'true', // true for port 465
  auth: {
    user: process.env.SMTP_USER,     // info@aldanexglobal.org
    pass: process.env.SMTP_PASS,     // your email password
  },
});

/**
 * Send an email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text fallback
 */
async function sendEmail({ to, subject, html, text }) {
  const info = await transporter.sendMail({
    from: `"Aldanex Global Consult" <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''), // strip HTML for plain text fallback
  });
  return info;
}

// ── Email Templates ──────────────────────────────────────────

function welcomeEmail(studentName, studentId) {
  return {
    subject: 'Welcome to Aldanex Global Consult!',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1d4ed8;padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;">Aldanex Global Consult</h1>
        </div>
        <div style="padding:32px;background:#f9fafb;">
          <h2>Welcome, ${studentName}! 🎉</h2>
          <p>Your account has been successfully created.</p>
          <p><strong>Your Student ID:</strong> <span style="background:#dbeafe;padding:4px 12px;border-radius:4px;font-weight:bold;">${studentId}</span></p>
          <p>Here's what to do next:</p>
          <ol>
            <li>Complete your student profile</li>
            <li>Upload your required documents</li>
            <li>Wait for your counselor to be assigned</li>
          </ol>
          <a href="${process.env.FRONTEND_URL}/dashboard" 
             style="display:inline-block;background:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">
            Go to Dashboard
          </a>
        </div>
        <div style="padding:16px;text-align:center;color:#6b7280;font-size:12px;">
          © ${new Date().getFullYear()} Aldanex Global Consult. All rights reserved.
        </div>
      </div>
    `,
  };
}

function stageUpdateEmail(studentName, stageName, notes) {
  return {
    subject: `Application Update: ${stageName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1d4ed8;padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;">Aldanex Global Consult</h1>
        </div>
        <div style="padding:32px;background:#f9fafb;">
          <h2>Application Update</h2>
          <p>Dear ${studentName},</p>
          <p>Your application has been updated to a new stage:</p>
          <div style="background:#dbeafe;border-left:4px solid #1d4ed8;padding:16px;margin:16px 0;border-radius:4px;">
            <strong>${stageName}</strong>
          </div>
          ${notes ? `<p><strong>Notes from your counselor:</strong><br>${notes}</p>` : ''}
          <a href="${process.env.FRONTEND_URL}/dashboard" 
             style="display:inline-block;background:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">
            View Application
          </a>
        </div>
        <div style="padding:16px;text-align:center;color:#6b7280;font-size:12px;">
          © ${new Date().getFullYear()} Aldanex Global Consult. All rights reserved.
        </div>
      </div>
    `,
  };
}

function documentReviewEmail(studentName, documentName, status, reviewerNotes) {
  const statusConfig = {
    approved:           { color: '#16a34a', bg: '#dcfce7', label: 'Approved ✓' },
    rejected:           { color: '#dc2626', bg: '#fee2e2', label: 'Rejected ✗' },
    resubmit_requested: { color: '#d97706', bg: '#fef3c7', label: 'Resubmission Required' },
  };
  const cfg = statusConfig[status] || statusConfig.approved;

  return {
    subject: `Document ${cfg.label}: ${documentName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1d4ed8;padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;">Aldanex Global Consult</h1>
        </div>
        <div style="padding:32px;background:#f9fafb;">
          <h2>Document Review Update</h2>
          <p>Dear ${studentName},</p>
          <p>Your document has been reviewed:</p>
          <div style="background:${cfg.bg};border-left:4px solid ${cfg.color};padding:16px;margin:16px 0;border-radius:4px;">
            <strong style="color:${cfg.color};">${cfg.label}</strong><br>
            <span>${documentName}</span>
          </div>
          ${reviewerNotes ? `<p><strong>Reviewer Notes:</strong><br>${reviewerNotes}</p>` : ''}
          <a href="${process.env.FRONTEND_URL}/dashboard/documents" 
             style="display:inline-block;background:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">
            View Documents
          </a>
        </div>
        <div style="padding:16px;text-align:center;color:#6b7280;font-size:12px;">
          © ${new Date().getFullYear()} Aldanex Global Consult. All rights reserved.
        </div>
      </div>
    `,
  };
}

function sessionScheduledEmail(studentName, sessionType, platform, scheduledAt, meetingLink) {
  return {
    subject: 'Counseling Session Scheduled',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1d4ed8;padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;">Aldanex Global Consult</h1>
        </div>
        <div style="padding:32px;background:#f9fafb;">
          <h2>Counseling Session Scheduled 📅</h2>
          <p>Dear ${studentName},</p>
          <p>A counseling session has been scheduled for you:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;color:#6b7280;">Type</td><td style="padding:8px;font-weight:bold;">${sessionType}</td></tr>
            <tr style="background:#f3f4f6;"><td style="padding:8px;color:#6b7280;">Platform</td><td style="padding:8px;font-weight:bold;">${platform}</td></tr>
            <tr><td style="padding:8px;color:#6b7280;">Date & Time</td><td style="padding:8px;font-weight:bold;">${new Date(scheduledAt).toLocaleString()}</td></tr>
          </table>
          ${meetingLink ? `
          <a href="${meetingLink}" 
             style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:8px;">
            Join Meeting
          </a>` : ''}
        </div>
        <div style="padding:16px;text-align:center;color:#6b7280;font-size:12px;">
          © ${new Date().getFullYear()} Aldanex Global Consult. All rights reserved.
        </div>
      </div>
    `,
  };
}

module.exports = {
  sendEmail,
  templates: {
    welcomeEmail,
    stageUpdateEmail,
    documentReviewEmail,
    sessionScheduledEmail,
  },
};
