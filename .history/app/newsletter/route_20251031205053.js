import nodemailer from 'nodemailer'

export async function POST(req,res) {
const {email}  = req.body
if(!email) return res.status(40).json({success: false, message: 'Email is required'})
}