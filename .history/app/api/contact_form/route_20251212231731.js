

const contactFormZodSchema = z.object({
    name: z.string().trim().min(3,{message: "Name should be more then 3 character long."}),
    email: z.string().trim().email({message: "Invalid email address."}),
    phone: z.string().trim().min(9, {message: "Invalid phone number"}),
    message: z.string().trim()
    .refine
    priority: z.boolean()
})