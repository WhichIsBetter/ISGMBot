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
const nearbyRange = 300; //range to prevent cross over.

function recentReports(data) { // extract recent (based on reportExpiry) reports
  var recentReportKeys = [];
  console.log('recentReportKeys Initialized');
  console.log('recentReportKeys: '+recentReportKeys);
  var nowTime = _.round(_.now()/1000);
  var reportKeys = _.keys(data.reports);
  for (var i = 0; i < reportKeys.length; i++) { 
    if (nowTime - _.toNumber(reportKeys[i]) < reportExpiry ) {
        recentReportKeys.push(reportKeys[i]);
        console.log('recentReportKeys: '+recentReportKeys);
    };
  }
  return recentReportKeys;
};

function coordToLatLong(latlong) { //coord to lat long format for geolocation
  latlong = _.split(latlong,",",2)
  return {latitude: _.toNumber(latlong[0]), longitude: _.toNumber(latlong[1])}
};

function proximityTest(location,recentLoc,testArchive) { // returns Pass/Fail
  var locToTest = coordToLatLong(location); 
  var recentLoc = recentLoc; //returns Array
  var testArchive = testArchive;
  var passFail = 0 //passFail > 0 = proximity test fail
  for (var i = 0; i < recentLoc.length; i++) {
    console.log(geolocate.distanceTo(locToTest,coordToLatLong(testArchive.reports[recentLoc[0]].coord)));
    if (geolocate.distanceTo(locToTest,coordToLatLong(testArchive.reports[recentLoc[0]].coord)) < nearbyRange ) {
      passFail = passFail+1; //cos location to test is too near
    } else {
      passFail = passFail+0;
    };
  };
  if (passFail === 0 ) {
    console.log('Proximity Test PASSed!');
    return 'PASS';
  } else {
    console.log('Proximity Test FAILed!');
    return 'FAIL';
  };
};
// geolocate.distanceTo(from: Location, to: Location)

//report JSON Schema
// "date":{
//   "report_id":,
//   "humanDate":"",
//   "from":{},
//   "chat":{},
//   "coord":"", // lat,lng
//   "address":""
// }

// telegrambot token
const token = '523462820:AAGRWjmVftMe5w2OAOcOgCIm06e0jaZcIsk';

//webHook URL
const hookURL = 'isgmbot.glitch.me'
var port = process.env.PORT; //webHook port
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
      'Greetings! Would you like to report a GreenMan Sighting?'
      +'\n\u{1F4CE}Simply \"share location\" to report a sighting or'
      +'\n\u{1F438}To get to get the latest sightings for the past 1.5hr',
      {'reply_markup':{
          'inline_keyboard':[[
            {text:'How to Make A Report',callback_data:'main_Report'},
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
      var address = response.json.results[0].formatted_address
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
    bot.sendMessage(CallBackData.message.chat.id,'Simply tap on \u{1F4CE} to share the location and follow the prompts after that.');
  } else if (CallBackData.data === 'main_GreenMan') { // on calling of sitred
    bot.answerCallbackQuery(CallBackData.id,{text:'Loading Recent Reports...'}); //load recent reports
    var archive = fs.readFileSync('reports.json');
    archive = JSON.parse(archive);
    console.log('numOfReports:'+archive.numOfReports);
    var recentKeys = recentReports(archive);
    recentKeys = recentKeys.sort();
    var message = ""
    console.log('KeysLength: '+recentKeys.length);
    for (var i = 0; i < recentKeys.length; i++) {
      console.log('Keynumber:'+i);
      report = archive.reports[recentKeys[i]];
      var repCoord = _.split(report.coord,',',2);
      console.log('Coord:'+repCoord[0]);
      bot.sendLocation(CallBackData.message.chat.id,_.toNumber(repCoord[0]),_.toNumber(repCoord[1]));
      var message = message+'\u{1F4CD}:'+report.address;
      //bot.sendMessage(CallBackData.message.chat.id,message);
      //message = message+'\n\u{1F4CD}:'+report.coord+'\n'+report.address;
      };
    //bot.sendMessage(CallBackData.message.chat.id,message);
  } else if (CallBackData.data === 'location_confirm') { // on confirmation of report
    var latLong = _.split(_.split(CallBackData.message.text,'\n')[0],':')[1];
    var address = _.split(CallBackData.message.text,'\n')[1];
    var humanDate = timestamp.toDate(CallBackData.message.date+(8*60*60)); // convert to readable time n to SGT
    console.log(CallBackData.message.text);
    console.log('Coords:'+latLong);
    console.log('Address:'+address); //address
    console.log('HumanDate:'+humanDate);
    // write report to reports.json
    var report_id; // declare report_id
    console.log('report:'+JSON.stringify(report));
    var archive = fs.readFileSync('reports.json'); //extract reports
    archive = JSON.parse(archive);
    console.log('numOfReports:'+archive.numOfReports);
    if (archive.numOfReports <= 0 || archive.numOfReports === null) {
      archive.numOfReports = 0  //RESET numOfReports if corrupted
      report_id = 1;  //reset report_id
    } else {
      report_id = archive.numOfReports+1;
    };
    console.log('current report_id is '+report_id);
    
    var report = {
      "reportID":report_id,
      "date":CallBackData.message.date,
      "humanDate":humanDate,
      "from":CallBackData.from,
      "chat":CallBackData.message.chat,
      "coord":latLong, // lat,lng
      "address":address
    };
    
    var keys = _.keys(archive.reports);  // generate array of keys
    console.log(keys);
    
    var recentKeys = recentReports(archive);
    console.log('recentKeys: '+recentKeys);
    console.log('print: '+archive.reports[recentKeys[0]].coord);
    var coord1 = coordToLatLong(archive.reports[recentKeys[0]].coord);
    console.log(coord1);
    var coord2 = coordToLatLong(archive.reports[recentKeys[1]].coord);
    console.log('dist:'+geolocate.distanceTo(coord1,coord2));

    var dateNow = _.round(_.now()/1000); // generate current date
    console.log('datenow: '+dateNow);
    if (keys.includes(_.toString(CallBackData.message.date))) { //checks for repeat
      console.log('report already exist');
      bot.answerCallbackQuery(CallBackData.id,{text:'Error! Report Already Exist! Please do not reconfirm old reports'});
    } else if (dateNow-CallBackData.message.date >= 45) { // checks for timeout
      console.log('report time-out!');
      bot.answerCallbackQuery(CallBackData.id,{text:'Error! Timeout! U have 30s to confirm reports!'});       
    } else if (proximityTest(report.coord,recentKeys,archive) === 'FAIL') { //check for proximity
      console.log('Proximity Test Fail!');
      bot.answerCallbackQuery(CallBackData.id,{text:'Error! Reported location to close to one of recently reported locations'});
    } else {
      // check for location proximity with recent reports
      archive.reports[_.toString(CallBackData.message.date)] = report; //appends report to archive
      archive.numOfReports = archive.numOfReports+1; //updates total num of reports
      console.log(JSON.stringify(archive));
      var dataToWrite = JSON.stringify(archive, null, 2);
      fs.writeFileSync('reports.json', dataToWrite);
      console.log('file written');
      bot.answerCallbackQuery(CallBackData.id,{text:'Report Lodged!'});
    };    
  } else if (CallBackData.data === 'location_cancel') { //on report cancel
    bot.answerCallbackQuery(CallBackData.id,{text:'Noted!'});
  };
});

bot.on('error', function () {
  //bot.sendMessage(msg.chat.id,error.code);
  console.log(error);
});
