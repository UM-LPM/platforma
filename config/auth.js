var master = require('../config/master.json');

module.exports = function(auth) {

function authenticate(req, email, password, done) {
	if(typeof master.username!=="undefined" && typeof master.username!=null && master.username.length>0
		&& typeof master.password!=="undefined" && master.password!=null && master.password.length>0)
			{
				if(master.username==email && master.password==password)
				{
					sess = req.session;
					sess.email = email;
					return done(null,true);
				}
				else
					return done(null, false, req.flash('loginMessage', 'Oops! Invalid login credentials!')); // create the loginMessage and save it to session as flashdata
			}
			else
				return done(null, false, req.flash('loginMessage', 'Inexsitent master config file.')); 
};


};