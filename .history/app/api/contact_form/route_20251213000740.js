import { mailTransporter } from "@/utils/transporter";
import dns from "dns/promises";
import { send } from "process";
import { success } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function isValidDomain(email) {
  const domain = email.split("@")[1];
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch (error) {
    return false;
  }
}

const contactFormZodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { message: "Name must be at least 3 characters long." })
    .max(50, { message: "Name must be at most 50 characters." })
    .regex(/^[a-zA-Z\s'-]+$/, {
      message:
        "Name can only contain letters, spaces, apostrophes, and hyphens.",
    }),
  email: z
    .string()
    .trim()
    .min(6, { message: "Email is required." })
    .max(254, { message: "Email is too long." })
    .email({ message: "Invalid email address." }),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?\d{1,3}[-.\s])?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}$/, {
      message: "Please enter a valid phone number.",
    })
    .min(9, { message: "Phone number is too short." })
    .max(20, { message: "Phone number is too long." }),
  message: z
    .string()
    .trim()
    .min(15, { message: "Message should be at least 15 characters long." })
    .max(2000, { message: "Message is too long." })
    .refine((val) => val.split(/\s+/).filter(Boolean).length >= 6, {
      message: "Message should be at least 6 words.",
    }),
  priority: z.boolean().default(false),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const parsedData = contactFormZodSchema.safeParse(body);

    if (!parsedData.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Validation Failed!",
          errors: parsedData.error.format(),
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const email = parsedData.data.email;
    const mxValid = await isValidDomain(email);

    if (!mxValid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "The email domain is invalid or cannot receive email.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const senderEmail = process.env.SENDER_EMAIL;
    const pass = process.env.EMAIL_APP_PASS;
    const receiverEmail = process.env.RECEIVER_EMAIL;

    const transporter = mailTransporter("gmail", senderEmail, pass);

    // 1. Email to the receiver (admin)
    const { name, phone, email: customerEmail, message, priority } = parsedData.data;

    // Email Subject & Header based on Priority
    const emailSubject = priority
      ? "🚨 High Priority Contact Form Submission"
      : "New Contact Form Submission";

    const priorityNote = priority
      ? `<div style="padding: 12px; background: #ffe5e5; border-radius: 6px; color: #c0392b; font-weight: bold; margin-bottom: 18px; border: 1px solid #f9b2b2;">
            <span style="font-size: 18px;">🚨 EMERGENCY:</span> Customer marked this as <u>High Priority</u>! Please respond as soon as possible.
         </div>`
      : `<div style="padding: 12px; background: #e8f6ff; border-radius: 6px; color: #2980b9; font-weight: bold; margin-bottom: 18px; border: 1px solid #b3e2ff;">
            New message received from the contact form.
         </div>`;

    await transporter.sendMail({
      from: senderEmail,
      to: receiverEmail,
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f4f6fa; padding: 40px 0;">
          <div style="max-width:560px; margin: auto; background: #fff; border-radius: 10px; box-shadow: 0 0 6px rgba(0,0,0,0.07); overflow: hidden;">
            <div style="background: #f9cb00; color: #000; font-size: 22px; font-weight: bold; padding: 20px 32px; text-align: center;">
              ${emailSubject}
            </div>
            <div style="padding: 32px;">
              ${priorityNote}
              <table style="width:100%; margin-bottom: 24px; font-size:14px;">
                <tr>
                  <td style="font-weight:bold;padding:6px 10px 6px 0; width:100px;">Name:</td>
                  <td style="padding:6px 0;">${name}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;padding:6px 10px 6px 0;">Email:</td>
                  <td style="padding:6px 0;">${customerEmail}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;padding:6px 10px 6px 0;">Phone:</td>
                  <td style="padding:6px 0;">${phone}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;padding:6px 10px 6px 0;">Priority:</td>
                  <td style="padding:6px 0;">${priority ? 'High / Emergency' : 'Normal'}</td>
                </tr>
              </table>
              <div style="margin-bottom:16px;">
                <div style="font-weight:bold; margin-bottom:7px;">Message:</div>
                <div style="padding:15px; background:#f7f7f7; border-radius:6px; color:#222;">
                  ${message.replace(/\n/g, "<br />")}
                </div>
              </div>
              <hr style="border:none;border-top:1px solid #e5e7eb; margin:30px 0 15px 0;" />
              <div style="font-size: 13px; color: #888888;">
                This notice was automatically generated from your website's contact form${priority ? " (HIGH PRIORITY)" : ""}.
              </div>
            </div>
          </div>
        </div>
      `,
    });

    // 2. Email to the user, confirming receipt
    await transporter.sendMail({
      from: receiverEmail,
      to: email,
      subject: "Thank you for contacting us – We have received your message",
      html: `
        <div style="font-family: Arial, sans-serif; background: #f4f6fa; padding: 40px 0;">
          <div style="max-width:560px; margin: auto; background: #fff; border-radius: 10px; box-shadow: 0 0 6px rgba(0,0,0,0.07); overflow: hidden;">
            <div style="background: #f9cb00; color: #000; font-size: 22px; font-weight: bold; padding: 20px 32px; text-align: center;">
              Thank you for your message!
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Hi${name ? ` ${name}` : ''},<br><br>
                Thank you for reaching out to us via our website contact form. We have received your message and will get back to you as soon as possible.<br>
                Please review the details you submitted below:
              </p>
              <table style="width:100%; margin-bottom: 24px; font-size:14px;">
                <tr>
                  <td style="font-weight:bold;padding:6px 10px 6px 0; width:100px;">Name:</td>
                  <td style="padding:6px 0;">${name}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;padding:6px 10px 6px 0;">Email:</td>
                  <td style="padding:6px 0;">${customerEmail}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold;padding:6px 10px 6px 0;">Phone:</td>
                  <td style="padding:6px 0;">${phone}</td>
                </tr>
              </table>
              <div style="margin-bottom:16px;">
                <div style="font-weight:bold; margin-bottom:7px;">Message you sent:</div>
                <div style="padding:15px; background:#f7f7f7; border-radius:6px; color:#222;">
                  ${message.replace(/\n/g, "<br />")}
                </div>
              </div>
              <p style="font-size: 15px; margin-top: 28px;">
                If any of this information is incorrect, please reply directly to this email to let us know.<br>
                <br>
                We appreciate your interest and will be in touch soon.
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb; margin:30px 0 15px 0;" />
              <div style="font-size: 13px; color: #888888;">
                This is an automated confirmation email. No further action is needed at this time.
              </div>
            </div>
          </div>
        </div>
      `,
    })

    return new Response(
        JSON.stringify({
            success: true,
            message: "Subscription successfull"
        }),{
            status: 200, headers: corsHeaders
        }
    )
  } catch (error) {
    console.error("POST /contact_form error: ",error)
    return new Response(
        JSON.stringify({
            success: false,
            message: 'Subscription Failed',
        })
    )
  }
}
