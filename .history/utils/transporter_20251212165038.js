import nodemailer from "nodemailer";

export function mailTransporter(service, email, pass) {
  try {
    return nodemailer.createTransport({
      service,
      auth: {
        user: email,
        pass,
      },
    });
  } catch (error) {
    console.error("Failed to transport email:", error);
    throw error;
  }
}
