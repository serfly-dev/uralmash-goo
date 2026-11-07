import nodemailer from 'nodemailer';
import { writeFile } from 'node:fs/promises';
nodemailer.createTransport = () => ({ sendMail: async (mail) => writeFile(process.env.TEST_MAIL_FILE, JSON.stringify(mail)) });
