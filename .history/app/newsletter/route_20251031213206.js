import nodemailer from "nodemailer";

export async function POST(req, res) {
  const { email } = req.body;
  if (!email)
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });

  const userEmail = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASS;
  const receiverEmail = process.env.RECEIVER_EMAIL;

  const transporter = await nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: userEmail,
      pass,
    },
  });

  await transporter.sendMail({
    from: userEmail,
    to: receiverEmail,
    subject: `New Newsletter Subscription from ${email}`,
    //   text: `This is a visiter from website enquiring about the service. Please add ${email} to the newsletter subscription list and reply to them appropriately. `,
    html: `    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; background-color: #f9f9f9;">
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
}
