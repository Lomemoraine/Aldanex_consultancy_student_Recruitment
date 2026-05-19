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

function verificationEmail(studentName, otp) {
  return {
    subject: 'Verify Your Aldanex Account — Your Code Inside',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1e3d8f;padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">ALDANEX</h1>
          <p style="color:#93c5fd;margin:4px 0 0;font-size:12px;letter-spacing:2px;">CONSULTANCY</p>
        </div>
        <div style="padding:40px 32px;background:#f9fafb;">
          <h2 style="color:#1e3d8f;margin:0 0 8px;">Verify Your Email Address</h2>
          <p style="color:#6b7280;margin:0 0 24px;">Hi ${studentName}, thanks for registering with Aldanex Global Consult. Use the code below to verify your email address.</p>

          <div style="background:white;border:2px solid #e5e7eb;border-radius:12px;padding:32px;text-align:center;margin:24px 0;">
            <p style="color:#6b7280;font-size:13px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;">Your Verification Code</p>
            <div style="font-size:48px;font-weight:bold;letter-spacing:12px;color:#1e3d8f;font-family:monospace;">${otp}</div>
            <p style="color:#9ca3af;font-size:12px;margin:16px 0 0;">This code expires in <strong>15 minutes</strong></p>
          </div>

          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin:16px 0;">
            <p style="color:#92400e;font-size:13px;margin:0;">⚠️ If you did not create an account with Aldanex, please ignore this email.</p>
          </div>
        </div>
        <div style="padding:16px;text-align:center;color:#9ca3af;font-size:12px;background:#f3f4f6;">
          © ${new Date().getFullYear()} Aldanex Global Consult. All rights reserved.
        </div>
      </div>
    `,
  };
}

function welcomeEmail(studentName, studentId) {
  const firstName = studentName.split(' ')[0];
  const year = new Date().getFullYear();
  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;

  return {
    subject: `Welcome to Aldanex, ${firstName}! Your journey starts now 🎓`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">

  <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0b1630 0%,#1e3d8f 60%,#2a4ea8 100%);padding:40px 32px;text-align:center;">
      <h1 style="color:white;margin:0;font-size:28px;letter-spacing:2px;font-weight:800;">ALDANEX</h1>
      <p style="color:#c7a84f;margin:4px 0 0;font-size:11px;letter-spacing:4px;text-transform:uppercase;">Global Consult</p>
      <div style="width:48px;height:2px;background:#c7a84f;margin:16px auto 0;"></div>
    </div>

    <!-- Hero message -->
    <div style="padding:40px 32px 24px;text-align:center;background:#fafafa;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:48px;margin-bottom:12px;">🎓</div>
      <h2 style="color:#1e3d8f;font-size:24px;margin:0 0 8px;">Welcome aboard, ${firstName}!</h2>
      <p style="color:#6b7280;font-size:15px;margin:0;line-height:1.6;">
        Your account has been verified and you're officially part of the Aldanex family.<br>
        Your international education journey begins today.
      </p>
    </div>

    <!-- Student ID -->
    <div style="padding:20px 32px;background:white;text-align:center;border-bottom:1px solid #f3f4f6;">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Your Student ID</p>
      <div style="display:inline-block;background:#eff6ff;border:2px solid #bfdbfe;border-radius:8px;padding:8px 24px;">
        <span style="color:#1e3d8f;font-size:20px;font-weight:bold;font-family:monospace;letter-spacing:2px;">${studentId}</span>
      </div>
      <p style="color:#9ca3af;font-size:11px;margin:8px 0 0;">Keep this ID safe — you'll need it for all communications with us.</p>
    </div>

    <!-- What to expect -->
    <div style="padding:32px;">
      <h3 style="color:#1e3d8f;font-size:16px;margin:0 0 20px;font-weight:700;">What happens next?</h3>

      <div style="display:flex;flex-direction:column;gap:0;">

        <!-- Step 1 -->
        <div style="display:flex;gap:16px;padding:16px 0;border-bottom:1px solid #f3f4f6;">
          <div style="width:36px;height:36px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:36px;font-weight:bold;color:#1e3d8f;font-size:14px;">1</div>
          <div>
            <p style="margin:0 0 4px;font-weight:700;color:#111827;font-size:14px;">Complete Your Profile</p>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">Fill in your personal details, passport information, educational background, and study preferences so we can match you with the right universities.</p>
          </div>
        </div>

        <!-- Step 2 -->
        <div style="display:flex;gap:16px;padding:16px 0;border-bottom:1px solid #f3f4f6;">
          <div style="width:36px;height:36px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:36px;font-weight:bold;color:#1e3d8f;font-size:14px;">2</div>
          <div>
            <p style="margin:0 0 4px;font-weight:700;color:#111827;font-size:14px;">Upload Your Documents</p>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">Upload your academic certificates, passport, English proficiency results, and financial documents. Our team reviews each one carefully.</p>
          </div>
        </div>

        <!-- Step 3 -->
        <div style="display:flex;gap:16px;padding:16px 0;border-bottom:1px solid #f3f4f6;">
          <div style="width:36px;height:36px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:36px;font-weight:bold;color:#1e3d8f;font-size:14px;">3</div>
          <div>
            <p style="margin:0 0 4px;font-weight:700;color:#111827;font-size:14px;">Meet Your Personal Counselor</p>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">A dedicated counselor will be assigned to guide you through university selection, application preparation, and every step of your journey.</p>
          </div>
        </div>

        <!-- Step 4 -->
        <div style="display:flex;gap:16px;padding:16px 0;border-bottom:1px solid #f3f4f6;">
          <div style="width:36px;height:36px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:36px;font-weight:bold;color:#1e3d8f;font-size:14px;">4</div>
          <div>
            <p style="margin:0 0 4px;font-weight:700;color:#111827;font-size:14px;">University Applications & Offers</p>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">We prepare and submit your applications to top universities worldwide. You'll receive and manage offer letters directly through your portal.</p>
          </div>
        </div>

        <!-- Step 5 -->
        <div style="display:flex;gap:16px;padding:16px 0;">
          <div style="width:36px;height:36px;background:#eff6ff;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:36px;font-weight:bold;color:#1e3d8f;font-size:14px;">5</div>
          <div>
            <p style="margin:0 0 4px;font-weight:700;color:#111827;font-size:14px;">Visa Support & Pre-Departure</p>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">Our visa officers guide you through the entire visa process. We also prepare you for departure with accommodation support and pre-departure briefings.</p>
          </div>
        </div>

      </div>
    </div>

    <!-- Stats bar -->
    <div style="background:#1e3d8f;padding:24px 32px;">
      <div style="display:flex;justify-content:space-around;text-align:center;">
        <div>
          <p style="color:#c7a84f;font-size:22px;font-weight:bold;margin:0;">2,400+</p>
          <p style="color:#93c5fd;font-size:11px;margin:4px 0 0;">Students Placed</p>
        </div>
        <div style="border-left:1px solid rgba(255,255,255,0.2);padding-left:24px;">
          <p style="color:#c7a84f;font-size:22px;font-weight:bold;margin:0;">150+</p>
          <p style="color:#93c5fd;font-size:11px;margin:4px 0 0;">Partner Universities</p>
        </div>
        <div style="border-left:1px solid rgba(255,255,255,0.2);padding-left:24px;">
          <p style="color:#c7a84f;font-size:22px;font-weight:bold;margin:0;">94%</p>
          <p style="color:#93c5fd;font-size:11px;margin:4px 0 0;">Visa Success Rate</p>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding:32px;text-align:center;background:white;">
      <p style="color:#374151;font-size:15px;margin:0 0 20px;line-height:1.6;">
        Your portal is ready. Start by completing your profile so we can begin working on your application right away.
      </p>
      <a href="${dashboardUrl}"
         style="display:inline-block;background:#f97316;color:white;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;letter-spacing:0.5px;">
        Go to My Dashboard →
      </a>
      <p style="color:#9ca3af;font-size:12px;margin:16px 0 0;">
        Or copy this link: <span style="color:#1e3d8f;">${dashboardUrl}</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">
        Questions? Reply to this email or message your counselor through the portal.
      </p>
      <p style="color:#9ca3af;font-size:11px;margin:0;">
        © ${year} Aldanex Global Consult · <a href="mailto:info@aldanexglobal.org" style="color:#1e3d8f;text-decoration:none;">info@aldanexglobal.org</a>
      </p>
    </div>

  </div>

</body>
</html>
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

function counselorAssignedEmail(counselorName, studentName, studentId, applicationId) {
  const firstName = counselorName.split(' ')[0];
  const applicationUrl = `${process.env.FRONTEND_URL}/admin/applications/${applicationId}`;

  return {
    subject: `New Student Assigned: ${studentName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1d4ed8;padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;">Aldanex Global Consult</h1>
        </div>
        <div style="padding:32px;background:#f9fafb;">
          <h2>New Student Assignment 👤</h2>
          <p>Dear ${firstName},</p>
          <p>You have been assigned as the counselor for a new student:</p>
          <div style="background:white;border:2px solid #e5e7eb;border-radius:12px;padding:24px;margin:20px 0;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px;color:#6b7280;font-size:13px;">Student Name</td>
                <td style="padding:8px;font-weight:bold;font-size:15px;color:#111827;">${studentName}</td>
              </tr>
              <tr style="background:#f9fafb;">
                <td style="padding:8px;color:#6b7280;font-size:13px;">Student ID</td>
                <td style="padding:8px;font-weight:bold;font-size:15px;color:#1d4ed8;">${studentId}</td>
              </tr>
            </table>
          </div>
          <div style="background:#dbeafe;border-left:4px solid #1d4ed8;padding:16px;margin:16px 0;border-radius:4px;">
            <p style="margin:0;color:#1e3d8f;font-size:14px;">
              <strong>Next Steps:</strong><br>
              • Review the student's profile and application details<br>
              • Check uploaded documents for completeness<br>
              • Schedule an initial counseling session<br>
              • Begin university selection and application planning
            </p>
          </div>
          <a href="${applicationUrl}" 
             style="display:inline-block;background:#1d4ed8;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;margin-top:16px;font-weight:bold;">
            View Student Application →
          </a>
          <p style="color:#6b7280;font-size:12px;margin:16px 0 0;">
            Or copy this link: <span style="color:#1d4ed8;">${applicationUrl}</span>
          </p>
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
    verificationEmail,
    welcomeEmail,
    stageUpdateEmail,
    documentReviewEmail,
    sessionScheduledEmail,
    counselorAssignedEmail,
  },
};
