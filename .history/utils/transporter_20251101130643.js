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

    return transport
  } catch (error) {
    console.error("Failed to transport email:", error)
  }
}
