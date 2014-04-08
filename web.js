// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
// var stripe = require('stripe');

// stripe.setApiKey('sk_test_bY22es5dN0RpWmJoJ5VlBQ5E')

var emitter = new EventEmitter;
var app = express();

app.use(logfmt.requestLogger());

var testJson = {
	head: "hello, this is a test",
	body: "hi, Meghann",
	object: {
		head: "this is a nested test",
		body: "written by isaac and meghann"
	}
};

app.get('/', function(req, res) {

	console.log('TEST >>>>>>>>>>>>>>>>> this is the console')
	res.send('server is running');
});

app.post('/webhook', function(request, response){
	console.log("RAW RESPONSE:", response);
	response.send('OK');
	response.end()
});

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);
});
