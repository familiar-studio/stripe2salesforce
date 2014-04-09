// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var stripe = require('stripe');
var jsforce = require('jsforce');

// requires mongo db for logging transactions
var mongo = require('mongodb');
// sets link to mongodb on heroku (and localhost???)
var mongoUri = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost:5000/stripeLogs';


var emitter = new EventEmitter;
var app = express();

// converts json metadata into stripe transaction object
app.use(express.bodyParser());

app.use(app.router);

app.use(logfmt.requestLogger());


// Salesforce Connection information
var conn = new jsforce.Connection({
  oauth2 : {
    clientId : '3MVG9y6x0357HleeZ5WRMCv.Ih7Uxos6mg6Y.7N3RdXzC15h..L4jxBOwzB79dpcRSxwpV3.OgbNXSSJiobQQ',
    clientSecret : '8923954381316425368',
    redirectUri : 'https://stripe2salesforce.herokuapp.com',
    proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'

  },
  proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'
});

conn.login('keith@familiar-studio.com', 'KVWVXbwYUjbB33yDyh84HkGeL1fbW2ZDx0rnmu', function(err, res) {
  if (err) { return console.error(err); }
});


app.get('/', function(req, res) {

});
	

app.post('/webhook', function(request, response){
	// on post from stripe webhook, dump json transaction in mongodb
	mongo.Db.connect(mongoUri, function(err, db) {
		// may be viewed at bash$ heroku addons:open mongolab
		db.collection('stripeLogs', function(er, collection) {
			collection.insert({'stripeReq':request.body}, function(err, result){
				console.log(err);
			});
		});
	});

	// TODO parse incoming types to route them separately
	if (request.body.type === 'charge.succeeded') {
		console.log("CHARGE.SUCCEEDED",response.body);
	} else {
		console.log("CHARGE NOT 'CHARGE.SUCCEEDED'", response.body.type);
	}

	response.send('OK');
	response.end();
});


app.get('/salesforce/read', function(request, response) {
  console.log('Read!' );
  conn.query('SELECT Id, Name, Phone FROM Account limit 10', function(err, res) {
    if (err) { return console.error(err); }
    console.log(res);
  });

});

app.get('/salesforce/insert', function(request, response) {
  console.log('Insert!' );
  conn.sobject("Account").create({ Name : 'Test Account #1' }, function(err, ret) {
    if (err || !ret.success) { return console.error(err, ret); }
    console.log("Created record id : " + ret.id);
    // ...
  });

});

var port = Number(process.env.PORT || 5000);
app.listen(port, function()
{  console.log("Listening on " + port);
});
