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
		var RedirectionUrl = defaultUrl+settings.RedirectionUrl;
	}
	catch(MissingConfig) { console.log("Missing config.js file in config folder!" ); process.exit(); }
	
	var google = require('googleapis');
	var OAuth2 = google.auth.OAuth2;
	var plus = google.plus('v1');
	
	var Localize = require('localize');
	var myLocalize = new Localize('./language/');
	myLocalize.setLocale(settings.setLanguage);
	


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
						var found = false;
						data.emails.forEach(function(email) 
						{
							master.admins.forEach(function(admin) 
							{
								if(admin.username==email.value)
								{
									found = true;
									req.session.email = email.value;
									res.redirect('/profile');
								}
							});
							if(master.username==email.value)
							{
								found = true;
								req.session.email = email.value;
								res.redirect('/profile');
							}
						});
						
						
						if(!found)
						{
							res.render('login.ejs', { message: myLocalize.translate("not_authorized"), googleAuthUrl:getAuthUrl(),
							emailTxt:myLocalize.translate("email"), passwordTxt:myLocalize.translate("password"),
							loginTxt:myLocalize.translate("login"),googleTxt:myLocalize.translate("google_login"), orgoTxt:myLocalize.translate("or_go"),homeTxt:myLocalize.translate("home") });
							return;
						}
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
			res.redirect('/profile');
	});

	

	// =====================================
	// PROFILE SECTION =========================
	// =====================================
	// we will want this protected so you have to be logged in to visit
	// we will use route middleware to verify this (the isLoggedIn function)
	app.get('/profile', isLoggedIn, loadConfigFile, function(req, res) 
	{
		res.render('profile.ejs', {
			user : req.session,
			tournaments: res.tournaments,
			controlPanel:myLocalize.translate("control_panel"),
			deleteTournamentConfirm:myLocalize.translate("delete_tournament_confirmation"),
			loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),
			logoutTxt:myLocalize.translate("logout"),newTournamentDesc:myLocalize.translate("new_tournament"),
			createnewTournametDesc:myLocalize.translate("create_new_tournament"),deleteDesc:myLocalize.translate("delete_desc"),
			editDesc:myLocalize.translate("edit_tournament"),
			loggedIn:true
		});
	});

	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.session.destroy();
		res.redirect('/');
	});
	
	// =====================================
	// WORKLOG ==============================
	// =====================================
	app.get('/worklog', isLoggedIn, function(req, res) 
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
				if(entry.id!=="undefined" && entry.id!=null && entry.id.length>0 && entry.path==req.params.url)
				{
					var fs = require('fs');
					fs.stat("tournaments/" +entry.id, function (err, stats){
					  if (err) {
						// Directory doesn't exist or something.
						/*console.log('Folder doesn\'t exist, so I made the folder ' + seriesid);
						return fs.mkdir("temp/" + seriesid, callback);*/
					  }
					  if (typeof stats==="undefined" || !stats.isDirectory()) {
						console.log("notadir");
						return;
						// This isn't a directory!
						//callback(new Error('temp is not a directory!'));
					  } 
					  else 
					  {
						var password = false;
						if((typeof entry.password!=="undefined" && entry.password!=null && entry.password!=null) || fs.existsSync("tournaments/"+entry.id+"/passwords.csv"))
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
							
						res.render('tournament.ejs',{
						data:entry,
						password:password,
						images:images,
						loggedIn:loggedIn,
						passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
						choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
						uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
						descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
						submitTxt:myLocalize.translate("submit")});
						return;
					  }
					});
				}
			});
		}
	});
	
	app.get('/newTournament',  isLoggedIn, loadBenchmarks, function(req, res) {
		res.render('edittournament.ejs', { loggedIn:true, benchmarks:res.benchmarks,newtournamentTxt:myLocalize.translate("new_tournament"),
		edittournamentTxt:myLocalize.translate("edit_tournament"),deleteSubmissionConfirmation:myLocalize.translate("delete_submissions_confirmation"),
		deleteimageConfirmation:myLocalize.translate("delete_image_confirmation"),loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),
		tournamentnameTxt:myLocalize.translate("tournament_name"),submissiondateTxt:myLocalize.translate("submission_date"), behcmarksTxt:myLocalize.translate("benchmarks"),
		tournamentUrlTxt:myLocalize.translate("tournament_url"),descTxt:myLocalize.translate("description"),imgdescTxt:myLocalize.translate("tournament_images"),
		passwordfileDesc:myLocalize.translate("tournament_passwordfile_desc"),oldpasswordDesc:myLocalize.translate("oldpasswordfile_desc"),
		submissionpasswordDesc:myLocalize.translate("submissionpassword_desc"),saveDesc:myLocalize.translate("save_btn"),cancelDesc:myLocalize.translate("cancel_btn"),
		submittedDesc:myLocalize.translate("submitted_desc"),deleteDesc:myLocalize.translate("delete_desc"),viewSubmission:myLocalize.translate("view_submission")} );
		return;
	});
	
	app.post('/newTournament',  isLoggedIn, function(req, res) {
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
						
						var end = Date.parse(req.body.ends);
						end = end/1000;
						obj.push({id:hash,name: req.body.name, timestamp:Math.floor(new Date() / 1000), ends:end, benchmarks:req.body.benchmarks, path:req.body.path, description:req.body.description, password:req.body.password}); //add some data
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
										csv.forEach(function(user)
										{
											if(typeof user.name=="undefined" || typeof user.email=="undefined" || typeof user.password=="undefined"
												|| user.name==null ||user.email==null || user.password==null
												|| user.name.length<=0 || user.email.length<=0 || user.password.length<=0)
													valid = false;
										});	
										
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
	
	
	app.get('/editTournament/:url/passwords.csv',  isLoggedIn, loadConfigFile, function(req, res) 
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
	
	app.get('/editTournament/:url',  isLoggedIn, loadConfigFile, loadBenchmarks, function(req, res) 
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
			var images = [];
			var fs = require('fs');
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
					}
					catch(JSONException) {}
				  }
				}
				catch (subseciption) {}
			}
			
			var passwordfile;
			if(fs.existsSync("tournaments/"+tournament.id+"/passwords.csv"))
				passwordfile = defaultUrl+"editTournament/"+tournament.id+"/passwords.csv";
			
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
						images:images,
						newtournamentTxt:myLocalize.translate("new_tournament"),
						edittournamentTxt:myLocalize.translate("edit_tournament"),deleteSubmissionConfirmation:myLocalize.translate("delete_submissions_confirmation"),
						deleteimageConfirmation:myLocalize.translate("delete_image_confirmation"),loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),
						tournamentnameTxt:myLocalize.translate("tournament_name"),submissiondateTxt:myLocalize.translate("submission_date"), behcmarksTxt:myLocalize.translate("benchmarks"),
						tournamentUrlTxt:myLocalize.translate("tournament_url"),descTxt:myLocalize.translate("description"),imgdescTxt:myLocalize.translate("tournament_images"),
						passwordfileDesc:myLocalize.translate("tournament_passwordfile_desc"),oldpasswordDesc:myLocalize.translate("oldpasswordfile_desc"),
						submissionpasswordDesc:myLocalize.translate("submissionpassword_desc"),saveDesc:myLocalize.translate("save_btn"),cancelDesc:myLocalize.translate("cancel_btn"),
						submittedDesc:myLocalize.translate("submitted_desc"),deleteDesc:myLocalize.translate("delete_desc"),viewSubmission:myLocalize.translate("view_submission")});
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
	
	app.post('/deleteTournament/:id', isLoggedIn, function(req,res)
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
	
	app.post('/editTournament/:url',  isLoggedIn, function(req, res) 
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
					//rename directory if different
					if(tournament.path!=req.body.path)
					{
						fs.rename("tournaments/"+tournament.path,"tournaments/"+req.body.path);
						tournament.path = req.body.path;
					}
					
					tournament.ends = Date.parse(req.body.ends)/1000;
					tournament.password = req.body.password;
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
								csv.forEach(function(user)
								{
									if(typeof user.name=="undefined" || typeof user.email=="undefined" || typeof user.password=="undefined"
										|| user.name==null ||user.email==null || user.password==null
										|| user.name.length<=0 || user.email.length<=0 || user.password.length<=0)
											valid = false;
								});	
								
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
					if(tournament.ends>new Date().getTime()/1000)
						found = true;
					else
					{
						req.flash('submissionMessage',myLocalize.translate("tournament_has_ended")); 
						res.render('tournament.ejs',{
						data:tournament, message:req.flash('submissionMessage'),passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
						choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
						uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
						descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
						submitTxt:myLocalize.translate("submit")});	
						return;
					}
					break;
				}
			}
			
			if(typeof req.files.submissionFile.size=="undefined" || req.files.submissionFile.size==null || req.files.submissionFile.size<=0)
			{
				
				req.flash('submissionMessage',myLocalize.translate("choose_file_upload")); 
				res.render('tournament.ejs',{
				data:tournament, message:req.flash('submissionMessage'),passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
				choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
				uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
				descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
				submitTxt:myLocalize.translate("submit")});				
				return;
			}
			
			var fs = require('fs');
			if(!fs.exists("tournaments/"+tournament.id+"/benchmark_result_files"))
				fs.mkdir("tournaments/"+tournament.id+"/benchmark_result_files");
			
			if(fs.existsSync("tournaments/"+tournament.id+"/passwords.csv"))
			{
				if(typeof req.body.password!=="undefined" && req.body.password!=null && req.body.password.length>0)
				{
					var loader = require('csv-load-sync');
					var csv = loader("tournaments/"+tournament.id+"/passwords.csv");
					if(typeof csv!=="undefined" && csv!=null && csv.length>0)
					{
						csv.forEach(function(user)
						{
							if(user.password == req.body.password)
								req.authordata = { "success":true, "author":user.name, "email":user.email };
						});	
						
						password = true;

						if(typeof req.authordata=="undefined" || req.authordata==null)
						{
							req.flash('submissionMessage',myLocalize.translate("invalid_submission_password")); 
							res.render('tournament.ejs',{
							data:tournament, message:req.flash('submissionMessage'), password:password,
							passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
							choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
							uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
							descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
							submitTxt:myLocalize.translate("submit")});
							return;
						}
					}
					else
					{
						req.flash('submissionMessage',myLocalize.translate("error_reading_passwords_file")); 
						res.render('tournament.ejs',{
						data:tournament, message:req.flash('submissionMessage'), password:password,
						passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
						choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
						uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
						descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
						submitTxt:myLocalize.translate("submit")});
						return;
					}
				}
				else
				{
					req.flash('submissionMessage',myLocalize.translate("empty_submission_password")); 
					res.render('tournament.ejs',{
					data:tournament, message:req.flash('submissionMessage'), password:password,
					passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
					choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
					uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
					descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
					submitTxt:myLocalize.translate("submit")});
					return;
				}
			}		
			else if(typeof tournament.password!=="undefined" && tournament.password!=null && tournament.password.length>0
				&& tournament.password!=req.body.password)
			{
				password = true;
				req.flash('submissionMessage',myLocalize.translate("invalid_submission_password")); 
				res.render('tournament.ejs',{
				data:tournament, message:req.flash('submissionMessage'), password:password,
				passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
				choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
				uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
				descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
				submitTxt:myLocalize.translate("submit")});
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
							data:tournament, message:req.flash('submissionMessage'),
							passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
							choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
							uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
							descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
							submitTxt:myLocalize.translate("submit"),password:password});
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
											data:tournament, message:req.flash('submissionMessage'),
											passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
											choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
											uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
											descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
											submitTxt:myLocalize.translate("submit"),password:password});
											return;
										});
										//successfull ZIP extraction
										unzipExtractor.on('close', function()
										{
											try {
												var fs = require('fs');
												var source_file;
												fs.readdirSync(tmp_dir).forEach(file => {
												  if(file.indexOf(".java")>0 || file.indexOf(".JAVA")>0)
												  {
													try
													{
														var tmp = fs.readFileSync(tmp_dir+"/"+file,"UTF-8");
														if(tmp.indexOf('extends Algorithm') >= 0)
														{
															source_file = file;
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
														data:tournament, message:req.flash('submissionMessage'),
														passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
														choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
														uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
														descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
														submitTxt:myLocalize.translate("submit"),password:password});
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
															if (!fs.existsSync("tournaments/"+tournament.id+"/submissions"))
															fs.mkdir("tournaments/"+tournament.id+"/submissions");
														
															var submissionTimestamp = Math.floor(Date.now() / 1000);
															var destFolder = "tournaments/"+tournament.id+"/submissions/"+authordata['author']+"_"+submissionTimestamp;
															fs.mkdir(destFolder);
															
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
																	data:tournament, message:req.flash('submissionMessage'),
																	passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
																	choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
																	uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
																	descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
																	submitTxt:myLocalize.translate("submit"),password:password});
																	deleteFolderAndContents(tmp_dir);
																	return;
																});	
																fs.unlink(req.files.submissionFile.path,function(err) {  });
																unzipExtractor2.on('close', function() 
																{
																	compileSource(destFolder+'/'+source_file);
																});
																var submissionUrl = defaultUrl+tournament.path+'/submission/'+authordata['author']+"_"+submissionTimestamp;
																req.flash('submissionMessage',submissionUrl); 
																res.render('tournament.ejs',{
																data:tournament, successmessage:req.flash('submissionMessage'),
																passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
																choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
																uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
																descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
																submitTxt:myLocalize.translate("submit"),password:password});
																generateSubmissionReport(destFolder,authordata,submissionTimestamp);
																deleteFolderAndContents(tmp_dir);
																updateTournamentSubmissionList(tournament,authordata['author'],submissionTimestamp,submissionUrl)
																return;
															});
															
															source.on('error', function() 
															{
																fs.unlink(req.files.submissionFile.path,function(err,data) {});
																req.flash('submissionMessage',myLocalize.translate("error_moving_submission")); 
																res.render('tournament.ejs',{
																data:tournament, message:req.flash('submissionMessage'),
																passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
																choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
																uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
																descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
																submitTxt:myLocalize.translate("submit"),password:password});
																deleteFolderAndContents(tmp_dir);
																return;
															});
															
														}
														else
														{
															fs.unlink(req.files.submissionFile.path,function(err,data) {});
															req.flash('submissionMessage',myLocalize.translate("author_not_found")); 
															res.render('tournament.ejs',{
															data:tournament, message:req.flash('submissionMessage'),
															passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
															choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
															uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
															descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
															submitTxt:myLocalize.translate("submit"),password:password});
															deleteFolderAndContents(tmp_dir);
															return;
														}
													}});
												}
												else //no source (java) files found in root folder
												{
													fs.unlink(req.files.submissionFile.path,function(err,data) {});
													req.flash('submissionMessage',myLocalize.translate("no_main_programme_found")); 
													res.render('tournament.ejs',{
													data:tournament, message:req.flash('submissionMessage'),
													passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
													choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
													uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
													descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
													submitTxt:myLocalize.translate("submit"),password:password});
													deleteFolderAndContents(tmp_dir);
													return;
												}
											}
											catch(glob) 
											{
												fs.unlink(req.files.submissionFile.path,function(err,data) {});
												req.flash('submissionMessage',myLocalize.translate("error_scanning_source")); 
												res.render('tournament.ejs',{
												data:tournament, message:req.flash('submissionMessage'),
												passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
												choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
												uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
												descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
												submitTxt:myLocalize.translate("submit"),password:password});
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
										data:tournament, message:req.flash('submissionMessage'),
										passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
										choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
										uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
										descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
										submitTxt:myLocalize.translate("submit"),password:password});
										return;
									});
								}
								else
								{
									fs.unlink(req.files.submissionFile.path,function(err,data) {});
									req.flash('submissionMessage',myLocalize.translate("error_uploading_tmp_folder")); 
									res.render('tournament.ejs',{
									data:tournament, message:req.flash('submissionMessage'),
									passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
									choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
									uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
									descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
									submitTxt:myLocalize.translate("submit"),password:password});
									return;
								}
							}
							else if(ext=="java" || ext=="JAVA")
							{
								if(data.indexOf('extends Algorithm')>=0)
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
										if (!fs.existsSync("tournaments/"+tournament.id+"/submissions"))
											fs.mkdir("tournaments/"+tournament.id+"/submissions");
										
										var submissionTimestamp = Math.floor(Date.now() / 1000);
										var destFolder = "tournaments/"+tournament.id+"/submissions/"+authordata['author']+"_"+submissionTimestamp;
										fs.mkdir(destFolder);
										var source = fs.createReadStream(req.files.submissionFile.path);
										var dest = fs.createWriteStream(destFolder+'/'+req.files.submissionFile.name);
										source.pipe(dest);
										source.on('end', function() 
										{
											fs.unlink(req.files.submissionFile.path,function(err,data) {});
											var submissionUrl = defaultUrl+tournament.path+'/submission/'+authordata['author']+"_"+submissionTimestamp;
											req.flash('submissionMessage',submissionUrl); 
											res.render('tournament.ejs',{
											data:tournament, successmessage:req.flash('submissionMessage'),
											passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
											choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
											uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
											descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
											submitTxt:myLocalize.translate("submit"),password:password});
											generateSubmissionReport(destFolder,authordata,submissionTimestamp)
											compileSource(destFolder+'/'+req.files.submissionFile.name);
											updateTournamentSubmissionList(tournament,authordata['author'],submissionTimestamp,submissionUrl)
											return;
										});
										
										source.on('error', function() 
										{
											fs.unlink(req.files.submissionFile.path,function(err,data) {});
											req.flash('submissionMessage',myLocalize.translate("error_moving_submission")); 
											res.render('tournament.ejs',{
											data:tournament, message:req.flash('submissionMessage'),
											passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
											choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
											uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
											descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
											submitTxt:myLocalize.translate("submit"),password:password});
											return;
										});
						
									}
									else
									{
										var fs = require('fs');
										fs.unlink(req.files.submissionFile.path,function(err,data) {});
										req.flash('submissionMessage',myLocalize.translate("author_not_found")); 
										res.render('tournament.ejs',{
										data:tournament, message:req.flash('submissionMessage'),
										passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
										choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
										uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
										descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
										submitTxt:myLocalize.translate("submit"),password:password});
										return;
									}
								}
								else
								{
									var fs = require('fs');
									fs.unlink(req.files.submissionFile.path,function(err,data) {});
									req.flash('submissionMessage',myLocalize.translate("no_main_programme_found")); 
									res.render('tournament.ejs',{
									data:tournament, message:req.flash('submissionMessage'),
									passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
									choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
									uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
									descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
									submitTxt:myLocalize.translate("submit"),password:password});
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
						data:tournament, message:req.flash('submissionMessage'),
						passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
						choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
						uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
						descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
						submitTxt:myLocalize.translate("submit"),password:password});
						return;
					}
				}
				else
				{
					var fs = require('fs');
					fs.unlink(req.files.submissionFile.path,function(err,data) {});
					req.flash('submissionMessage',myLocalize.translate("invalid_file_format")); 
					res.render('tournament.ejs',{
					data:tournament, message:req.flash('submissionMessage'),
					passwordTxt:myLocalize.translate("empty_submission_password"),maxsizeTxt:myLocalize.translate("max_upload_size"),invalidformatTxt:myLocalize.translate("invalid_file_format"),
					choosefileTxt:myLocalize.translate("choose_file_for_upload"),loginTxt:myLocalize.translate("login"), profileTxt:myLocalize.translate("profile"),
					uploadSuccessTxt:myLocalize.translate("file_upload_success"),benchTxt:myLocalize.translate("benchmarks"),submissionTxt:myLocalize.translate("submission_date"),
					descTxt:myLocalize.translate("description"),typesTxt:myLocalize.translate("valid_types"),filepasswordTxt:myLocalize.translate("submission_password"),
					submitTxt:myLocalize.translate("submit"),password:password});
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
				
				
				res.render('showresults.ejs',{
				data:tournament, submission_report:submission_report, compile_report:compile_report,loggedIn:loggedIn,
				error_txt:error_txt,info_txt:info_txt,
				passwordRequired:myLocalize.translate("empty_submission_password"),maxsizeDesc:myLocalize.translate("max_upload_size"),
				invalidFormat:myLocalize.translate("invalid_file_format"),chooseFile:myLocalize.translate("choose_file_for_upload"),
				loginTxt:myLocalize.translate("login"),profileTxt:myLocalize.translate("profile"),uploadSuccess:myLocalize.translate("file_upload_success"),
				benchmarks:myLocalize.translate("benchmarks"),submissionDate:myLocalize.translate("submission_date"),description:myLocalize.translate("description"),
				author:myLocalize.translate("author"),submittedDate:myLocalize.translate("submitted_date"),compileReport:myLocalize.translate("compile_report"),
				noErrors:myLocalize.translate("no_errors"),submissionProcessing:myLocalize.translate("submission_being_processed")});
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
				noErrors:myLocalize.translate("no_errors"),submissionProcessing:myLocalize.translate("submission_being_processed")});
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
	
	app.get('/deleteSubmission', isLoggedIn, function(req, res) 
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
	
	app.get('/deleteTournamentImage', isLoggedIn, function(req, res) 
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
	
	app.post('/deleteTournamentImage', function(req,res)
	{
		res.redirect('/');
	});
};

// route middleware to make sure
function isLoggedIn(req, res, next) {
	// if user is authenticated in the session, carry on
	if (typeof req.session.email!=="undefined" && req.session.email!=null && req.session.email.length>0)
		return next();

	// if they aren't redirect them to the home page
	res.redirect('/');
}

function deleteFolderAndContents(folderPath)
{
	var rimraf = require('rimraf');
	rimraf(folderPath, function () {  });
}

function authenticate(req, res, next) {
	var master = require('../config/master.json');
	var Localize = require('localize');
	var myLocalize = new Localize('./language/');
	myLocalize.setLocale("si");
	
	if(typeof master.admins!=="undefined" && typeof master.admins!=null && master.admins.length>0)
	{
		var found = false;
		master.admins.forEach(function(admin) 
		{
			if(admin.username==req.body.email)
			{
				if(typeof admin.password!=="undefined" && admin.password!=null && admin.password.length>0 && admin.password==req.body.password)
				{

					sess = req.session;
					sess.email = req.body.email;
					found = true;
				}
			}
		});
	
		
		if(!found)
			req.flash('loginMessage',myLocalize.translate("invalid_login_credentials")); // create the loginMessage and save it to session as flashdata
	}
	else
		req.flash('loginMessage',myLocalize.translate("invalid_tournament_config")); 
	return next();	
}

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 20; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function loadConfigFile(req,res,next)
{
	var fs = require('fs');
	var Localize = require('localize');
	var myLocalize = new Localize('./language/');
	myLocalize.setLocale("si");
	
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
		}
		catch(JSONError) {}
	}
	
	return next();	
	});
}

function loadBenchmarks(req,res,next)
{
	var fs = require('fs');
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
		var obj = {
		   benchmarks: []
		};
		obj = JSON.parse(data); 
		res.benchmarks = obj;
	}
	
	return next();	
	});
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
		authorName = authorName.replace(/Č/g,"c");
		authorName = authorName.replace(/č/g,"c");
		authorName = authorName.replace(/Ć/g,"c");
		authorName = authorName.replace(/ć/g,"c");
		authorName = authorName.replace(/Ž/g,"z");
		authorName = authorName.replace(/ž/g,"z");
		authorName = authorName.replace(/Š/g,"s");
		authorName = authorName.replace(/š/g,"s");
		authorName = authorName.replace(/Đ/g,"d");
		authorName = authorName.replace(/đ/g,"d");
		authorName = authorName.replace(/Ä/g,"a");
		authorName = authorName.replace(/ä/g,"a");
		authorName = authorName.replace(/Ö/g,"o");
		authorName = authorName.replace(/ö/g,"o");
		authorName = authorName.replace(/Ü/g,"u");
		authorName = authorName.replace(/ü/g,"u");
		authorName = authorName.replace(/Ë/g,"e");
		authorName = authorName.replace(/ë/g,"e");
		authorName = authorName.replace(/ +(?= )/g,''); //remove multiple whitespace (usually start and end of string)
		authorName = authorName.replace(/ /g,'_'); //remove any spaces left with underscore, usually between name and surname
		authorName = authorName.replace(/,/g,"_");
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

function updateTournamentSubmissionList(tournament,author,timestamp,submissionUrl)
{
	if(typeof tournament!=="undefined" && typeof author!=="undefined" &&  typeof timestamp!=="undefined" && typeof submissionUrl!=="undefined"
		&& tournament!=null && author!=null && timestamp!=null && submissionUrl!=null && submissionUrl.length>0 && author.length>0 && timestamp>0)
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
				
				obj.push({id:makeid(),author:author,timestamp:timestamp,submissionUrl:submissionUrl});
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