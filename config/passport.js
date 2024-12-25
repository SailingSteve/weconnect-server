/* eslint-disable no-param-reassign */
/* eslint-disable consistent-return */
const passport = require('passport');
const refresh = require('passport-oauth2-refresh');
const axios = require('axios');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: FacebookStrategy } = require('passport-facebook');
const { Strategy: SnapchatStrategy } = require('passport-snapchat');
const { Strategy: TwitterStrategy } = require('@passport-js/passport-twitter');
const { Strategy: TwitchStrategy } = require('twitch-passport');
const { Strategy: GitHubStrategy } = require('passport-github2');
const { OAuth2Strategy: GoogleStrategy } = require('passport-google-oauth');
const { Strategy: LinkedInStrategy } = require('passport-linkedin-oauth2');
const { SteamOpenIdStrategy } = require('passport-steam-openid');
const { OAuthStrategy } = require('passport-oauth');
const { OAuth2Strategy } = require('passport-oauth');
const _ = require('lodash');
const moment = require('moment');
const { findPersonById, findOnePerson, comparePassword, createUser, saveUser } = require('../models/personModel');

// https://medium.com/@prashantramnyc/node-js-with-passport-authentication-simplified-76ca65ee91e5#id_token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjU2NGZlYWNlYzNlYmRmYWE3MzExYjlkOGU3M2M0MjgxOGYyOTEyNjQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIyMTYyOTYwMzU4MzQtazFrNnFlMDYwczJ0cDJhMmphbTRsamRjbXMwMHN0dGcuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiIyMTYyOTYwMzU4MzQtazFrNnFlMDYwczJ0cDJhMmphbTRsamRjbXMwMHN0dGcuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDIzOTA2NDQ0MjQ4MzM3NzQ5MzciLCJlbWFpbCI6InN0ZXZlcG9kZWxsMzdAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5iZiI6MTczNDg5ODgxNSwibmFtZSI6IlN0ZXZlIFBvZGVsbCIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NKMlJPWVd6RjVfdGhIbnA5UzVmYndFRy1idGN5T1lOdmFVRktuNmEwN2JYcWI1eXZndz1zOTYtYyIsImdpdmVuX25hbWUiOiJTdGV2ZSIsImZhbWlseV9uYW1lIjoiUG9kZWxsIiwiaWF0IjoxNzM0ODk5MTE1LCJleHAiOjE3MzQ5MDI3MTUsImp0aSI6IjhmYWE2NDU3ZTdmMGFiOGRjOWIzZjgzNjU1OTkxNzA4NTcyYTRjMWUifQ.BiNYnXFRCB2u_p7mOWev-cVeVBvHXArS30fgGLh09apwOZZiIdUrjfXA94twoaLhtrYWG9Op02-CliCV-ddgby6Ej8vrXHYK4hnGlAsaUbsjxB-6ayaj_LTP3C2eBIaU5n2yRoee3K30qR5Br8_ZGrYbObjEz8ESUVgM-_YSIbnTZlZFNrM5eL4q_SwAMfNjS4aIRpfRtOuCjn_4VbTBNTA6dQfPvPF3vh2BIE9uGVsoOVWbML-H5YdJIOGiGNOt-VbdTChusNraAgrrhClYdlJVaHl3diJgzqXLZPfnzRzbcpb0a3XLO62PXtOHxl3sW6_oF_xqUATOFcgb6SR4ug

/* Convert a user object into a session object, passport should be storing this object on the server
1. "express-session" creates a "req.session" object, when it is invoked via app.use(session({..}))
2. "passport" then adds an additional object "req.session.passport" to this "req.session".
3. All the serializeUser() function does is, receives the "authenticated user" object from the "Strategy" framework, and attach the authenticated user to "req.session.passport.user.{..}"
*/
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/* retrieve user data from session
  1. Passport JS conveniently populates the "userObj" value in the deserializeUser() with the object attached at the end of "req.session.passport.user.{..}"
  2. When the done (null, user) function is called in the deserializeUser(), Passport JS takes this last object attached to "req.session.passport.user.{..}",
     and attaches it to "req.user" i.e "req.user.{..}"
     In our case, since after calling the done() in "serializeUser" we had req.session.passport.user.{id: 123, email: "kyle@wevote.us"},
     calling the done() in the "deserializeUser" will take that last object that was attached to req.session.passport.user.{..} and attach to req.user.{..}
     i.e. req.user.{id: 123, email: "kyle@wevote.us"}
  3. So "req.user" will contain the authenticated user object for that session, and you can use it in any of the routes in the Node JS app.
*/
passport.deserializeUser(async (id, done) => {
  try {
    return done(null, await findPersonById(id));
  } catch (error) {
    return done(error);
  }
});

exports.ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    return res.send(401);
  }
};


/**
 * Sign in using Email and Password.
 * authenticate a user, and return the "authenticated user".
 */
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
  findOnePerson({ emailPersonal: email.toLowerCase() }, true)
    .then((user) => {
      if (!user) {
        return done(null, false, { msg: `Email ${email} not found.` });
      }
      if (!user.password) {
        return done(null, false, { msg: 'Your account was registered using a sign-in provider. To enable password login, sign in using a provider, and then set a password under your user profile.' });
      }
      comparePassword(user, password, (err, isMatch) => {
        if (err) { return done(err); }
        if (isMatch) {
          // The “done()” function is then used to pass the “{authenticated_user}” to the serializeUser() function.
          return done(null, user);
        }
        return done(null, false, { msg: 'Invalid email or password.' });
      });
    })
    .catch((err) => done(err));
}));





// =================== not currently used ==============




/**
 * OAuth Strategy Overview
 *
 * - User is already logged in.
 *   - Check if there is an existing account with a provider id.
 *     - If there is, return an error message. (Account merging not supported)
 *     - Else link new OAuth account with currently logged-in user.
 * - User is not logged in.
 *   - Check if it's a returning user.
 *     - If returning user, sign in and we are done.
 *     - Else check if there is an existing account with user's email.
 *       - If there is, return an error message.
 *       - Else create a new account.
 */

/**
 * Sign in with Snapchat.
 */
passport.use(new SnapchatStrategy({
  clientID: process.env.SNAPCHAT_ID,
  clientSecret: process.env.SNAPCHAT_SECRET,
  callbackURL: '/auth/snapchat/callback',
  profileFields: ['id', 'displayName', 'bitmoji'],
  scope: ['user.display_name', 'user.bitmoji.avatar'],
  passReqToCallback: true,
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    if (req.user) {
      const existingUser = await findOnePerson({ snapchat: profile.id });
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Snapchat account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        return done(null, existingUser);
      }
      const user = await findPersonById(req.user.id);
      user.snapchat = profile.id;
      user.tokens.push({ kind: 'snapchat', accessToken });
      user.name = user.name || profile.displayName;
      user.picture = user.picture || profile.bitmoji.avatarUrl;
      await saveUser(user);
      req.flash('info', { msg: 'Snapchat account has been linked.' });
      return done(null, user);
    }
    const existingUser = await findOnePerson({ snapchat: profile.id });
    if (existingUser) {
      return done(null, existingUser);
    }
    const user = createUser();
    // Assign a temporary e-mail address
    // to get on with the registration process. It can be changed later
    // to a valid e-mail address in Profile Management.
    user.email = `${profile.id}@snapchat.com`;
    user.snapchat = profile.id;
    user.tokens.push({ kind: 'snapchat', accessToken });
    user.name = profile.displayName;
    user.picture = profile.bitmoji.avatarUrl;
    await saveUser(user);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

/**
 * Sign in with Facebook.
 */
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_ID,
  clientSecret: process.env.FACEBOOK_SECRET,
  callbackURL: `${process.env.BASE_URL}/auth/facebook/callback`,
  profileFields: ['name', 'email', 'link', 'locale', 'timezone', 'gender'],
  passReqToCallback: true,
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    if (req.user) {
      const existingUser = await findOnePerson({ facebook: profile.id });
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Facebook account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        return done(null, existingUser);
      }
      const user = await findPersonById(req.user.id);
      user.facebook = profile.id;
      user.tokens.push({ kind: 'facebook', accessToken });
      user.name = user.name || `${profile.name.givenName} ${profile.name.familyName}`;
      user.gender = user.gender || profile._json.gender;
      user.picture = user.picture || `https://graph.facebook.com/${profile.id}/picture?type=large`;
      await saveUser(user);
      req.flash('info', { msg: 'Facebook account has been linked.' });
      return done(null, user);
    }
    const existingUser = await findOnePerson({ facebook: profile.id });
    if (existingUser) {
      return done(null, existingUser);
    }
    const existingEmailUser = await findOnePerson({ email: profile._json.email });
    if (existingEmailUser) {
      req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Facebook manually from Account Settings.' });
      return done(null, existingEmailUser);
    }
    const user = createUser();
    user.email = profile._json.email;
    user.facebook = profile.id;
    user.tokens.push({ kind: 'facebook', accessToken });
    user.name = `${profile.name.givenName} ${profile.name.familyName}`;
    user.gender = profile._json.gender;
    user.picture = `https://graph.facebook.com/${profile.id}/picture?type=large`;
    user.location = profile._json.location ? profile._json.location.name : '';
    await saveUser(user);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

/**
 * Sign in with GitHub.
 */
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_ID,
  clientSecret: process.env.GITHUB_SECRET,
  callbackURL: `${process.env.BASE_URL}/auth/github/callback`,
  passReqToCallback: true,
  scope: ['user:email'],
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    if (req.user) {
      const existingUser = await findOnePerson({ github: profile.id });
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a GitHub account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        return done(null, existingUser);
      }
      const user = await findPersonById(req.user.id);
      user.github = profile.id;
      user.tokens.push({ kind: 'github', accessToken });
      user.name = user.name || profile.displayName;
      user.picture = user.picture || profile._json.avatar_url;
      user.location = user.location || profile._json.location;
      user.website = user.website || profile._json.blog;
      await saveUser(user);
      req.flash('info', { msg: 'GitHub account has been linked.' });
      return done(null, user);
    }
    const existingUser = await findOnePerson({ github: profile.id });
    if (existingUser) {
      return done(null, existingUser);
    }
    const emailValue = _.get(_.orderBy(profile.emails, ['primary', 'verified'], ['desc', 'desc']), [0, 'value'], null);
    if (profile._json.email === null) {
      const existingEmailUser = await findOnePerson({ email: emailValue });

      if (existingEmailUser) {
        req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with GitHub manually from Account Settings.' });
        return done(null, existingEmailUser);
      }
    } else {
      const existingEmailUser = await findOnePerson({ email: profile._json.email });
      if (existingEmailUser) {
        req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with GitHub manually from Account Settings.' });
        return done(null, existingEmailUser);
      }
    }
    const user = createUser();
    user.email = emailValue;
    user.github = profile.id;
    user.tokens.push({ kind: 'github', accessToken });
    user.name = profile.displayName;
    user.picture = profile._json.avatar_url;
    user.location = profile._json.location;
    user.website = profile._json.blog;
    await saveUser(user);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

/**
 * Sign in with Twitter.
 */
passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_KEY,
  consumerSecret: process.env.TWITTER_SECRET,
  callbackURL: `${process.env.BASE_URL}/auth/twitter/callback`,
  passReqToCallback: true,
}, async (req, accessToken, tokenSecret, profile, done) => {
  try {
    if (req.user) {
      const existingUser = await findOnePerson({ twitter: profile.id });
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Twitter account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        return done(null, existingUser);
      }
      const user = await findPersonById(req.user.id);
      user.twitter = profile.id;
      user.tokens.push({ kind: 'twitter', accessToken, tokenSecret });
      user.name = user.name || profile.displayName;
      user.location = user.location || profile._json.location;
      user.picture = user.picture || profile._json.profile_image_url_https;
      await saveUser(user);
      req.flash('info', { msg: 'Twitter account has been linked.' });
      return done(null, user);
    }
    const existingUser = await findOnePerson({ twitter: profile.id });
    if (existingUser) {
      return done(null, existingUser);
    }
    const user = createUser();
    // Twitter will not provide an email address.  Period.
    // But a person’s twitter username is guaranteed to be unique
    // so we can "fake" a twitter email address as follows:
    user.email = `${profile.username}@twitter.com`;
    user.twitter = profile.id;
    user.tokens.push({ kind: 'twitter', accessToken, tokenSecret });
    user.name = profile.displayName;
    user.location = profile._json.location;
    user.picture = profile._json.profile_image_url_https;
    await saveUser(user);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

/**
 * Sign in with Google.
 */
const googleStrategyConfig = new GoogleStrategy({
  clientID: process.env.GOOGLE_ID,
  clientSecret: process.env.GOOGLE_SECRET,
  callbackURL: '/auth/google/callback',
  passReqToCallback: true,
}, async (req, accessToken, refreshToken, params, profile, done) => {
  try {
    if (req.user) {
      const existingUser = await findOnePerson({ google: profile.id });
      if (existingUser && (existingUser.id !== req.user.id)) {
        req.flash('errors', { msg: 'There is already a Google account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        return done(null, existingUser);
      }
      const user = await findPersonById(req.user.id);
      user.google = profile.id;
      user.tokens.push({
        kind: 'google',
        accessToken,
        accessTokenExpires: moment().add(params.expires_in, 'seconds').format(),
        refreshToken,
      });
      user.name = user.name || profile.displayName;
      user.gender = user.gender || profile._json.gender;
      user.picture = user.picture || profile._json.picture;
      await saveUser(user);
      req.flash('info', { msg: 'Google account has been linked.' });
      return done(null, user);
    }
    const existingUser = await findOnePerson({ google: profile.id });
    if (existingUser) {
      return done(null, existingUser);
    }
    const existingEmailUser = await findOnePerson({ email: profile.emails[0].value });
    if (existingEmailUser) {
      req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Google manually from Account Settings.' });
      return done(null, existingEmailUser);
    }
    const user = createUser();
    user.email = profile.emails[0].value;
    user.google = profile.id;
    user.tokens.push({
      kind: 'google',
      accessToken,
      accessTokenExpires: moment().add(params.expires_in, 'seconds').format(),
      refreshToken,
    });
    user.name = profile.displayName;
    user.gender = profile._json.gender;
    user.picture = profile._json.picture;
    await saveUser(user);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
});
passport.use('google', googleStrategyConfig);
refresh.use('google', googleStrategyConfig);

/**
 * Sign in with LinkedIn.
 */
passport.use(new LinkedInStrategy({
  clientID: process.env.LINKEDIN_ID,
  clientSecret: process.env.LINKEDIN_SECRET,
  callbackURL: `${process.env.BASE_URL}/auth/linkedin/callback`,
  scope: ['r_liteprofile', 'r_emailaddress'],
  passReqToCallback: true,
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    if (req.user) {
      const existingUser = await findOnePerson({ linkedin: profile.id });
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a LinkedIn account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        return done(null, existingUser);
      }
      const user = await findPersonById(req.user.id);
      user.linkedin = profile.id;
      user.tokens.push({ kind: 'linkedin', accessToken });
      user.name = user.name || profile.displayName;
      user.picture = user.picture || profile.photos[3].value;
      await saveUser(user);
      req.flash('info', { msg: 'LinkedIn account has been linked.' });
      return done(null, user);
    }
    const existingUser = await findOnePerson({ linkedin: profile.id });
    if (existingUser) {
      return done(null, existingUser);
    }
    const existingEmailUser = await findOnePerson({ email: profile.emails[0].value });
    if (existingEmailUser) {
      req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with LinkedIn manually from Account Settings.' });
      return done(null, existingEmailUser);
    }
    const user = createUser();
    user.linkedin = profile.id;
    user.tokens.push({ kind: 'linkedin', accessToken });
    user.email = profile.emails[0].value;
    user.name = profile.displayName;
    user.picture = user.picture || profile.photos[3].value;
    await saveUser(user);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

/**
 * Twitch API OAuth.
 */
const twitchStrategyConfig = new TwitchStrategy({
  clientID: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
  callbackURL: `${process.env.BASE_URL}/auth/twitch/callback`,
  scope: ['user_read', 'chat:read', 'chat:edit', 'whispers:read', 'whispers:edit', 'user:read:email'],
  passReqToCallback: true,
}, async (req, accessToken, refreshToken, params, profile, done) => {
  try {
    if (req.user) {
      const existingUser = await findOnePerson({ twitch: profile.id });
      if (existingUser && existingUser.id !== req.user.id) {
        req.flash('errors', { msg: 'There is already a Twitch account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        return done(null, existingUser);
      }
      const user = await findPersonById(req.user.id);
      user.twitch = profile.id;
      user.tokens.push({
        kind: 'twitch',
        accessToken,
        accessTokenExpires: moment().add(params.expires_in, 'seconds').format(),
        refreshToken,
      });
      user.name = user.name || profile.display_name;
      user.email = user.gender || profile.email;
      user.picture = user.picture || profile.profile_image_url;
      await saveUser(user);
      req.flash('info', { msg: 'Twitch account has been linked.' });
      return done(null, user);
    }
    const existingUser = await findOnePerson({ twitch: profile.id });
    if (existingUser) {
      return done(null, existingUser);
    }
    const existingEmailUser = await findOnePerson({ email: profile.email });
    if (existingEmailUser) {
      req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Twitch manually from Account Settings.' });
      return done(null, existingEmailUser);
    }
    const user = createUser();
    user.email = profile.email;
    user.twitch = profile.id;
    user.tokens.push({
      kind: 'twitch',
      accessToken,
      accessTokenExpires: moment().add(params.expires_in, 'seconds').format(),
      refreshToken,
    });
    user.name = profile.display_name;
    user.email = profile.email;
    user.picture = profile.profile_image_url;
    await saveUser(user);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
});
passport.use('twitch', twitchStrategyConfig);
refresh.use('twitch', twitchStrategyConfig);

/**
 * Tumblr API OAuth.
 */
passport.use('tumblr', new OAuthStrategy(
  {
    requestTokenURL: 'https://www.tumblr.com/oauth/request_token',
    accessTokenURL: 'https://www.tumblr.com/oauth/access_token',
    userAuthorizationURL: 'https://www.tumblr.com/oauth/authorize',
    consumerKey: process.env.TUMBLR_KEY,
    consumerSecret: process.env.TUMBLR_SECRET,
    callbackURL: '/auth/tumblr/callback',
    passReqToCallback: true,
  },
  async (req, token, tokenSecret, profile, done) => {
    try {
      const user = await findPersonById(req.user._id);
      user.tokens.push({ kind: 'tumblr', accessToken: token, tokenSecret });
      await saveUser(user);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  },
));

/**
 * Foursquare API OAuth.
 */
passport.use('foursquare', new OAuth2Strategy(
  {
    authorizationURL: 'https://foursquare.com/oauth2/authorize',
    tokenURL: 'https://foursquare.com/oauth2/access_token',
    clientID: process.env.FOURSQUARE_ID,
    clientSecret: process.env.FOURSQUARE_SECRET,
    callbackURL: `${process.env.BASE_URL}/auth/foursquare/callback`,
    passReqToCallback: true,
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const user = await findPersonById(req.user._id);
      user.tokens.push({ kind: 'foursquare', accessToken });
      await saveUser(user);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  },
));

/**
 * Steam API OpenID.
 */
passport.use(new SteamOpenIdStrategy({
  apiKey: process.env.STEAM_KEY,
  returnURL: `${process.env.BASE_URL}/auth/steam/callback`,
  profile: true,
}, async (req, identifier, profile, done) => {
  const steamId = identifier.match(/\d+$/)[0];
  const profileURL = `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${process.env.STEAM_KEY}&steamids=${steamId}`;
  try {
    if (req.user) {
      const existingUser = await findOnePerson({ steam: steamId });
      if (existingUser) {
        req.flash('errors', { msg: 'There is already an account associated with the SteamID. Sign in with that account or delete it, then link it with your current account.' });
        return done(null, existingUser);
      }
      const user = await findPersonById(req.user.id);
      user.steam = steamId;
      user.tokens.push({ kind: 'steam', accessToken: steamId });
      try {
        const res = await axios.get(profileURL);
        const profileData = res.data.response.players[0];
        user.name = user.name || profileData.personaname;
        user.picture = user.picture || profileData.avatarmedium;
        await saveUser(user);
        return done(null, user);
      } catch (err) {
        console.log(err);
        await saveUser(user);
        return done(err, user);
      }
    } else {
      try {
        const { data } = await axios.get(profileURL);
        const profileData = data.response.players[0];
        const user = createUser();
        user.steam = steamId;
        user.email = `${steamId}@steam.com`; // steam does not disclose emails, prevent duplicate keys
        user.tokens.push({ kind: 'steam', accessToken: steamId });
        user.name = profileData.personaname;
        user.picture = profileData.avatarmedium;
        await saveUser(user);
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  } catch (err) {
    return done(err);
  }
}));

/**
 * Pinterest API OAuth.
 */
passport.use('pinterest', new OAuth2Strategy(
  {
    authorizationURL: 'https://api.pinterest.com/oauth/',
    tokenURL: 'https://api.pinterest.com/v1/oauth/token',
    clientID: process.env.PINTEREST_ID,
    clientSecret: process.env.PINTEREST_SECRET,
    callbackURL: `${process.env.BASE_URL}/auth/pinterest/callback`,
    passReqToCallback: true,
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOnePerson(req.user._id);
      user.tokens.push({ kind: 'pinterest', accessToken });
      await saveUser();
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  },
));

/**
 * Intuit/QuickBooks API OAuth.
 */
const quickbooksStrategyConfig = new OAuth2Strategy(
  {
    authorizationURL: 'https://appcenter.intuit.com/connect/oauth2',
    tokenURL: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    clientID: process.env.QUICKBOOKS_CLIENT_ID,
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL}/auth/quickbooks/callback`,
    passReqToCallback: true,
  },
  async (req, accessToken, refreshToken, params, profile, done) => {
    try {
      const user = await findPersonById(req.user._id);
      user.quickbooks = req.query.realmId;
      const quickbooksToken = user.tokens.find((vendor) => vendor.kind === 'quickbooks');
      if (quickbooksToken) {
        quickbooksToken.accessToken = accessToken;
        quickbooksToken.accessTokenExpires = moment().add(params.expires_in, 'seconds').format();
        quickbooksToken.refreshToken = refreshToken;
        quickbooksToken.refreshTokenExpires = moment().add(params.x_refresh_token_expires_in, 'seconds').format();
        if (params.expires_in) quickbooksToken.accessTokenExpires = moment().add(params.expires_in, 'seconds').format();
      } else {
        user.tokens.push({
          kind: 'quickbooks',
          accessToken,
          accessTokenExpires: moment().add(params.expires_in, 'seconds').format(),
          refreshToken,
          refreshTokenExpires: moment().add(params.x_refresh_token_expires_in, 'seconds').format(),
        });
      }
      user.markModified('tokens');
      await saveUser(user);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  },
);
passport.use('quickbooks', quickbooksStrategyConfig);
refresh.use('quickbooks', quickbooksStrategyConfig);

/**
 * Login Required middleware.
 */
exports.isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};

/**
 * Authorization Required middleware.
 */
exports.isAuthorized = async (req, res, next) => {
  const provider = req.path.split('/')[2];
  // eslint-disable-next-line no-shadow
  const token = req.user.tokens.find((token) => token.kind === provider);
  if (token) {
    if (token.accessTokenExpires && moment(token.accessTokenExpires).isBefore(moment().subtract(1, 'minutes'))) {
      if (token.refreshToken) {
        if (token.refreshTokenExpires && moment(token.refreshTokenExpires).isBefore(moment().subtract(1, 'minutes'))) {
          return res.redirect(`/auth/${provider}`);
        }
        try {
          const newTokens = await new Promise((resolve, reject) => {
            refresh.requestNewAccessToken(`${provider}`, token.refreshToken, (err, accessToken, refreshToken, params) => {
              if (err) reject(err);
              resolve({ accessToken, refreshToken, params });
            });
          });

          req.user.tokens.forEach((tokenObject) => {
            if (tokenObject.kind === provider) {
              tokenObject.accessToken = newTokens.accessToken;
              if (newTokens.params.expires_in) tokenObject.accessTokenExpires = moment().add(newTokens.params.expires_in, 'seconds').format();
            }
          });

          await saveUser(req.user);
          return next();
        } catch (err) {
          console.log(err);
          return next();
        }
      } else {
        return res.redirect(`/auth/${provider}`);
      }
    } else {
      return next();
    }
  } else {
    return res.redirect(`/auth/${provider}`);
  }
};
