import nodemailer from "nodemailer";

export async function POST(req, res) {
  const { email } = req.body;
  if (!email)
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });

      const userEmail = process.env.EMAIL_USER
      const pass = process.env.EMAIL_APP_PASS
      const receiverEmail = process.env.RECEIVER_EMAIL

      const transporter = await nodemailer.createTransport({
service: 'gmail',
auth: {
    user: userEmail,
    pass,
}
      })
}
