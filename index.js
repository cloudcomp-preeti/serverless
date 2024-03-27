const functions = require('@google-cloud/functions-framework');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const Knex = require('knex');

const createTcpPool = async config => {

  const dbConfig = {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    },
    ...config,
  };
  return Knex(dbConfig);
};

const mailgun = new Mailgun(formData);
const mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY});

functions.cloudEvent('helloPubSub', async cloudEvent => {
  try {
    const email = JSON.parse(Buffer.from(cloudEvent.data.message.data, 'base64').toString('utf-8')).username;
    console.log('email', email);

    const knex = await createTcpPool();
    const user = await knex('users').where('username', email).first();
    if (!user) {
      console.error('User not found with email:', email);
      await knex.destroy();
      return;
    }

    const userId = user.id; 
    const expDttm = Date.now() + (2 * 60 * 1000);

    await knex('users').where('id', userId).update({ expiration_dttm: expDttm });
    const verificationLink = `http://preetikulk.me:3000/verify?token=${encodeURIComponent(userId)}`;
    const emailBody = `Click the following link to verify your email: ${verificationLink}`;
    console.log('Email Body:', emailBody);

    await mg.messages.create('preetikulk.me', {
      from: "Reader's Digest <mailgun@preetikulk.me>",
      to: [email],
      subject: 'Email Verification',
      text: emailBody,
    });

    console.log(`Verification email sent to ${email}`);
    await knex.destroy();
    
  } catch (error) {
    console.error('Error sending verification email:', error);
  }
});
