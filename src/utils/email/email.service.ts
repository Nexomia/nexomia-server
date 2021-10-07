import { Injectable, OnModuleInit } from '@nestjs/common'
import nodemailer from 'nodemailer'
import Mail from 'nodemailer/lib/mailer'
import { config } from './../../app.config'

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: Mail

  onModuleInit() {
    this.transporter = nodemailer.createTransport(config.smtp)
  }

  sendEmailConfirmation(email, token) {
    return this.transporter.sendMail({
      from: config.smtp.auth.user,
      to: email,
      subject: 'Nexomia | Verification',
      html: `Your confirmation link is <a href="http://${config.domain}/api/auth/emailConfirmation?code=${token}">http://${config.domain}/api/auth/emailConfirmation?code=${token}</a>`,
    })
  }
  sendLoginNotice(email, info) {
    return this.transporter.sendMail({
      from: config.smtp.auth.user,
      to: email,
      subject: 'Nexomia | Security',
      html:
        `Someone just logged into your account.<br /><br />` +
        `OS: <b>${info.os.family}</b><br />` +
        `City: <b>${info.geoip.country}, ${info.geoip.region}, ${info.geoip.city}</b><br /><br />` +
        `If it wasn't you, change your password immediately.`,
    })
  }
}
