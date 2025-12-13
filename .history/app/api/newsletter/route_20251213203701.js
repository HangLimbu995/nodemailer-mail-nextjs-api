import { mailTransporter } from "@/utils/transporter";
import arcjet, { createRemoteClient, fixedWindow } from "@arcjet/node";
import { z } from "zod";
import dns from "dns/promises";
import { aj } from "@/utils/aj";

// -- Strong MX check for email domains --
async function isValidDomain(email) {
  const domain = email.split("@")[1];
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch (error) {
    return false;
  }
}

// Arcjet setup for rate limiting
// const arcjetClient = createRemoteClient({
//   token: process.env.ARCJET_KEY,
// });
// const limiterOptions = {
//   limit: 5,
//   interval: 10 * 60 * 1000, // 5 requests per 10min
// };

const client = createRemoteClient({
  token: process.env.ARCJET_KEY,
});
// const aj = arcjet({
//   log: console,
//   client,
//   rules: [
//     fixedWindow({
//       max: 2,
//       window: "10m",
//     }),
//   ],
// });

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
    { status: 200, headers: corsHeaders }
  );
}

const emailPostZodSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address." }),
});

export async function POST(request) {
  try {
    console.log("arcjet api key is", process.env.ARCJET_KEY);
    const body = await request.json();
    const parsedData = emailPostZodSchema.safeParse(body);

    if (!parsedData.success) {
      // Standard zod error structure for consistency and JSON validity
      return new Response(
        JSON.stringify({
          success: false,
          message:
            parsedData.error.errors && parsedData.error.errors[0]
              ? parsedData.error.errors[0].message
              : "Invalid email address.",
          errors: parsedData.error.format(),
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const email = parsedData.data.email;
    const mxValid = await isValidDomain(email);

    if (!mxValid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "The email domain is invalid or cannot receive emails.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // --- IP detection for Arcjet (XFF, cf-connecting-ip, x-real-ip, host) ---
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Arcjet rate limiting (fail closed for correct spam defense)
    // let allowed = true;
 

    // --- Check required env vars ---
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

    // --- Send email to admin ---
    await transporter.sendMail({
      from: senderEmail,
      to: receiverEmail,
      subject: `New Newsletter Subscription from ${email}`,
      html: `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; background-color: #f9f9f9;">
    <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">
      <div style="background-color: #F9CB00; color: #000; padding: 16px 24px; text-align: center; font-size: 20px; font-weight: bold;">
        New Newsletter Subscription
      </div>
      <div style="padding: 24px;">
        <h2 style="margin-top: 0;">Hello Admin,</h2>
        <p>A new visitor has subscribed to your newsletter.</p>
        <p style="font-size: 15px;">
          Please add <strong>${email}</strong> to your mailing list and reply to them appropriately.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="font-size: 13px; color: #777;">
          This message was automatically generated from your website's newsletter form.
        </p>
      </div>
    </div>
  </div>
  `,
    });

    // --- Confirmation email to user ---
    await transporter.sendMail({
      from: senderEmail,
      to: email,
      subject: "We've received your newsletter subscription!",
      html: `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; background-color: #f9f9f9;">
    <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">
      <div style="background-color: #F9CB00; color: #000; padding: 16px 24px; text-align: center; font-size: 20px; font-weight: bold;">
        Newsletter Subscription Received
      </div>
      <div style="padding: 24px;">
        <h2 style="margin-top: 0;">Thank you for subscribing!</h2>
        <p>We have received your email: <strong>${email}</strong></p>
        <p style="font-size: 15px;">
          We will send you our latest news and updates to this address.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="font-size: 13px; color: #777;">
          This is an automated confirmation. Thank you for your interest!
        </p>
      </div>
    </div>
  </div>
  `,
    });

    // Success response (note: correct full/partial English)
    return new Response(
      JSON.stringify({
        success: true,
        message: "Subscription successful",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("POST /newsletter error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Subscription failed",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
