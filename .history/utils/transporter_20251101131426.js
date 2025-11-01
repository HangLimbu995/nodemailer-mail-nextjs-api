import nodemailer from "nodemailer";

export function mailTransporter(service='gmail', email, pass) {
  try {
    const transport = nodemailer.createTransport({
      service: service,
      auth: {
        user: email,
        pass,
      },
    });

    return transport
  } catch (error) {
    console.error("Failed to transport email:", error)
  }
}
