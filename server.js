// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var session = require('express-session');
var app      = express();
var port     = process.env.PORT || 8080;
var flash    = require('connect-flash');

// configuration ===============================================================
app.configure(function() {

	// set up our express application
	app.use(express.logger('dev')); // log every request to the console
	app.use(express.cookieParser()); // read cookies (needed for auth)
	app.use(express.bodyParser()); // get information from html forms
	app.set('view engine', 'ejs'); // set up ejs for templating
	app.use(express.static(__dirname + '/public'));

	// required for passport
	app.use(express.session({ secret: 'pikachuisayellowrat',cookie: { maxAge: 3600000 } })); // session secret
	
	app.use(flash()); // use connect-flash for flash messages stored in session

});

// routes ======================================================================
require('./app/routes.js')(app); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
//console.log('The magic happens on port ' + port);
