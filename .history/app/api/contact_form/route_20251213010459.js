import { mailTransporter } from "@/utils/transporter";
import dns from "dns/promises";
import { send } from "process";
import z from "zod";
import { limit } from "@arcjet/rate-limiter";
import { createRemoteClient } from "@arcjet/node";

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
  email: z.string().trim().email({ message: "Invalid email address." }),
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

const arcjetClient = createRemoteClient({
    token: process.env.ARCJET_KEY
})
const limiterOptions = {
    limit: 5,
    interval: 10 * 60 * 1000, // per 10 minutes
}; // 5 request per minute

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

    // ip detection for Arcjet
    const ip = request.headers.get("x-forwarded-for")?.split(',')[0].trim() || request.headers.get('host') || "unknown";

    // Arcjet rate limiter
    const allowed = await aj.check(ip);
    if (!allowed) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Too many requests. Please try again later",
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    const senderEmail = process.env.SENDER_EMAIL;
    const pass = process.env.EMAIL_APP_PASS;
    const receiverEmail = process.env.RECEIVER_EMAIL;

    if (!senderEmail || !pass || !receiverEmail) {
      console.error("Missing email environment variables!");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Server configuration error.",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    const transporter = mailTransporter("gmail", senderEmail, pass);

    // 1. Email to the receiver (admin)
    const {
      name,
      phone,
      email: customerEmail,
      message,
      priority,
    } = parsedData.data;

    // Branding headline with inline gradient styles for max compatibility
    const himalayaBanner = `
      <!--[if !mso]><!-- -->
      <div style="text-align:center;margin-bottom:20px;">
        <span aria-label="HimalayaFace" style="
          display:inline-block;
          font-size:2.1rem;
          font-family:'Segoe UI',Arial,sans-serif;
          font-weight:bold;
          letter-spacing:1.7px;
          background-image:linear-gradient(to right,#F9CB00,#E2792B);
          background-clip:text;-webkit-background-clip:text;
          color:transparent;-webkit-text-fill-color:transparent;
        ">HimalayaFace</span>
      </div>
      <!--<![endif]-->
      <!--[if mso]>
      <div style="text-align:center;margin-bottom:20px;">
        <span style="font-size:2.1rem;font-family:'Segoe UI',Arial,sans-serif;font-weight:bold;letter-spacing:1.7px;color:#E0920A;">HimalayaFace</span>
      </div>
      <![endif]-->
      <span style="display:none;">HimalayaFace</span>
    `;

    // Loader: fallback for email - reduce to static colored dots (no animation)
    const fallbackLoader = `
      <span aria-hidden="true" style="margin-left:8px;">
        <span style="display:inline-block;width:8px;height:8px;margin-right:2px;border-radius:50%;background:#F9CB00;vertical-align:middle;"></span>
        <span style="display:inline-block;width:8px;height:8px;margin-right:2px;border-radius:50%;background:#E2792B;vertical-align:middle;"></span>
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F9CB00;vertical-align:middle;"></span>
      </span>
      <span style="display:none;"> ... </span>
    `;

    // Priority note: SVG is safe, but no animation, use aria-label/fallback
    const priorityNote = priority
      ? `<div style="padding:16px;background:#ffe5e5;border-radius:10px;color:#c0392b;font-weight:bold;margin-bottom:24px;border:1px solid #f9b2b2;display:flex;align-items:center;box-shadow:0 0 6px #ffd3a47a;">
          <span role="img" aria-label="Emergency" style="font-size:30px;display:inline-block;margin-right:12px;">&#9888;</span>
          <span>
            <span style="font-size:17px;"><b>Emergency:</b></span>
            Customer marked this as <u>High Priority</u>! Please respond <span style="text-decoration:underline;">ASAP</span>.
          </span>
        </div>`
      : `<div style="padding:14px;background:#f5fcff;border-radius:8px;color:#0074d9;font-weight:bold;margin-bottom:24px;border:1px solid #d2f2fc;display:flex;align-items:center;box-shadow:0 0 4px #e7f2ff;">
          <span role="img" aria-label="Info" style="font-size:20px;display:inline-block;margin-right:8px;">ℹ️</span>
          New message received from the contact form.
        </div>`;

    // To maximize compatibility, put all key declarations inline and avoid CSS classes or <style> tags

    // Subject
    const emailSubject = priority
      ? "🚨 High Priority Contact Form Submission — HimalayaFace"
      : "New Contact Form Submission — HimalayaFace";

    // Email to the admin/receiver
    await transporter.sendMail({
      from: senderEmail,
      to: receiverEmail,
      subject: emailSubject,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f9fafb;padding:55px 0 45px 0;">
          <div style="max-width:620px;margin:auto;background:#fff;border-radius:17px;box-shadow:0 10px 40px rgba(249,203,0,0.14),0 2px 7px rgba(0,0,0,.07);overflow:hidden;">
            ${himalayaBanner}
            <div style="background:linear-gradient(to right,#F9CB00,#E2792B);color:#fff;font-size:25px;font-weight:bold;padding:18px 40px 18px 36px;text-align:center;letter-spacing:2px;">
              <span aria-hidden="true">${emailSubject} ${
        priority ? fallbackLoader : ""
      }</span>
              <span style="display:none;">
                ${
                  priority
                    ? "High Priority Contact form received."
                    : "New contact form submission."
                }
              </span>
            </div>
            <div style="padding:38px 37px 28px 37px;">
              ${priorityNote}
              <table style="width:100%;margin-bottom:27px;font-size:15px;background:#fcfcfc;border-radius:7px;border:1px solid #f7e7ce;box-shadow:0 0 10px #f9cb0033;">
                <tr>
                  <td style="font-weight:600;padding:8px 13px 8px 0;width:110px;color:#432;">Name:</td>
                  <td style="padding:8px 0;">${name}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;padding:8px 13px 8px 0;color:#432;">Email:</td>
                  <td style="padding:8px 0;">${customerEmail}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;padding:8px 13px 8px 0;color:#432;">Phone:</td>
                  <td style="padding:8px 0;">${phone}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;padding:8px 13px 8px 0;color:#432;">Priority:</td>
                  <td style="padding:8px 0;">${
                    priority ? "High / Emergency 🚨" : "Normal"
                  }</td>
                </tr>
              </table>
              <div style="margin-bottom:19px;">
                <div style="font-weight:600;margin-bottom:10px;">Message Content:</div>
                <div style="padding:17px 13px;background:#f7f7fa;border-radius:9px;color:#2e2100;font-size:15px;border:1px dashed #F9CB00;">
                  ${message.replace(/\n/g, "<br />")}
                </div>
              </div>
              <div style="text-align:center;margin-top:33px;">
                <span style="color:#ffd122;font-size:13.6px;letter-spacing:0.2px;">
                  This notice was automatically generated from&nbsp;
                  <b style="background-image:linear-gradient(to right,#F9CB00,#E2792B);
                            background-clip:text;-webkit-background-clip:text;
                            color:transparent;-webkit-text-fill-color:transparent;">
                    HimalayaFace
                  </b>'s website contact form${
                    priority ? " <b>(HIGH PRIORITY)</b>" : ""
                  }.
                </span>
                <br />
                <a href="https://himalayaface.com" target="_blank"
                  style="display:inline-block;margin-top:17px;background:#F9CB00;color:#432128;text-decoration:none;padding:8px 25px;border-radius:22px;font-weight:bold;letter-spacing:1.1px;font-size:15px;">
                  Visit HimalayaFace
                </a>
              </div>
            </div>
          </div>
        </div>
      `,
    });

    // 2. Email to the user (confirmation)
    await transporter.sendMail({
      from: receiverEmail,
      to: email,
      subject:
        "Thank you for contacting HimalayaFace — We have received your message",
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;padding:48px 0;">
          <div style="max-width:610px;margin:auto;background:#fff;border-radius:15px;box-shadow:0 7px 36px rgba(249,200,0,0.08),0 2px 7px rgba(0,0,0,.07);overflow:hidden;">
            ${himalayaBanner}
            <div style="background:linear-gradient(to right,#F9CB00,#E2792B);color:#fff;font-size:23px;font-weight:bold;padding:19px 26px 17px 26px;text-align:center;letter-spacing:2px;">
              <span aria-hidden="true">Thank you for your message to 
                <span style="background-image:linear-gradient(to right,#F9CB00,#E2792B,#F9CB00 65%);background-clip:text;-webkit-background-clip:text;color:transparent;-webkit-text-fill-color:transparent;font-weight:900;">HimalayaFace</span>! ${fallbackLoader}
              </span>
              <span style="display:none;">We have received your message at HimalayaFace.</span>
            </div>
            <div style="padding:32px 33px 27px 33px;">
              <p style="font-size:16.6px;margin-bottom:15px;">
                Hi${name ? ` ${name}` : ""},<br/>
                Thank you for contacting&nbsp;<b style="background-image:linear-gradient(to right,#F9CB00,#E2792B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-fill-color:transparent;">HimalayaFace</b>.
                We have received your message and will get back to you as soon as possible.<br/>
                Please review your details below:
              </p>
              <table style="width:100%;margin-bottom:26px;font-size:14.5px;background:#fef8e7;border-radius:7px;border:1px solid #F9CB00;box-shadow:0 0 5px #F9CB0033;">
                <tr>
                  <td style="font-weight:600;padding:8px 12px 8px 0;width:102px;color:#432;">Name:</td>
                  <td style="padding:8px 0;">${name}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;padding:8px 12px 8px 0;color:#432;">Email:</td>
                  <td style="padding:8px 0;">${customerEmail}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;padding:8px 12px 8px 0;color:#432;">Phone:</td>
                  <td style="padding:8px 0;">${phone}</td>
                </tr>
              </table>
              <div style="margin-bottom:17px;">
                <div style="font-weight:600;margin-bottom:8px;">Your Message:</div>
                <div style="padding:15px 13px;background:#f7f7f7;border-radius:8px;color:#23201a;font-size:15.3px;border:1px dashed #F9CB00;">
                  ${message.replace(/\n/g, "<br />")}
                </div>
              </div>
              <p style="font-size:15.1px;margin-top:28px;color:#7c600a;">
                Please reply to this email if you wish to update your inquiry.<br/>
                <b>We appreciate your interest and will be in touch soon!</b>
              </p>
              <div style="text-align:center;margin:27px 0 0 0;">
                <a href="https://himalayaface.com" target="_blank"
                  style="display:inline-block;background:#F9CB00;color:#432128;text-decoration:none;padding:9px 26px;border-radius:22px;font-weight:bold;letter-spacing:1px;font-size:15.3px;">
                  Explore HimalayaFace
                </a>
              </div>
              <hr style="border:none;border-top:1px solid #f5e7ce;margin:30px 0 15px 0;" />
              <div style="font-size:13px;color:#bba95a;">
                This is an automated confirmation email from
                <span style="background-image:linear-gradient(to right,#F9CB00,#E2792B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-fill-color:transparent;">HimalayaFace</span>.
                No further action is needed at this time.
              </div>
            </div>
          </div>
        </div>
      `,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Submission successful",
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("POST /contact_form error: ", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Submission Failed",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
