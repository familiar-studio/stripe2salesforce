// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var stripe = require('stripe');




var mongo = require('mongodb');
var databaseUrl = 'db.js'
var collection = ['stripeReq']

var db = mongo.connect(databaseUrl, collection)


// stripe.setApiKey('sk_test_bY22es5dN0RpWmJoJ5VlBQ5E')

var emitter = new EventEmitter;
var app = express();

app.use(express.bodyParser());

app.use(logfmt.requestLogger());



var mongoUri = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost:5000/db'


app.get('/', function(req, res) {
	res.send('server is running');

	mongo.Db.connect(mongoUri, function(err, db) {
		console.log("DB===================", db)
		db.collection('db', function(er, collection) {
			collection.insert({'stripeReq':request.body})
		})
	});
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
