// web.js
var express = require("express");
var logfmt = require("logfmt");
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var q = require('q'); 

var jsforce = require('jsforce');

var moment = require('moment');

// requires mongo db for logging transactions
var mongo = require('mongodb');
var mongoUri = process.env.MONGOLAB_URI || process.env.MONGOHQ_URL || 'mongodb://localhost:5000/stripeLogs';


var emitter = new EventEmitter;
var app = express();

// converts json metadata into stripe transaction object
app.use(express.bodyParser());

app.use(app.router);

app.use(logfmt.requestLogger());

// Salesforce Connection information



var stripeCheckName = function(name){
	console.log("FULL NAME", name)
	if (typeof name == 'string') {
		var name_array = name.split(' ');

		if (name_array.length == 1) {
			return {first_name: '', last_name: name_array.join(' ')}
		} else {
			return {
				first_name: name_array.slice(0, (name_array.length - 1)).join(' '), 
				last_name: name_array[name_array.length - 1]
			};
		}
	} 
}




var stripeId2SalesContact = function(stripe_id){
	console.log('CREATING / UPDATING CONTACT')
	var deferred = q.defer();

	stripe.customers.retrieve(stripe_id, function(err, customer){

		console.log('THIS IS THE STRIPE CUSTOMER', customer)
	
		if (customer.metadata.Name == null){
			var name = 'anonymous';
		} else {
			var name = customer.metadata.Name;
		}
				
		conn.sobject('Contact').find({ Stripe_Customer_Id__c : stripe_id }).limit(1).execute(function(err, res) {
			console.log('CUSTOMER FOUND BY STRIPE ID : ', res)

			if (err || !res.success) { postResponse.send('ERR'); }
	    // if (res == undefined || res == null || res == false || res.length == 0) {

    		conn.sobject('Contact').find({ Email : customer.email }).limit(1).execute(function(err, res) {
    			console.log('CONTACT FOUND BY EMAIL', res)
    			if (err || !res.success) { postResponse.send('ERR'); }
    			if (res.length == 0){
  					conn.sobject("Contact").create({ 
  						FirstName : stripeCheckName(name).first_name, 
  						LastName: stripeCheckName(name).last_name,
  						Stripe_Customer_Id__c: stripe_id, 
  						Email: customer.email,
  						RecordTypeId: client_ids.contactRecord 
  					}, function(err, ret) {
  						console.log('hi')
  				    if (err) { 
  				    	console.log("INTENTIONAL ERROR IN CONTACT CREATION <<<<<<<<<<<<<") 
  				    	postResponse.send('ERR in contact creation');
  				    }
  				    console.log("Created Contact With ID: " + ret.id, 'And Email:' + customer.email);
  				    deferred.resolve(ret);
				  	});
    			} else {
    				var sfContactId = res[0].Id
			    	conn.sobject('Contact').update({
	            Id: sfContactId,
	            Stripe_Customer_Id__c : stripe_id,
	            RecordTypeId: client_ids.contactRecord
		        }, function(error, ret){
	            if (error || !ret.success) { postResponse.send('ERR in contact update'); }
	            console.log('Updated Customer found by Email:' + customer.email);
	            deferred.resolve(ret); 
		        });
    			};
				});			            	
	    // } else {
	    // 	console.log('CUSTOMER EXISTS, UPDATING CONTACT TO MATCH EMAIL')
	    // 	var sfExistingId = res[0].Id
	    // 	conn.sobject('Contact').update({
	    //     Id: sfExistingId,
	    //     Email: customer.email,
	    //     RecordTypeId: client_ids.contactRecord
	    //   }, function(error, ret){
					// if (error || !ret.success) { postResponse.send('ERR in existing contact update') }
					// console.log('Updated Contact found by customer_id to:' + customer.email);
					// deferred.resolve(ret);
	    //   });
	    // };
	  });
  });
	return deferred.promise;
}


var createPayment = function( amount, charge_id, date, opportunity_id){
	console.log('CREATING PAYMENT')
	console.log("1. amount", amount)
	console.log("2. stripe charge id", charge_id)
	console.log("5. OPP id", opportunity_id)
	console.log("6. record type", client_ids.paymentRecord )

	console.log("I AM A PAYMENT BEING MADE")
		conn.sobject("npe01__OppPayment__c").create({ 
			npe01__Payment_Amount__c: (amount/100), 
			Stripe_Charge_Id__c: charge_id, 
			Name: "Stripe Charge",
			npe01__Payment_Method__c: "Credit Card",
			npe01__Payment_Date__c: date,
			npe01__Opportunity__c: opportunity_id,
			RecordTypeId: client_ids.paymentRecord 

		
		}, function(error, ret){
			if (error || !ret.success) { postResponse.send('ERR in payment creation'); }
			console.log('payment opportunity created!!!!')

			response.send('OK');
			response.end()
		});

}

var buildSFOpportunity = function (chargeObj) {
	var stripe_id = chargeObj.customer;
	var invoice = chargeObj.invoice;
	var amount = chargeObj.amount;
	var charge_id = chargeObj.charge_id;

	if (invoice !== null) { 
		console.log('INVOICE EXISTS, FINDING OPPORTUNITY W/ STRIPE SUB ID')
		stripe.invoice.retrieve( invoice, function (err, response) {
			var sub_id = response.subscription;

			conn.sobject('Opportunity').find({ 'Stripe_Subscription_Id__c' : sub_id }).limit(1).execute( function (err, opportunity) { // finds opportunity existence
				if (err || !opportunity.success) { postResponse.send('ERR'); }
				if (opportunity.length === 0) { // opportunity does not exist, build opportunity, then send id to payment
					console.log('OPPORTUNITY DOES NOT EXIST - CREATING')
					conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : stripe_id }).limit(1).execute( function (err, contact) {
						stripe.customers.retrieveSubscription(stripe_id, sub_id, function (err, subscription) {
							var sub_name = subscription.plan.name;
							console.log('SUBSCRIPTION FROM STRIPE:', subscription)

							conn.sobject('Opportunity').create({
								AccountId : contact[0].AccountId,
								Name : 'Magazine Subscription',
								Stripe_Subscription_Id__c : sub_id,
								RecordTypeId : client_ids.opportunityRecord,
								CloseDate : contact[0].CreatedDate,
								StageName : 'Posted' // hard coded, not sure if this will change
							}, function (err, ret) {
								if (err || !ret.success) { postResponse.send('ERR'); console.log('ERROR IN OPP CREATION', err) }
								conn.sobject('Opportunity').find({ 'Id' : ret.id }).limit(1).execute( function (err, result) {
									if (err || !result.success) { postResponse.send }
									var opportunity_id = result[0].Id;
									var account_id = result[0].AccountId;
									var date = result[0].CreatedDate;

									// create payment
									console.log('OPPORTUNITY CREATED, MOVING TO PAYMENT CREATION');
									createPayment(amount, charge_id, date ,account_id, opportunity_id);
								});
							});
						});
					});
				} else { // opportunity already exists, create payment:
					var opportunity_id = opportunity[0].Id;
					var account_id = opportunity[0].AccountId;
					var date = opportunity[0].CreatedDate;

					createPayment(amount, charge_id, date ,account_id, opportunity_id);
				}
			})
		});
	} else {
		conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : stripe_id }).limit(1).execute(function(err, res) {
			if (err || !res.success) { postResponse.send('ERR'); }
	    var account_id = res[0].AccountId;
	   	var date = res[0].CreatedDate;

	   	// createPayment(amount, charge_id, date, account_id, opportunity_id); // where is opportunity id?
		});
	}
};

// var createOpp = function(amount, charge_id, date, account_id, contract_id){
// 	console.log('CREATING OPPORTUNITY')
// 	console.log("THIS IS THE CONTRACT ID SENT FROM SUB", contract_id)
// 	console.log("1. amount", amount)
// 	console.log("2. stripe charge id", charge_id)
// 	console.log("3. date", date)
// 	console.log("4. account id", account_id)
// 	console.log("5. contact id", contract_id)
// 	console.log("6. record type", client_ids.opportunityRecord)
// 	if (contract_id){
// 		console.log("I AM A SUB TRYING TO MAKE AN OPP")
// 		conn.sobject("Opportunity").create({ 
// 			Amount: (amount/100), 
// 			Stripe_Charge_Id__c: charge_id, 
// 			Name: "Stripe Charge",
// 			StageName: "Closed Won",
// 			CloseDate: date,
// 			AccountId: account_id,
// 			Contract__c: contract_id,
// 			RecordTypeId: client_ids.opportunityRecord
// 		}, function(error, ret){
// 			if (error || !ret.success) { postResponse.send('ERR in sub opportunity creation'); }
// 			console.log('new opportunity created from new contract')

// 			response.send('OK');
// 			response.end()
// 		});

// 	}else{
// 		console.log("I AM A SINGLE OPP BEING MADE")
// 		conn.sobject("Opportunity").create({ 
// 			Amount: (amount/100), 
// 			Stripe_Charge_Id__c: charge_id, 
// 			Name: "Stripe Charge",
// 			StageName: "Closed Won",
// 			CloseDate: date,
// 			AccountId: account_id,
// 			RecordTypeId: client_ids.opportunityRecord 

		
// 		}, function(error, ret){
// 			if (error || !ret.success) { postResponse.send('ERR in single opportunity creation'); }
// 			console.log('single charge opportunity created')

// 			response.send('OK');
// 			response.end()
// 		});
// 	};
// }


	
// var salesContact2Contract = function(chargeObj){
// 	console.log('MOVING FROM CONTACT TO CONTRACT')
// 	var stripe_id = chargeObj.customer;
// 	var invoice = chargeObj.invoice;
// 	var amount = chargeObj.amount;
// 	var charge_id = chargeObj.charge_id;
	 

// 	if (invoice !== null) {
// 		stripe.invoices.retrieve( invoice, function(err, response){
// 			var sub_id = response.subscription 

// 			conn.sobject('Contract').find({ Stripe_Subscription_Id__c : sub_id }).limit(1).execute(function(err, res){
// 				if (err || !res.success) { postResponse.send('ERR'); }
// 				if (res.length === 0) {
					

// 	  			conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : stripe_id }).limit(1).execute(function(err, res) {
	  			  
	  			 //  stripe.customers.retrieveSubscription(stripe_id, sub_id, function(err, subscription) {
							// var sub_name = subscription.plan.name 
							// console.log("client id object ____________", client_ids)
					  //   console.log("SUB NAME", sub_name)
					  //   console.log("ACCOUTN ID", res[0].AccountId)
					  //   console.log("SUB id", sub_id)
					  //   console.log("record type", client_ids.contractRecord)
					  //   console.log("date", res[0].CreatedDate)
					   	

					  //  	conn.sobject('Contract').create({ 
      	// 		  	AccountId : res[0].AccountId, 
      	// 		  	Stripe_Subscription_Id__c : sub_id,
      	// 		  	RecordTypeId: client_ids.contractRecord,
      	// 				Description: sub_name,
      	// 				StartDate: res[0].CreatedDate
      					
//       			  }, function(err, ret){
//       			  	if (err || !ret.success) { postResponse.send('ERR'); }
//       			  	conn.sobject('Contract').find({ 'Id' : ret.id }).limit(1).execute(function(err, result) { 
//       			  		if (err || !result.success) { postResponse.send('ERR'); }
//     							var contract_id = result[0].Id;		  
//     							var account_id = result[0].AccountId;
//     							var date = result[0].CreatedDate;

//     							createOpp(amount, charge_id, date, account_id, contract_id)
//       			  	});
//       			  });
// 					  });
// 	  			});
// 				} else {
// 					var contract_id = res[0].Id;
// 					var account_id = res[0].AccountId;
// 					var date = res[0].CreatedDate;

// 					createOpp(amount, charge_id, date, account_id, contract_id) //this is untestable a the moment
// 	  		};
// 	  	});
// 		});

// 	} else {
// 		conn.sobject('Contact').find({ 'Stripe_Customer_Id__c' : stripe_id }).limit(1).execute(function(err, res) {
// 			if (err || !res.success) { postResponse.send('ERR'); }
// 	    var account_id = res[0].AccountId;
// 	   	var date = res[0].CreatedDate;

// 	   	createOpp(amount, charge_id, date, account_id);
// 		});
// 	};
// }

// ========================
//     GLOBAL VARIABLES
var conn;
var client_ids;
var stripe;
var postResponse;
// ========================

var chargeSucceededRouter = function(chargeSucceeded){
	var chargeObj = {
		customer: chargeSucceeded.data.object.customer,
		invoice: chargeSucceeded.data.object.invoice,
		amount: chargeSucceeded.data.object.amount,
		charge_id: chargeSucceeded.data.object.id
	};
	
	console.log("NEW CHARGE OBJECT----------------------------------", chargeSucceeded.data.object)
	console.log('CHARGE OBJ', chargeObj, 'FINDING PAYMENT');

	conn.sobject('npe01__OppPayment__c').find({ 'Stripe_Charge_Id__c' : chargeObj.charge_id }).limit(1).execute(function(err, res) {
		console.log("inside this func!")
		if (err) { postResponse.send('ERR router'); }
		console.log('HEEEY!!!! res', res)

		// if (res == undefined){
			console.log('PAYMENT DOES NOT EXIST')
			stripeId2SalesContact(chargeObj.customer).then(function(){
				buildSFOpportunity(chargeObj);
			});
		// } else {
		// 	console.log('PAYMENT ALREADY EXISTS IN SALES FORCE');
		// };
	});

	mongo.Db.connect(mongoUri, function(err, db) {
		// may be viewed at bash$ heroku addons:open mongolab
			db.collection('stripeLogs', function(er, collection) {
				collection.insert({ 'stripeReq' : chargeSucceeded }, function(err, result){
					console.log(err);
				});
		});
	});
}

var getLogins = function (client) {
	console.log('in login w/:',client);
	var defer = q.defer();
	mongo.Db.connect(mongoUri, function (err, db) {
		console.log('connected to mongo')
		db.collection(client, function (er, organization) {
			console.log('mongo collection')
			organization.findOne({ 'Name' : client }, function (error, result) {
				console.log('mongo collection organization')
				stripe = require("stripe")(
				  result.stripe_api.secret_key
				);

				conn = new jsforce.Connection({
					oauth2: result.oauth2
				});

				conn.login( result.sf_login.username, result.sf_login.password, function(err, res) {
					if (err) { postResponse.send('ERR conn login'); }
					console.log("connected to", client);
					defer.resolve(res);
				});

				client_ids = result.client_ids;

			});
		});
	});
	return defer.promise;
}

app.post('/webhook', function (request, response) {
	if (request.body.type === 'charge.succeeded' ) {
		var chargeSucceeded = request.body
		postResponse = response;
		getLogins('Development').then(function(){
			chargeSucceededRouter(chargeSucceeded);
		});
	} else {
		response.send('OK');
		response.end();
	};
});


// UrbanGlass sandbox
app.post('/webhook/UrbanGlassSandbox', function (request, response) {
	console.log('webhook hit!')
	if (request.body.type === 'charge.succeeded') {
		console.log('charge succeeded, proceeding')
		var chargeSucceeded = request.body;
		postResponse = response;
		getLogins('UrbanGlassSandbox').then(function () {
			chargeSucceededRouter(chargeSucceeded);
		});
	} else {
		response.send('OK');
		response.end();
	}
});

app.post('/webhook/changeMachineLive', function (request, response) {
	if (request.body.type === 'charge.succeeded' ) {
		var chargeSucceeded = request.body;
		postResponse = response;
		getLogins('ChangeMachineLive').then(function(){
			chargeSucceededRouter(chargeSucceeded);	
		});
	} else {
		response.send('OK');
		response.end();
	};
})

// misleading webhook name - this is sandbox!!
app.post('/webhook/changeMachine', function (request, response) {
	if (request.body.type === 'charge.succeeded' ) {
		var chargeSucceeded = request.body;
		postResponse = response;
		getLogins('ChangeMachineTest').then(function(){
			chargeSucceededRouter(chargeSucceeded);			
		});

	} else {
		response.send('OK');
		response.end();
	};
})


// if a webhook breaks, pass company name and Stripe event ID of charge.succeeded obj to this url:
app.get('/webhook/retry/:clientName/:eventId', function (request, response) {
// CHANGE MACHINE: ChangeMachineLive / ChangeMachineTest
	getLogins(request.param('clientName')).then(function(){
		stripe.events.retrieve(request.param('eventId'), function (err, res) {
			if (res.type === 'charge.succeeded') {
				chargeSucceededRouter(res);
			};
		});
	});

})




var port = Number(process.env.PORT || 5000);
app.listen(port, function()
{  console.log("Listening on " + port);
});
