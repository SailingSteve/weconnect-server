/**
 * Module dependencies.
 */
const path = require('path');
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const bodyParser = require('body-parser');
const logger = require('morgan');
const errorHandler = require('errorhandler');
const lusca = require('lusca');
const dotenv = require('dotenv');
const flash = require('express-flash');
const passport = require('passport');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { gravatar } = require('./models/prismaUser');

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
const userController = require('./controllers/user');
const apiController = require('./controllers/api');
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
 * Connect to MongoDB.
 */
// mongoose.connect(process.env.MONGODB_URI);
// mongoose.connection.on('error', (err) => {
//   console.error(err);
//   console.log('%s MongoDB connection error. Please make sure MongoDB is running.');
//   process.exit();
// });

/**
 * Express configuration.
 */
weconnectServer.set('host', process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0');
weconnectServer.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 3000);
weconnectServer.set('views', path.join(__dirname, 'views'));
weconnectServer.set('view engine', 'pug');
weconnectServer.locals.gravatar = gravatar;       // for pug
weconnectServer.set('trust proxy', numberOfProxies);
weconnectServer.use(compression());
weconnectServer.use(logger('dev'));
weconnectServer.use(bodyParser.json());
weconnectServer.use(bodyParser.urlencoded({ extended: true }));
weconnectServer.use(limiter);

weconnectServer.use(session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  name: 'startercookie', // change the cookie name for additional security in production
  cookie: {
    maxAge: 1209600000, // Two weeks in milliseconds
    secure: secureTransfer,
    allowlist: [{ path: '/localhost', type: 'exact' }, { path: '/summary', type: 'startWith' }],
  },
  // store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
}));
weconnectServer.use(passport.initialize());
weconnectServer.use(passport.session());
weconnectServer.use(flash());
dotenv.config({ path: '.env.config' });
// TODO: This allowlist is a hack around a csrf.js issue, where login was blocked by a csrf mismatch.  I suspect that we have an unresolved Lusca setup issue.
weconnectServer.use(lusca({
  allowlist: ['/login', '/signup'],
}));


weconnectServer.use((req, res, next) => {
  if (req.path === '/api/upload') {
    // Multer multipart/form-data handling needs to occur before the Lusca CSRF check.
    next();
  } else {
    lusca.csrf({ allowlist: ['/login', '/signup']})(req, res, next);
    // lusca.csrf()(req, res, next);
  }
});
weconnectServer.use(lusca.xframe('SAMEORIGIN'));
weconnectServer.use(lusca.xssProtection(true));
weconnectServer.disable('x-powered-by');
weconnectServer.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
weconnectServer.use((req, res, next) => {
  // After successful login, redirect back to the intended page
  if (!req.user &&
    req.path !== '/login' &&
    req.path !== '/signup' &&
    !req.path.match(/^\/auth/) &&
    !req.path.match(/\./)) {
    req.session.returnTo = req.originalUrl;
  } else if (req.user &&
    (req.path === '/account' || req.path.match(/^\/api/))) {
    req.session.returnTo = req.originalUrl;
  }
  next();
});
weconnectServer.use('/', express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));
weconnectServer.use('/js/lib', express.static(path.join(__dirname, 'node_modules/chart.js/dist'), { maxAge: 31557600000 }));
weconnectServer.use('/js/lib', express.static(path.join(__dirname, 'node_modules/popper.js/dist/umd'), { maxAge: 31557600000 }));
weconnectServer.use('/js/lib', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js'), { maxAge: 31557600000 }));
weconnectServer.use('/js/lib', express.static(path.join(__dirname, 'node_modules/jquery/dist'), { maxAge: 31557600000 }));
weconnectServer.use('/webfonts', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free/webfonts'), { maxAge: 31557600000 }));

/**
 * Primary app routes.
 */
weconnectServer.get('/', homeController.index);
weconnectServer.get('/login', userController.getLogin);
weconnectServer.post('/login', userController.postLogin);
weconnectServer.get('/logout', userController.logout);
weconnectServer.get('/forgot', userController.getForgot);
weconnectServer.post('/forgot', userController.postForgot);
weconnectServer.get('/reset/:token', userController.getReset);
weconnectServer.post('/reset/:token', userController.postReset);
weconnectServer.get('/signup', userController.getSignup);
weconnectServer.post('/signup', userController.postSignup);
weconnectServer.get('/contact', contactController.getContact);
weconnectServer.post('/contact', contactController.postContact);
weconnectServer.get('/account/verify', passportConfig.isAuthenticated, userController.getVerifyEmail);
weconnectServer.get('/account/verify/:token', passportConfig.isAuthenticated, userController.getVerifyEmailToken);
weconnectServer.get('/account', passportConfig.isAuthenticated, userController.getAccount);
weconnectServer.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
weconnectServer.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
weconnectServer.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
weconnectServer.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);

/**
 * WeConnect API routes.
 */
weconnectServer.get('/api/v1/retrieve-team', teamApiController.retrieveTeam);

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
// eslint-disable-next-line no-unused-vars
weconnectServer.use((req, res, next) => {
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
