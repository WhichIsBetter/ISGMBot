process.env.NTBA_FIX_319 = 1;

const fs = require('fs');
const timestamp = require('unix-timestamp');
const _ = require('lodash');
const geolocate = require('geolocation-utils');
const express = require('express');
const telegramBot = require('node-telegram-bot-api');
var googleMapsClient = require('@google/maps').createClient({
  key: 'AIzaSyDVvTxMd8gQ4xg3VSL_ybI2AW_0Ged-2MA'
});

// expiry for each Report
const reportExpiry = 2*60*60; //2hrs (2hr*60min*60secs)

//report JSON Schema
// {
//   "report_id": 1,
//   "date":,
//   "humanDate":"",
//   "from":{},
//   "chat":{},
//   "coord":"", // lat,lng
//   "address":""
// }

// telegrambot token
const token = '523462820:AAGRWjmVftMe5w2OAOcOgCIm06e0jaZcIsk';

//webHook URL
const hookURL = 'ffd54e84.ngrok.io'
const port = 8443; //webHook port
const options = {
  webHook: {
    'port': port,
  }};
const bot = new telegramBot(token, options);
console.log('https://'+hookURL+':'+port);
bot.setWebHook('https://'+hookURL+'/bot'+token);

function defaultreply(chatid,text) {
  bot.sendMessage(
    chatid,
    text,
    {'reply_markup':{
      'keyboard':[['/start']],
      'resize_keyboard':true,
      'one_time_keyboard':true
      }
    });
};

bot.on('webhook_error', (error) => {
  console.log(error.code);  // => 'EPARSE'
});

bot.on('message', function onMessage(msg) {
  console.log(msg);
  if (msg.text == '/start') {
    bot.sendMessage(
      msg.chat.id,
      'Hi There! Would you like to report a GreenMan Sighting?'
      +'\n\u{1F4CE}Simply \"share location\" to report a sighting or'
      +'\n\u{1F438}To get to get the latest sightings for the past 1.5hr',
      {'reply_markup':{
          'inline_keyboard':[[
            {text:'\u{1F4CE} Share Locaton',callback_data:'main_Report'},
            {text:'\u{1F438} Sightings',callback_data:'main_GreenMan'}
          ]]
        }
      }
    // {'reply_markup':{
    //   'keyboard':[['yes'],['/sitrep']],
    //   'resize_keyboard':true,
    //   'one_time_keyboard':true
    // }}
  );
} else if (msg.text == 'no, I would like a SITREP please') {
  defaultreply(msg.chat.id,'Okay...');
} else if (msg.location == null) {
  defaultreply(msg.chat.id,'Yes?');
  };
});

bot.on('location', function onMessage(msg) {
  var location = [msg.location.latitude,msg.location.longitude];
  googleMapsClient.reverseGeocode({'latlng':location}, function(err, response) {
    if (!err) {
      // Handle response.
      // check if have duplicate
      // if not duplicate confirm
      // save in json after confirm
      address = response.json.results[0].formatted_address
      bot.sendMessage(msg.chat.id,
        '\u{1F4CD}:'+ msg.location.latitude+','+msg.location.longitude
        +'\n'+address,
        {'reply_markup':{
            'inline_keyboard':[[
              {text:'Confirm location',callback_data:'location_confirm'},
              {text:'Cancel Report',callback_data:'location_cancel'}
            ]]
          }
        }
      );
      console.log(address);
    } else if (err === 'timeout') {
      // Handle timeout.
      console.log('timeout');
    } else if (err.json) {
      // Inspect err.status for more info.
      console.log(err.json);
    } else {
      // Handle network error.
      console.log('network error');
    }
  });
});

bot.on('callback_query', function (CallBackData) {
  console.log(CallBackData);
  if (CallBackData.data === 'main_Report') {
    bot.answerCallbackQuery(CallBackData.id,{text:'awaiting location...',show_alert:true});
  } else if (CallBackData.data === 'main_GreenMan') { // on calling of sitred
    bot.answerCallbackQuery(CallBackData.id,{text:'greengreen'});
    bot.sendMessage(CallBackData.message.chat.id,'yoyoyo');
  } else if (CallBackData.data === 'location_confirm') { // on confirmation of report
    latLong = _.split(_.split(CallBackData.message.text,'\n')[0],':')[1]
    address = _.split(CallBackData.message.text,'\n')[1];
    humanDate = timestamp.toDate(CallBackData.message.date);
    console.log(CallBackData.message.text);
    console.log('Coords:'+latLong);
    console.log('Address:'+address); //address
    console.log('HumanDate:'+humanDate);
    // write report to reports.json
    var report = {
      "report_id": 1,
      "date":CallBackData.message.date,
      "humanDate":humanDate,
      "from":CallBackData.from,
      "chat":CallBackData.message.chat,
      "coord":latLong, // lat,lng
      "address":address
    };
    console.log('report:'+report);
    var reports = fs.readFileSync('reports.json'); //extract reports
    console.log('report:'+JSON.parse(reports));
    reports = reports+report;
    console.log('report:'+JSON.parse(reports));
    var dataToWrite = JSON.stringify(report, null, 2);
    fs.writeFileSync('reports.json', dataToWrite);
    console.log('file writted');
  } else if (CallBackData.data === 'location_cancel') { //on report cancel
    bot.answerCallbackQuery(CallBackData.id,{text:'Noted!'});
  };
});

bot.on('error', function () {
  //bot.sendMessage(msg.chat.id,error.code);
  console.log(error.code);
});
