import { mailTransporter } from "@/utils/transporter";
import { createRemoteClient } from "@arcjet/node";
import nodemailer from "nodemailer";
import { success, z } from "zod";

// The Arcjet 2.x API's createRemoteClient does NOT return a rate limiting function directly.
// We must use the limiter property from the client object. See Arcjet docs and context.

const arcjetClient = createRemoteClient({
// Note: Arcjet context (see error @file_context_0) 
// Arcjet 2.x API does not use "check" method anymore.
// Instead, limiter() is a function. Docs: https://docs.arcjet.com

const limiter = createRemoteClient({
  token: process.env.ARCJET_KEY,
  limit: 5, // max 5 requests
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
  // recaptchaToken: z.string().min(1, "reCAPTCHA token is required"),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const email = body.email;
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

    // ---- IP detection for Arcjet----
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("host") ||
      "unknown";

    // Arcjet Rate Limiting - call limiter as a function (not .check)
    let allowed = true;
    try {
      const limiterResult = await limiter(ip);
      allowed = limiterResult?.allowed ?? true;
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

    var transporter = mailTransporter(
      "gmail",
      senderEmail,
      pass
    );

    // 1. Email to the receiver (admin)
    await transporter.sendMail({
      from: senderEmail,
      to: receiverEmail,
      subject: `New Newsletter Subscription from ${email}`,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; background-color: #f9f9f9;">
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
              This message was automatically generated from your website's contact form.
            </p>
          </div>
        </div>
      </div>`,
    });

    // 2. Email to the user, confirming receipt
    await transporter.sendMail({
      from: senderEmail,
      to: email,
      subject: "We've received your newsletter subscription!",
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">
          <div style="background-color: #F9CB00; color: #000; padding: 16px 24px; text-align: center; font-size: 20px; font-weight: bold;">
            Newsletter Subscription Received
          </div>
          <div style="padding: 24px;">
            <h2 style="margin-top: 0;">Thank you for subscribing!</h2>
            <p>We have received your email: <strong>${email}</strong></p>
            <p style="font-size: 15px;">
              We will reply back to this email as soon as possible or send you our latest news and updates.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="font-size: 13px; color: #777;">
              This is an automated confirmation. Thank you for your interest!
            </p>
          </div>
        </div>
      </div>`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Subscription successful!",
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("POST /newsletter error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Subscription Failed",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
