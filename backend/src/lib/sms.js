/**
 * SMS Notification Service — Twilio
 * Sends SMS to students when their application stage changes.
 */

let twilioClient = null;

function getClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken ||
        accountSid === 'your_twilio_account_sid' ||
        authToken === 'your_twilio_auth_token') {
      return null; // Twilio not configured — skip silently
    }

    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

/**
 * Send an SMS message.
 * @param {string} to - Phone number in E.164 format e.g. +254712345678
 * @param {string} message - SMS body text
 */
async function sendSMS(to, message) {
  const client = getClient();
  if (!client) {
    console.log('SMS skipped — Twilio not configured. Would send to:', to);
    return null;
  }

  if (!to || !to.startsWith('+')) {
    console.warn('SMS skipped — invalid phone number:', to);
    return null;
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log('SMS sent to', to, '| SID:', result.sid);
    return result;
  } catch (err) {
    console.error('SMS failed to', to, ':', err.message);
    return null;
  }
}

// ── SMS Message Templates ─────────────────────────────────────

const smsTemplates = {

  stageUpdate(studentName, stageName) {
    return `Hi ${studentName}, your Aldanex application has moved to: ${stageName}. Log in to your portal for details: ${process.env.FRONTEND_URL}/dashboard`;
  },

  documentApproved(studentName, docName) {
    return `Hi ${studentName}, your document "${docName}" has been approved by Aldanex. Log in to check your progress: ${process.env.FRONTEND_URL}/dashboard/documents`;
  },

  documentRejected(studentName, docName, notes) {
    const noteText = notes ? ` Reason: ${notes}` : '';
    return `Hi ${studentName}, your document "${docName}" was rejected.${noteText} Please re-upload: ${process.env.FRONTEND_URL}/dashboard/documents`;
  },

  offerReceived(studentName, universityName, outcome) {
    const outcomeText = outcome === 'unconditional' ? 'Congratulations! Unconditional offer' :
                        outcome === 'conditional'   ? 'Conditional offer' :
                        outcome === 'waitlisted'    ? 'Waitlisted' : 'Update';
    return `Hi ${studentName}, ${outcomeText} received from ${universityName}. Log in to respond: ${process.env.FRONTEND_URL}/dashboard/universities`;
  },

  visaApproved(studentName) {
    return `Congratulations ${studentName}! Your visa has been approved. Log in to Aldanex for next steps: ${process.env.FRONTEND_URL}/dashboard/visa`;
  },

  sessionScheduled(studentName, platform, dateStr) {
    return `Hi ${studentName}, a counseling session has been scheduled for ${dateStr} via ${platform}. Log in for details: ${process.env.FRONTEND_URL}/dashboard/messages`;
  },

};

module.exports = { sendSMS, smsTemplates };
