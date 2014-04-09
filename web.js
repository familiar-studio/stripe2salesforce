// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

var stripe = require("stripe")(
 "sk_test_bY22es5dN0RpWmJoJ5VlBQ5E"
);
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
    //proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'

  },
//  proxyUrl: 'https://pure-bastion-9629.herokuapp.com/proxy'
});

conn.login('keith@familiar-studio.com', 'KVWVXbwYUjbB33yDyh84HkGeL1fbW2ZDx0rnmu', function(err, res) {
  if (err) { return console.error(err); }
});



app.get('/', function(req, res) {

});


app.post('/webhook', function(request, response){
  //grabbing customer object
  // console.log("THIS IS THE CARD DEATILS*******", request.body.data.object.card)
  // console.log("THIS IS THE ID_____", (request.body.data.object.customer))
  stripe.customers.retrieve(request.body.data.object.customer, function(err, customer) {

    // console.log('********************************THIS IS IT __________EMAIL', customer.email)
    //if no email logges as null


    // console.log('********************************THIS IS IT _______ID', customer.id)


    // TODO IF NAME IS NULL, .SPLIT WILL BREAK
    var cus_name_array = (request.body.data.object.card.name).split(' ')
    conn.sobject("Contact").create({ FirstName : cus_name_array[0], LastName: cus_name_array[cus_name_array.length -1], Stripe_Customer_Id__c: request.body.data.object.customer, Email: customer.email }, function(err, ret) {
      if (err || !ret.success) { return console.error(err, ret); }
      console.log("-----Created record id------ : " + ret.id);
      
    });

	  conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : request.body.data.object.customer }, function(err, res) {
	    if (err) { return console.error(err); }
	    console.log("HERE BE WHAT WE WANT ?>>>>>>>>>>>", res[0].Id)

	    // if the Stripe ID exists, we'll be in this closure, will grab the account ID, and then update  
	  });


  });
	// on post from stripe webhook, dump json transaction in mongodb
	mongo.Db.connect(mongoUri, function(err, db) {
		// may be viewed at bash$ heroku addons:open mongolab
		db.collection('stripeLogs', function(er, collection) {
			collection.insert({'stripeReq':request.body}, function(err, result){
				console.log(err);

			});
		});


	});
//sales force insert
  // console.log('*********THIS IS THE REQUEST>BODY***************', request.body.data.object.amount );

  // var cus_name_array = (request.body.data.object.card.name).split(' ')
  // conn.sobject("Contact").create({ FirstName : cus_name_array[0], LastName: cus_name_array[cus_name_array.length -1], Stripe_Customer_Id__c: request.body.data.object.customer, Email: request.body.data.object.customer.email }, function(err, ret) {
  //   if (err || !ret.success) { return console.error(err, ret); }
  //   console.log("-----Created record id------ : " + ret.id);
    
  // });



	// TODO parse incoming types to route them separately
	// if (request.body.type === 'charge.succeeded') {
	// 	console.log("CHARGE.SUCCEEDED", request.body);
	// } else {
	// 	console.log("CHARGE NOT 'CHARGE.SUCCEEDED'", request.body.type);
	// }

	response.send('OK');
	response.end();
});


app.get('/salesforce/read', function(request, response) {
  // conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : 'cus_3p2nTR84gq9rqi' }, function(err, res) {
  //   if (err) { return console.error(err); }
  //   console.log(res[0].Id)

  //   // if the Stripe ID exists, we'll be in this closure, will grab the account ID, and then update  
  // });


	
});

// app.get('/salesforce/insert', function(request, response) {
//   console.log('Insert!' );
//   conn.sobject("Contact").create({ FirstName : 'Test2', LastName: 'Faker', Stripe_Customer_Id__c: 'cus_3oiBOE7BELbxj2' }, function(err, ret) {
//     if (err || !ret.success) { return console.error(err, ret); }
//     console.log("Created record id : " + ret.id);
//     // ...
//   });

// });

var port = Number(process.env.PORT || 5000);
app.listen(port, function()
{  console.log("Listening on " + port);
});
