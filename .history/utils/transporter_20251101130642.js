import nodemailer from "nodemailer";

export async function mailTransporter(service, email, pass) {
  try {
    const transport = nodemailer.createTransport({
      service: service,
      auth: {
        user: email,
        pass,
      },
    });

    return transporter
  } catch (error) {
    console.error("Failed to transport email:", error)
  }
}
