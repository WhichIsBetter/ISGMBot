process.env.NTBA_FIX_319 = 1;

const geolocate = require('geolocation-utils');
const express = require('express');
const telegramBot = require('node-telegram-bot-api');

// telegrambot token
const token = '523462820:AAGRWjmVftMe5w2OAOcOgCIm06e0jaZcIsk';
// const bot = new telegramBot(token,{webHook:{
//   host: '9f3f6f1e.ngrok.io',
//   port: 3000
// }
// });
const hookURL = 'https://42f9ba8c.ngrok.io'
const port = 8443;
const options = {
  webHook: {
    'port': port,
  }};
const bot = new telegramBot(token, options);
console.log(hookURL+':'+port);
bot.setWebHook(hookURL+'/bot'+token);

// var text = bot.getWebhookInfo();

// console.log(text);

// bot.on('message', (msg) => {
//
//   console.log(msg.text.toString());
//
// });

// Listen for any kind of message. There are different kinds of
// messages.
// bot.on('message', (msg) => {
//   const chatId = msg.chat.id;
//
//   // send a message to the chat acknowledging receipt of their message
//   bot.sendMessage(chatId, 'Received your message');
// });

bot.on('message', function onMessage(msg) {
  bot.sendMessage(msg.chat.id, 'I am alive!!!');
});
