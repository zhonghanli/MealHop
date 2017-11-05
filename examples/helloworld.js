//
// Copyright (c) 2016 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a Cisco Spark bot that:
 *   - sends a welcome message as he joins a room, 
 *   - answers to a /hello command, and greets the user that chatted him
 *   - supports /help and a fallback helper message
 *
 * + leverages the "node-sparkclient" library for Bot to Cisco Spark communications.
 * 
 */

var SparkBot = require("node-sparkbot");
var bot = new SparkBot();
//bot.interpreter.prefix = "#"; // Remove comment to overlad default / prefix to identify bot commands

var SparkAPIWrapper = require("node-sparkclient");
if (!process.env.SPARK_TOKEN) {
    console.log("Could not start as this bot requires a Cisco Spark API access token.");
    console.log("Please add env variable SPARK_TOKEN on the command line");
    console.log("Example: ");
    console.log("> SPARK_TOKEN=XXXXXXXXXXXX DEBUG=sparkbot* node helloworld.js");
    process.exit(1);
}
var spark = new SparkAPIWrapper(process.env.SPARK_TOKEN);


//
// Help and fallback commands
//
bot.onCommand("help", function (command) {
    spark.createMessage(command.message.roomId, "Here is a list of my functions: \n\n- /setzipcode [zipcode] to set your location \n\n- /start [restaurant] [minutes to decide] \n\n- /where to get the restaurant name \n\n- /order [your order] to submit your order \n\n- /editorder [your edited order] to change your order \n\n- /showorders to see the current order list \n\n- /add [additional order] to add to your current order \n\n- /deleteorder to delete your submitted order \n\n- /cancel to cancel the entire order \n\n", { "markdown":true }, function(err, message) {
        if (err) {
            console.log("WARNING: could not post message to room: " + command.message.roomId);
            return;
        }
    });
});
bot.onCommand("fallback", function (command) {
    spark.createMessage(command.message.roomId, "Sorry, I did not understand.\n\nTry /help.", { "markdown":true }, function(err, response) {
        if (err) {
            console.log("WARNING: could not post Fallback message to room: " + command.message.roomId);
            return;
        }
    });
});

///
///Google Places///
///
var GooglePlaces = require("../node_modules/googleplaces/index.js");
var googlePlaces = new GooglePlaces('AIzaSyCWgJBtSkeklJ0UnApwzUXVDNVC4gPlWfU','json');

var PlaceDetailsRequest = require("../node_modules/googleplaces/lib/PlaceDetailsRequest.js");
var placeDetailsRequest = new PlaceDetailsRequest('AIzaSyCWgJBtSkeklJ0UnApwzUXVDNVC4gPlWfU','json');

//
// Bots commands here
//

//global variables
var restaurantname = "";
var countdown = 0;
var zip = 60201;
var orderList = [];
var orderOpen = "false";
var startcommand;

function timer(){
            setTimeout(reminder, (countdown-1)*60000);
            setTimeout(minutedec, 60000);
        };
        
function minutedec(){
    // Close submissions, print order list
    // [!!!] Format so order list is ordered
    countdown = countdown-1;
    if(countdown <= 0 && orderOpen == true){
        orderOpen = false;
        var finalOrder = "";
        for(var i = 0; i < orderList.length; i++) {
            finalOrder += "<@personEmail: " + orderList[i][0] + "> " + orderList[i][1];
            finalOrder += "\n\n";
        }
        spark.createMessage(startcommand, "Final list of orders for " + restaurantname + ": \n\n" + finalOrder, { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post End message to room: " + startcommand);
                return;
            }
        });
    }else{setTimeout(minutedec, 60000);}
};

function reminder(){
    // Send reminder one minute before func end
    spark.createMessage(startcommand, "One Minute Left!", { "markdown":true }, function(err, message) {
    if (err) {
        console.log("WARNING: could not post reminder message to room: " + startcommand);
        return;
    }
    });
};

bot.onCommand("start", function (command) {
    startcommand = command.message.roomId;
    if(orderOpen == true) {
        spark.createMessage(command.message.roomId, "There is already an open lunch order for " + restaurantname + ", do /cancel to start over.", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post End message to room: " + command.message.roomId);
                return;
            }
        });
    }
    else {
        orderOpen = true;
        restaurantname = "";
        for(var i = 0; i < command.args.length-2; i++) {
            restaurantname += command.args[i] + " ";
        }
        restaurantname += command.args[command.args.length-2]
        countdown = parseInt(command.args[command.args.length-1]);
        
        
        if(countdown == 1){
            spark.createMessage(command.message.roomId, "Collecting orders for " + restaurantname + " for the next minute.", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post Start message to room: " + command.message.roomId);
                return;
            }
        });
        }else{
        spark.createMessage(command.message.roomId, "Collecting orders for " + restaurantname + " for the next " + countdown + " minutes.", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post Start message to room: " + command.message.roomId);
                return;
            }
        });
        }
        
        
        timer();
        
        var placeId;
        var parameters = {
            query:  restaurantname+zip,
            type: "restaurant"
        };
        googlePlaces.textSearch(parameters, function(err, response) {
            console.log("search: ", response.results);
            if(response.results.length != 0){
            placeDetailsRequest({reference: response.results[0].reference}, function (error, response) {
                spark.createMessage(command.message.roomId, response.result.website, { "markdown":true }, function(err, message) {
                if (err) {
                console.log("WARNING: could not find website: " + command.message.roomId);
                return;
                }
             });
            });
            }
        });
    }
});

bot.onCommand("where", function(command) {
    spark.createMessage(command.message.roomId, "The lunch plan is for " + restaurantname, { "markdown":true }, function(err, message) {
        if (err) {
            console.log("WARNING: could not post Where message to room: " + command.message.roomId);
            return;
        }
    });
});

bot.onCommand("showorders", function(command) {
    if(countdown <= 0) {
        spark.createMessage(command.message.roomId, "There are no active lunch plans! Use /start to start a lunch plan!", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post Order Failure message to room: " + command.message.roomId);
                return;
            }
        });
    }
    else {
        for(var i = 0; i < orderList.length; i = i+1) {
            spark.createMessage(command.message.roomId, "<@personEmail: " + orderList[i][0]+ "> " + orderList[i][1], { "markdown":true }, function(err, message) {
                if (err) {
                    console.log("WARNING: could not post End Table message to room: " + command.message.roomId);
                    return;
                }
            });
        }
    }
});

bot.onCommand("order", function (command) {
    var email = command.message.personEmail;
    if(countdown <= 0) {
        spark.createMessage(command.message.roomId, "There are no active lunch plans! Use /start to start a lunch plan!", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post Order Failure message to room: " + command.message.roomId);
                return;
            }
        });
    } 
    else{
        for (i=0; i < orderList.length; i++){
            if (orderList[i][0]==command.message.personEmail ){
                spark.createMessage(command.message.roomId, "You have already created an order, " + "<@personEmail: " + orderList[i][0]+ ">"+", try /edit or /add.", { "markdown":true }, function(err, message) {
                if (err) {
                console.log("WARNING: could not add or order: " + command.message.roomId);
                return;
                }
                });
            return;
            }
        }
        var order = "";
        for(var i = 0; i < command.args.length-1; i++) {
            order += command.args[i];
            order += " ";
        }
        order += command.args[command.args.length-1];
        //var email = "<@personEmail: " + command.message.personEmail + ">"; // Spark User that created the message orginally
        var newOrder = [email, order];
        orderList.push(newOrder);
        spark.createMessage(command.message.roomId, "Thank you for your order of " + order + ", " + "<@personEmail: " + command.message.personEmail + ">", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post Hello message to room: " + command.message.roomId);
                return;
            }
        });
    }
    
});

bot.onCommand("editorder", function(command){
    if(countdown <= 0) {
        spark.createMessage(command.message.roomId, "There are no active lunch plans! Use /start to start a lunch plan!", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post Order Failure message to room: " + command.message.roomId);
                return;
            }
        });
    }
    else {
        var email = command.message.personEmail;
        for(var j = 0; j < orderList.length; j++) {
            if(email == orderList[j][0]){ 
                var order = "";
                for(var i = 0; i < command.args.length; i++) {
                    order += " " + command.args[i];
                }
                var email =  command.message.personEmail;
                for (i=0; i < orderList.length; i++){
                    if (orderList[i][0]==command.message.personEmail ){
                        orderList[i][1] = order;
                        spark.createMessage(command.message.roomId, "Your order has been changed to " + order + ", " + "<@personEmail: " + orderList[i][0]+ ">", { "markdown":true }, function(err, message) {
                            if (err) {
                            console.log("WARNING: could not post message to room: " + command.message.roomId);
                            return;
                            }
                        });
                    }
                }
                return;
            }
        };
        spark.createMessage(command.message.roomId, "You haven't placed an order yet, did you mean /order?", { "markdown":true }, function(err, message) {
            if (err) {
            console.log("WARNING: could not post message to room: " + command.message.roomId);
            return;
            }
        });
        
          
    }
});

bot.onCommand("add", function(command){
    if(countdown <= 0) {
        spark.createMessage(command.message.roomId, "There are no active lunch plans! Use /start to start a lunch plan!", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post Order Failure message to room: " + command.message.roomId);
                return;
            }
        });
    }
    else {
        var email = command.message.personEmail;
        for(var j = 0; j < orderList.length; j++) {
            if(email == orderList[j][0]){
                var order = "";
                for(var i = 0; i < command.args.length; i++) {
                    order += " " + command.args[i];
                }
                var email =  command.message.personEmail;
                for (i=0; i < orderList.length; i++){
                    if (orderList[i][0]==command.message.personEmail ){
                        orderList[i][1] = orderList[i][1]+","+order;
                        spark.createMessage(command.message.roomId, "You have added" + order +" to your order, " + "<@personEmail: " + orderList[i][0]+ ">", { "markdown":true }, function(err, message) {
                        if (err) {
                        console.log("WARNING: could not add or order: " + command.message.roomId);
                        return;
                        }
                        });
                    }
                }
                return;
            }
        };
        spark.createMessage(command.message.roomId, "You haven't placed an order yet, did you mean /order?", { "markdown":true }, function(err, message) {
            if (err) {
            console.log("WARNING: could not post message to room: " + command.message.roomId);
            return;
            }
        });
    }
});

bot.onCommand("deleteorder", function(command){
    if(countdown <= 0) {
        spark.createMessage(command.message.roomId, "There are no active lunch plans! ", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post Order Failure message to room: " + command.message.roomId);
                return;
            }
        });
    }
    else {
        var email = command.message.personEmail;
        for (var i=0; i < orderList.length; i++){
            if (orderList[i][0]==command.message.personEmail ){
                orderList.splice(i,1);
                spark.createMessage(command.message.roomId, "You have deleted your order, " + "<@personEmail: " + email + ">", { "markdown":true }, function(err, message) {
                    if (err) {
                        console.log("WARNING: could not add or order: " + command.message.roomId);
                        return;
                    }
                });
                return;
            }
        }
        spark.createMessage(command.message.roomId, "You haven't placed an order yet, did you mean /order?", { "markdown":true }, function(err, message) {
            if (err) {
            console.log("WARNING: could not post message to room: " + command.message.roomId);
            return;
            }
        });
    }
});
    


bot.onCommand("cancel", function (command) {
    if(countdown <= 0) {
        spark.createMessage(command.message.roomId, "There are no active lunch plans! Use /start to start a lunch plan!", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post Order Failure message to room: " + command.message.roomId);
                return;
            }
        });
    }
    else {
        orderOpen = false;
        countdown = -1;
        orderList = [];
        spark.createMessage(command.message.roomId, "Lunch has been canceled :^(", { "markdown":true }, function(err, message) {
            if (err) {
                console.log("WARNING: could not post Cancel message to room: " + command.message.roomId);
                return;
            }
        });
    }
});

bot.onCommand("setzipcode", function (command) {
    zip = parseInt(command.args[0]);
    spark.createMessage(command.message.roomId, "Your zip code is set to: " + zip, { "markdown":true }, function(err, message) {
                if (err) {
                    console.log("WARNING: could not change zipcode: " + command.message.roomId);
                    return;
                }
            });
});


//
// Welcome message 
// sent as the bot is added to a Room
//
bot.onEvent("memberships", "created", function (trigger) {
    var newMembership = trigger.data; // see specs here: https://developer.ciscospark.com/endpoint-memberships-get.html
    if (newMembership.personId != bot.interpreter.person.id) {
        // ignoring
        console.log("new membership fired, but it is not us being added to a room. Ignoring...");
        return;
    }

    // so happy to join
    console.log("bot's just added to room: " + trigger.data.roomId);
    
    spark.createMessage(trigger.data.roomId, "Hi, I am the MealHop bot !\n\n I'm here to organize your lunch plans. Start a lunch order in this group by typing /start [restaurant] [minutes to decide]. Type /help to see my other functions.", { "markdown":true }, function(err, message) {
        if (err) {
            console.log("WARNING: could not post Hello message to room: " + trigger.data.roomId);
            return;
        }

        if (message.roomType == "group") {
            spark.createMessage(trigger.data.roomId, "**Note that this is a 'Group' room. I will wake up only when mentionned.**", { "markdown":true }, function(err, message) {
                if (err) {
                    console.log("WARNING: could not post Mention message to room: " + trigger.data.roomId);
                    return;
                }
            });
        }      
    }); 
});

