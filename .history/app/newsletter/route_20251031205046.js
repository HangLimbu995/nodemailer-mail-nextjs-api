import nodemailer from 'nodemailer'

export async function POST(req,res) {
const {email}  = req.body
if(!email) return res.status(404).json({success: false, message: 'Email is required'})
}