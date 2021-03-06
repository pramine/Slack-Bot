// Import express and request modules
var express = require('express');
var request = require('request');
var Botkit = require('botkit');
var Promise = require("bluebird");
var main = require('./main.js');
var chai = require("chai");
var expect = chai.expect;
var HashMap = require('hashmap');
var OAuth = require('oauth').OAuth
var url = require('url')
require('dotenv').config();
var trello = require('./trello.js');
var trelloDB = require('./trelloDB.js');
var bodyParser = require('body-parser');
// Store our app's ID and Secret. These we got from Step 1.
// For this tutorial, we'll keep your API credentials right here. But for an actual app, you'll want to  store them securely in environment variables.
var clientid = process.env.CLIENT_ID;
var clientsecret = process.env.CLIENT_SECRET;

var persistStoryboardID;
var persistCardID;
var newCardName;
var newStoryBoardName;
var trelloToken;
var trelloUserName;

const { createMessageAdapter } = require('@slack/interactive-messages');

// Initialize adapter using slack verification token from environment variables
const slackMessages = createMessageAdapter(process.env.SLACK_VERIFICATION_TOKEN);


//new setup using express middleware

// Instantiates Express and assigns our app variable to it
var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use('/slack/actions',slackMessages.expressMiddleware());



var fetch = require('isomorphic-fetch');

function create_new_board(entities){
  console.log("Entities : "+ entities["board_name"][0]["value"])
  var msg = "Board name is "+ entities["board_name"][0]["value"];

  return msg;
}

function delegateMessage(json){
  console.log("JSON  "+ JSON.stringify(json));
  debugger;
  console.log("Intent  "+ json["entities"]["intent"][0]["value"]);
  var intent = json["entities"]["intent"][0]["value"];
  var entities = json["entities"];
  var msg;
  switch(intent){
    case "new_board_with_name": msg = create_new_board(entities); break;
    default: msg = "No idea what this command means";
  }
  console.log("Msg is" + msg);
  return msg;
}



// Attach action handlers by `callback_id`
// (See: https://api.slack.com/docs/interactive-message-field-guide#attachment_fields)
slackMessages.action('button_tutorial', (payload,bot) => {
 // `payload` is JSON that describes an interaction with a message.
 console.log(`The user ${payload.user.name} in team ${payload.team.domain} pressed the welcome button`);
 var slackUserID = (payload.user.id).toLowerCase();
 console.log('******* PAYLOAD : ', payload);
 // The `actions` array contains details about the specific action (button press, menu selection, etc.)
 const action = payload.actions[0];
 console.log(`The button had name ${action.name} and value ${action.value}`);

 var labelName = action.name;
 var color = action.value;

 var ackText;
 var replacement = payload.original_message;
 // Typically, you want to acknowledge the action and remove the interactive elements from the message

 //replacement.text =`Welcome ${payload.user.name}`;

 if(persistStoryboardID == undefined){
    responseMessage = {
        "text": "Please create a storyboard first or link your existing story board of trello."};
        bot.reply(message,responseMessage);
  }else{
      
    main.addLabel(persistCardID, color, labelName, slackUserID).then(function(results){
        responseMessage = "Priority set on this card "+ results;
        //bot.reply(message,responseMessage);
        ackText = responseMessage;
        console.log("AckText :" + ackText);
        replacement.attachments[0].text = `:white_check_mark: ${ackText}`;
        delete replacement.attachments[0].actions;
        return replacement;
            
    }).then(bot);
  }
 
});


slackMessages.action('template_selection_callback', (payload,bot) => {
    // `payload` is JSON that describes an interaction with a message.
    console.log(`The user ${payload.user.name} in team ${payload.team.domain} pressed the welcome button`);
    var slackUserID = (payload.user.id).toLowerCase();
    console.log('******* Template PAYLOAD : ', payload);
    // The `actions` array contains details about the specific action (button press, menu selection, etc.)
    const action = payload.actions[0];
    var slackUserID = (payload.user.id).toLowerCase();
    console.log("Slack user id received " + slackUserID);

    // You should return a JSON object which describes a message to replace the original.
    // Note that the payload contains a copy of the original message (`payload.original_message`).

    //const updatedMessage = acknowledgeActionFromMessage(payload.original_message, 'button_tutorial',
    //'I\'m getting an order started for you.');
    var selected_options = action.selected_options[0];
   console.log("Selected options: ",JSON.stringify(selected_options));
   //console.log(`The dropdown menu had name ${action.name} and value ${action.value}`);
    var ackText = `You have selected ${selected_options.value} board.`;
    const replacement = payload.original_message;
    // Typically, you want to acknowledge the action and remove the interactive elements from the message

    //attachment.text =`Welcome ${payload.user.name}`;
    var createdListsNames;
    // Start an order, and when that completes, send another message to the user.
    console.log("Trello token in tmbot new board "+ trelloToken);
    main.getNewStoryBoard(selected_options.value, newStoryBoardName, slackUserID)
    .then((response) => {
      // Keep the context from the updated message but use the new text and attachment
      var storyboardlink = response[0].url;
      console.log(" Received Storyboard link: "+storyboardlink);

      console.log(" ********** Received Storyboard ID: "+response[0].id);
      persistStoryboardID = response[0].id;
      
      ackText = `Your story board is created and here is the link: ${storyboardlink} and board id : ${persistStoryboardID}.`;

        return persistStoryboardID;
        //return ackText;
    }).then((persistStoryboardID) => {
        main.getListsInBoard(persistStoryboardID, slackUserID)
        .then((responseLists) => {
            console.log(" LINE 96");
            createdListsNames = responseLists.values();
            createdListsIds = responseLists.keys();
            console.log(" LINE 98");

            var map = new HashMap();

            console.log("** Attachement: "+JSON.stringify(replacement.attachments[0]));
            replacement.attachments[0].text = `:white_check_mark:  ${ackText}`;
            delete replacement.attachments[0].actions;


            var lists = `I have created board with ${createdListsNames} lists.`;
            var listsAttach =
              {
                  "text": lists,
                  "color": "#FF5733"
              };
              replacement.attachments.push(listsAttach);
            var mylist = [];

            responseLists.forEach(function(value, key){

              var cards = main.getCardsInList(key, slackUserID).then(function(cardsMap) {
                  //cardsArray = JSON.parse(cardsArray);
                  console.log("\n ## CARDS ARRAY for this list: ");
                  var cardNames = [];
                  cardsMap.forEach(function(value, key) {
                      console.log( "CARD NAME: "+value+" CARD ID: "+key);
                      cardNames.push(value);
                  });

                  var listcard = `I have created ${cardNames} cards in ${value} list.`;
                  console.log( "LIST CARDs: "+listcard);
                  var listcards =
                    {
                        "text": listcard,
                        "color": "#FFE400"
                    };
                    
                    //replacement.attachments.push(listcards);
                    return listcards; 
              });
              
              console.log(" mylist.push(cards) for cards: "+cards);
              mylist.push(cards);
            });
            console.log(" 149 mylist.push(cards) for cards: ");
            return Promise.all(mylist);
            }).then((listlist) => {
                listlist.forEach(function(entry){
                    replacement.attachments.push(entry);
                });
                
                return replacement;
            }).then(bot);

            
        });
    });
//.then(bot);

//     console.log("\n At line 116 ***************");

//     return replacement;
//    });

//Use Case 1 : Copy lists from one board to another board
slackMessages.action('boards_lists_callback', (payload,bot) => {
    // `payload` is JSON that describes an interaction with a message.
    //console.log(`The user ${payload.user.name} in team ${payload.team.domain} pressed the welcome button`);
    var slackUserID = (payload.user.id).toLowerCase();
    //console.log('******* LIST PAYLOAD : ', payload);
    // The `actions` array contains details about the specific action (button press, menu selection, etc.)
    const action = payload.actions[0];

    var selected_options = action.selected_options[0];
   console.log("\n\n Board Selected options: ",JSON.stringify(action.selected_options));
   console.log("\n\n BOARD Selected options KEY: ",JSON.stringify(action.selected_options[1]));
   
    var ackText = `You have selected ${selected_options.value} board.`;
    const replacement = payload.original_message;

    var createdListsNames;
    const selectedType = findSelectedOption(payload.original_message, 
        'boards_lists_callback', 
        payload.actions[0].selected_options[0].value);
    // Start an order, and when that completes, send another message to the user.
    main.copyListsToBoard(selected_options.value, persistStoryboardID, slackUserID)
    .then((response) => {
      // Keep the context from the updated message but use the new text and attachment
      
      ackText = `All the lists from ${selectedType.text} board has been copied to your linked board with this channel.`;
      
      replacement.attachments[0].text = `:white_check_mark:  ${ackText}`;
      delete replacement.attachments[0].actions;
      
        return replacement;
        
    }).then(bot);



    return replacement;
   });

   //Use Case 1 : Link pre-existing storyboard to channel
slackMessages.action('link_boards_lists_callback', (payload,bot) => {
    // `payload` is JSON that describes an interaction with a message.
    //console.log(`The user ${payload.user.name} in team ${payload.team.domain} pressed the welcome button`);
    var slackUserID = (payload.user.id).toLowerCase();
    //console.log('******* LIST PAYLOAD : ', payload);
    // The `actions` array contains details about the specific action (button press, menu selection, etc.)
    const action = payload.actions[0];

    var selected_options = action.selected_options[0];
   console.log("\n\n Board Selected options: ",JSON.stringify(action.selected_options));
   console.log("\n\n BOARD Selected options KEY: ",JSON.stringify(action.selected_options[1]));
   persistStoryboardID = action.selected_options[0].value;
   const selectedType = findSelectedOption(payload.original_message, 
                                'link_boards_lists_callback', 
                                payload.actions[0].selected_options[0].value);

    var ackText = `${selectedType.text} board has been linked with this channel.`;


    const replacement = payload.original_message;
    replacement.attachments[0].text = `:white_check_mark:  ${ackText}`;
    delete replacement.attachments[0].actions;
    
      return replacement;
   });


//USE CASE 2 CREATING NEW TASK
slackMessages.action('list_selection_callback', (payload,bot) => {
    // `payload` is JSON that describes an interaction with a message.
    console.log(`The user ${payload.user.name} in team ${payload.team.domain} pressed the welcome button`);
    var slackUserID = (payload.user.id).toLowerCase();
    console.log('******* LIST PAYLOAD : ', payload);
    // The `actions` array contains details about the specific action (button press, menu selection, etc.)
    const action = payload.actions[0];

    var selected_options = action.selected_options[0];
   //console.log(`The dropdown menu had name ${action.name} and value ${action.value}`);
    var ackText = `You have selected ${selected_options.value} list.`;
    const replacement = payload.original_message;
    // Typically, you want to acknowledge the action and remove the interactive elements from the message
    //attachment.text =`Welcome ${payload.user.name}`;
    var createdListsNames;
    // Start an order, and when that completes, send another message to the user.
    
	return trelloDB.getTrelloTokenFromSlackId(slackUserID)
	.then((response) => {
	 trelloToken  = response
	 console.log("Got value of trelloToken here "+ trelloToken);
    main.getNewCard(newCardName, selected_options.value, trelloToken)
    .then((response) => {
      // Keep the context from the updated message but use the new text and attachment
      
      ackText = `Your card has been successfully created in your selected list.`;
      
      replacement.attachments[0].text = `:white_check_mark:  ${ackText}`;
      delete replacement.attachments[0].actions;
      console.log(" LINE 100");
      
        return replacement;
        //return ackText;
    }).then(bot);



    return replacement;
   });
});

slackMessages.action('cards_under_list_callback', (payload,bot) => {
    // `payload` is JSON that describes an interaction with a message.
    var slackUserID = (payload.user.id).toLowerCase();
    console.log('******* Template Cards under List PAYLOAD : ', payload);
    // The `actions` array contains details about the specific action (button press, menu selection, etc.)
    const action = payload.actions[0];
    var listId = action.selected_options[0].value;
    console.log("Selected options: ",JSON.stringify(action.selected_options[0]));


    const selectedType = findSelectedOption(payload.original_message, 
      'cards_under_list_callback', 
      payload.actions[0].selected_options[0].value);
     
    var ackText = `You have selected \`${selectedType.text}\` list. \n You can do the following : Provide URL to attach, Set due date, Set label, or Archive Card`;
    const replacement = payload.original_message;

    var createdListsNames;
    // Start an order, and when that completes, send another message to the user.
    var trelloToken;
    
    trelloDB.getTrelloTokenFromSlackId(slackUserID)
	.then((response) => {
	 trelloToken  = response
	 console.log("Got value of trelloToken here "+ trelloToken);
});
    trello.retrieveCards(listId, trelloToken)
    .then((cards) => {

          var cardsAttach = {
              "text": "Select your card that you want to manage:",
              "fallback": "If you could read this message, you'd be choosing something fun to do right now.",
                "callback_id": "card_selected_attachment_callback",
                "color": "#3AA3E3",
                "attachment_type": "default",
                "actions": [
                {
                    "name": "cards_list",
                    "text": "Select a Card...",
                    "type": "select",
                    "options": []
               }
              ]
          };
          console.log(" TYPE OF CARDS : "+typeof cards);

          cards.forEach(function(card){
            console.log("card: "+card.id+" "+card.name+" ");
            cardsAttach.actions[0].options.push({"text":card.name,"value":card.id});
          });

          // console.log("** Attachement: "+JSON.stringify(replacement.attachments[0]));
          // console.log("** Attachement1 options: "+JSON.stringify(cardsAttach.actions[0].options));
          replacement.attachments[0].text = `:white_check_mark:  ${ackText}`;
          delete replacement.attachments[0].actions;
          replacement.attachments.push(cardsAttach);
          return replacement;
    }).then(bot);

    //main.getCardsInList(listId)



    return replacement;
   });

slackMessages.action('card_selected_attachment_callback', (payload,bot) => {
    // `payload` is JSON that describes an interaction with a message.
    var slackUserID = (payload.user.id).toLowerCase();
    console.log('*******  Cards Attach PAYLOAD : ', payload);
    const action = payload.actions[0];
    var cardId = action.selected_options[0].value;
    console.log("Selected options: ",JSON.stringify(action.selected_options[0]));
    const selectedType = findSelectedOption(payload.original_message, 
    'card_selected_attachment_callback', 
    payload.actions[0].selected_options[0].value);
    
    var ackText = `You have selected \`${selectedType.text}.\` card`;
    const replacement = payload.original_message;
    persistCardID = cardId;
    replacement.attachments[1].text = `:white_check_mark:  ${ackText}`;
    delete replacement.attachments[1].actions;

    // buildManageTasksDropdownLists().then(function(taskAttachment){
    //     console.log("WHY ARE YOU NOT COMING HERE?");
    //     replacement.attachments.push(taskAttachment); 
    //     return replacement;
    // }).then(bot);
    return replacement;
   });


   //Manage Tasks:

   slackMessages.action('manage_tasks_callback', (payload,bot) => {
    // `payload` is JSON that describes an interaction with a message.
    var slackUserID = (payload.user.id).toLowerCase();
    console.log('*******  manage_tasks PAYLOAD : ', payload);
    const action = payload.actions[0];
    console.log("Selected options: ",JSON.stringify(action.selected_options[0]));
    var selected_options = action.selected_options[0];
    var ackText = `You have selected \`${selected_options.value}.\` manage`;
    const replacement = payload.original_message;
    replacement.attachments[2].text = `:white_check_mark:  ${ackText}`;
    delete replacement.attachments[2].actions;
    return replacement;
   });


var controller = Botkit.slackbot({
    debug: true
    //include "log: false" to disable logging
    //or a "logLevel" integer from 0 to 7 to adjust logging verbosity
  }).configureSlackApp(
    {
      clientId: clientid,
      clientSecret: clientsecret,
      scopes: ['bot'],
    }
  );
controller.spawn({
    token: process.env.SLACK_BOT_TOKEN,
    // incoming_webhook: {
    //     url: my_webhook_url
    //   }
}).startRTM()


controller.hears('new card',['mention', 'direct_mention','direct_message'], function(bot,message)
{
  console.log(message);
  var slackUserID = (message.user).toLowerCase();
  console.log("Found the slackuser id in new card func "+ slackUserID);
  //bot.reply(message,"Wow! You want to work on Task management with me. Awesome!");
  //check first whether user has created board or not
  var responseMessage;
  if(persistStoryboardID == undefined){
    responseMessage = {
        "text": "Please create a storyboard first or link your existing story board of trello."};
        bot.reply(message,responseMessage);
  }else{
     // console.log("\n 166: "+buildDropdownLists());
      const actionCallbackID = 'list_selection_callback';

      bot.startConversation({
        user: message.user,
        channel: message.channel,
        text: 'Enter the name of the card:'
        }, function(err, convo) {
          convo.ask({
          channel: message.channel,
          text: 'Please enter the name of the card!'
           }, function(res, convo) {
            newCardName = res.text;
            console.log("Inside builDropdownlists, value of slackUserID "+ slackUserID);
            buildDropdownLists(actionCallbackID, slackUserID).then(function(results){
                responseMessage = results;
                convo.next();
                bot.reply(message,responseMessage);
            });
             
             }
      )
}

);
  }
});

  controller.hears('create new list',['mention', 'direct_mention','direct_message'], function(bot,message)
  {
    console.log("!@#$%^&* create new list: "+message);
    var responseMessage;
    var slackUserID = (message.user).toLowerCase();

    if(persistStoryboardID == undefined){
      responseMessage = {
          "text": "Please link your existing story board of trello or create a new storyboard first."};
          bot.reply(message,responseMessage);
    }else{
        bot.startConversation({
            user: message.user,
            channel: message.channel,
            text: 'Please enter the list name!'
            }, function(err, convo) {
              convo.ask({
              channel: message.channel,
              text: 'Please enter the name of the list!'
               }, function(res, convo) {
                 
                 main.getNewList(res.text, persistStoryboardID, slackUserID).then((response)=>{
                    convo.say(`\`${res.text}\`` + ' list has been created to your linked board!'); 
                    convo.next();  
                 });
                 
                 }
          )
    }

);
    }    

});


controller.hears('new board',['mention', 'direct_mention','direct_message'], function(bot,message)
{
  // var msg;
  // console.log(message);
  // fetch(
  // 'https://api.wit.ai/message?q='+message.text,
  // {
  //   method: 'GET',
  //   headers: {Authorization: 'Bearer JV4QANMKE3OADXWWE2CWJH4M2EDGIHTJ'}
  // }
  // )
  // .then(response => response.json())
  // .then(json => delegateMessage(json))
  // .then(msg => console.log(msg));
  console.log("RECEIVED MESSAGE: "+message.text);
  var slackUsername = (message.user).toLowerCase();
    bot.startConversation({
    user: message.user,
    channel: message.channel,
    text: 'Please enter the new board name!'
    }, function(err, convo) {
      convo.ask({
      channel: message.channel,
      text: 'Enter the name of the board:'
       }, function(res, convo) {

        newStoryBoardName = res.text;
        bot.reply(message,{
            "text": "Creating a new board is easy now!",
            "attachments": [
      
                {
                  "text": "Choose a list from the following dropdown",
                  "fallback": "If you could read this message, you'd be choosing something fun to do right now.",
                    "callback_id": "template_selection_callback",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                    {
                        "name": "templates_list",
                        "text": "Select a template...",
                        "type": "select",
                        "options": [
                            {
                                "text": "Scrum Board",
                                "value": "Scrum"
                            },
                            {
                                "text": "Waterfall Board",
                                "value": "Waterfall"
                            }
                       ]
                   }
                  ]
              }
          ]
        });
        convo.next();
         }
         
  )
}

);


});



controller.hears('manage tasks',['mention', 'direct_mention','direct_message'], function(bot,message){
    var slackUserID = (message.user).toLowerCase();
    var trelloToken;
    trelloDB.getTrelloTokenFromSlackId(slackUserID)
	.then((response) => {
	 trelloToken  = response
	 console.log("Got value of trelloToken here "+ trelloToken);

      lists = trello.retrieveLists(persistStoryboardID, trelloToken).then(function(lists){
        var options = [];
        console.log(lists);
        lists.forEach(function(list) {
          options.push({"text": list.name, "value": list.id});
        });
        bot.reply(message,{
          "text": "Choose the card you want to manage:",
          "attachments": [
              {
                "text": "Choose a List",
                "fallback": "If you could read this message, you'd be choosing something fun to do right now.",
                  "callback_id": "cards_under_list_callback",
                  "color": "#3AA3E3",
                  "attachment_type": "default",
                  "actions": [
                  {
                      "name": "list_items",
                      "text": "Select a List...",
                      "type": "select",
                      "options": options
                 }
                ]
            }
        ]
        });
      });
    });
      
});

controller.hears('Copy lists',['mention', 'direct_mention','direct_message'], function(bot,message){

    var slackUserID = (message.user).toLowerCase();

    listMap = main.getBoardsOfMember(slackUserID).then(function(listMap){
      var options = [];
      console.log(listMap);
      listMap.forEach(function(value, key) {
        options.push({"text": value, "value": key});
      });
      bot.reply(message,{
        "text": "Choose your pre-existing storyboard from which you want to copy your lists.",
        "attachments": [
            {
              "text": "Choose pre-existing storyboard",
              "fallback": "If you could read this message, you'd be choosing something fun to do right now.",
                "callback_id": "boards_lists_callback",
                "color": "#1ABDE3",
                "attachment_type": "default",
                "actions": [
                {
                    "name": "board_items",
                    "text": "Select a Board...",
                    "type": "select",
                    "options": options
               }
              ]
          }
      ]
      });
    });
    
});

controller.hears('Link existing board',['mention', 'direct_mention','direct_message'], function(bot,message){
    var slackUserID = (message.user).toLowerCase();
    listMap = main.getBoardsOfMember(slackUserID).then(function(listMap){
      var options = [];
      console.log(listMap);
      listMap.forEach(function(value, key) {
        options.push({"text": value, "value": key});
      });
      bot.reply(message,{
        "text": "Choose your pre-existing storyboard to which you want to link this channel.",
        "attachments": [
            {
              "text": "Choose pre-existing storyboard",
              "fallback": "If you could read this message, you'd be choosing something fun to do right now.",
                "callback_id": "link_boards_lists_callback",
                "color": "#1ABDE3",
                "attachment_type": "default",
                "actions": [
                {
                    "name": "board_items",
                    "text": "Select a Board...",
                    "type": "select",
                    "options": options
               }
              ]
          }
      ]
      });
    });
    
});

controller.hears('URL',['mention', 'direct_mention','direct_message'], function(bot,message){
      console.log("Message: "+ message);
      var slackUserID = (message.user).toLowerCase();
      var regexpURL = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/igm
      url = regexpURL.exec(message.text);
      
      var card_attachment = {url: String(url[0])};
      
      main.addAttachment(persistCardID, card_attachment, slackUserID)
      .then((urlreceived) => {
        var replyMessage = "Sorry did not understand your URL";
        if(String(url[0])){
          replyMessage = "Link "+ String(url[0])+ " was attached to "+ persistCardID+ " card";
        }
        var replyMessage = {
            "text": "I have attached the given URL "+String(url[0])+ " to your previously selected card. "
        };
        bot.reply(message,replyMessage);

        return replyMessage;

      }).then(bot);

});

controller.hears('Hello',['mention', 'direct_mention','direct_message'], function(bot,message){
    console.log("Message: "+ message);
    var slackUsername = (message.user).toLowerCase();
      bot.reply(message,{
        "text": "Hey there, I am task management bot :robot_face:. I am here to help you initialize your task management process faster. ",
        "attachments": [
            {
                "title": "Hint:",
                "text": "You can ask me to create storyboard from predefined templates! "
            }  
        ]
    });
    
    
});
var slackUsername;
controller.hears('Link my trello',['mention', 'direct_mention','direct_message'], function(bot,message)
{
  console.log(message);
  slackUsername = message.user;
  var responseMessage;
  // Check if entry already there in slack to trello database, 
  // getTrelloToken (Also need to modify all functions to take in key and token as params)
  
  trelloDB.getTrelloUsername(slackUsername.toLowerCase())
  .then((response) => {
   trelloUserName  = response
   console.log("Got value of trelloUserName here "+ response + " type :" + typeof response);
  
 
  console.log("The value for trelloUserName "+ trelloUserName);
  if( trelloUserName === -1){
    const requestURL = "https://trello.com/1/OAuthGetRequestToken";
    const accessURL = "https://trello.com/1/OAuthGetAccessToken";
    const authorizeURL = "https://trello.com/1/OAuthAuthorizeToken";
    const appName = "Taskbot App";
    console.log("New site");
    
    // Be sure to include your key and secret in 🗝.env ↖️ over there.
    // You can get your key and secret from Trello at: https://trello.com/app-key
    const key = process.env.TRELLO_KEY;
    const secret = process.env.TRELLO_OAUTH_SECRET;
    
    // Trello redirects the user here after authentication
    const loginCallback = "http://ec2-18-217-81-155.us-east-2.compute.amazonaws.com/callback";
    
    // You should have {"token": "tokenSecret"} pairs in a real application
    // Storage should be more permanent (redis would be a good choice)
    //const oauth_secrets = {};
    
    oauth = new OAuth(requestURL, accessURL, key, secret, "1.0A", loginCallback, "HMAC-SHA1")
    
   // trelloUserName =  //call the oauth method to get the user related trelloname, toke
    oauth.getOAuthRequestToken(function(error, token, tokenSecret, results){
        console.log(`in getOAuthRequestToken - token: ${token}, tokenSecret: ${tokenSecret}, resultes ${JSON.stringify(results)}, error: ${JSON.stringify(error)}`);
        oauth_secrets[token] = tokenSecret;
        responseMessage = `${authorizeURL}?oauth_token=${token}&scope=read,write&name=${appName}`;
        console.log(responseMessage);
        bot.reply(message, responseMessage);
        
      });
    
    //trelloDB.insertIntoSlackToTrello(slackUsername, trelloUserName);
    }
    else {
        // get the trello token

        trelloDB.getTrelloToken(trelloUserName)
        .then((response) => {
         trelloToken  = response
         console.log("Got value of trelloToken here "+ trelloToken);
         console.log("Entry already in database");
         responseMessage = "Trello account already linked"
         bot.reply(message, responseMessage);
    });
}
});
}); 
// Helper functions

function buildDropdownLists(actionCallbackId, slackUser){

   console.log("slackuser id in builDropdown list "+ slackUser);
    //console.log("\n\n BEFORE :: BEFORE :: JSON OBJECT BUILT: "+JSON.stringify(jsonobj));
    return new Promise( function(resolve, reject){
        main.getListsInBoard(persistStoryboardID, slackUser)
        .then((responseLists) => {
            var jsonobj = {
                "text": "First we will link your task which you want to manage: ",
                "attachments": [   
                
                    {
                      "text": "Choose a list from the following list to a task into that list:",
                      "fallback": "If you could read this message, you'd be choosing something fun to do right now.",
                        "callback_id": "list_selection_callback",
                        "color": "#CECDE1",
                        "attachment_type": "default",
                        "actions": [
                        {
                            "name": "lists_list",
                            "text": "Select a list...",
                            "type": "select",
                            "options": [],
                       }
                      ],
                  }
              ],
            };
            console.log("\n\n BEFORE :: JSON OBJECT BUILT: "+JSON.stringify(jsonobj));
            responseLists.forEach(function(value, key) {
                console.log(" KEY : "+key+ "VALUE: "+value);
                jsonobj.attachments[0].actions[0].options.push({ 
                    "text" : value,
                    "value"  : key,
                });
            });
            console.log("\n\n JSON OBJECT BUILT: "+JSON.stringify(jsonobj));
            resolve(jsonobj);  
        });
    });

}

function buildManageTasksDropdownLists(){  
        //console.log("\n\n BEFORE :: BEFORE :: JSON OBJECT BUILT: "+JSON.stringify(jsonobj));
        return new Promise( function(resolve, reject){

                var jsonobj = {
                          "text": "Choose a list from the following list to a task into that list:",
                          "fallback": "If you could read this message, you'd be choosing something fun to do right now.",
                            "callback_id": "manage_tasks_callback",
                            "color": "#0070FF",
                            "attachment_type": "default",
                            "actions": [
                            {
                                "name": "lists_list",
                                "text": "Select an action to perform...",
                                "type": "select",
                                "options": [
                                    {
                                        "text": "Set Label",
                                        "value": "Set Label"
                                    },
                                    {
                                        "text": "Attach URL",
                                        "value": "Attach URL"
                                    },
                                    {
                                        "text": "Set Due Date",
                                        "value": "Set Due Date"
                                    },
                                    {
                                        "text": "Archive Card",
                                        "value": "Archive Card"
                                    },
                                ],
                           }
                          ],
                      };
                resolve(jsonobj);  
            });
    }

function findAttachment(message, actionCallbackId) {
    console.log("Funciton findAttachment: \n message: ", message, "/n actionCallbackID: ",actionCallbackId);
    return message.attachments.find(a => a.callback_id === actionCallbackId);
  }

  function acknowledgeActionFromMessage(originalMessage, actionCallbackId, ackText) {
    console.log("Called acknowledgeActionFromMessage : \n Original Message",originalMessage);
    console.log("actionCallbackId: ",actionCallbackId);
    console.log("Ack Text: ",ackText);
    const message = cloneDeep(originalMessage);
    const attachment = findAttachment(message, actionCallbackId);
    delete attachment.actions;
    attachment.text = `:white_check_mark: ${ackText}`;
    console.log("Message:: ",message);
    return message;
  }

  function findSelectedOption(originalMessage, actionCallbackId, selectedValue) {
    const attachment = findAttachment(originalMessage, actionCallbackId);
    return attachment.actions[0].options.find(o => o.value === selectedValue);
  }

// Start the built-in HTTP server
//const port = 4390;
// slackMessages.start(port).then(() => {
//  console.log(`server listening on port ${port}`);
// });
var server = app.listen(process.env.PORT, function () {
    console.log('Server up and running...🏃🏃🏻');
    console.log("Listening on port %s", server.address().port);
});
app.get("/callback", function (request, response) {
    console.log(`GET '/callback' 🤠 ${Date()}`);
    callback(request, response);
});
const oauth_secrets = {};
var oauth;
var callback = function(request, response) {
    const query = url.parse(request.url, true).query;
    const token = query.oauth_token;
    const tokenSecret = oauth_secrets[token];
    const verifier = query.oauth_verifier;
    oauth.getOAuthAccessToken(token, tokenSecret, verifier, function(error, accessToken, accessTokenSecret, results){
      // In a real app, the accessToken and accessTokenSecret should be stored
      console.log(`in getOAuthAccessToken - accessToken: ${accessToken}, accessTokenSecret: ${accessTokenSecret}, error: ${error}`);
      oauth.getProtectedResource("https://api.trello.com/1/members/me", "GET", 
      accessToken, accessTokenSecret, function(error, data, res){
        // Now we can respond with data to show that we have access to your Trello account via OAuth
        console.log(`in getProtectedResource - accessToken: ${accessToken}, accessTokenSecret: ${accessTokenSecret}`);
        console.log(JSON.parse(data).username);
        trelloUserName = JSON.parse(data).username
        
        trelloDB.insertIntoSlackToTrello(slackUsername.toLowerCase(), trelloUserName );
        trelloDB.insertIntoTrelloInfo(trelloUserName, accessToken);
        trelloToken= accessToken;
        
        response.send(data);
      });
    });
   };

   // This route handles get request to a /oauth endpoint. We'll use this endpoint for handling the logic of the Slack oAuth process behind our app.
app.get('/oauth', function(req, res) {
    // When a user authorizes an app, a code query parameter is passed on the oAuth endpoint. If that code is not there, we respond with an error message
    if (!req.query.code) {
        res.status(500);
        res.send({"Error": "Looks like we're not getting code."});
        console.log("Looks like we're not getting code.");
    } else {
        // If it's there...
        console.log("oatuh code: "+req.query.code);
        // We'll do a GET call to Slack's `oauth.access` endpoint, passing our app's client ID, client secret, and the code we just got as query parameters.
        request({
            url: 'https://slack.com/api/oauth.access', //URL to hit
            qs: {code: req.query.code, client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET}, //Query string data
            method: 'GET', //Specify the method

        }, function (error, response, body) {
            if (error) {
                console.log(error);
            } else {
                res.json(body);
                console.log("Response Oauth: "+response.body);
                //trelloDB.insertSlackToken(userId, slackBotToken);
            }
        })
    }
});

controller.hears('set due date',['mention', 'direct_mention','direct_message'], function(bot,message)
{
  console.log(message);
  var slackUserID = (message.user).toLowerCase();
  //bot.reply(message,"Wow! You want to work on Task management with me. Awesome!");
   var slackUserID = (message.user).toLowerCase();
  //check first whether user has created board or not
  var responseMessage;
  var regexpDueDate = /(0[1-9]|1[012])[- \/.](0[1-9]|[12][0-9]|3[01])[- \/.](19|20)\d\d/
  dueDate = regexpDueDate.exec(message.text);
  var card_due = String(dueDate[0]);
  
  
  if(persistStoryboardID == undefined){
    responseMessage = {
        "text": "Please create a storyboard first or link your existing story board of trello."};
        bot.reply(message,responseMessage);
  }else{
      
    main.addDueDate(persistCardID, card_due, slackUserID).then(function(results){
        responseMessage = "Due date set on this card: "+results;
        bot.reply(message,responseMessage);
    });
  }
});

controller.hears('archive card',['mention', 'direct_mention','direct_message'], function(bot,message)
{
  console.log(message);
  var slackUserID = (message.user).toLowerCase();
  //bot.reply(message,"Wow! You want to work on Task management with me. Awesome!");
  var slackUserID = (message.user).toLowerCase();
  //check first whether user has created board or not
  var responseMessage;
 
  
  
  if(persistStoryboardID == undefined){
    responseMessage = {
        "text": "Please create a storyboard first or link your existing story board of trello."};
        bot.reply(message,responseMessage);
  }else{
      
    main.archiveCard(persistCardID, slackUserID).then(function(results){
        responseMessage = "This card is now archived: "+results;
        bot.reply(message,responseMessage);
    });
  }
});

controller.hears('label',['mention', 'direct_mention','direct_message'], function(bot,message) 
{
  console.log(message);
  //bot.reply(message,"Wow! You want to work on Task management with me. Awesome!");
  var slackUserID = (message.user).toLowerCase();
  var mg = {
    "text": "You can assign the priority of the task now.",
    "attachments": [
        {
            "text": "Select the priority of the card you want to assign:",
            "fallback": "Shame... buttons aren't supported in this land",
            "callback_id": "button_tutorial",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "high Priority",
                    "text": "High Priority",
                    "type": "button",
                    "value": "red",
                    "style": "danger"
                },
                {
                    "name": "Medium Priority",
                    "text": "Medium Priority",
                    "type": "button",
                    "value": "yellow"
                
                },
                {
                    "name": "Low Priority",
                    "text": "Low Priority",
                    "type": "button",
                    "value": "green",
                    
                }
            ]
        }
    ]
}
bot.reply(message,mg);
});

