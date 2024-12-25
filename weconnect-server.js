/**
 * Module dependencies.
 */
const cors = require('cors');
const path = require('path');
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const bodyParser = require('body-parser');
const logger = require('morgan');
const errorHandler = require('errorhandler');
const lusca = require('lusca');
const dotenv = require('dotenv');
const flash = require('express-flash');
const passport = require('passport');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const upload = multer({ dest: path.join(__dirname, 'uploads') });

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.config({ path: '.env' });

/**
 * Set config values
 */
const secureTransfer = (process.env.BASE_URL.startsWith('https'));

// Consider adding a proxy such as cloudflare for production.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// This logic for numberOfProxies works for local testing, ngrok use, single host deployments
// behind cloudflare, etc. You may need to change it for more complex network settings.
// See readme.md for more info.
let numberOfProxies;
if (secureTransfer) numberOfProxies = 1; else numberOfProxies = 0;

/**
 * Controllers (route handlers).
 */
const homeController = require('./controllers/home');
const prismaUserController = require('./controllers/userController');
const apiController = require('./controllers/api');
const personApiController = require('./controllers/personApiController');
const teamApiController = require('./controllers/teamApiController');
const contactController = require('./controllers/contact');

/**
 * API keys and Passport configuration.
 */
const passportConfig = require('./config/passport');

/**
 * Create Express server.
 */
const weconnectServer = express();

/**
 * Express configuration.
 */
weconnectServer.set('host', process.env.HOST || '0.0.0.0');
weconnectServer.set('port', process.env.PORT || 4500);
weconnectServer.set('views', path.join(__dirname, 'views'));
weconnectServer.set('view engine', 'pug');
weconnectServer.set('trust proxy', numberOfProxies);
weconnectServer.use(compression());
const corsConfig = {
  credentials: true,
  origin: true,
};
weconnectServer.use(cors(corsConfig));
weconnectServer.use(logger('dev'));
weconnectServer.use(bodyParser.json());
weconnectServer.use(bodyParser.urlencoded({ extended: true }));
weconnectServer.use(limiter);

// TODO: Move to auth.js

// This is the basic express session({..}) initialization.
weconnectServer.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  name: 'WeConnectSession',
  cookie: {
    maxAge: 1209600000, // Two weeks in milliseconds
    secure: secureTransfer,
    allowlist: [
      { path: '/apis/v1', type: 'startWith' },
      { path: '/localhost', type: 'exact' },
      { path: '/summary', type: 'startWith' },
    ],
  },
  store: new (connectPgSimple(session))({
    createTableIfMissing: true,
  }),
  // store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI })    WHAT ABOUT POSTGRES??????
}));

weconnectServer.use(passport.initialize());   // init passport on every route call.
weconnectServer.use(passport.session());      // allow passport to use "express-session".
weconnectServer.use(flash());   // TODO: probably not needed or wanted
dotenv.config({ path: '.env' });              // reads text in '.env' file into process.env global variables
// TODO: This allowlist is a hack around a csrf.js issue, where login was blocked by a csrf mismatch.  I suspect that we have an unresolved Lusca setup issue.
weconnectServer.use(lusca({
  allowlist: ['/login', '/signup'],
}));

// END move to auth js

weconnectServer.use((req, res, next) => {
  if (req.path === '/api/upload') {
    // Multer multipart/form-data handling needs to occur before the Lusca CSRF check.
    next();
  } else {
    lusca.csrf({ allowlist: ['/login', '/signup']})(req, res, next);
    // lusca.csrf()(req, res, next);
  }
});
// weconnectServer.use(lusca.xframe('SAMEORIGIN'));
// weconnectServer.use(lusca.xssProtection(true));
weconnectServer.disable('x-powered-by');
weconnectServer.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// After successful login, redirect back to the intended page
weconnectServer.use((req, res, next) => {
  if (!req.user &&
    req.path !== '/login' &&
    req.path !== '/signup' &&
    !req.path.match(/^\/auth/) &&
    !req.path.match(/\./)) {
    req.session.returnTo = req.originalUrl;
  } else if (req.user &&
    (req.path === '/account' || req.path.match(/^\/api/))) {
    req.session.returnTo = req.originalUrl;
    console.log('test in weconnect-server isAuthenticated: ', req.isAuthenticated());
  }
  next();
});

// make the req.user available globally to be able to check logged in status
weconnectServer.use((req, res, next) => {
  res.locals.login = req.user;
  next();
});



weconnectServer.use('/', express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));
weconnectServer.use('/js/lib', express.static(path.join(__dirname, 'node_modules/chart.js/dist'), { maxAge: 31557600000 }));
weconnectServer.use('/js/lib', express.static(path.join(__dirname, 'node_modules/popper.js/dist/umd'), { maxAge: 31557600000 }));
weconnectServer.use('/js/lib', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js'), { maxAge: 31557600000 }));
weconnectServer.use('/js/lib', express.static(path.join(__dirname, 'node_modules/jquery/dist'), { maxAge: 31557600000 }));
weconnectServer.use('/webfonts', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free/webfonts'), { maxAge: 31557600000 }));

// Middleware function to log requests
weconnectServer.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next(); // Call next middleware
});


/**
 * Primary app routes.
 */
weconnectServer.get('/', homeController.index);
// weconnectServer.get('/login', prismaUserController.getLogin);
// weconnectServer.post('/login', prismaUserController.postLogin);
weconnectServer.get('/logout', prismaUserController.logout);
weconnectServer.get('/forgot', prismaUserController.getForgot);
weconnectServer.post('/forgot', prismaUserController.postForgot);
weconnectServer.get('/reset/:token', prismaUserController.getReset);
weconnectServer.post('/reset/:token', prismaUserController.postReset);
// weconnectServer.get('/signup', prismaUserController.getSignup);
// weconnectServer.post('/signup', prismaUserController.postSignup);
weconnectServer.get('/contact', contactController.getContact);
weconnectServer.post('/contact', contactController.postContact);
weconnectServer.get('/account/verify', passportConfig.isAuthenticated, prismaUserController.getVerifyEmail);
weconnectServer.get('/account/verify/:token', passportConfig.isAuthenticated, prismaUserController.getVerifyEmailToken);
weconnectServer.get('/account', passportConfig.isAuthenticated, prismaUserController.getAccount);
weconnectServer.post('/account/profile', passportConfig.isAuthenticated, prismaUserController.postUpdateProfile);
weconnectServer.post('/account/password', passportConfig.isAuthenticated, prismaUserController.postUpdatePassword);
weconnectServer.post('/account/delete', passportConfig.isAuthenticated, prismaUserController.postDeleteAccount);
weconnectServer.get('/account/unlink/:provider', passportConfig.isAuthenticated, prismaUserController.getOauthUnlink);

/**
 * WeConnect API routes.
 */
weconnectServer.get('/apis/v1/add-person-to-team', teamApiController.addPersonToTeam);
weconnectServer.get('/apis/v1/person-list-retrieve', personApiController.personListRetrieve);
weconnectServer.get('/apis/v1/person-retrieve', personApiController.personRetrieve);
weconnectServer.get('/apis/v1/person-save', personApiController.personSave);
weconnectServer.get('/apis/v1/remove-person-from-team', teamApiController.removePersonFromTeam);
weconnectServer.get('/apis/v1/team-list-retrieve', teamApiController.teamListRetrieve);
weconnectServer.get('/apis/v1/team-save', teamApiController.teamSave);
weconnectServer.get('/apis/v1/team-retrieve', teamApiController.teamRetrieve);
weconnectServer.get('/apis/v1/secret-retrieve', prismaUserController.getSignup);

// weconnectServer.post('/apis/v1/auth-test', passportConfig.isAuthenticated, personApiController.postTestAuth);
weconnectServer.post('/apis/v1/auth-test', personApiController.postTestAuth);
weconnectServer.post('/apis/v1/login', personApiController.postLogin);
weconnectServer.post('/apis/v1/signup', personApiController.postSignup);

/**
 * API examples routes.
 */
weconnectServer.get('/api', apiController.getApi);
weconnectServer.get('/api/lastfm', apiController.getLastfm);
weconnectServer.get('/api/nyt', apiController.getNewYorkTimes);
weconnectServer.get('/api/steam', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getSteam);
weconnectServer.get('/api/stripe', apiController.getStripe);
weconnectServer.post('/api/stripe', apiController.postStripe);
weconnectServer.get('/api/scraping', apiController.getScraping);
// app.get('/api/twilio', apiController.getTwilio);
// app.post('/api/twilio', apiController.postTwilio);
weconnectServer.get('/api/foursquare', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getFoursquare);
weconnectServer.get('/api/tumblr', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getTumblr);
weconnectServer.get('/api/facebook', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getFacebook);
weconnectServer.get('/api/github', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getGithub);
weconnectServer.get('/api/twitch', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getTwitch);
weconnectServer.get('/api/paypal', apiController.getPayPal);
weconnectServer.get('/api/paypal/success', apiController.getPayPalSuccess);
weconnectServer.get('/api/paypal/cancel', apiController.getPayPalCancel);
weconnectServer.get('/api/lob', apiController.getLob);
weconnectServer.get('/api/upload', lusca({ csrf: true }), apiController.getFileUpload);
weconnectServer.post('/api/upload', upload.single('myFile'), lusca({ csrf: true }), apiController.postFileUpload);
weconnectServer.get('/api/pinterest', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getPinterest);
weconnectServer.post('/api/pinterest', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.postPinterest);
weconnectServer.get('/api/here-maps', apiController.getHereMaps);
weconnectServer.get('/api/google-maps', apiController.getGoogleMaps);
weconnectServer.get('/api/google/drive', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getGoogleDrive);
weconnectServer.get('/api/chart', apiController.getChart);
weconnectServer.get('/api/google/sheets', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getGoogleSheets);
weconnectServer.get('/api/quickbooks', passportConfig.isAuthenticated, passportConfig.isAuthorized, apiController.getQuickbooks);

/**
 * OAuth authentication routes. (Sign in)
 */
weconnectServer.get('/auth/snapchat', passport.authenticate('snapchat'));
weconnectServer.get('/auth/snapchat/callback', passport.authenticate('snapchat', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
weconnectServer.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'public_profile']}));
weconnectServer.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
weconnectServer.get('/auth/github', passport.authenticate('github'));
weconnectServer.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
weconnectServer.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets.readonly'], accessType: 'offline', prompt: 'consent' }));
weconnectServer.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
weconnectServer.get('/auth/twitter', passport.authenticate('twitter'));
weconnectServer.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
weconnectServer.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'SOME STATE' }));
weconnectServer.get('/auth/linkedin/callback', passport.authenticate('linkedin', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});
weconnectServer.get('/auth/twitch', passport.authenticate('twitch', {}));
weconnectServer.get('/auth/twitch/callback', passport.authenticate('twitch', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo || '/');
});

/**
 * OAuth authorization routes. (API examples)
 */
weconnectServer.get('/auth/foursquare', passport.authorize('foursquare'));
weconnectServer.get('/auth/foursquare/callback', passport.authorize('foursquare', { failureRedirect: '/api' }), (req, res) => {
  res.redirect('/api/foursquare');
});
weconnectServer.get('/auth/tumblr', passport.authorize('tumblr'));
weconnectServer.get('/auth/tumblr/callback', passport.authorize('tumblr', { failureRedirect: '/api' }), (req, res) => {
  res.redirect('/api/tumblr');
});
weconnectServer.get('/auth/steam', passport.authorize('steam-openid', { state: 'SOME STATE' }));
weconnectServer.get('/auth/steam/callback', passport.authorize('steam-openid', { failureRedirect: '/api' }), (req, res) => {
  res.redirect(req.session.returnTo);
});
weconnectServer.get('/auth/pinterest', passport.authorize('pinterest', { scope: 'read_public write_public' }));
weconnectServer.get('/auth/pinterest/callback', passport.authorize('pinterest', { failureRedirect: '/login' }), (req, res) => {
  res.redirect('/api/pinterest');
});
weconnectServer.get('/auth/quickbooks', passport.authorize('quickbooks', { scope: ['com.intuit.quickbooks.accounting'], state: 'SOME STATE' }));
weconnectServer.get('/auth/quickbooks/callback', passport.authorize('quickbooks', { failureRedirect: '/login' }), (req, res) => {
  res.redirect(req.session.returnTo);
});

/**
 * Error Handler.
 */
weconnectServer.use((req, res) => {
  const err = new Error('Not Found');
  err.status = 404;
  res.status(404).send('Page Not Found');
});

if (process.env.NODE_ENV === 'development') {
  // only use in development
  weconnectServer.use(errorHandler());
} else {
  weconnectServer.use((err, req, res) => {
    console.error(err);
    res.status(500).send('Server Error');
  });
}

/**
 * Start Express server.
 */
weconnectServer.listen(weconnectServer.get('port'), () => {
  const { BASE_URL } = process.env;
  const colonIndex = BASE_URL.lastIndexOf(':');
  const port = parseInt(BASE_URL.slice(colonIndex + 1), 10);

  if (!BASE_URL.startsWith('http://localhost')) {
    console.log(`The BASE_URL env variable is set to ${BASE_URL}. If you directly test the application through http://localhost:${weconnectServer.get('port')} instead of the BASE_URL, it may cause a CSRF mismatch or an Oauth authentication failure. To avoid the issues, change the BASE_URL or configure your proxy to match it.\n`);
  } else if (parseInt(weconnectServer.get('port')) !== port) {
    console.warn(`WARNING: The BASE_URL environment variable and the App have a port mismatch. If you plan to view the app in your browser using the localhost address, you may need to adjust one of the ports to make them match. BASE_URL: ${BASE_URL}\n`);
  }

  console.log(`App is running on http://localhost:${weconnectServer.get('port')} in ${weconnectServer.get('env')} mode.`);
  console.log('Press CTRL-C to stop.');
});

module.exports = weconnectServer;
