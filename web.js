// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var stripe = require('stripe');


// =========================================
// MONGO REQUIREMENTS & VARIABLES

var mongo = require('mongodb');
var databaseUrl = 'stripeLogs.js'
var collection = ['stripeReq']

var db = mongo.connect(databaseUrl, collection)
var mongoUri = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost:5000/db'

// =========================================


var emitter = new EventEmitter;
var app = express();

app.use(express.bodyParser());
app.use(logfmt.requestLogger());


app.get('/', function(req, res) {
	res.send('server is running');

// =========================================
// BROKEN DB INSERT HERE

	// mongo.Db.connect(mongoUri, function(err, db) {
	// 	console.log("DB===================", db)
	// 	db.collection('db', function(er, collection) {
	// 		collection.insert({'stripeReq':request.body})
	// 	})
	// });

// IT'S IN THE ROOT ROUTE NOW SO IT'S HIT ON
// LOAD BUT WILL LIVE IN APP.POST EVENTUALLY
// =========================================


});

app.post('/webhook', function(request, response){
	if (request.body.type === 'charge.succeeded') {
		// mongo.Db.connect(mongoUri, function(err, db) {
		// 	db.collection('stripeLogs', function(er, collection) {
		// 		collection.insert({'stripeReq':request.body})
		// 	})
		// });
	}else{
		console.log('noooooooo!!!!')
	}
	// console.log("RAW RESPONSE:", response);
	// console.log("request*******", request.body);
	response.send('OK');
	response.end()
});

var port = Number(process.env.PORT || 5000);
app.listen(port, function() 
{  console.log("Listening on " + port);
});
