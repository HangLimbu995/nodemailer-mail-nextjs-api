import { createLimiter } from "@arcjet/node";
import nodemailer from "nodemailer";
import { success, z } from "zod";

const limiter = createLimiter({
  token: process.env.ARCJET_KEY,
  limit: 5, // max 5 request
  interval: 10 * 60 * 1000, // per 10 minutes
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function GET(request) {
  return new Response(
    JSON.stringify({
      success: true,
      message: "Just newsletter API calling...",
    }),
    {
      status: 200,
      headers: corsHeaders,
    }
  );
}

const emailPostZodSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address." }),
  recaptchaToken: z.string().min(1, "reCAPTCHA token is required"),
});

export async function POST(request) {
  try {
    const body = request.body;
    const parsedData = emailPostZodSchema.safeParse(body);

    if (!parsedData.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid data",
          errors: parsedData.error.format(),
        }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const { email, recaptchaToken } = parsedData.data;

    // --- Verification ---
    const recaptchaResponse = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaToken}`,
      { method: "POST" }
    );

    const recaptchaResult = await recaptchaResponse.json();

    if (!recaptchaResponse.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Bot verification Failed",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ---- IP detection for Arcjet----
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("host") ||
      "unknown";

    // Arcjet Rate Limiting
    let allowed = true;
    try {
      limiterResult = await limiter.check(ip);
      allowed = limiterResult.allowed;
    } catch (error) {
      console.error("Arcjet error", error);
      allowed = true; // optionally allow if limiter fails
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Too many requests",
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // -- Send Email via Nodemailer---

    const senderEmail = process.env.SENDER_EMAIL;
    const pass = process.env.EMAIL_APP_PASS;
    const receiverEmail = process.env.RECEIVER_EMAIL;

    const transport
    
  } catch (error) {}
}

// export async function POST(request) {
//   try {

//     const ip =
//       request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
//       request.headers.get("host") ||
//       "unknown";

//     let allowed;

//     try {
//       const result = await limiter.ckeck(ip);
//       allowed = result.allowed;
//     } catch (error) {
//       console.error("Arkjet error", error);
//     }

//     if (!allowed) {
//       return new Response(
//         JSON.stringify({
//           success: false,
//           message: "Too many requests",
//         }),
//         {
//           status: 429,
//           headers: corsHeaders,
//         }
//       );
//     }

//     const parsedData = emailPostZodSchema.safeParse(await request.json());

//     if (!parsedData.success) {
//       return new Response(
//         JSON.stringify({
//           success: false,
//           message: "Invalid data",
//           errors: parsedData.error.format(), // <-- this will show field-specific errors
//         }),
//         {
//           status: 400,
//           headers: corsHeaders,
//         }
//       );
//     }

//     const { email } = parsedData.data;

//     const userEmail = process.env.EMAIL_USER;
//     const pass = process.env.EMAIL_APP_PASS;
//     const receiverEmail = process.env.RECEIVER_EMAIL;

//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: userEmail,
//         pass,
//       },
//     });

//     await transporter.sendMail({
//       from: userEmail,
//       to: receiverEmail,
//       subject: `New Newsletter Subscription from ${email}`,
//       //   text: `This is a visiter from website enquiring about the service. Please add ${email} to the newsletter subscription list and reply to them appropriately. `,
//       html: `    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; background-color: #f9f9f9;">
//     <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">
//       <div style="background-color: #F9CB00; color: #000; padding: 16px 24px; text-align: center; font-size: 20px; font-weight: bold;">
//         New Newsletter Subscription
//       </div>
//       <div style="padding: 24px;">
//         <h2 style="margin-top: 0;">Hello Admin,</h2>
//         <p>A new visitor has subscribed to your newsletter.</p>
//         <p style="font-size: 15px;">
//           Please add <strong>${email}</strong> to your mailing list and reply to them appropriately.
//         </p>
//         <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
//         <p style="font-size: 13px; color: #777;">
//           This message was automatically generated from your website's contact form.
//         </p>
//       </div>
//     </div>
//   </div>`,
//     });

//     return new Response(
//       JSON.stringify({
//         success: true,
//         message: "Message sent!",
//       }),
//       {
//         status: 200,
//         headers: corsHeaders,
//       }
//     );
//   } catch (error) {
//     console.error(error);
//     return new Response(
//       JSON.stringify({
//         success: false,
//         message: "Subscription failed",
//       }),
//       {
//         status: 500,
//         headers: corsHeaders,
//       }
//     );
//   }
// }
