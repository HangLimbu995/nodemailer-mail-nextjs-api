const contactFormZodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { message: "Name must be at least 3 characters long." })
    .max(50, { message: "Name must be at most 50 characters." })
    .regex(/^[a-zA-Z\s'-]+$/, { message: "Name can only contain letters, spaces, apostrophes, and hyphens." }),
  email: z
    .string()
    .trim()
    .min(6, { message: "Email is required." })
    .max(254, { message: "Email is too long." })
    .email({ message: "Invalid email address." }),
  phone: z
    .string()
    .trim()
    .regex(
      /^(\+?\d{1,3}[-.\s])?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}$/,
      { message: "Please enter a valid phone number." }
    )
    .min(9, { message: "Phone number is too short." })
    .max(20, { message: "Phone number is too long." }),
  message: z
    .string()
    .trim()
    .min(15, { message: "Message should be at least 15 characters long." })
    .max(2000, { message: "Message is too long." })
    .refine((val) => val.split(/\s+/).filter(Boolean).length >= 6, {
      message: "Message should be at least 6 words.",
    }),
  priority: z.boolean().default(false),
});

export async function POST(request) {
    try {
        const {}
    } catch (error) {
        
    }
}