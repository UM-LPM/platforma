// app/routes.js
/*REWORK change all console logs to flash messages!*/
/*http://voidcanvas.com/googles-oauth-api-node-js/*/
/*config file being cached problems with deleting*/

module.exports = function(app, passport) {

	try
	{	
		var settings = require("../config/config.js")
		var defaultUrl = settings.defaultUrl;
		var ClientId = settings.GoogleClientId;
		var ClientSecret = settings.GoogleClientSecret;
		var earsPath = settings.earsPath;
		var RedirectionUrl = defaultUrl+settings.RedirectionUrl;
		var appMailAddress = settings.appMailAddress;
		var appMailPassword = settings.appMailPassword;
		var setLanguage = settings.setLanguage;
	}
	catch(MissingConfig) {  console.log("Error in config file: " + MissingConfig); process.exit(); }
	
	var google = require('googleapis');
	var OAuth2 = google.auth.OAuth2;
	var plus = google.plus('v1');
	
	var Localize = require('localize');
	var myLocalize = new Localize('./language/');
	myLocalize.setLocale(setLanguage);
	
	var EARSinstances = [];
	var EARSmessages = [];
	var EARSerrors = [];
	var authorsList = [];
	

	function getOAuthClient () {
		return new OAuth2(ClientId ,  ClientSecret, RedirectionUrl);
	}
	 
	function getAuthUrl () {
		var oauth2Client = getOAuthClient();
		// generate a url that asks permissions for Google+ and Google Calendar scopes
		var scopes = [
		  'https://www.googleapis.com/auth/userinfo.email'
		];
	 
		var url = oauth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: scopes // If you only need one scope you can pass it as string
		});
	 
		return url;
	}
	
	

	app.get("/auth/google/callback", function (req, res) {
		var oauth2Client = getOAuthClient();
		var session = req.session;
		var code = req.query.code; // the query param code
		oauth2Client.getToken(code, function(err, tokens) {
		  // Now tokens contains an access_token and an optional refresh_token. Save them.
	 
		  if(!err) {
			oauth2Client.setCredentials(tokens);
			//saving the token to current session
			session["tokens"]=tokens;
			 var p = new Promise(function (resolve, reject) {
				plus.people.get({ userId: 'me', auth: oauth2Client }, function(err, response) {
					resolve(response || err);
				});
			}).then(function (data) {
				if(typeof data.emails!=="undefined" && data.emails!=null && data.emails.length>0)
				{
					var master = require('../config/master.json');
					if(typeof master.admins!=="undefined" && typeof master.admins!=null && master.admins.length>0)
					{
						data.emails.forEach(function(email) 
						{
							master.admins.forEach(function(admin) 
							{
								if(admin.username==email.value)
								{
									req.session.email = email.value;
									req.session.role = "admin";
									res.redirect(302,'/profile');
									res.end();
								}
							});
							
							if(req.session.role!="admin" && authorsList.length>0)
							{
								for(var i=0;i<authorsList.length;i++)
								{
									if(authorsList[i].email==email.value)
									{
										req.session.email = email.value;
										req.session.role = "user";
										res.redirect(302,'/profile');
										res.end();
									}
								}
							}
						});
					}

					//no valid profile found
					res.render('login.ejs', { message: myLocalize.translate("not_authorized"), googleAuthUrl:getAuthUrl(),
					emailTxt:myLocalize.translate("email"), passwordTxt:myLocalize.translate("password"),
					loginTxt:myLocalize.translate("login"),googleTxt:myLocalize.translate("google_login"), orgoTxt:myLocalize.translate("or_go"),homeTxt:myLocalize.translate("home") });
					return;
				}
				else
				{
					res.render('error.ejs',{
					loggedIn:true,
					message:myLocalize.translate("google_error"),
					gobackTxt:myLocalize.translate("go_back"),
					link:"/"});
					return;
				}
			})
		  }
		  else{
			res.render('login.ejs', { message: myLocalize.translate("google_error"), googleAuthUrl:getAuthUrl(),
			emailTxt:myLocalize.translate("email"), passwordTxt:myLocalize.translate("password"),
			loginTxt:myLocalize.translate("login"),googleTxt:myLocalize.translate("google_login"), orgoTxt:myLocalize.translate("or_go"),homeTxt:myLocalize.translate("home") });
			return;
		  }
		});
	});
 


	// =====================================
	// HOME PAGE (with login links) ========
	// =====================================
	app.get('/', loadConfigFile, function(req, res) 
	{	
		loggedIn = false;
		if(typeof req.session.email!=="undefined" && req.session.email!=null && req.session.email.length>0)
			loggedIn = true;
			
		res.render('index.ejs', { tournaments: res.tournaments, loggedIn:loggedIn, nothingYet:myLocalize.translate("no_tournament_yet"), loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile") }); // load the index.ejs file
	});

	// =====================================
	// LOGIN ===============================
	// =====================================
	// show the login form
	app.get('/login', function(req, res) {
		
	if (typeof req.session.email!=="undefined" && req.session.email!=null && req.session.email.length>0)
		var loggedIn = true;
	else
		loggedIn = false;
		res.render('login.ejs', { message: req.flash('loginMessage'), loggedIn:loggedIn, googleAuthUrl:getAuthUrl(),
		emailTxt:myLocalize.translate("email"), passwordTxt:myLocalize.translate("password"),
		loginTxt:myLocalize.translate("login"),googleTxt:myLocalize.translate("google_login"), orgoTxt:myLocalize.translate("or_go"),homeTxt:myLocalize.translate("home") });
	});
	
	app.post('/login', authenticate, function(req, res) {
		if(typeof req.session.email=="undefined" || req.session.email.length==null || req.session.email.length<=0)
			res.render('login.ejs', { message: req.flash('loginMessage'), googleAuthUrl:getAuthUrl(),emailTxt:myLocalize.translate("email"), 
			passwordTxt:myLocalize.translate("password"),loginTxt:myLocalize.translate("login"),googleTxt:myLocalize.translate("google_login"), orgoTxt:myLocalize.translate("or_go"),homeTxt:myLocalize.translate("home") });
		else
		{
			res.redirect('/profile');
			res.end();
		}
	});

	

	// =====================================
	// PROFILE SECTION =========================
	// =====================================
	// we will want this protected so you have to be logged in to visit
	// we will use route middleware to verify this (the isLoggedAsAdmin function)
	app.get('/profile', loadConfigFile, function(req, res) 
	{
		if(typeof req.session.role!=="undefined" && req.session.role!=null && req.session.role=="admin")
		{
				res.render('profile.ejs', {
				user : req.session,
				tournaments: res.tournaments,
				controlPanel:myLocalize.translate("control_panel"),
				deleteTournamentConfirm:myLocalize.translate("delete_tournament_confirmation"),
				loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),
				logoutTxt:myLocalize.translate("logout"),newTournamentDesc:myLocalize.translate("new_tournament"),
				createnewTournametDesc:myLocalize.translate("create_new_tournament"),deleteDesc:myLocalize.translate("delete_desc"),
				EARSinstances:EARSinstances,EARSmessages:EARSmessages,EARSerrors:EARSerrors,
				editDesc:myLocalize.translate("edit_tournament"),
				runEars:myLocalize.translate("run_ears"),
				runEarsConfirm:myLocalize.translate("run_ears_confirm"),
				runEarsFailed:myLocalize.translate("run_ears_failed"),
				runEarsSuccess:myLocalize.translate("run_ears_success"),
				runEarsOverride:myLocalize.translate("run_ears_override"),
				killEars:myLocalize.translate("kill_ears_confirm"),
				loggedIn:true
			});
		}
		else if(typeof req.session.role!=="undefined" && req.session.role!=null && req.session.role=="user")
		{	
			var authorHistory = null;
			for(var i=0;i<authorsList.length;i++)
			{
				if(authorsList[i].email == req.session.email)
				{
					authorHistory = authorsList[i];
					break;
				}
			}
			res.render('userprofile.ejs', {
				user : req.session,
				authorsSubmissions:authorHistory,
				loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),
				controlPanel:myLocalize.translate("control_panel"),
				logoutTxt:myLocalize.translate("logout"),newTournamentDesc:myLocalize.translate("new_tournament"),
				loggedIn:true
			});
		}
		else
			res.redirect('/');		
	});

	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.session.destroy(); 
		req.session = null;
		res.redirect('/');
	});
	
	// =====================================
	// WORKLOG ==============================
	// =====================================
	app.get('/worklog', isLoggedAsAdmin, function(req, res) 
	{
		res.render('worklog.ejs', {
			user : req.session
		});
	});
	
	
	// =====================================
	// TOURNAMENT ==============================
	// =====================================
	app.get('/tournament/:url', loadConfigFile, function(req , res)
	{
		var tournaments = res.tournaments;
		if (typeof tournaments!=="undefined" && tournaments!=null && tournaments.length>0) 
		{ 
			tournaments.forEach(function(entry) 
			{
				if(entry.id!=="undefined" && entry.id!=null && entry.id.length>0 && entry.path==req.params.url && entry.visible)
				{
					var fs = require('fs');
					fs.stat("tournaments/" +entry.id, function (err, stats){
					  if (err) {
					  }
					  if (typeof stats==="undefined" || !stats.isDirectory()) {
						console.log("notadir");
						return;
					  } 
					  else 
					  {
						var password = false;
						if((typeof entry.password!=="undefined" && entry.password!=null && entry.password.length>0) || fs.existsSync("tournaments/"+entry.id+"/passwords.csv"))
							password = true;
							
						var images = [];
						if(fs.existsSync("tournaments/"+entry.id+"/images"))
						{
							fs.readdirSync("tournaments/"+entry.id+"/images").forEach(file => {
							  images.push(file);
							})
						}						
						loggedIn = false;
						if(typeof req.session.email!=="undefined" && req.session.email!=null && req.session.email.length>0)
							loggedIn = true;
						var results = [];
						
						if(fs.existsSync("tournaments/"+entry.id+"/benchmark_result_files/results.json"))
						{
							try
							{
								var result_data = fs.readFileSync("tournaments/"+entry.id+"/benchmark_result_files/results.json", 'utf8');
								
								if(result_data.length>0)
									results = JSON.parse(result_data); 
									
								results.sort(function(a, b) {
									return a.ratingIntervalRight - b.ratingIntervalRight; //sort in ascending order
								});	
								
							}
							catch(Emptyresults) { console.log("Error reading results file"); }
						}
						res.render('tournament.ejs',{
						data:entry,
						password:password,
						images:images,
						loggedIn:loggedIn,
						results:results,
						passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
						choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
						uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
						descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
						tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
						submitTxt:myLocalize.translate("submit"),benchTypeTxt:myLocalize.translate("benchmark_type")});
						return;
					  }
					});
				}
			});
		}
	});
	
	app.get('/newTournament',  isLoggedAsAdmin, loadBenchmarks, function(req, res) {
		res.render('edittournament.ejs', { loggedIn:true, benchmarks:res.benchmarks,newtournamentTxt:myLocalize.translate("new_tournament"),
		edittournamentTxt:myLocalize.translate("edit_tournament"),deleteSubmissionConfirmation:myLocalize.translate("delete_submissions_confirmation"),
		deleteimageConfirmation:myLocalize.translate("delete_image_confirmation"),loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),
		tournamentnameTxt:myLocalize.translate("tournament_name"),submissiondateTxt:myLocalize.translate("submission_date"),submissiondateStartTxt:myLocalize.translate("submission_date_start"),visibleDesc:myLocalize.translate("submission_visible"),
		behcmarksTxt:myLocalize.translate("benchmarks"),tournamentUrlTxt:myLocalize.translate("tournament_url"),descTxt:myLocalize.translate("description"),imgdescTxt:myLocalize.translate("tournament_images"),
		passwordfileDesc:myLocalize.translate("tournament_passwordfile_desc"),oldpasswordDesc:myLocalize.translate("oldpasswordfile_desc"),
		submissionpasswordDesc:myLocalize.translate("submissionpassword_desc"),saveDesc:myLocalize.translate("save_btn"),cancelDesc:myLocalize.translate("cancel_btn"),
		deletePasswordFileConfirmation:myLocalize.translate("delete_password_file"),invalidPasswordsFilename:myLocalize.translate("invalid_passwords_filename"),
		storedPasswords:myLocalize.translate("stored_passwords"),storedPasswordsAuthor:myLocalize.translate("stored_passwords_author"),
		storedPasswordsEmail:myLocalize.translate("stored_passwords_email"),storedPasswordsPassword:myLocalize.translate("stored_passwords_password"),
		storedPasswordsDeleteconfirmation:myLocalize.translate("stored_passwords_delete_confirmation"),
		submittedDesc:myLocalize.translate("submitted_desc"),deleteDesc:myLocalize.translate("delete_desc"),viewSubmission:myLocalize.translate("view_submission"),
		rating_table_score:myLocalize.translate("rating_table_score"),rating_table_min:myLocalize.translate("rating_table_min"), 
		runValidathorTXT:myLocalize.translate("run_validathor"),validathorFinished:myLocalize.translate("validathor_finished"),
		tournament_results:myLocalize.translate("tournament_results"),tableAlgorithm:myLocalize.translate("rating_table_algorithm"),
		rating_table_max:myLocalize.translate("rating_table_max"),hasErrors:myLocalize.translate("submission_has_errors")} );
		return;
	});
	
	app.get('/downloadTournamentReport/:id', function(req, res) {
			if(typeof req.params.id!=="undefined" && req.params.id!=null && req.params.id.length>0)
			{
				var fs = require('fs'); 
				if(fs.existsSync("tournaments/"+req.params.id+"/benchmark_result_files/Report.txt"))
					res.download("tournaments/"+req.params.id+"/benchmark_result_files/Report.txt");
			}
	});
	
	app.post('/downloadTournamentReport/:id', function(req, res) {
		res.redirect("/");
	});
	
	
	
	app.post('/newTournament',  isLoggedAsAdmin, function(req, res) {
		if(typeof req.body.name!=="undefined" && req.body.name.length>0 && typeof req.body.ends!=="undefined" && req.body.ends.length>0
			&& req.body.benchmarks!=="undefined" && req.body.benchmarks.length>0 && typeof req.body.path!=="undefined" && req.body.path.length>0)
			{
				var fs = require('fs');
				fs.stat("tournaments/list.json", function (err, stats)
				{
				  if (err) {
					// Directory or our config file doesn't exist so we create them.
					fs.mkdir("tournaments/list.json");
				  }
				});
				//check if the file was created
				var configFile = "tournaments/list.json";
				fs.stat(configFile, function (err, stats)
				{
				  if (err) {
					res.render('error.ejs',{
					loggedIn:true,
					message:myLocalize.translate("error_writting"),
					gobackTxt:myLocalize.translate("go_back"),
					link:"/"});
					return;
				  }
				  else
				  {
					fs.readFile(configFile, 'utf8', function readFileCallback(err, data){
					if (err)
					{
						res.render('error.ejs',{
						loggedIn:true,
						message:myLocalize.translate("invalid_tournament_config"),
						gobackTxt:myLocalize.translate("go_back"),
						link:"/"});
						return;
					} 
					else 
					{
						var hash = makeid();
						var obj = [];
						try { obj = JSON.parse(data); } catch(ex) { /*probs empty*/} 
						
						var date = new Date();		
						var month = date.getUTCMonth()+1;
						if(month<10)
							var month="0"+month;
						var day = date.getUTCDate();
						if(day<10)
							var day="0"+day;
						
						var start_date = date.getUTCFullYear()+"-"+month+"-"+day;
						var end_date = date.getUTCFullYear()+"-"+month+"-"+day;
				
						var end_hour = "23:59";
						var start_hour = "00:00";
						
						try
						{
							if(typeof req.body.starts!=="undefined" && req.body.starts!=null && req.body.starts.length==10 && req.body.starts.indexOf("-")==4 && req.body.starts.lastIndexOf("-")==7 && parseInt(req.body.starts.substring(0,4))>date.getUTCFullYear()-1 
								&& parseInt(req.body.starts.substring(5,7))>0 && parseInt(req.body.starts.substring(5,7))<=12 && parseInt(req.body.starts.substring(8,10))>0 && parseInt(req.body.starts.substring(8,10))<=31)
								start_date = req.body.starts;

							if(typeof req.body.ends!=="undefined" && req.body.ends!=null && req.body.ends.length==10 && req.body.ends.indexOf("-")==4 && req.body.ends.lastIndexOf("-")==7 && parseInt(req.body.ends.substring(0,4))>date.getUTCFullYear()-1 
								&& parseInt(req.body.ends.substring(5,7))>0 && parseInt(req.body.ends.substring(5,7))<=12 && parseInt(req.body.ends.substring(8,10))>0 && parseInt(req.body.ends.substring(8,10))<=31)
								end_date = req.body.ends;

							if(typeof req.body.end_hour!=="undefined" && req.body.end_hour!=null && req.body.end_hour.length==5 && req.body.end_hour.indexOf(":")==2 && parseInt(req.body.end_hour.substring(0,2))<24 && parseInt(req.body.end_hour.substring(3,4))<59)
								end_hour = req.body.end_hour;
							
							if(typeof req.body.start_hour!=="undefined" && req.body.start_hour!=null && req.body.start_hour.length==5 && req.body.start_hour.indexOf(":")==2 && parseInt(req.body.start_hour.substring(0,2))<24 && parseInt(req.body.start_hour.substring(3,4))<59)
								start_hour = req.body.start_hour;
						}
						catch(hoursError) {}
						
						var end = Date.parse(end_date+"T"+end_hour+":59Z")/1000;
						var start =  Date.parse(start_date+"T"+start_hour+":59Z")/1000;
						
						var visible = false;
						if(typeof req.body.visible!=="undefined" && req.body.visible!=null && req.body.visible.length>0)
							visible = true;
						
						obj.push({id:hash,name: req.body.name, timestamp:Math.floor(new Date() / 1000), starts:start, ends:end, benchmarks:req.body.benchmarks, path:cleanUpAuthorName(req.body.path), description:req.body.description, password:req.body.password, visible:visible }); //add some data
						obj.sort(function(a, b) {
						return parseInt(b.timestamp) - parseInt(a.timestamp); //sort in descending order
						});
						json = JSON.stringify(obj); //convert it back to json
						fs.writeFile(configFile, json, 'utf8', function(err) {
						if(err) {
							res.render('error.ejs',{
							loggedIn:true,
							message:myLocalize.translate("error_saving_tournament_list"),
							gobackTxt:myLocalize.translate("go_back"),
							link:"/"});
							return;
						}
						});
						
						fs.mkdir("tournaments/"+hash, function (err) {
						if (err) {
							res.render('error.ejs',{
							loggedIn:true,
							message:myLocalize.translate("error_creating_tournament_directory"),
							gobackTxt:myLocalize.translate("go_back"),
							link:"/"});
							return;
						}
						
						var fs = require('fs');
						fs.mkdir("tournaments/"+hash+"/submissions"); //create submissions folder
						fs.mkdir("tournaments/"+hash+"/benchmark_result_files"); //create benchmark results folder
						fs.mkdirSync("tournaments/"+hash+"/images"); //create images folder
						if(typeof req.files.passwordfile!=="undefined" && req.files.passwordfile!=null && req.files.passwordfile.size>0)
						{
						
							fs.renameSync(req.files.passwordfile.path, "tournaments/"+hash+"/passwords.csv", function(err) {
							if (err) throw err;
							});
						
							if(fs.existsSync("tournaments/"+hash+"/passwords.csv"))
							{
								try
								{
									var loader = require('csv-load-sync');
									var csv = loader("tournaments/"+hash+"/passwords.csv"); //validate password file structure
									if(typeof csv!=="undefined" && csv!=null && csv.length>0)
									{
										var  valid = true;
										
										try
										{
											csv.forEach(function(user)
											{
												if(typeof user.name=="undefined" || typeof user.email=="undefined" || typeof user.password=="undefined"
													|| user.name==null ||user.email==null || user.password==null
													|| user.name.length<=0 || user.email.length<=0 || user.password.length<=0)
														valid = false;
											});	
										}								
										catch(CSVException) { valid=false; }	
																			
										if(!valid) //invalid password file structure
										{
											fs.unlinkSync("tournaments/"+hash+"/passwords.csv");
											res.render('error.ejs',{
											loggedIn:true,
											message:myLocalize.translate("invalid_password_file_structure"),
											gobackTxt:myLocalize.translate("go_back"),
											link:"/profile" });
											return;
										}
									}
									else
									{
										fs.unlinkSync("tournaments/"+hash+"/passwords.csv");
										res.render('error.ejs',{
										loggedIn:true,
										message:myLocalize.translate("invalid_password_file_structure"),
										gobackTxt:myLocalize.translate("go_back"),
										link:"/profile" });
										return;
									}
								}
								catch(csverror)
								{
									fs.unlinkSync("tournaments/"+hash+"/passwords.csv");
									res.render('error.ejs',{
									loggedIn:true,
									message:myLocalize.translate("invalid_password_file_structure"),
									gobackTxt:myLocalize.translate("go_back"),
									link:"/profile" });
									return;
								}
							}
							else
							{
								res.render('error.ejs',{
								loggedIn:true,
								message:myLocalize.translate("error_saving_passwords_file"),
								gobackTxt:myLocalize.translate("go_back"),
								link:"/profile" });
								return;
							}
						}
						
						if(typeof req.files.tournamentimages!=="undefined" && req.files.tournamentimages!=null)
						{
							var files = []; 
							files = files.concat(req.files.tournamentimages);
							if(files.length>0)
							{
								files.forEach(function(img)
								{
									if(fs.existsSync(img.path) && typeof img.originalFilename!=="undefined" && img.originalFilename!=null 
										&& (img.originalFilename.indexOf(".jpg")>0 || img.originalFilename.indexOf(".JPG")>0 || img.originalFilename.indexOf(".png")>0 ||  img.originalFilename.indexOf(".PNG")>0))
										fs.writeFileSync("tournaments/"+hash+"/images/"+img.name, fs.readFileSync(img.path));
								});
							}						
						}
						
						res.redirect("/editTournament/"+hash);
						});

					}});
				   
				  }
				});
			}
			else
			{
				res.render('error.ejs',{
				loggedIn:true,
				message:myLocalize.translate("empty_send_data"),
				gobackTxt:myLocalize.translate("go_back"),
				link:"/profile"});
				return;
			}
	});
	
	
	app.get('/editTournament/:url/passwords.csv',  isLoggedAsAdmin, loadConfigFile, function(req, res) 
	{
		var tournaments = res.tournaments;
		var found = false;
		var tournament;
		for(var i=0; i<tournaments.length; i++)
		{
			tournament = tournaments[i];
			if(tournament.id==req.params.url)
			{
				found = true;
				break;
			}
		}
		if(found)
		{
			var fs = require('fs');
			if(fs.existsSync("tournaments/"+tournament.id+"/passwords.csv"))
				res.download("tournaments/"+tournament.id+"/passwords.csv"); // Set disposition and send it.
		}
	});
	
	app.get('/tournament/:url/images/:filename', loadConfigFile, function(req, res) 
	{
		var tournaments = res.tournaments;
		var found = false;
		var tournament;
		for(var i=0; i<tournaments.length; i++)
		{
			tournament = tournaments[i];
			if(tournament.id==req.params.url)
			{
				found = true;
				break;
			}
		}
		if(found)
		{
			var fs = require('fs');
			if(fs.existsSync("tournaments/"+tournament.id+"/images/"+req.params.filename))
				res.download("tournaments/"+tournament.id+"/images/"+req.params.filename); // Set disposition and send it.
		}
	});
	
	app.get('/editTournament/:url',  isLoggedAsAdmin, loadConfigFile, loadBenchmarks, function(req, res) 
	{
		var tournaments = res.tournaments;
		var found = false;
		var tournament;
		for(var i=0; i<tournaments.length; i++)
		{
			tournament = tournaments[i];
			if(tournament.id==req.params.url)
			{
				found = true;
				break;
			}
		}
		if(found)
		{
			var submissions;
			var results;
			var images = [];
			var fs = require('fs');
			
			if(fs.existsSync("tournaments/"+tournament.id+"/submissions/submission_list.json"))
			{
				var fs = require('fs');
				
				try { 
				  var obj =  fs.readFileSync("tournaments/"+tournament.id+"/benchmark_result_files/results.json","UTF-8");
				  if(obj.length>0)
				  {
					var results = [];
					try
					{
						results = JSON.parse(obj);
						results.sort(function(a, b) 
						{
							return a.ratingIntervalRight - b.ratingIntervalRight; //sort in ascending order
						});	
					}
					catch(JSONException) { console.log(JSONException); }
				  }
				}
				catch (subseciption) {}
			}
			
			
			if(fs.existsSync("tournaments/"+tournament.id+"/submissions/submission_list.json"))
			{
				var fs = require('fs');
				
				try {
				  var obj =  fs.readFileSync("tournaments/"+tournament.id+"/submissions/submission_list.json","UTF-8");
				  if(obj.length>0)
				  {
					var submissions = [];
					try
					{
						submissions = JSON.parse(obj);
						submissions.forEach(function(sub)
						{
							sub.hasErrors = false;
							if(fs.existsSync("tournaments/"+tournament.id+"/submissions/"+sub.author+"_"+sub.timestamp+"/compile_report.json"))
							{
								var error = fs.readFileSync("tournaments/"+tournament.id+"/submissions/"+sub.author+"_"+sub.timestamp+"/compile_report.json");
								error = JSON.parse(error);
								if(typeof error.error_list!=="undefined" && error.error_list!=null && error.error_list.length>0)
									sub.hasErrors = true;
								if(typeof results!=="undefined" && results!=null && results.length>0)
								{
									results.forEach(function(result)
									{
										if(typeof result.submissionId!=="undefined" && result.submissionId!=null && result.submissionId == sub.id)
										{
											sub.score_left = result.ratingIntervalLeft;
											sub.score_right = result.ratingIntervalRight;
											sub.score_rating = result.rating;
											return;
										}
									});
								}								
							}
						});
					}
					catch(JSONException) { console.log(JSONException); }
				  }
				}
				catch (subseciption) {}
			}
			
			var passwordfile;
			var passwords = [];
			
			if(fs.existsSync("tournaments/"+tournament.id+"/passwords.csv"))
			{
				passwordfile = defaultUrl+"editTournament/"+tournament.id+"/passwords.csv";
				var loader = require('csv-load-sync');
				try
				{
					var csv = loader("tournaments/"+tournament.id+"/passwords.csv"); //validate password file structure
					csv.forEach(function(user)
					{
						if(typeof user.name=="undefined" || typeof user.email=="undefined" || typeof user.password=="undefined"
							|| user.name==null ||user.email==null || user.password==null
							|| user.name.length<=0 || user.email.length<=0 || user.password.length<=0)
								valid = false;
						else
							passwords.push({name:user.name,email:user.email,password:user.password});
					});	
				}								
				catch(CSVException) { valid=false; }	

				
			}
			
			if(fs.existsSync("tournaments/"+tournament.id+"/images"))
			{
				fs.readdirSync("tournaments/"+tournament.id+"/images").forEach(file => {
				  images.push(file);
				})
			}
			
			res.render('edittournament.ejs',{
						data:tournament,
						loggedIn:true,
						submissions:submissions,
						benchmarks:res.benchmarks,
						passwordfile:passwordfile,
						passwords:passwords,
						images:images,
						results:results,
						newtournamentTxt:myLocalize.translate("new_tournament"),
						edittournamentTxt:myLocalize.translate("edit_tournament"),deleteSubmissionConfirmation:myLocalize.translate("delete_submissions_confirmation"),
						deleteimageConfirmation:myLocalize.translate("delete_image_confirmation"),loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),
						tournamentnameTxt:myLocalize.translate("tournament_name"),submissiondateTxt:myLocalize.translate("submission_date"),submissiondateStartTxt:myLocalize.translate("submission_date_start"),
						visibleDesc:myLocalize.translate("submission_visible"),behcmarksTxt:myLocalize.translate("benchmarks"),tournamentUrlTxt:myLocalize.translate("tournament_url"),
						descTxt:myLocalize.translate("description"),imgdescTxt:myLocalize.translate("tournament_images"),
						passwordfileDesc:myLocalize.translate("tournament_passwordfile_desc"),oldpasswordDesc:myLocalize.translate("oldpasswordfile_desc"),
						submissionpasswordDesc:myLocalize.translate("submissionpassword_desc"),saveDesc:myLocalize.translate("save_btn"),cancelDesc:myLocalize.translate("cancel_btn"),
						submittedDesc:myLocalize.translate("submitted_desc"),deleteDesc:myLocalize.translate("delete_desc"),viewSubmission:myLocalize.translate("view_submission"),
						deletePasswordFileConfirmation:myLocalize.translate("delete_password_file"),invalidPasswordsFilename:myLocalize.translate("invalid_passwords_filename"),
						storedPasswords:myLocalize.translate("stored_passwords"),storedPasswordsAuthor:myLocalize.translate("stored_passwords_author"),
						storedPasswordsEmail:myLocalize.translate("stored_passwords_email"),storedPasswordsPassword:myLocalize.translate("stored_passwords_password"),
						storedPasswordsDeleteconfirmation:myLocalize.translate("stored_passwords_delete_confirmation"),
						runValidathorTXT:myLocalize.translate("run_validathor"),validathorFinished:myLocalize.translate("validathor_finished"),
						hasErrors:myLocalize.translate("submission_has_errors"),rating_table_score:myLocalize.translate("rating_table_score"),rating_table_min:myLocalize.translate("rating_table_min"), 
						rating_table_max:myLocalize.translate("rating_table_max"),tournament_results:myLocalize.translate("tournament_results"),tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),
						tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max")});
						return;
		}
		else
		{
			res.render('error.ejs',{
			loggedIn:true,
			message:myLocalize.translate("tournament_not_found"),
			gobackTxt:myLocalize.translate("go_back"),
			link:"/profile" });
			return;
		}
	});
	
	app.post('/deleteTournament/:id', isLoggedAsAdmin, function(req,res)
	{
		var configFile = "tournaments/list.json";
		var fs = require('fs');
		
		try 
		{
		  var data = fs.readFileSync(configFile,"UTF-8");
		  var obj = [];
			
			try
			{
				obj = JSON.parse(data);
			}
			catch(JSONError) {}
			
			if(typeof obj!=="undefined" && obj!=null && obj.length>0)
			{
				var newList = [];
				for(var i=0; i<obj.length; i++)
				{
					var tournament = obj[i];
					if(tournament.id!=req.params.id) //generate the new list without the one we are deleting
						newList.push(tournament);
					else //delete the folder and files containing our tournament
						deleteFolderAndContents('tournaments/'+tournament.id);
				}
				
				if(obj.length>newList.length) //check if we actually removed anythin
				{
					obj = newList;
					obj.sort(function(a, b) {
					return parseInt(b.timestamp) - parseInt(a.timestamp); //sort in descending order
					});
					json = JSON.stringify(obj); //convert it back to json
					try
					{
						fs.writeFileSync(configFile, json, 'utf8');
					}
					catch(err) 
					{
						res.render('error.ejs',{
						loggedIn:true,
						message:myLocalize.translate("error_saving_tournament_list"),
						gobackTxt:myLocalize.translate("go_back"),
						link:"/profile" });
						return;
					}
				}
			}
			else
			{
				res.render('error.ejs',{
				loggedIn:true,
				message:myLocalize.translate("error_deleting_empty_config"),
				gobackTxt:myLocalize.translate("go_back"),
				link:"/profile" });
				return;
			}
		}
		catch (e) 
		{ 
			res.render('error.ejs',{
			loggedIn:true,
			message:myLocalize.translate("error_reading_config"),
			gobackTxt:myLocalize.translate("go_back"),
			link:"/profile" });
			return;
		}
	});
	
	app.post('/editTournament/:url',  isLoggedAsAdmin, function(req, res) 
	{
		var configFile = "tournaments/list.json";
		var fs = require('fs');
		fs.readFile(configFile, 'utf8', function readFileCallback(err, data){
		if (err)
		{
			res.render('error.ejs',{
			loggedIn:true,
			message:myLocalize.translate("error_reading_config"),
			gobackTxt:myLocalize.translate("go_back"),
			link:"/profile" });
			return;
		} 
		else 
		{
			var found = true;
			var obj = {
			   tournaments: []
			};
			obj = JSON.parse(data); 
			for(var i=0; i<obj.length; i++)
			{
				var tournament = obj[i];
				if(tournament.id==req.body.id)
				{
					tournament.name = req.body.name;
					tournament.description = req.body.description;
					tournament.benchmarks = req.body.benchmarks;
					if(tournament.path!=req.body.path)
						tournament.path = cleanUpAuthorName(req.body.path);
					
					var date = new Date();				
					var month = date.getUTCMonth()+1;
					if(month<10)
						var month="0"+month;
					var day = date.getUTCDate();
					if(day<10)
						var day="0"+day;
						
					var start_date = date.getUTCFullYear()+"-"+month+"-"+day;
					var end_date = date.getUTCFullYear()+"-"+month+"-"+day;
				
					var end_hour = "23:59";
					var start_hour = "00:00";
						
					try
					{
						if(typeof req.body.starts!=="undefined" && req.body.starts!=null && req.body.starts.length==10 && req.body.starts.indexOf("-")==4 && req.body.starts.lastIndexOf("-")==7 && parseInt(req.body.starts.substring(0,4))>date.getUTCFullYear()-1 
							&& parseInt(req.body.starts.substring(5,7))>0 && parseInt(req.body.starts.substring(5,7))<=12 && parseInt(req.body.starts.substring(8,10))>0 && parseInt(req.body.starts.substring(8,10))<=31)
								start_date = req.body.starts;

						if(typeof req.body.ends!=="undefined" && req.body.ends!=null && req.body.ends.length==10 && req.body.ends.indexOf("-")==4 && req.body.ends.lastIndexOf("-")==7 && parseInt(req.body.ends.substring(0,4))>date.getUTCFullYear()-1 
							&& parseInt(req.body.ends.substring(5,7))>0 && parseInt(req.body.ends.substring(5,7))<=12 && parseInt(req.body.ends.substring(8,10))>0 && parseInt(req.body.ends.substring(8,10))<=31)
								end_date = req.body.ends;

						if(typeof req.body.end_hour!=="undefined" && req.body.end_hour!=null && req.body.end_hour.length==5 && req.body.end_hour.indexOf(":")==2 && parseInt(req.body.end_hour.substring(0,2))<24 && parseInt(req.body.end_hour.substring(3,4))<59)
							end_hour = req.body.end_hour;
							
						if(typeof req.body.start_hour!=="undefined" && req.body.start_hour!=null && req.body.start_hour.length==5 && req.body.start_hour.indexOf(":")==2 && parseInt(req.body.start_hour.substring(0,2))<24 && parseInt(req.body.start_hour.substring(3,4))<59)
							start_hour = req.body.start_hour;
					}
					catch(hoursError) {}
						
					tournament.ends = Date.parse(end_date+"T"+end_hour+":59Z")/1000;
					tournament.password = req.body.password;
					tournament.starts = Date.parse(start_date+"T"+start_hour+":59Z")/1000;
					tournament.visible = false;
					if(typeof req.body.visible!=="undefined" && req.body.visible!=null && req.body.visible.length>0)
						tournament.visible = true;
					
					found = true;
					break;
				}
			}
			
			if(found)
			{	
				var fs = require('fs');
				obj.sort(function(a, b) {
				return parseInt(b.timestamp) - parseInt(a.timestamp); //sort in descending order
				});
				json = JSON.stringify(obj); //convert it back to json
				fs.writeFile(configFile, json, 'utf8', function(err) {
				if(err) {
					res.render('error.ejs',{
					loggedIn:true,
					message:myLocalize.translate("error_saving_tournament_list"),
					gobackTxt:myLocalize.translate("go_back"),
					link:"/profile" });
					return;
				}
				});
				
				if(typeof req.files.passwordfile!=="undefined" && req.files.passwordfile!=null && req.files.passwordfile.size>0)
				{	
					fs.renameSync(req.files.passwordfile.path, "tournaments/"+tournament.id+"/passwords.csv", function(err) {
					if (err) throw err;
					});
					
					if(fs.existsSync("tournaments/"+tournament.id+"/passwords.csv"))
					{
						try
						{
							var loader = require('csv-load-sync');
							var csv = loader("tournaments/"+tournament.id+"/passwords.csv"); //validate password file structure
							if(typeof csv!=="undefined" && csv!=null && csv.length>0)
							{
								var  valid = true;
								try
								{
									csv.forEach(function(user)
									{
										if(typeof user.name=="undefined" || typeof user.email=="undefined" || typeof user.password=="undefined"
											|| user.name==null ||user.email==null || user.password==null
											|| user.name.length<=0 || user.email.length<=0 || user.password.length<=0)
												valid = false;
									});
								}								
								catch(CSVException) { valid = false; }
								
								if(!valid) //invalid password file structure
								{
									fs.unlinkSync("tournaments/"+tournament.id+"/passwords.csv");
									res.render('error.ejs',{
									loggedIn:true,
									message:myLocalize.translate("invalid_password_file_structure"),
									gobackTxt:myLocalize.translate("go_back"),
									link:"/editTournament/"+tournament.id });
									return;
								}
							}
							else
							{
								fs.unlinkSync("tournaments/"+tournament.id+"/passwords.csv");
								res.render('error.ejs',{
								loggedIn:true,
								message:myLocalize.translate("invalid_password_file_structure"),
								gobackTxt:myLocalize.translate("go_back"),
								link:"/editTournament/"+tournament.id });
								return;
							}
						}
						catch(csvloaderror)
						{
							fs.unlinkSync("tournaments/"+tournament.id+"/passwords.csv");
							res.render('error.ejs',{
							loggedIn:true,
							message:myLocalize.translate("invalid_password_file_structure"),
							gobackTxt:myLocalize.translate("go_back"),
							link:"/editTournament/"+tournament.id });
							return;
						}
					}
					else
					{
						res.render('error.ejs',{
						loggedIn:true,
						message:myLocalize.translate("error_saving_passwords_file"),
						gobackTxt:myLocalize.translate("go_back"),
						link:"/editTournament/"+tournament.id });
						return;
					}
				}
				
				if(typeof req.body.passwordsAuthors !=="undefined" && req.body.passwordsAuthors!=null && req.body.passwordsAuthors.length>0
					&& typeof req.body.passwordsEmails !=="undefined" && req.body.passwordsEmails!=null && req.body.passwordsEmails.length>0
					&& typeof req.body.passwordsPasswords !=="undefined" && req.body.passwordsPasswords!=null && req.body.passwordsPasswords.length>0
					&& typeof req.body.passwordsAuthors[0] !=="undefined" && req.body.passwordsAuthors[0]!=null && req.body.passwordsAuthors[0].length>0
					&& typeof req.body.passwordsEmails[0] !=="undefined" && req.body.passwordsEmails[0]!=null && req.body.passwordsEmails[0].length>0
					&& typeof req.body.passwordsPasswords[0] !=="undefined" && req.body.passwordsPasswords[0]!=null && req.body.passwordsPasswords[0].length>0
					&& req.body.passwordsPasswords[0].length == req.body.passwordsAuthors[0].length && req.body.passwordsEmails[0].length == req.body.passwordsAuthors[0].length )
				{
					var newpasswordsfile = "";
					for(var i=0;i<req.body.passwordsAuthors[0].length;i++)
					{
						if(req.body.passwordsAuthors[0][i].length>0 && req.body.passwordsEmails[0][i].length>0 && req.body.passwordsPasswords[0][i].length>0)
							newpasswordsfile+=req.body.passwordsAuthors[0][i]+','+req.body.passwordsEmails[0][i]+','+req.body.passwordsPasswords[0][i]+'\r\n';
					}
					
					if(newpasswordsfile.length>0)	
					{
						try
						{
							newpasswordsfile = "name,email,password \n" + newpasswordsfile;
							fs.writeFileSync("tournaments/"+tournament.id+"/passwords.csv", newpasswordsfile);
						}
						catch(IOError) { console.log(IOError); }
					}
				}
				
				
				
				if(typeof req.files.tournamentimages!=="undefined" && req.files.tournamentimages!=null)
				{
					var fs = require('fs');
					if(!fs.existsSync("tournaments/"+tournament.id+"/images"))
						fs.mkdir("tournaments/"+tournament.id+"/images");
					var files = [];
						files = files.concat(req.files.tournamentimages);

					if(files.length>0)
					{
						files.forEach(function(img)
						{
							if(typeof img.originalFilename!=="undefined" && img.originalFilename!=null 
								&& (img.originalFilename.indexOf(".jpg")>0 || img.originalFilename.indexOf(".JPG")>0 || img.originalFilename.indexOf(".png")>0 ||  img.originalFilename.indexOf(".PNG")>0) 
								&& fs.existsSync(img.path) && fs.existsSync("tournaments/"+tournament.id+"/images"))
								fs.writeFileSync("tournaments/"+tournament.id+"/images/"+img.name, fs.readFileSync(img.path));
						});		
					}					
				}
			}
			else
			{
				res.render('error.ejs',{
				loggedIn:true,
				message:myLocalize.translate("tournament_not_found"),
				gobackTxt:myLocalize.translate("go_back"),
				link:"/profile" });
				return;
			}	
			
			res.redirect("/profile");
		}});
	});
	
	app.get('/fileSubmission', function(req,res)
	{
		res.redirect('/');
	});
	
	app.post('/fileSubmission', loadConfigFile, function(req, res) 
	{
		if(typeof res.tournaments!=="undefined" && res.tournaments!=null && typeof res.tournaments!=="undefined"
			&& res.tournaments.length>0)
		{
			var found = false;
			var tournament;
			var password = false;
			req.authordata = null;
			
			for(var i=0; i<res.tournaments.length; i++)
			{
				tournament = res.tournaments[i];
				if(tournament.id==req.body.id)
				{
					var password = false;
					if((typeof tournament.password!=="undefined" && tournament.password!=null && tournament.password!=null) || fs.existsSync("tournaments/"+tournament.id+"/passwords.csv"))
						password = true;
					
					if(tournament.visible && tournament.starts<new Date().getTime()/1000 && tournament.ends>new Date().getTime()/1000)
						found = true;
					else
					{
						req.flash('submissionMessage',myLocalize.translate("tournament_has_ended")); 
						res.render('tournament.ejs',{
						data:tournament,password:password,message:req.flash('submissionMessage'),passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
						choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
						uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
						descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
						tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
						submitTxt:myLocalize.translate("submit"),benchTypeTxt:myLocalize.translate("benchmark_type")});	
						return;
					}
					break;
				}
			}
			
			if(typeof req.files.submissionFile.size=="undefined" || req.files.submissionFile.size==null || req.files.submissionFile.size<=0)
			{
				
				req.flash('submissionMessage',myLocalize.translate("choose_file_upload")); 
				res.render('tournament.ejs',{
				data:tournament,password:password,message:req.flash('submissionMessage'),passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
				choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
				uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
				descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
				tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
				submitTxt:myLocalize.translate("submit"),benchTypeTxt:myLocalize.translate("benchmark_type")});				
				return;
			}
			
			var fs = require('fs');
			if(!fs.existsSync("tournaments/"+tournament.id+"/benchmark_result_files"))
				fs.mkdir("tournaments/"+tournament.id+"/benchmark_result_files");
			
			if(fs.existsSync("tournaments/"+tournament.id+"/passwords.csv"))
			{
				if(typeof req.body.password!=="undefined" && req.body.password!=null && req.body.password.length>0)
				{
					var loader = require('csv-load-sync');
					var csv = null;
					try
					{
						var csv = loader("tournaments/"+tournament.id+"/passwords.csv");
					}
					catch(CSVError) {}
					
					
					if(typeof csv!=="undefined" && csv!=null && csv.length>0)
					{
						try
						{
							csv.forEach(function(user)
							{
								if(user.password == req.body.password)
									req.authordata = { "success":true, "author":cleanUpAuthorName(user.name), "email":user.email };
							});	
						}								
						catch(CSVException) { }						
						
						if(typeof req.authordata=="undefined" || req.authordata==null)
						{
							req.flash('submissionMessage',myLocalize.translate("invalid_submission_password")); 
							res.render('tournament.ejs',{
							data:tournament,message:req.flash('submissionMessage'), password:password,
							passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
							choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
							uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
							descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
							tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
							submitTxt:myLocalize.translate("submit"),benchTypeTxt:myLocalize.translate("benchmark_type")});
							return;
						}
					}
					else
					{
						req.flash('submissionMessage',myLocalize.translate("error_reading_passwords_file")); 
						res.render('tournament.ejs',{
						data:tournament,message:req.flash('submissionMessage'), password:password,
						passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
						choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
						uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
						descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
						tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
						submitTxt:myLocalize.translate("submit"),benchTypeTxt:myLocalize.translate("benchmark_type")});
						return;
					}
				}
				else
				{
					req.flash('submissionMessage',myLocalize.translate("empty_submission_password")); 
					res.render('tournament.ejs',{
					data:tournament,password:password,message:req.flash('submissionMessage'), password:password,
					passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
					choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
					uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
					descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
					tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),				
					submitTxt:myLocalize.translate("submit"),benchTypeTxt:myLocalize.translate("benchmark_type")});
					return;
				}
			}		
			else if(typeof tournament.password!=="undefined" && tournament.password!=null && tournament.password.length>0
				&& tournament.password!=req.body.password)
			{
				req.flash('submissionMessage',myLocalize.translate("invalid_submission_password")); 
				res.render('tournament.ejs',{
				data:tournament,message:req.flash('submissionMessage'), password:password,
				passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
				choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
				uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
				descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
				tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
				submitTxt:myLocalize.translate("submit"),benchTypeTxt:myLocalize.translate("benchmark_type")});
				return;
			}
			
			
			
			if(found)
			{
				//check if submission folder exists (it should be created at tournament creation :) )
				var fs = require('fs');
				if (!fs.existsSync("tournaments/"+tournament.id+"/submissions"))
					fs.mkdir("tournaments/"+tournament.id+"/submissions");
			
				//check if correct file format
				var re = /(?:\.([^.]+))?$/;
				var ext = re.exec(req.files.submissionFile.path)[1];
				if(ext=="java" || ext=="JAVA" || ext=="zip" || ext=="ZIP")
				{
					var fs = require('fs');
					var stats = fs.statSync(req.files.submissionFile.path);
					if((stats.size/1000000.0)<5)
					{
						fs.readFile(req.files.submissionFile.path, "utf8", function (err, data) {
						if(err)
						{
							fs.unlink(req.files.submissionFile.path,function(err,data) {});
							req.flash('submissionMessage',myLocalize.translate("submission_error_uploading")); 
							res.render('tournament.ejs',{
							data:tournament,message:req.flash('submissionMessage'),
							passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
							choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
							uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
							descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
							tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
							submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
							return;
						}
						else
						{
							if(ext=="zip" || ext=="ZIP") //unzip the file to temp location
							{
								var tmp_dir = "tmp/extraction_folder_"+Date.now();
								var fs = require('fs');
								fs.mkdirSync(tmp_dir);
								if (fs.existsSync(tmp_dir))
								{
									var source = fs.createReadStream(req.files.submissionFile.path);
									var dest = fs.createWriteStream(tmp_dir+'/'+req.files.submissionFile.name);
									source.pipe(dest);
									source.on('end', function() 
									{ 
										var unzip = require('unzip');
										var unzipExtractor = fs.createReadStream(tmp_dir+'/'+req.files.submissionFile.name).pipe(unzip.Extract({ path: tmp_dir }),
										function(err) 
										{ 
											fs.unlink(req.files.submissionFile.path,function(err,data) {});
											fs.unlink(tmp_dir+'/'+req.files.submissionFile.name,function(err,data) {});
											fs.rmdir(tmp_dir,function(err,data) {});
											req.flash('submissionMessage',myLocalize.translate("error_unzipping_file")); 
											res.render('tournament.ejs',{
											data:tournament,message:req.flash('submissionMessage'),
											passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
											choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
											uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
											descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
											tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
											submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
											return;
										});
										//successfull ZIP extraction
										unzipExtractor.on('close', function()
										{
											try {
												var fs = require('fs');
												var source_file;
												var algorithmName = "";
												
												fs.readdirSync(tmp_dir).forEach(file => {
												  if(file.indexOf(".java")>0 || file.indexOf(".JAVA")>0)
												  {
													try
													{
														var tmp = fs.readFileSync(tmp_dir+"/"+file,"UTF-8");
														if(typeof tournament.selectedBenchmark!=="undefined" && typeof tournament.selectedBenchmark.type!=="undefined" && tournament.selectedBenchmark.type!=null
															&& tournament.selectedBenchmark.type=="Multi-Objective")
														{
															if(tmp.indexOf('extends MOAlgorithm')>=0)
																source_file = file;
															algorithmName = extractAlgorithmName(tmp,"extends MOAlgorithm");	
														}
														else if(tmp.indexOf('extends Algorithm') >= 0)
														{
															source_file = file;
															algorithmName = extractAlgorithmName(tmp,"extends Algorithm");	
														}
													}
													catch(errorreading) { console.log(errorreading);}
												  }
												})
												
												if(typeof source_file!=="undefined" && source_file!=null) //našli smo source file, pogledamo če ima podatke o avtorju
												{
													//try to read the supposed source file
													fs.readFile(tmp_dir+'/'+source_file, "utf8", function (err, data) {
													if(err)
													{
														fs.unlink(req.files.submissionFile.path,function(err,data) {});
														req.flash('submissionMessage',myLocalize.translate("error_reading_source_file")); 
														res.render('tournament.ejs',{
														data:tournament,message:req.flash('submissionMessage'),
														passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
														choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
														uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
														descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
														tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
														submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
														deleteFolderAndContents(tmp_dir);
														return;			
													}
													else 
													{
														if(typeof req.authordata=="undefined" || req.authordata==null) //if general submission we dont have author data yet
															var authordata = extractAuthorAndEmail(data);
														else	
														{
															var authordata = req.authordata;
															req.authordata = null;
														}
														
														if(authordata["success"])
														{
															//everything looks ok, move to submission folder and run Validathor
															var submissionTimestamp = Math.floor(Date.now() / 1000);
															var destFolder = "tournaments/"+tournament.id+"/submissions/"+authordata['author']+"_"+submissionTimestamp;
															fs.mkdirSync(destFolder);
															
															var source = fs.createReadStream(req.files.submissionFile.path);
															var dest = fs.createWriteStream(destFolder+'/'+req.files.submissionFile.name);
															source.pipe(dest);
															source.on('end', function() 
															{
																var unzipExtractor2 = fs.createReadStream(req.files.submissionFile.path).pipe(unzip.Extract({ path: destFolder }),
																function(err) 
																{ 
																	fs.unlink(req.files.submissionFile.path,function(err,data) {});
																	req.flash('submissionMessage',myLocalize.translate("error_unzipping_file")); 
																	res.render('tournament.ejs',{
																	data:tournament,message:req.flash('submissionMessage'),
																	passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
																	choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
																	uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
																	descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
																	tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
																	submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
																	deleteFolderAndContents(tmp_dir);
																	return;
																});	
																fs.unlink(req.files.submissionFile.path,function(err) {  });
																unzipExtractor2.on('close', function() 
																{
																	compileSource(destFolder+'/'+source_file);
																});
																var submissionUrl = defaultUrl+tournament.path+'/submission/'+authordata['author']+"_"+submissionTimestamp;
																sendMail(tournament.name,authordata,submissionUrl);
																req.flash('submissionMessage',submissionUrl); 
																res.render('tournament.ejs',{
																data:tournament,successmessage:req.flash('submissionMessage'),
																passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
																choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
																uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
																tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
																descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
																submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
																generateSubmissionReport(destFolder,authordata,submissionTimestamp);
																deleteFolderAndContents(tmp_dir);
																updateTournamentSubmissionList(tournament,authordata['author'],submissionTimestamp,submissionUrl,algorithmName);
																return;
															});
															
															source.on('error', function() 
															{
																fs.unlink(req.files.submissionFile.path,function(err,data) {});
																req.flash('submissionMessage',myLocalize.translate("error_moving_submission")); 
																res.render('tournament.ejs',{
																data:tournament,message:req.flash('submissionMessage'),
																passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
																choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
																uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
																descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
																tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
																submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
																deleteFolderAndContents(tmp_dir);
																return;
															});
															
														}
														else
														{
															fs.unlink(req.files.submissionFile.path,function(err,data) {});
															req.flash('submissionMessage',myLocalize.translate("author_not_found")); 
															res.render('tournament.ejs',{
															data:tournament,message:req.flash('submissionMessage'),
															passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
															choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
															uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
															descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
															tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
															submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
															deleteFolderAndContents(tmp_dir);
															return;
														}
													}});
												}
												else //no source (java) files found in root folder
												{
													if(typeof tournament.selectedBenchmark!=="undefined" && tournament.selectedBenchmark!=null && typeof tournament.selectedBenchmark.type!=="undefined" 
															&& tournament.selectedBenchmark.type=="Multi-Objective")
													{
														var noExtendsMsg = myLocalize.translate("no_main_programme_found_mo");
													}
													else
														var noExtendsMsg = myLocalize.translate("no_main_programme_found_so");												
													
													fs.unlink(req.files.submissionFile.path,function(err,data) {});
													req.flash('submissionMessage',noExtendsMsg); 
													res.render('tournament.ejs',{
													data:tournament,message:req.flash('submissionMessage'),
													passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
													choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
													uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
													descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
													tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
													submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
													deleteFolderAndContents(tmp_dir);
													return;
												}
											}
											catch(glob) 
											{
												fs.unlink(req.files.submissionFile.path,function(err,data) {});
												req.flash('submissionMessage',myLocalize.translate("error_scanning_source")); 
												res.render('tournament.ejs',{
												data:tournament,message:req.flash('submissionMessage'),
												passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
												choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
												uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
												descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
												tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
												submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
												deleteFolderAndContents(tmp_dir);
												return;
											}
										});
									});
									source.on('error', function(err) 
									{ 
										fs.unlink(req.files.submissionFile.path,function(err,data) {});
										fs.unlink(tmp_dir+'/'+req.files.submissionFile.name,function(err,data) {});
										fs.rmdir(tmp_dir,function(err,data) {});
										req.flash('submissionMessage',myLocalize.translate("error_uploading_tmp_folder")); 
										res.render('tournament.ejs',{
										data:tournament,message:req.flash('submissionMessage'),
										passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
										choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
										uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
										descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
										tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
										submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
										return;
									});
								}
								else
								{
									fs.unlink(req.files.submissionFile.path,function(err,data) {});
									req.flash('submissionMessage',myLocalize.translate("error_uploading_tmp_folder")); 
									res.render('tournament.ejs',{
									data:tournament,message:req.flash('submissionMessage'),
									passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
									choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
									uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
									descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
									tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
									submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
									return;
								}
							}
							else if(ext=="java" || ext=="JAVA")
							{
								
								var extendsFound = false; 
								var algorithmName = "";
								
								if(typeof tournament.selectedBenchmark!=="undefined" && typeof tournament.selectedBenchmark.type!=="undefined" && tournament.selectedBenchmark.type!=null 
									&& tournament.selectedBenchmark.type=="Multi-Objective")
								{
									if(data.indexOf('extends MOAlgorithm')>=0)
										extendsFound = true;
									algorithmName = extractAlgorithmName(data,"extends MOAlgorithm");	
								}
								else if(data.indexOf('extends Algorithm')>=0)
								{
									extendsFound = true;
									algorithmName = extractAlgorithmName(data,"extends Algorithm");
								}
							
								if(extendsFound)
								{
									if(typeof req.authordata=="undefined" || req.authordata==null) //if general submission we dont have author data yet
										var authordata = extractAuthorAndEmail(data);
									else
									{
										var authordata = req.authordata;
										req.authordata = null;
									}

									if(authordata["success"])
									{
										var fs = require('fs');
										var submissionTimestamp = Math.floor(Date.now() / 1000);
										var destFolder = "tournaments/"+tournament.id+"/submissions/"+authordata['author']+"_"+submissionTimestamp;
										fs.mkdirSync(destFolder);
										var source = fs.createReadStream(req.files.submissionFile.path);
										var dest = fs.createWriteStream(destFolder+'/'+req.files.submissionFile.name);
										source.pipe(dest);
										source.on('end', function() 
										{
											fs.unlink(req.files.submissionFile.path,function(err,data) {});
											var submissionUrl = defaultUrl+tournament.path+'/submission/'+authordata['author']+"_"+submissionTimestamp;
											sendMail(tournament.name,authordata,submissionUrl);
											req.flash('submissionMessage',submissionUrl); 
											res.render('tournament.ejs',{
											data:tournament,successmessage:req.flash('submissionMessage'),
											passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
											choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
											uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
											descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
											tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
											submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
											generateSubmissionReport(destFolder,authordata,submissionTimestamp)
											compileSource(destFolder+'/'+req.files.submissionFile.name);
											updateTournamentSubmissionList(tournament,authordata['author'],submissionTimestamp,submissionUrl,algorithmName);
											return;
										});
										
										source.on('error', function() 
										{
											fs.unlink(req.files.submissionFile.path,function(err,data) {});
											req.flash('submissionMessage',myLocalize.translate("error_moving_submission")); 
											res.render('tournament.ejs',{
											data:tournament,message:req.flash('submissionMessage'),
											passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
											choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
											uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
											descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
											tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
											submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
											return;
										});
						
									}
									else
									{
										var fs = require('fs');
										fs.unlink(req.files.submissionFile.path,function(err,data) {});
										req.flash('submissionMessage',myLocalize.translate("author_not_found")); 
										res.render('tournament.ejs',{
										data:tournament,message:req.flash('submissionMessage'),
										passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
										choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
										uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
										descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
										tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
										submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
										return;
									}
								}
								else
								{
									var fs = require('fs');
									fs.unlink(req.files.submissionFile.path,function(err,data) {});
									
									if(typeof tournament.selectedBenchmark!=="undefined" && tournament.selectedBenchmark!=null && typeof tournament.selectedBenchmark.type!=="undefined" 
											&& tournament.selectedBenchmark.type=="Multi-Objective")
									{
										var noExtendsMsg = myLocalize.translate("no_main_programme_found_mo");
									}
									else
										var noExtendsMsg = myLocalize.translate("no_main_programme_found_so");	
									
									req.flash('submissionMessage',noExtendsMsg); 
									res.render('tournament.ejs',{
									data:tournament,message:req.flash('submissionMessage'),
									passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
									choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
									uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
									descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
									tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
									submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
									return;
								}
							}
						}				
						});
					}
					else
					{
						var fs = require('fs');
						fs.unlink(req.files.submissionFile.path,function(err,data) {});
						req.flash('submissionMessage',myLocalize.translate("max_upload_size")); 
						res.render('tournament.ejs',{
						data:tournament,message:req.flash('submissionMessage'),
						passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
						choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
						uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
						descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
						tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
						submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
						return;
					}
				}
				else
				{
					var fs = require('fs');
					fs.unlink(req.files.submissionFile.path,function(err,data) {});
					req.flash('submissionMessage',myLocalize.translate("invalid_file_format")); 
					res.render('tournament.ejs',{
					data:tournament,message:req.flash('submissionMessage'),
					passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
					choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
					uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
					descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
					tableAlgorithm:myLocalize.translate("rating_table_algorithm"),tableRating:myLocalize.translate("rating_table_score"),tableMin:myLocalize.translate("rating_table_min"),tableMax:myLocalize.translate("rating_table_max"),
					submitTxt:myLocalize.translate("submit"),password:password,benchTypeTxt:myLocalize.translate("benchmark_type")});
					return;
				}
			}
			else
				res.redirect('/');
		}
		else
			res.redirect('/');
	});
		
	app.get('/:url/submission/:authorfolder', loadConfigFile, function(req, res) 
	{
		var tournaments = res.tournaments;
		var found = false;
		var tournament;
		for(var i=0; i<tournaments.length; i++)
		{
			tournament = tournaments[i];
			if(tournament.path==req.params.url)
			{
				found = true;
				break;
			}
		}
		if(found)
		{
			loggedIn = false;
			if(typeof req.session.email!=="undefined" && req.session.email!=null && req.session.email.length>0)
			loggedIn = true;
			var fs = require('fs');
			var submissionFolder = "tournaments/"+tournament.id+"/submissions/"+req.params.authorfolder;
			if(fs.existsSync(submissionFolder))
			{
				var compile_report;
				var submission_report;
				var info_txt;
				var error_txt;
				var files;
				
				try {
				  var obj = fs.readFileSync(submissionFolder+"/compile_report.json","UTF-8");
				  compile_report = JSON.parse(obj);
				}
				catch (e) {}
					
					
				try {
				  var obj = fs.readFileSync(submissionFolder+"/submission_report.json","UTF-8");
				  submission_report = JSON.parse(obj);
				}
				catch (e) {}

				try {
				  info_txt = fs.readFileSync(submissionFolder+"/info.txt","UTF-8");
				}
				catch (e) {}
				
				try {
				  error_txt = fs.readFileSync(submissionFolder+"/error.txt","UTF-8");
				}
				catch (e) {  }
				
				try {
					var files = [];
					var tmp = fs.readdirSync(submissionFolder);
					tmp.forEach(file => {
						if(typeof req.session.role !=="undefined" && req.session.role!=null && req.session.role == "admin")
							files.push(file);
						else if(file.indexOf(".java")>0 || file.indexOf(".zip")>0)
							files.push(file);
					  });  
				}
				catch (e) {}
				
				var enableFileDownloads = false;
				if(typeof req.session.role !=="undefined" && req.session.role!=null && req.session.role == "admin")
					enableFileDownloads = true;
				else if(req.session.role !=="undefined" && req.session.role!=null && req.session.role == "user" && isHisSubmission(req.session.email,tournament.id,req.params.authorfolder))
					enableFileDownloads = true;
				
				res.render('showresults.ejs',{
				data:tournament, submission_report:submission_report, compile_report:compile_report,loggedIn:loggedIn,
				error_txt:error_txt,info_txt:info_txt,
				files:files,
				passwordRequired:myLocalize.translate("empty_submission_password"),maxsizeDesc:myLocalize.translate("max_upload_size"),
				invalidFormat:myLocalize.translate("invalid_file_format"),chooseFile:myLocalize.translate("choose_file_for_upload"),
				loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),uploadSuccess:myLocalize.translate("file_upload_success"),
				benchmarks:myLocalize.translate("benchmarks"),submissionDate:myLocalize.translate("submission_date"),description:myLocalize.translate("description"),
				author:myLocalize.translate("author"),submittedDate:myLocalize.translate("submitted_date"),compileReport:myLocalize.translate("compile_report"),
				noErrors:myLocalize.translate("no_errors"),submissionProcessing:myLocalize.translate("submission_being_processed"),
				submitted_files:myLocalize.translate("submitted_files"),submission_url:req.params.authorfolder,enableFileDownloads:enableFileDownloads});
				return;
			}
			else
			{
				req.flash('showResultsMsg',myLocalize.translate("inexsistent_submission")); 
				res.render('showresults.ejs',{
				data:tournament, message:req.flash('showResultsMsg'), loggedIn:loggedIn,
				passwordRequired:myLocalize.translate("empty_submission_password"),maxsizeDesc:myLocalize.translate("max_upload_size"),
				invalidFormat:myLocalize.translate("invalid_file_format"),chooseFile:myLocalize.translate("choose_file_for_upload"),
				loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),uploadSuccess:myLocalize.translate("file_upload_success"),
				benchmarks:myLocalize.translate("benchmarks"),submissionDate:myLocalize.translate("submission_date"),description:myLocalize.translate("description"),
				author:myLocalize.translate("author"),submittedDate:myLocalize.translate("submitted_date"),compileReport:myLocalize.translate("compile_report"),
				noErrors:myLocalize.translate("no_errors"),submissionProcessing:myLocalize.translate("submission_being_processed"),
				submitted_files:myLocalize.translate("submitted_files"),submission_url:req.params.authorfolder,enableFileDownloads:enableFileDownloads});
				return;
			}	
		}
		else
		{
			req.flash('showResultsMsg',myLocalize.translate("inexsistent_tournament")); 
			res.render('showresults.ejs',{
			data:tournament, message:req.flash('showResultsMsg'),loggedIn:loggedIn,
			passwordRequired:myLocalize.translate("empty_submission_password"),maxsizeDesc:myLocalize.translate("max_upload_size"),
			invalidFormat:myLocalize.translate("invalid_file_format"),chooseFile:myLocalize.translate("choose_file_for_upload"),
			loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),uploadSuccess:myLocalize.translate("file_upload_success"),
			benchmarks:myLocalize.translate("benchmarks"),submissionDate:myLocalize.translate("submission_date"),description:myLocalize.translate("description"),
			author:myLocalize.translate("author"),submittedDate:myLocalize.translate("submitted_date"),compileReport:myLocalize.translate("compile_report"),
			noErrors:myLocalize.translate("no_errors"),submissionProcessing:myLocalize.translate("submission_being_processed")});
			return;
		}
	});
	
	function isHisSubmission(email,tournamentId,submissionUrl) 
	{
		if(typeof email!=="undefined" && email!=null && email.length>0 && authorsList.length>0 && typeof tournamentId!=="undefined" && tournamentId!=null && tournamentId.length>0
			&& typeof submissionUrl!=="undefined" && submissionUrl!=null && submissionUrl.length>0)
		{
			for(var i=0;i<authorsList.length;i++)
			{
				if(authorsList[i].email == email)
				{
					for(var k=0;k<authorsList[i].tournaments.length;k++)
					{
						if(authorsList[i].tournaments[k].id == tournamentId)
						{				
							for(var j=0;j<authorsList[i].tournaments[k].submissions.length;j++)
							{
								if(authorsList[i].tournaments[k].submissions[j].url == authorsList[i].tournaments[k].path+"/submission/"+submissionUrl)
									return true;
							}
						}
					}
				}
			}
			return false;
		}
		else
			return false;
	}
	
	app.get('/downloadSubmissionFile', function(req, res) {
			if(typeof req.session.role!=="undefined" && req.session.role!=null && (req.session.role=="admin" || req.session.role == "user") && typeof req.query.url!=="undefined" && req.query.url!=null 
			&& req.query.url.length>0 && req.query.fileName!=="undefined" && req.query.fileName!=null && req.query.fileName.length>0
			&& req.query.tournamentId!=="undefined" && req.query.tournamentId!=null && req.query.tournamentId.length>0)
			{
				if(req.session.role == "admin")
				{
					var fs = require('fs');
					var submissionFolder = "tournaments/"+req.query.tournamentId+"/submissions/"+req.query.url+"/"+req.query.fileName;
					if(fs.existsSync(submissionFolder))
						res.download(submissionFolder);
				}
				else if(isHisSubmission(req.session.email,req.query.tournamentId,req.query.url))
				{
					var fs = require('fs');
					var submissionFolder = "tournaments/"+req.query.tournamentId+"/submissions/"+req.query.url+"/"+req.query.fileName;
					if(fs.existsSync(submissionFolder))
						res.download(submissionFolder);
				}
				else
					res.redirect("/");
			}	
			else
				res.redirect("/");
	});
	
	app.get('/deleteSubmission', isLoggedAsAdmin, function(req, res) 
	{
		if(req.query.tournamentId!=="undefined" && req.query.tournamentId!=null && req.query.tournamentId.length>0
			&& req.query.submissionId!=="undefined" && req.query.submissionId!==null && req.query.submissionId.length>0)
			{
				var tournamentLink = defaultUrl+'editTournament/'+req.query.tournamentId;
				if(deleteTournamentSubmission(req.query.tournamentId,req.query.submissionId))
				{
					res.redirect(tournamentLink);
				}
				else
				{
					res.render('error.ejs',{
					message:myLocalize.translate("error_deleting_submission"),
					gobackTxt:myLocalize.translate("go_back"),
					link:tournamentLink});
					return;
				}
			}
			else
			{
				res.render('error.ejs',{
				message:myLocalize.translate("error_retrieving_deletion_file"),
				gobackTxt:myLocalize.translate("go_back")});
				return;
			}
	});
	
	app.post('/deleteSubmission', function(req,res)
	{
		res.redirect('/');
	});
	
	app.get('/deleteTournamentImage', isLoggedAsAdmin, function(req, res) 
	{
		if(req.query.tournamentId!=="undefined" && req.query.tournamentId!=null && req.query.tournamentId.length>0
			&& req.query.fileName!=="undefined" && req.query.fileName!==null && req.query.fileName.length>0)
			{
				var tournamentLink = defaultUrl+'editTournament/'+req.query.tournamentId;
				var fs = require('fs');
				if(fs.existsSync("tournaments/"+req.query.tournamentId+"/images/"+ req.query.fileName))
				{
					fs.unlinkSync("tournaments/"+req.query.tournamentId+"/images/"+ req.query.fileName);
					res.redirect(tournamentLink);
				}
				else
				{
					res.render('error.ejs',{
					message:myLocalize.translate("error_deleting_image"),
					gobackTxt:myLocalize.translate("go_back"),
					link:tournamentLink});
					return;
				}
			}
			else
			{
				res.render('error.ejs',{
				message:myLocalize.translate("error_retrieving_deletion_file"),
				gobackTxt:myLocalize.translate("go_back")});
				return;
			}
	});
	
	app.get('/deleteTournamentPasswordFile', isLoggedAsAdmin, function(req, res) 
	{
		if(req.query.tournamentId!=="undefined" && req.query.tournamentId!=null && req.query.tournamentId.length>0)
			{
				var tournamentLink = defaultUrl+'editTournament/'+req.query.tournamentId;
				var fs = require('fs');
				if(fs.existsSync("tournaments/"+req.query.tournamentId+"/passwords.csv"))
				{
					fs.unlinkSync("tournaments/"+req.query.tournamentId+"/passwords.csv");
					res.redirect(tournamentLink);
				}
				else
				{
					res.render('error.ejs',{
					message:myLocalize.translate("error_deleting_image"),
					gobackTxt:myLocalize.translate("go_back"),
					link:tournamentLink});
					return;
				}
			}
			else
			{
				res.render('error.ejs',{
				message:myLocalize.translate("error_retrieving_deletion_file"),
				gobackTxt:myLocalize.translate("go_back")});
				return;
			}
	});
	
	app.get('/runValidathor:submissionURL?', isLoggedAsAdmin, function(req, res) 
	{
		try
		{
				var submissionURL = "";
				if(typeof req.query.submissionURL!=="undefined" && req.query.submissionURL!=null && req.query.submissionURL.length>0)
					submissionURL = req.query.submissionURL;
					
				if(submissionURL.length>0 && submissionURL.length>0)
				{
					var fs = require('fs');
					submissionURL = "tournaments/"+submissionURL;
					if(fs.existsSync(submissionURL))
					{
						try 
						{
							var files = [];
							var tmp = fs.readdirSync(submissionURL);
							tmp.forEach(file => {
							if(file.indexOf(".java")>0)
							{
								var tmp = fs.readFileSync(submissionURL+"/"+file);
								if(tmp.indexOf("extends Algorithm")>=0 || tmp.indexOf("extends MOAlgorithm")>=0)
								{
									compileSource(submissionURL+"/"+file);
									return;
								}
							}

							
							
						  });  
						res.json({"success": true});
						return;
						}
						catch (e) { console.log(e); }
					}
					else
						res.json({"success": false});
				}
				else
					res.json({"success": false});				
		}
		catch(EarsError) { console.log(EarsError); res.json({"success": false});}
	});
	
	app.get('/runEars:tournamentId?:override?', isLoggedAsAdmin, function(req, res) 
	{
		try
		{
			if(EARSinstances.length==0)
			{
				var override = false;
				var tournamentId = "";
				if(typeof req.query.override!=="undefined" && req.query.override!=null && req.query.override=="true")
					override = true;

				if(typeof req.query.tournamentId!=="undefined" && req.query.tournamentId!=null && req.query.tournamentId.length>0)	
					tournamentId = req.query.tournamentId;
			
				var result = runEARS(tournamentId,override);
				res.json({"success": result.success});
			}
			else
				res.json({"success": false, "message":myLocalize.translate("ears_already_running")});
		}
		catch(EarsError) { console.log(EarsError); res.json({"success": false});}
	});
	
	
	app.get('/killEARS', isLoggedAsAdmin, function(req,res)
	{
		updateEarsProcessList(true);
		res.json({"success": true });
	});
	
	app.post('/killEARS', isLoggedAsAdmin, function(req,res)
	{
		res.redirect('/');
	});
	
	app.post('/deleteTournamentImage', function(req,res)
	{
		res.redirect('/');
	});
	
	function sendMail(title,authordata,submissionUrl)
	{	
		var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		if(typeof title!=="undefined" && title!=null && title.length>0 && typeof authordata['email']!=="undefined"
			&& authordata['email']!=null && authordata['email'].length>0 && typeof submissionUrl!=="undefined"
			&& submissionUrl!=null && submissionUrl.length>0 && re.test(authordata['email']) && typeof appMailAddress!=="undefined" && appMailAddress!=null
			&& appMailAddress.length>0 && typeof appMailPassword!=="undefined" && appMailPassword!=null && appMailPassword.length>0)
		{
			var nodemailer = require('nodemailer');
			var transporter = nodemailer.createTransport({
			  service: 'gmail',
			  auth: {
				user: appMailAddress,
				pass: appMailPassword
			  }
			});

			var mailOptions = {
			  from: appMailAddress,
			  to: authordata['email'],
			  subject: title.substring(0,30),
			  text: myLocalize.translate("mail_body")+submissionUrl
			};

			transporter.sendMail(mailOptions, function(error, info){
			  if (error) {
				console.log(error);
			  } else {
				console.log('Email sent: ' + info.response);
			  }
			});
		}	
	}

	
	function runEARS(tournamentId,override)
	{
		if(typeof earsPath!=="undefined" && earsPath!=null && earsPath.length>0)
		{
			var fs = require('fs');
			if(fs.existsSync(earsPath))
			{
				var execCommand = "java -jar "+earsPath;
				if(tournamentId.length>0 && override)
					execCommand += " override "+tournamentId; 
				else if(tournamentId.length>0)
					execCommand += " "+tournamentId;
				else if(override)
					execCommand += " override";
					
				require('child_process').exec(execCommand, function(error, stdout, stderr) {
					EARSmessages = [];
					EARSerrors = [];
					updateEarsProcessList();
					
					if(typeof stdout!=="undefined" && stdout!=null && stdout.length>0)
						EARSmessages.push(stdout);
					
					if(typeof stderr!=="undefined" && stderr!=null && stderr.length>0)	
						EARSerrors.push(stderr);

					if (error !== null) {
						console.log('exec error: ' + error);
					}
				});
				
				updateEarsProcessList();
				return  { "success":true };
			}
			else
				return  { "success":false };
		}
		else
			return  { "success":false };
	}
	
	function updateEarsProcessList(kill = false)
	{
		var ps = require('ps-node');
		ps.lookup({
			command: 'java',
			arguments: 'ears.jar'
			}, function(err, resultList ) {
			if (err) {
				throw new Error( err );
			}
			
			EARSinstances = []; //clear process list and rebuild it
			resultList.forEach(function( process ){
				if(process){
					if(!kill)
						EARSinstances.push(process.pid);
					else
					{
						ps.kill(process.pid, 'SIGKILL', function( err ) {
						if (err) {
							throw new Error( err );
						}
						else {
							
						}
						});
					}
				}
			});
		});	
	}
	
	function loadConfigFile(req,res,next)
	{
		var fs = require('fs');
		var Localize = require('localize');
		var myLocalize = new Localize('./language/');
		myLocalize.setLocale("si");
		
		if(!fs.existsSync("tournaments"))
			fs.mkdirSync("tournaments");
		
		if(!fs.existsSync("tournaments/list.json"))
			fs.writeFileSync("tournaments/list.json");
			
		if(!fs.existsSync("tmp"))
			fs.mkdirSync("tmp");
		
		fs.readFile("tournaments/list.json", 'utf8', function readFileCallback(err, data){
		if (err)
		{
			res.render('error.ejs',{
			loggedIn:true,
			message:myLocalize.translate("invalid_tournament_config"),
			gobackTxt:myLocalize.translate("go_back"),
			link:"/" });
			return;
		} 
		
		if(data.length>0)
		{
			try 
			{
			  res.tournaments = JSON.parse(data);
			  updateAuthorsList(res.tournaments);
			  if(fs.existsSync("config/benchmarks.json"))
			  {
				var data = 	fs.readFileSync("config/benchmarks.json","UTF-8"); 
				if(typeof data!=="undefined" && data!=null && data.length>0)
				{
					try
					{
						var benchmarks = JSON.parse(data);
						if(benchmarks.length>0)
						{
							res.tournaments.forEach(function(tournament)
							{
								benchmarks.forEach(function(bench) 
								{
									if(tournament.benchmarks==bench.fileName)
										tournament.selectedBenchmark = bench;
								});
								
								if(fs.existsSync("tournaments/"+tournament.id+"/benchmark_result_files/Report.txt"))								
									tournament.downloadReport = true;
								else
									tournament.downloadReport = false;
							});
						}
					}
					catch(BenchError) { console.log(BenchError); }	
				}
			  }
			  
			}
			catch(JSONError) {}
		}
		
		return next();	
		});
	}

	/*Authors structure*/
	/*Name,Passwords,submissionUrls*/
	function updateAuthorsList(tournaments)
	{
		if(typeof tournaments!=="undefined" && tournaments!=null && tournaments.length>0)
		{
			tournaments.forEach(function(tournament)
			{
				var fs = require('fs');
				fs.readFile("tournaments/"+tournament.id+"/submissions/submission_list.json", "UTF-8", function read(err, data) {
					if(!err) 
					{
						try
						{
							authors = JSON.parse(data);
							authors.forEach(function(author)
							{
								fs.readFile("tournaments/"+tournament.id+"/submissions/"+author.author+"_"+author.timestamp+"/submission_report.json", "UTF-8", function read(sub_err, sub_data) 
								{
									if(!sub_err)
									{
										sub_data = JSON.parse(sub_data);
										if(typeof sub_data.email!=="undefined" && sub_data.email!=null && sub_data.email.length>0 && typeof author.submissionUrl!=="undefined" && author.submissionUrl!=null && author.submissionUrl.length>0)
										{									
											var loader = require('csv-load-sync');
											var password = "";
											var authorName = author.author;
											var authorEmail = sub_data.email;
											var submissionUrl = tournament.path+"/submission/"+author.author+"_"+author.timestamp;
											
											try
											{
												var csv = loader("tournaments/"+tournament.id+"/passwords.csv"); //validate password file structure
												if(typeof csv!=="undefined" && csv!=null && csv.length>0)
												{
													csv.forEach(function(user)
													{
														if(typeof user.name!=="undefined" && user.name!=null && typeof user.email!=="undefined" && typeof user.password!=="undefined" && user.email!=null && user.password!=null
															&& user.email == sub_data.email)
														{
															password = user.password;
															authorName = user.name;
															authorEmail = user.email;
															return;
														}
													});		
												}
											}								
											catch(CSVException) { /*inexistent or invalid csv*/ }
											//problem if he has only one submission and it is on a tournament without a password :)
											
											if(password.length==0 && tournament.password.length>0)
												password = tournament.password;
											
											if(password.length>0 && authorName.length>0 && submissionUrl.length>0)
											{
												var found = false;
												for(var i=0; i<authorsList.length;i++)
												{
													if(typeof authorsList[i].email!=="undefined" && authorsList[i].email!=null && authorsList[i].email==authorEmail)
													{
														authorsList[i].passwords.indexOf(password) === -1 ? authorsList[i].passwords.push(password):null;
														found = true; //we found the author if we are in here :)
														var tournament_position = -1;
														for(var k=0; k<authorsList[i].tournaments.length;k++)
														{
															if(authorsList[i].tournaments[k].id == tournament.id)
															{
																tournament_position = k;
																break;
															}
														}
														
														if(tournament_position>-1) //we found him in this tournament append submission
														{
															var submission_position=-1;
															for(var c=0;c<authorsList[i].tournaments[tournament_position].submissions.length;c++)
															{
																if(authorsList[i].tournaments[tournament_position].submissions[c].id == author.id)
																{
																	submission_position = c;
																	break;
																}
															}
															
															if(submission_position==-1) //not a duplicate
															{
																authorsList[i].tournaments[tournament_position].submissions.push({id:author.id,timestamp:sub_data.timestamp,url:submissionUrl,date_readable:sub_data.date_readable});
																authorsList[i].tournaments[tournament_position].submissions.sort(function(a, b) {
																	return b.timestamp-a.timestamp; //sort in ascending order
																});	
															}
														}
														else //he is not yet present in the current tournament
														{
															var submissions = [{id:author.id,timestamp:sub_data.timestamp,url:submissionUrl,date_readable:sub_data.date_readable}];
															let tmp_tournament = Object.assign({},tournament);
															tmp_tournament.submissions = submissions;
															authorsList[i].tournaments.push(tmp_tournament);
															break;
														}
													}
												}
															
												if(!found) //new entry
												{
													var submissions = [{id:author.id,timestamp:sub_data.timestamp,email:authorEmail,url:submissionUrl,date_readable:sub_data.date_readable}];
													let tmp_tournament = Object.assign({},tournament);
													tmp_tournament.submissions = submissions;
													authorsList.push({ name:authorName,email:authorEmail,passwords:[password],tournaments:[tmp_tournament]});
												}
											}
										}
									}
								});
							});
						}
						catch(JSONError) { console.log(JSONError); }
					}
				});
			});	
		}
	}
	
	function authenticate(req, res, next) {
		var master = require('../config/master.json');
		var Localize = require('localize');
		var myLocalize = new Localize('./language/');
		myLocalize.setLocale("si");
		
		if(typeof master.admins!=="undefined" && typeof master.admins!=null && master.admins.length>0)
		{
			master.admins.forEach(function(admin) 
			{
				if(admin.username==req.body.email)
				{
					if(typeof admin.password!=="undefined" && admin.password!=null && admin.password.length>0 && admin.password==req.body.password)
					{
						req.session.email = req.body.email;
						req.session.role = "admin";
						return next();
					}
				}
			});
		}

		if(authorsList!=null && authorsList.length>0)
		{
			for(var i=0;i<authorsList.length;i++)
			{
				if(authorsList[i].email == req.body.email)
				{
					for(var j=0;j<authorsList[i].passwords.length;j++)
					{
						if(authorsList[i].passwords[j] == req.body.password)
						{
							req.session.email = req.body.email;
							req.session.role = "user";
							return next();
						}
					}
				}
			}
		}
			
			
		req.flash('loginMessage',myLocalize.translate("invalid_login_credentials")); // create the loginMessage and save it to session as flashdata		
		return next();	
	}
};

// route middleware to make sure
function isLoggedAsAdmin(req, res, next) {
	// if user is authenticated in the session, carry on
	if (typeof req.session.email!=="undefined" && req.session.email!=null && req.session.email.length>0 && typeof req.session.role!=="undefined"
		&& req.session.role!=null && req.session.role == "admin")
		return next();

	// if they aren't redirect them to the home page
	res.redirect('/');
}

function deleteFolderAndContents(folderPath)
{
	var rimraf = require('rimraf');
	rimraf(folderPath, function () {  });
}

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 20; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function loadBenchmarks(req,res,next)
{
	var fs = require('fs');
	res.benchmarks = [];
	
	if(fs.existsSync("config/benchmarks.json"))
	{
		var Localize = require('localize');
		var myLocalize = new Localize('./language/');
		myLocalize.setLocale("si");
		
		fs.readFile("config/benchmarks.json", 'utf8', function readFileCallback(err, data){
		if (err)
		{
			res.render('error.ejs',{
			loggedIn:true,
			message:myLocalize.translate("invalid_tournament_config"),
			gobackTxt:myLocalize.translate("go_back"),
			link:"/" });
			return;
		} 
		
		if(data.length>0)
		{
			try
			{
				res.benchmarks = JSON.parse(data);
			}
			catch(JSONError) { }
		}
	
		return next();	
		});
	}
}


function convertToUTF8(folderPath)
{
	var fs = require('fs');
	var isUtf8 = require('is-utf8');

	if(fs.existsSync(folderPath))
	{
		try 
		{
			var files = [];
			var tmp = fs.readdirSync(folderPath);
			tmp.forEach(file => 
			{
				var currentFile = fs.readFileSync(folderPath+"/"+file)
				if(!isUtf8(currentFile)) 
				{
					fs.writeFileSync(folderPath+"/"+file,'/*Scanned by Validathor on:'+getDateTime()+' \ufeff*/\r\n'+currentFile,'utf8');
				}
			});

			return true;
		}
		catch (e) {console.log(e);}
	}
	return false;
}

function getDateTime() 
{
    var date = new Date();
    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return day+"."+month+"."+year + ":"+ hour + ":" + min + ":" + sec;
}

function compileSource(filePath)
{
	if(typeof filePath!=="undefined" && filePath!=null && filePath.length>0)
	{
		var fs = require('fs');
		if(fs.existsSync(filePath))
		{
			var lastIndex = filePath.lastIndexOf("/");
			if(lastIndex>0)
			{
				var folderPath = filePath.substring(0,lastIndex);
				convertToUTF8(folderPath);
				if(fs.existsSync(folderPath))
				{
					const { exec } = require('child_process');
					exec('java -cp Validathor Validathor '+ filePath +" "+folderPath+"/compile_report.json", (error, stdout, stderr) => {
					  if (error) {
						console.error(`exec error: ${error}`);
						return  { "success":false };
					  }
					});
					return  { "success":true };
				}
				else
					return  { "success":false };
			}
			else
				return  { "success":false };
		}
		else
			return  { "success":false };
	}
	else
		return  { "success":false };
}

function parseCompileResults(filePath)
{
	if(typeof filePath!=="undefined" && filePath!=null && filePath.length>0)
	{
		filePath = filePath.substring(0,filePath.lastIndexOf('/')+1)+"compile_report.json";
		if(typeof filePath!=="undefined" && filePath!=null && filePath.length>0)
		{
			var fs = require('fs');
			try {
			  var obj = fs.readFileSync(filePath,"UTF-8");
			  obj = JSON.parse(obj);
			  return  { "success":false, "error_msg":obj };
			}
			catch (e) 
			{
			 return  { "success":false };
			}
		}
		else
			return  { "success":false };
	}
	else
		return  { "success":false };
}

function extractAuthorAndEmail(text)
{
	if(typeof text!=="undefined" && text!=null && text.length>0)
	{
		var authorIdx = text.indexOf("@author");
		if(authorIdx>=0) //returns -1 if not found
		{	
			authorIdx+=7; //offset for @author
			var author = text.substring(authorIdx,text.length);
			if(author.indexOf('\r\n')>0)
				author = author.substring(0,author.indexOf('\r\n'));
			else if(author.indexOf('\r')>0)
				author = author.substring(0,author.indexOf('\r'));
			else if(author.indexOf('\n')>0)
				author = author.substring(0,author.indexOf('\n'));
			else if(author.indexOf('\n\r')>0)
				author = author.substring(0,author.indexOf('\n\r'));
			else return { "success":false }; 	//no newline found, throw error
			author = cleanUpAuthorName(author);
			if(author.length>0 && author.substring(0,1)=="_")
				author = author.substring(1,author.length);
			if(author.length>0)
			{
				if(author.indexOf("@")>=0)
				{
					var email = author.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi); //regex for email
					if(typeof email!=="undefined" && email!=null && email.constructor === Array && email.length>0) //check if found an email
						return  { "success":true, "author":author, "email":email[0] };
					else return { "success":true, "author":author };
				} //we didnt find authors email next to his name, so we scan the whole document
				else
				{
					var email = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi); //regex for email
					if(typeof email!=="undefined" && email!=null && email.constructor === Array && email.length>0) //check if found an email
						return  { "success":true, "author":author, "email":email[0] };
					else return { "success":true, "author":author };
				}
			}
			else return { "success":false };
		}
		else return { "success":false };
	}
}

function cleanUpAuthorName(authorName)
{
	if(typeof authorName!=="undefined" && authorName.length>0)
	{
		authorName = authorName.replace(/Č/g,"C");
		authorName = authorName.replace(/Č/,"C"); //testing
		authorName = authorName.replace(/č/g,"c");
		authorName = authorName.replace(/Ć/g,"C");
		authorName = authorName.replace(/ć/g,"c");
		authorName = authorName.replace(/Ž/g,"Z");
		authorName = authorName.replace(/ž/g,"z");
		authorName = authorName.replace(/Š/g,"S");
		authorName = authorName.replace(/š/g,"s");
		authorName = authorName.replace(/Đ/g,"D");
		authorName = authorName.replace(/đ/g,"d");
		authorName = authorName.replace(/Ä/g,"A");
		authorName = authorName.replace(/ä/g,"a");
		authorName = authorName.replace(/Ö/g,"O");
		authorName = authorName.replace(/ö/g,"o");
		authorName = authorName.replace(/Ü/g,"U");
		authorName = authorName.replace(/ü/g,"u");
		authorName = authorName.replace(/Ë/g,"E");
		authorName = authorName.replace(/ë/g,"e");
		authorName = authorName.replace(/ +(?= )/g,''); //remove multiple whitespace (usually start and end of string)
		authorName = authorName.replace(/ /g,'_'); //remove any spaces left with underscore, usually between name and surname
		authorName = authorName.replace(/,/g,"_");
		authorName = authorName.replace(/\s/g,"_");
		authorName = authorName.trim();
		return authorName;
	}
}

function generateSubmissionReport(folderPath,author,timestamp)
{
	if(typeof folderPath!=="undefined" && typeof author!=="undefined" &&  typeof timestamp!=="undefined"
		&& folderPath!=null && author!=null && timestamp!=null && folderPath.length>0  && timestamp>0)
	{
		var fs = require('fs');
		if(fs.existsSync(folderPath))
		{
			var date = new Date(timestamp*1000);
			var month = date.getUTCMonth()+1;
			if(month<10)
				var month="0"+month;
			var day = date.getUTCDate();
			if(day<10)
				var day="0"+day;
				
			var hours = date.getUTCHours();
		    if(hours<10)
				var hours = "0"+hours;
			
			var minutes = date.getUTCMinutes()
			if(minutes<10)
				var minutes = "0"+minutes;	
				
			date = day+'.'+month+'.'+date.getUTCFullYear()+":"+hours+"."+minutes;

		
			try 
			{
				var obj = 
				{
					author:author.author,
					email:author.email,
					date_timestamp:timestamp,
					date_readable:date
				};
				
				fs.writeFile(folderPath+'/submission_report.json', JSON.stringify(obj), 'utf8', function(err) {
				if(err) {
					return false;
				}
				});
			}
			catch(writeE) { return false; }
			
		}
		else
			return false;
	}
}

function updateTournamentSubmissionList(tournament,author,timestamp,submissionUrl,algorithmName)
{
	if(typeof tournament!=="undefined" && typeof author!=="undefined" &&  typeof timestamp!=="undefined" && typeof submissionUrl!=="undefined" && typeof algorithmName!=="undefined"
		&& tournament!=null && author!=null && timestamp!=null && submissionUrl!=null  && algorithmName!=null && submissionUrl.length>0 && author.length>0 && algorithmName.length>0 && timestamp>0)
	{
		var Localize = require('localize');
		var myLocalize = new Localize('./language/');
		myLocalize.setLocale("si");
		var fs = require('fs');
		if(fs.existsSync("tournaments/"+tournament.id+"/submissions"))
		{
			var submission_file = "tournaments/"+tournament.id+"/submissions/submission_list.json";
			if (!fs.existsSync(submission_file)) { //create the file if it doesn`t exist
				fs.closeSync(fs.openSync(submission_file, 'w'));
			}
			
			fs.readFile(submission_file, 'utf8', function readFileCallback(err, data){
			if (err)
			{
				res.render('error.ejs',{
				loggedIn:true,
				message:myLocalize.translate("error_reading_submission_list"),
				gobackTxt:myLocalize.translate("go_back"),
				link:"/" });
				return;
			} 
			else 
			{
				var obj = [];
				if(data.length>0)
				{
					try
					{
						obj = JSON.parse(data); 
					}
					catch(JSONError) {}
				}
				
				obj.push({id:makeid(),author:author,timestamp:timestamp,algorithm:algorithmName,submissionUrl:submissionUrl});
				obj.sort(function(a, b) {
				return parseInt(b.timestamp) - parseInt(a.timestamp); //sort in descending order
				});
				json = JSON.stringify(obj); //convert it back to json
				fs.writeFile(submission_file, json, 'utf8', function(err) {
				if(err) {
					res.render('error.ejs',{
					loggedIn:true,
					message:myLocalize.translate("error_saving_submission_list"),
					gobackTxt:myLocalize.translate("go_back"),
					link:"/"});
					return;
				}
				});
			
			}});		
	    }	
	}
}

function deleteTournamentSubmission(tournamentId,submissionId)
{
	if(typeof tournamentId!=="undefined" && tournamentId!=null && tournamentId.length>0 && typeof submissionId!=="undefined" && submissionId!=null && submissionId.length>0)
	{
		var fs = require('fs');
		var Localize = require('localize');
		var myLocalize = new Localize('./language/');
		myLocalize.setLocale("si");
		if(fs.existsSync("tournaments/"+tournamentId+"/submissions/submission_list.json"))
		{
			try {
				  var obj =  fs.readFileSync("tournaments/"+tournamentId+"/submissions/submission_list.json","UTF-8");
				  if(obj.length>0)
				  {
					var submissions = [];
					try
					{
						submissions = JSON.parse(obj);
					}
					catch(JSONError) {}
					
					if(typeof submissions!=="undefined" && submissions!=null && submissions.length>0)
					{
						var newList = [];
						for(var i=0; i<submissions.length; i++)
						{
							if(submissions[i].id!=submissionId) //generate the new list without the one we are deleting
								newList.push(submissions[i]);
							else //delete the folder and files containing our tournament
								deleteFolderAndContents("tournaments/"+tournamentId+"/submissions/"+submissions[i].author+"_"+submissions[i].timestamp);
						}
						
						if(submissions.length>newList.length) //check if we actually removed anythin
						{
							submissions = newList;
							submissions.sort(function(a, b) {
							return parseInt(b.timestamp) - parseInt(a.timestamp); //sort in descending order
							});
							json = JSON.stringify(submissions); //convert it back to json
							fs.writeFileSync("tournaments/"+tournamentId+"/submissions/submission_list.json", json, 'utf8', function(err) {
							if(err) 
							{
								console.log(myLocalize.translate("error_saving_tournament_list"));
								return false;
							}
							});
							return true;
						}
						else
							return false;
					}
					else
					{
						console.log(myLocalize.translate("error_deleting_empty_config"));
						return;
					}
				  }
				  else 
					return false;
				}
				catch (subseciption) { console.log(myLocalize.translate("error_reading_submission_list")); return false; }
		}
		else
			return false;
	}
	else
		return false;
}

function extractAlgorithmName(sourceFile,type)
{
	if(typeof sourceFile!=="undefined" && sourceFile!=null && sourceFile.length>0 && typeof type!=="undefined" && type!=null && type.length>0)
	{
		try
		{
			if(sourceFile.indexOf(type)>0)
			{
				sourceFile = sourceFile.substring(0,sourceFile.indexOf(type)-1);
				sourceFile = sourceFile.substring(sourceFile.lastIndexOf("class")+6,sourceFile.length);
				return sourceFile;
			}
		}
		catch(AlgorithmParseError) { }
	}
}
