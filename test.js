var stripe = require("stripe")(
 "sk_test_bY22es5dN0RpWmJoJ5VlBQ5E"
);

// var email

// var getStripeCustomer = function(stripe_id){
// 	var customer_email;
  

// 	return customer_email;
// }


function getStripeCustomer (stripe_id){

	var customer_email;

	stripe.customers.retrieve('cus_3pPXbquFxtJsmH', function(err, customer){
		 	var email = customer.email;
		 	console.log('inner <<<<<<<<<', email);
		 	customer_email = email;
	}).then(function (customer) {

		console.log("CALL:", customer.email);
			return customer.email;
		exit;		
	});


	return 'keith@familiar.is';


}

getStripeCustomer().then(function (keith) {

	console.log('this'+keith);
});



