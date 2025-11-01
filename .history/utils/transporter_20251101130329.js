import nodemailer from "nodemailer";

export async function mailTransporter(service, email, pass) {
  try {
    const transporter = nodemailer.createTransport({
      service: service,
      auth: {
        user: email,
        pass,
      },
    });

    return transporter
  } catch (error) {}
}
