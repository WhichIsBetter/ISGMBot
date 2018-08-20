process.env.NTBA_FIX_319 = 1;

const fs = require('fs');
const timestamp = require('unix-timestamp');
const _ = require('lodash');
const geolocate = require('geolocation-utils');
const express = require('express');
const telegramBot = require('node-telegram-bot-api');
const geojson = require('geojson');
const request = require('request');
var httpProxy = require('http-proxy');
var http = require('http');
var https = require('https');
var httpProxyRules = require('http-proxy-rules');
var googleMapsClient = require('@google/maps').createClient({
  key: 'AIzaSyDVvTxMd8gQ4xg3VSL_ybI2AW_0Ged-2MA'
});

// settings for each Report
const reportExpiry = 5*60*60; //2hrs (2hr*60min*60secs)
const nearbyRange = 50; //range in meters to prevent cross over.
const reportFilePath = 'data/reports.json';
const blacklistFilePath = 'blacklist.json';
const bossesFilePath = 'bosses.json';
const publicReportsPath = 'public/publicReports.geojson';
const myJSONPath = 'https://api.myjson.com/bins/jje2i';


// telegrambot token
const token = '523462820:AAGRWjmVftMe5w2OAOcOgCIm06e0jaZcIsk';

//telegrambot webHook URL
const hookURL = 'isgmbot.glitch.me'
var port = process.env.PORT; //webHook port
const options = {
  webHook: {
    'port': port,
  }};
const bot = new telegramBot(token, options);
console.log('https://'+hookURL+':'+port);
bot.setWebHook('https://'+hookURL+'/bot'+token);

// Generate Recent Reports
function recentReports(data) { // extract recent (based on reportExpiry) reports
  var recentReportKeys = [];
  console.log('recentReportKeys Initialized');
  console.log('recentReportKeys: '+recentReportKeys);
  var nowTime = _.round(_.now()/1000);
  var reportKeys = _.keys(data.reports);
  for (var i = 0; i < reportKeys.length; i++) { 
    if (nowTime - _.toNumber(reportKeys[i]) < reportExpiry) {
        recentReportKeys.push(reportKeys[i]);
        console.log('recentReportKeys: '+recentReportKeys);
    };
  }
  return recentReportKeys;
};

// check black list return 'False' for not in blacklist
function checkBlacklist(user) {
  console.log('initiate blacklist check');
  console.log(user);
  var blacklist = fs.readFileSync(blacklistFilePath);
  blacklist = JSON.parse(blacklist);
  var blacklisted = _.keys(blacklist);
  //console.log(_.indexOf(blacklisted, user));
  if ( _.indexOf(blacklisted, user) >= 0) {
    //console.log(user+' is \'Y\'');
    return ['Y',blacklist[user].date,blacklist[user].reason];
  } else if ( _.indexOf(blacklisted, user) == -1) {
    //console.log(user+' is \'N\'');
    return ['N',"",""];
  }
  console.log('====Check Complete!====\n');
};

// check black list return 'False' for not in blacklist
function checkBosses(user) {
  console.log('\ninitiate Boss check');
  console.log(user);
  var bosses = fs.readFileSync(bossesFilePath);
  bosses = JSON.parse(bosses)['usernames']; //returns array of usernames
  console.log(bosses);
  if ( _.indexOf(bosses, user) >= 0) {
    console.log(user+' is a Boss');
    return 'Y';
  } else if ( _.indexOf(bosses, user) == -1) {
    console.log(user+' is not a Boss');
    return 'N';
  }
  console.log('====Check Complete!====\n');
};

//coord to lat long format for geolocation
function coordToLatLong(latlong) { 
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

function geoJSONTweaker(input) {  //adds id from property to higher branch
  for (var i = 0; i < input.features.length; i++) {
    input.features[i].id = input.features[i].properties.id;
  };
};

function updatePublicReports() {
  var archive = fs.readFileSync(reportFilePath);
  archive = JSON.parse(archive);
  //console.log('Exposing recent reports');
  console.log('numOfReports:'+archive.numOfReports);
  var recentKeys = recentReports(archive);
  recentKeys = recentKeys.sort();
  var reports = [];
  console.log('num of recent reports:' + recentKeys.length);
  for (var i = 0; i < recentKeys.length; i++) {
    if (archive.reports[recentKeys[i]].deleted == "N") {
      var latlong = coordToLatLong(archive.reports[recentKeys[i]].coord);
      var address = archive.reports[recentKeys[i]].address;
      var username = archive.reports[recentKeys[i]].from.username;
      console.log(username);
      var keyID = recentKeys[i]; //keyID is date of report in unix time converted to SG time seconds
      reports.push({lat:latlong['latitude'],long:latlong['longitude'],name:address,id:keyID,username:username})
      } else {
        console.log('ReportID '+recentKeys[i]+' was deleted hence not publicised');
      }
  };
  var data = geojson.parse(reports, {Point: ['lat', 'long'], include: ['name','id','username']});
  geoJSONTweaker(data); 
  console.log('****geoJSON data****\n'+data);
  request.put({ //updates myJSON
    url:myJSONPath,
    json:data
    },
    function(error,request,body) {
    console.log('==========JSONbodyText:===========\n'+body+'\n====================\n');
    }          
  );
  data = JSON.stringify(data, null, 2);
  fs.writeFileSync(publicReportsPath, data); //write geojson to public geojson
  //console.log(data);
  console.log('public reports updated!\n');
};


//report JSON Schemac
// "date":{
//   "report_id":,
//   "humanDate":"",
//   "from":{},
//   "chat":{},
//   "coord":"", // lat,lng
//   "address":""
// }

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
  console.log('\n===incoming msg====');
  console.log('HumanDate: '+timestamp.toDate(msg.date+(8*60*60))); 
  console.log(msg);
  if (msg.text == '/start') {
    var inlineKeyboard = [
            {text:'How to',callback_data:'main_Report'}//,
            //{text:'\u{1F438} Sightings',callback_data:'main_GreenMan'}            
          ];
    if (checkBosses(msg.from.username) == 'Y') {
        inlineKeyboard.push({text:'Del Report',callback_data:'main_DeleteReport'});
    }
    bot.sendMessage(
      msg.chat.id,
      'Greetings! Would you like to report a GreenMan Sighting?'
      +'\n\u{1F4CE}Simply \"share location\" to report a sighting or'
      +'\n\u{1F438}To get to get the latest sightings for the past '+(reportExpiry/60)+'mins',
      {'reply_markup':{
          'inline_keyboard':[inlineKeyboard]
        }
      }
    // {'reply_markup':{
    //   'keyboard':[['yes'],['/sitrep']],
    //   'resize_keyboard':true,
    //   'one_time_keyboard':true
    // }}
  );
  }
  else if (msg.location == null && msg.chat.type == 'private' && checkBosses(msg.from.username) == 'Y') {
    var reportID = msg.text.trim();
    var archive = fs.readFileSync(reportFilePath); //extract reports
    archive = JSON.parse(archive);
    if (archive.reports[reportID] == null) {
      bot.sendMessage(msg.chat.id,'Report Not Found!')
    }
    else {
      if (archive.reports[reportID].deleted == 'Y') {
        bot.sendMessage(msg.chat.id,'Report Already Deleted!')
      }
      else {
        bot.sendMessage(msg.chat.id,             
        "Confirm Delete: "
        +'\n\u{1F4CD}:'+ archive.reports[reportID].coord
        +'\n'+archive.reports[reportID].address
        +'\nReport ID:'+reportID,
        {'reply_markup':{
            'inline_keyboard':[[
              {text:'Confirm Delete',callback_data:'del_report_confirm'},
              {text:'Cancel Delete',callback_data:'del_report_cancel'}
            ]]
          }
        }
        );
      }
    }
  }
  else if (msg.location == null && msg.chat.type == 'private') {
  defaultreply(msg.chat.id,'Yes?');
  };
});

bot.on('location', function onMessage(msg) {
  console.log('===incoming location====');
  var location = [msg.location.latitude,msg.location.longitude];
  googleMapsClient.reverseGeocode({'latlng':location}, function(err, response) {  
    if (!err) {
      console.log('on.location !err');
      // Handle response.
      // check if have duplicate
      // if not duplicate confirm
      // save in json after confirm
      // check for blacklist
      var blacklistResult = checkBlacklist(msg.from.username);
      var blacklisted = blacklistResult[0];
      console.log("Blacklist check return: "+blacklistResult);
      if (blacklisted == 'Y') { // if user is blacklisted 
        console.log('user Blacklisted!');
        bot.sendMessage(msg.chat.id,'Error!\nSince '+blacklistResult[1]+', You have been blacklisted due to '+blacklistResult[2]+'!');
      } else if (blacklisted == 'N') {
        var address = response.json.results[0].formatted_address;
        var greetings;
        if (checkBosses(msg.from.username) == 'Y') {
          greetings = 'Hi Boss, \n'
        } else {
          greetings = 'Hi, \n'
        } 
        bot.sendMessage(msg.chat.id,             
          greetings
          +'\u{1F4CD}:'+ msg.location.latitude+','+msg.location.longitude
          +'\n'+address,
          {'reply_markup':{
              'inline_keyboard':[[
                {text:'Confirm location',callback_data:'location_confirm'},
                {text:'Cancel Report',callback_data:'location_cancel'}
              ]]
            }
          }
        );
      console.log('Incoming Location from '+msg.from.username);
      console.log(address);
      console.log("=========================================\n");
      }       
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
    //bot.answerCallbackQuery(CallBackData.id,{text:'awaiting location...',show_alert:true});
    bot.sendMessage(CallBackData.message.chat.id,'Simply tap on \u{1F4CE} to share the location and follow the prompts after that.');
  } 
  else if (CallBackData.data === 'main_DeleteReport') { // to delete report
    bot.answerCallbackQuery(CallBackData.id,{text:"Report ID Please"});
    bot.sendMessage(CallBackData.message.chat.id,'Simply send me the Report ID :)'); 
  }
  else if (CallBackData.data === 'main_GreenMan') { // on calling of sitrep
    bot.answerCallbackQuery(CallBackData.id,{text:'Loading Recent Reports...'}); //load recent reports
    var archive = fs.readFileSync(reportFilePath);
    archive = JSON.parse(archive);
    console.log('numOfReports:'+archive.numOfReports);
    var recentKeys = recentReports(archive);
    recentKeys = recentKeys.sort();
    var message = ""
    console.log('KeysLength: '+recentKeys.length);
    if (recentKeys.length === 0) {
      bot.sendMessage(CallBackData.message.chat.id,'No Sightings Reported Recently');
    };
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
  } 
  else if (CallBackData.data === 'location_confirm') { // on confirmation of report
    var latLong = _.split(_.split(CallBackData.message.text,'\n')[1],':')[1];
    var address = _.split(CallBackData.message.text,'\n')[2];
    var humanDate = timestamp.toDate(CallBackData.message.date+(8*60*60)); // convert to readable time n to SGT
    console.log(CallBackData.message.text);
    console.log('Coords:'+latLong);
    console.log('Address:'+address); //address
    console.log('HumanDate:'+humanDate);
    // write report to reportFilePath
    var report_id; // declare report_id
    console.log('report:'+JSON.stringify(report));
    var archive = fs.readFileSync(reportFilePath); //extract reports
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
      "address":address,
      "deleted":'N'
    };
    
    var keys = _.keys(archive.reports);  // generate array of keys
    console.log(keys);
    
    var recentKeys = recentReports(archive);
    // if (recentKeys.length > 0) {
    //   console.log('recentKeys: '+recentKeys);
    //   console.log('print: '+archive.reports[recentKeys[0]].coord);
    //   var coord1 = coordToLatLong(archive.reports[recentKeys[0]].coord);
    //   console.log(coord1);
    //   var coord2 = coordToLatLong(archive.reports[recentKeys[1]].coord);
    //   console.log('dist:'+geolocate.distanceTo(coord1,coord2));
    // };
        
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
      fs.writeFileSync(reportFilePath, dataToWrite);
      console.log('file written');
      bot.answerCallbackQuery(CallBackData.id,{text:'Report Lodged!'});
      updatePublicReports();
    };    
  } 
  else if (CallBackData.data === 'del_report_confirm') {
    var reportID = _.split(_.split(CallBackData.message.text,'\n')[3],':')[1];
    
    var archive = fs.readFileSync(reportFilePath); //extract reports
    archive = JSON.parse(archive); 
    
    archive.reports[reportID].deleted = 'Y'; //update to 'deleted'
    
    var dataToWrite = JSON.stringify(archive, null, 2); //save report data
    fs.writeFileSync(reportFilePath, dataToWrite);
    
    bot.answerCallbackQuery(CallBackData.id,{text:'Report Deleted!'});
    updatePublicReports();    
  }
  else if (CallBackData.data === 'location_cancel' || CallBackData.data === 'del_report_cancel') { //on report/delete cancel
    bot.answerCallbackQuery(CallBackData.id,{text:'Noted!'});
  };
});

bot.on('error', function (error) {
  //bot.sendMessage(msg.chat.id,error.code);
  console.log(error);
});

setInterval(updatePublicReports,30000);