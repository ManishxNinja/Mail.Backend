import express, { Request, Response } from 'express';
import prisma from './lib/prisma';
import dotenv from 'dotenv';
import { emailQueue } from './lib/queue';
import { transporter } from './transporter/transporter';

const app = express();
app.use(express.json());
dotenv.config();


app.get('/', (req, res) => {
  return res.json("Email Scheduler is running");
});

app.post('/', async (req: Request, res: Response) => {
  const { email, name } = req.body;

  if (!email) return res.status(404).json({ error: 'Missing email' });

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: name || undefined,
    },
  });

  return res.status(200).json(user);
});

app.post('/send', async(req: Request, res: Response) => {
  const { subject,body,to,userId } = req.body;

  if(!subject || !body || !to || !userId) {
    return res.status(400).json({error: "Missing required fields"});
  }

  // const scheduledDate = new Date(scheduledAt);
  
  const email = await prisma.email.create({
    data: {
      subject,
      body,
      to,
      userId,
      // scheduledAt: scheduledDate,
      status: 'SCHEDULED',
    }
  });

  console.log("Adding Job to Redis Queue");

  try {
    const result = await transporter.sendMail({
      to: email.to,
      subject: email.subject,
      html: email.body,
    });
    console.log(`Email is sended to ${email.to}`);
    console.log(`Email sent: ${result.messageId}`);
    
  } catch(err) {
    console.log("Unable to send the email",err);
  }

  

  // await emailQueue.add('send-email', {emailId: email.id});

  return res.status(200).json({ message: "Email scheduled", email });
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
