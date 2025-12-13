import { mailTransporter } from "@/utils/transporter";
import dns from "dns/promises";
import { send } from "process";
import z from "zod";

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
    const {
      name,
      phone,
      email: customerEmail,
      message,
      priority,
    } = parsedData.data;

    // Email Subject & Header based on Priority (with HimalayaFace branding)
    const emailSubject = priority
      ? "🚨 High Priority Contact Form Submission — HimalayaFace"
      : "New Contact Form Submission — HimalayaFace";

    // HimalayaFace gradient logo/text (animated shimmer effect)
    const himalayaBanner = `
      <div style="text-align:center;margin-bottom:20px;">
        <span style="
          display: inline-block;
          font-size: 2.1rem;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-weight: bold;
          letter-spacing: 1.7px;
          background-image: linear-gradient(to right, #F9CB00, #E2792B);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-fill-color: transparent;
          animation: hfaceShimmer 2.2s infinite linear alternate;
        " class="hf-gradient-anim">HimalayaFace</span>
        <style>
          @keyframes hfaceShimmer {
            0% { background-position: 0 50%; }
            100% { background-position: 100% 50%; }
          }
        </style>
      </div>
    `;

    // Animated dot loader for interactive emphasis (retains subtle gold)
    const animatedLoader = `
      <div style="display:inline-block;vertical-align:middle;margin-left:8px;">
        <span style="display:inline-block;width:8px;height:8px;margin-right:2px;border-radius:50%;background:#F9CB00;animation:bounceLoader 1.3s infinite alternate;"></span>
        <span style="display:inline-block;width:8px;height:8px;margin-right:2px;border-radius:50%;background:#E2792B;animation:bounceLoader 1.3s 0.4s infinite alternate;"></span>
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F9CB00;animation:bounceLoader 1.3s 0.8s infinite alternate;"></span>
      </div>
      <style>
        @keyframes bounceLoader {
          0% { transform: translateY(0);}
          100% { transform: translateY(-10px);}
        }
      </style>
    `;

    // Priority note with animated icon, and new gradient on icon
    const priorityNote = priority
      ? `<div style="padding: 16px; background: #ffe5e5; border-radius: 10px; color: #c0392b; font-weight: bold; margin-bottom: 24px; border: 1px solid #f9b2b2; display:flex;align-items:center;box-shadow:0 0 6px #ffd3a47a;">
            <svg style="margin-right:14px;" width="32" height="32" viewBox="0 0 40 40">
              <defs>
                <linearGradient id="gradient-emergency" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#F9CB00"/>
                  <stop offset="100%" stop-color="#E2792B"/>
                </linearGradient>
              </defs>
              <circle cx="20" cy="20" r="20" fill="url(#gradient-emergency)">
                <animate attributeName="opacity" values="1;0.7;1" dur="1.1s" repeatCount="indefinite"/>
              </circle>
              <text x="50%" y="61%" text-anchor="middle" fill="#fff" font-size="20" font-family="Arial" font-weight="bold">!</text>
            </svg>
            <span>
              <span style="font-size: 17px;">&#9888; <i>Emergency:</i></span> Customer marked this as <u>High Priority</u>! Please respond <span style="text-decoration: underline;">ASAP</span>.
            </span>
          </div>`
      : `<div style="padding: 14px; background: #f5fcff; border-radius: 8px; color: #0074d9; font-weight: bold; margin-bottom: 24px; border: 1px solid #d2f2fc;display:flex;align-items:center;box-shadow:0 0 4px #e7f2ff;">
            <svg style="margin-right:10px;" width="24" height="24" viewBox="0 0 20 20">
              <defs>
                <linearGradient id="gradient-info" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#F9CB00"/>
                  <stop offset="100%" stop-color="#E2792B"/>
                </linearGradient>
              </defs>
              <circle cx="10" cy="10" r="10" fill="url(#gradient-info)">
                <animate attributeName="r" values="10;11;10" dur="1.6s" repeatCount="indefinite"/>
              </circle>
              <text x="50%" y="67%" text-anchor="middle" fill="#fff" font-size="13.5" font-family="Arial" font-weight="bold">i</text>
            </svg>
            New message received from the contact form.
          </div>`;

    // Branded card main
    await transporter.sendMail({
      from: senderEmail,
      to: receiverEmail,
      subject: emailSubject,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f9fafb; padding: 55px 0 45px 0; animation: fade-in .85s;">
          <style>
            @keyframes fade-in { from {opacity:0; transform: translateY(18px);} to {opacity:1; transform: none;} }
            .hf-btn:hover { background: #E2792B !important; color: #fff !important; }
          </style>
          <div style="max-width:620px; margin: auto; background: #fff; border-radius: 17px; 
                      box-shadow: 0 10px 40px rgba(249,203,0,0.14), 0 2px 7px rgba(0,0,0,.07); overflow:hidden;">
            ${himalayaBanner}
            <div style="
              background: linear-gradient(to right, #F9CB00, #E2792B);
              color: #fff;
              font-size: 25px;
              font-weight: bold;
              padding: 18px 40px 18px 36px;
              text-align: center;
              letter-spacing:2px;
              ">
              ${emailSubject} ${priority ? animatedLoader : ""}
            </div>
            <div style="padding: 38px 37px 28px 37px;">
              ${priorityNote}
              <table style="width:100%; margin-bottom: 27px; font-size:15px; background:#fcfcfc;border-radius:7px;border:1px solid #f7e7ce;box-shadow:0 0 10px #f9cb0033;">
                <tr>
                  <td style="font-weight:600;padding:8px 13px 8px 0; width:110px; color:#432;">Name:</td>
                  <td style="padding:8px 0;">${name}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;padding:8px 13px 8px 0; color:#432;">Email:</td>
                  <td style="padding:8px 0;">${customerEmail}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;padding:8px 13px 8px 0; color:#432;">Phone:</td>
                  <td style="padding:8px 0;">${phone}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;padding:8px 13px 8px 0; color:#432;">Priority:</td>
                  <td style="padding:8px 0;">${
                    priority ? "High / Emergency 🚨" : "Normal"
                  }</td>
                </tr>
              </table>
              <div style="margin-bottom:19px;">
                <div style="font-weight:600; margin-bottom:10px;">Message Content:</div>
                <div style="padding:17px 13px; background:#f7f7fa; border-radius:9px; color:#2e2100; font-size:15px; border:1px dashed #F9CB00; transition: box-shadow .3s;">
                  ${message.replace(/\n/g, "<br />")}
                </div>
              </div>
              <div style="text-align:center; margin-top:33px;">
                <span style="color:#ffd122;font-size:13.6px;letter-spacing:0.2px;">
                  This notice was automatically generated from <b style="background-image:linear-gradient(to right,#F9CB00,#E2792B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-fill-color:transparent;">HimalayaFace</b>'s website contact form${priority ? " <b>(HIGH PRIORITY)</b>" : ""}.
                </span>
                <br>
                <a href="https://himalayaface.com" target="_blank" class="hf-btn"
                  style="display:inline-block;margin-top:17px;background:#F9CB00;color:#432128;text-decoration:none;padding:8px 25px;
                         border-radius:22px;font-weight:bold;letter-spacing:1.1px;font-size:15px;transition:background .18s;">
                  Visit HimalayaFace
                </a>
              </div>
            </div>
          </div>
        </div>
      `,
    });

    // 2. Email to the user, confirming receipt with improved and branded template
    await transporter.sendMail({
      from: receiverEmail,
      to: email,
      subject: "Thank you for contacting HimalayaFace — We have received your message",
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif; background:#f8fafc; padding: 48px 0; animation: fade-in 1s;">
          <style>
            @keyframes fade-in { from {opacity:0; transform: translateY(16px);} to {opacity:1; transform: none;} }
            @keyframes shimmer {
              100% { background-position: 100% 0; }
            }
            .hf-shimmer {
              background-image: linear-gradient(to right, #F9CB00, #E2792B, #F9CB00 65%);
              background-size: 700px 104px;
              color:transparent;
              background-clip:text;
              -webkit-background-clip:text;
              -webkit-text-fill-color: transparent;
              animation: shimmer 2.3s infinite linear forwards;
            }
            .hf-btn:hover { background: #E2792B !important; color: #fff !important; }
          </style>
          <div style="max-width:610px; margin: auto; background: #fff; border-radius: 15px; box-shadow:0 7px 36px rgba(249,200,0,0.08), 0 2px 7px rgba(0,0,0,.07); overflow:hidden;">
           ${himalayaBanner}
            <div style="background: linear-gradient(to right, #F9CB00, #E2792B); color: #fff; font-size: 23px; font-weight: bold; padding: 19px 26px 17px 26px; text-align: center; letter-spacing:2px;">
              Thank you for your message to <span class="hf-shimmer" style="font-weight:900;">HimalayaFace</span>! ${animatedLoader}
            </div>
            <div style="padding: 32px 33px 27px 33px;">
              <p style="font-size: 16.6px; margin-bottom: 15px;">
                Hi${name ? ` ${name}` : ""},<br>
                Thank you for contacting <b style="background-image:linear-gradient(to right,#F9CB00,#E2792B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-fill-color:transparent;">HimalayaFace</b>.
                We have received your message and will get back to you as soon as possible.<br>
                Please review your details below:
              </p>
              <table style="width:100%; margin-bottom: 26px; font-size:14.5px; background:#fef8e7;border-radius:7px;border:1px solid #F9CB00;box-shadow:0 0 5px #F9CB0033;">
                <tr>
                  <td style="font-weight:600;padding:8px 12px 8px 0; width:102px;color:#432;">Name:</td>
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
                <div style="font-weight:600; margin-bottom:8px;">Your Message:</div>
                <div style="padding:15px 13px; background:#f7f7f7; border-radius:8px; color:#23201a; font-size:15.3px; border:1px dashed #F9CB00;">
                  ${message.replace(/\n/g, "<br />")}
                </div>
              </div>
              <p style="font-size: 15.1px; margin-top: 28px; color: #7c600a;">
                Please reply to this email if you wish to update your inquiry.<br>
                <b>We appreciate your interest and will be in touch soon!</b>
              </p>
              <div style="text-align:center;margin:27px 0 0 0;">
                <a href="https://himalayaface.com" target="_blank" class="hf-btn"
                  style="display:inline-block;background:#F9CB00;color:#432128;text-decoration:none;padding:9px 26px;
                         border-radius:22px;font-weight:bold;letter-spacing:1px;font-size:15.3px;transition:background .18s;">
                  Explore HimalayaFace
                </a>
              </div>
              <hr style="border:none;border-top:1px solid #f5e7ce; margin:30px 0 15px 0;" />
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
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Subscription successfull",
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
        message: "Subscription Failed",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
