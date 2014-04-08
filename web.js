// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var stripe = require('stripe');


// stripe.setApiKey('sk_test_bY22es5dN0RpWmJoJ5VlBQ5E')

var emitter = new EventEmitter;
var app = express();

app.use(express.bodyParser());

app.use(logfmt.requestLogger());



app.get('/', function(req, res) {

	console.log('TEST >>>>>>>>>>>>>>>>> this is the console')
	res.send('server is running');
});

app.post('/webhook', function(request, response){
	if (request.body.type === 'charge.succeeded') {
		fs.appendFile('wow.txt', JSON.stringify(request.body, null, 4), function(err){
			if (err) {
				console.log('error!', err);
			} else {
				console.log('yaaaaaayy!! saved!' )
			}
		});
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
