import prisma from "../lib/prisma";
import { Worker } from "bullmq";
import dotenv from 'dotenv';
import { connection } from '../lib/queue';
import { transporter } from "../transporter/transporter";

dotenv.config();

console.log('Loaded RESEND key:', process.env.RESEND_KEY);


const emailWorker = new Worker('email-queue',async job => {
  const { emailId } = job.data;
  const email = await prisma.email.findUnique({where: {id: emailId }});
  if(!email) throw new Error('Email not found');
  const user = await prisma.user.findUnique({
    where: {
      id: email.userId
    }
  });

  if(!user?.email) throw new Error('User not authorized');

  const receiver = {
    from: user.email,
    to: email.to,
    subject: email.subject,
    text: email.body,
  };

  try {
    const info = await transporter.sendMail(receiver);
    console.log('Email sent', info.messageId);
    await prisma.email.update({
      where: {id: emailId},
      data: {
        status: 'SENT',
        sentAt: new Date(),
      }
    })
  } catch (err) {
    console.log('Failed to send email',err);
  }

  console.log(`Email sent to ${email.to}`);
  
},{connection});

console.log('Email worker is running...');
