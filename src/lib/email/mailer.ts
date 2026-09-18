import nodemailer from "nodemailer";

const SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  (SMTP_USER ? `Wager <${SMTP_USER}>` : "Wager <noreply@wager.app>");

function getTransporter() {
  if (!SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

function renderHtmlTemplate({
  headline,
  description,
  code,
  extraLink,
  extraLinkText,
}: {
  headline: string;
  description: string;
  code: string;
  extraLink?: string;
  extraLinkText?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0d13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0d13;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#131722;border:1px solid #1f2533;border-radius:16px;padding:32px 24px;text-align:center;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:24px;font-weight:700;letter-spacing:0.05em;color:#ffffff;">WAGER</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:12px;">
              <h1 style="margin:0;font-size:20px;font-weight:600;color:#ffffff;">${headline}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0;font-size:14px;line-height:1.5;color:#9ca3af;">${description}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="display:inline-block;background-color:#1c2233;border:1px solid #2e364f;border-radius:12px;padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:0.25em;color:#ffffff;font-family:monospace;">
                ${code}
              </div>
            </td>
          </tr>
          ${
            extraLink && extraLinkText
              ? `<tr>
            <td align="center" style="padding-bottom:24px;">
              <a href="${extraLink}" style="display:inline-block;background-color:#ffffff;color:#0b0d13;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
                ${extraLinkText}
              </a>
            </td>
          </tr>`
              : ""
          }
          <tr>
            <td style="border-top:1px solid #1f2533;padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.4;">
                This code will expire in <strong>15 minutes</strong>. If you did not request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export async function sendVerificationEmail(
  email: string,
  code: string,
): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.log("\n=======================================================");
    console.log(" [DEV EMAIL SIMULATOR] Email Verification Code");
    console.log(` To:      ${email}`);
    console.log(` Code:    ${code}`);
    console.log(` Expires: 15 minutes`);
    console.log(" (Set SMTP_USER and SMTP_PASS in .env to send real emails)");
    console.log("=======================================================\n");
    return true;
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: `Your Wager Verification Code: ${code}`,
      text: `Your Wager email verification code is: ${code}. It expires in 15 minutes.`,
      html: renderHtmlTemplate({
        headline: "Verify your email address",
        description:
          "Welcome to Wager. Use the 6-digit verification code below to activate your account.",
        code,
      }),
    });
    return true;
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  code: string,
  resetUrl?: string,
): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter) {
    console.log("\n=======================================================");
    console.log(" [DEV EMAIL SIMULATOR] Password Reset Code");
    console.log(` To:       ${email}`);
    console.log(` Code:     ${code}`);
    if (resetUrl) console.log(` Link:     ${resetUrl}`);
    console.log(` Expires:  15 minutes`);
    console.log(" (Set SMTP_USER and SMTP_PASS in .env to send real emails)");
    console.log("=======================================================\n");
    return true;
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: `Reset your Wager password: ${code}`,
      text: `Your password reset code is: ${code}. It expires in 15 minutes.${resetUrl ? ` Or visit: ${resetUrl}` : ""}`,
      html: renderHtmlTemplate({
        headline: "Reset your password",
        description:
          "We received a request to reset your Wager account password. Enter the code below or click the button to set a new password.",
        code,
        extraLink: resetUrl,
        extraLinkText: "Reset Password",
      }),
    });
    return true;
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return false;
  }
}
