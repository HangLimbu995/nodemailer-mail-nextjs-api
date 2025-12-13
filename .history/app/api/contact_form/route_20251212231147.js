

const contactFormZodSchema = z.object({
    name: z.string().trim().min(3,{message: })
})