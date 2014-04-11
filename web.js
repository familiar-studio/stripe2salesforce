// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

var stripe = require("stripe")(
 "sk_test_bY22es5dN0RpWmJoJ5VlBQ5E"
);
var jsforce = require('jsforce');

var moment = require('moment');

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
})



conn.login('keith@familiar-studio.com', 'KVWVXbwYUjbB33yDyh84HkGeL1fbW2ZDx0rnmu', function(err, res) {
  if (err) { return console.error(err); }
})


app.post('/webhook', function(request, response){

	var stripeCheckName = function(){
		//adding swtich case
		// if ( request.body.data.object.metadata.Name){ console.log("&&&&&&&THIS IS HERE")}
		var name = request.body.data.object.metadata.Name;
		

		if (typeof name == 'string') {
			var name_array = name.split(' ');
			return {
				first_name: name_array[0], 
				last_name: name_array[name_array.length - 1]
			};
		} else {
			// console.log("___________________________Hello")
			return {
				first_name: 'no first name listed',
				last_name: 'no last name listed'
			};
		};
	}


	var getStripeCustomer = function(option, stripe_id, sf_id) {
		console.log('GET STRIPE CUSTOMER', option)
		stripe.customers.retrieve(stripe_id, function(err, customer){
			console.log('EMAIL OBJECT', customer)
			if (option === 0){
				createNewSFContact(stripe_id, customer)
				// exit
			} else if (option === 1) {
				updateSFContactEmail(sf_id, stripe_id, customer)
				// exit
			}

		});
	}

	var createNewSFContact = function(stripe_id, customer){
		console.log("CREATE NEW SF CONTACT", customer.email)
		conn.sobject("Contact").create({ FirstName : stripeCheckName().first_name, LastName: stripeCheckName().last_name,  Stripe_Customer_Id__c: stripe_id, Email: customer.email }, function(err, ret) {
	      if (err || !ret.success) { return console.error(err, ret); }
	      console.log("Created Contact With ID: " + ret.id);

	  });
	}

	var updateSFContactEmail = function(sf_id, stripe_id, customer){
		// console.log(">>>>>>>>> UPDATE SF CONTACT", customer.email)
		// console.log('>>>>>>>>> STRIPE_ID', stripe_id)
		// console.log('>>>>>>>>> SF_ID', sf_id)
		conn.sobject('Contact').update({
			Id: sf_id,
			Email: customer.email
		}, function(error, result){
			if (error || !ret.success) { return console.error(err, ret); }
			console.log('Updated Contact Email to:' + email);
		});
	}


	var createSFSingleOpportunity = function(stripe_info){
		var stripe_id = request.body.data.object.id
		var amount = request.body.data.object.amount/100
		var date = moment.unix(stripe_info.created).format("YYYY-MM-DDTHH:mm:ss:ZZ")
		console.log('THIS IS THE AMOUT *********************', request.body.data.object.amount)
		console.log('THIS IS THE id *********************', request.body.data.object.customer)

		conn.sobject("Opportunity").create({ 
			Amount: amount, 
			Stripe_Charge_Id__c: stripe_id, 
			Name: "OUR Stripe Charge",
			StageName: "Closed Won",
			CloseDate: date
		
		}, function(error, ret){
			if (err || !ret.success) { return console.error(err, ret); }
			console.log("created!!!!!!!!!!!! record id :" + ret.id);
		});
	}


	var createSFSubOpportunity = function(stripe_info){
		var stripe_id = stripe_info.id
		var amount = stripe_info.amount/100
		var date = moment.unix(stripe_info.created).format("YYYY-MM-DDTHH:mm:ss:ZZ")
		conn.sobject("Opportunity").create({ 
			Amount: amount, 
			Stripe_Charge_Id__c: stripe_id, 
			Name: "OUR Stripe Charge",
			StageName: "Closed Won",
			CloseDate: date,
			Contract__c: ""
		
		}, function(error, ret){
			if (err || !ret.success) { return console.error(err, ret); }
			console.log("created!!!!!!!!!!!! record id :" + ret.id);
		});
	}
 	
 	var getStripeInvoice = function(stripe_info, invoice){
 		stripe.invoices.retrieve( invoice, function(err, response){
 			getStripeSubscription(stripe_info, response.subscription)
 		});
 	}

 	var getStripeSubscription = function(stripe_info, subscription_id){
 		console.log(subscription_id)
 		stripe.customers.retrieveSubscription({
 			stripe_info.customer,
 			subscription_id
 		}, function(subscription){
 			console.log(subscription)
 		});
 	}



	if (request.body.type === 'charge.succeeded') {
		var stripe_info = request.body.data.object;
  	var invoice = request.body.data.object.invoice;

  	console.log(invoice)

		conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : stripe_info.customer }, function(err, res) {
			if (invoice !== null) {
				getStripeInvoice(stripe_info, invoice)
			} else {
				createSFSingleOpportunity(stripe_info);

			};
		});
	};


 
	// if (request.body.type === 'customer.created' || request.body.type === 'customer.updated') {
	// 	var stripeCustomerId = request.body.data.object.id
	// 	var customer = request.body.data.object

		
		
	// 	conn.sobject('Contact').find({ Stripe_Customer_Id__c : stripeCustomerId }).limit(1).execute(function(err, res) {


	// 		if (res.length == 0) {
	// 			createNewSFContact(stripeCustomerId, customer);
	// 		} else {
	// 			updateSFContactEmail(res[0].Id, stripeCustomerId, customer);
	// 		};
	// 	});
	// };

	response.send('OK');
	response.end();
});


var port = Number(process.env.PORT || 5000);
app.listen(port, function()
{  console.log("Listening on " + port);
});
