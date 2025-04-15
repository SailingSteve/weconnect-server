// weconnect-server/controllers/personApiController.js
const bcrypt = require('@node-rs/bcrypt');
const validator = require('validator');
const passport = require('passport');
const { getAllAccessRightsForPerson, personCanSeeOrDo } = require('./personController');
const {
  createPerson, createPersonAway, findPersonListByParams, getAccessRightsForPerson, PERSON_AWAY_FIELDS_ACCEPTED,
  PERSON_FIELDS_ACCEPTED, PERSON_FIELDS_ACCEPTED_ADMIN,
  removeProtectedFieldsFromPerson, removeProtectedFieldsFromPersonAway,
  findOnePerson, findPersonById, savePerson, savePersonAway,
  getUniqueKeyEmail,
  manuallyConfirmEmailUniqueness,
} = require('../models/personModel');

const { extractVariablesToChangeFromIncomingParams } = require('./dataTransformationUtils');
const { viewerCanSeeOrDoForThisTeamMember } = require('./teamController');
const { getTeamAccessRightsForPerson, updateOrCreateTeamMember } = require('../models/teamModel');
const { convertToInteger } = require('../utils/convertToInteger');
const { sendEmailValidationCode } = require('./sendEmailController');
const { createSessionRecord, getPersonIdBySessionId, deleteOneSessionRecord } = require('../models/clientSessionModel');

/**
 * GET /api/v1/person-away-save
 */
exports.personAwaySave = async (request, response) => {
  let shouldCreatePersonAway = false;
  let shouldUpdatePersonAway = false;
  const results = await getAllAccessRightsForPerson(request);
  const { accessRights, personIdsByTeam, teamAccessRights, viewerPersonId } = results;
  // console.log('personAwaySave accessRights: ', accessRights);
  const parsedUrl = new URL(request.url, `${process.env.BASE_URL}`);
  const queryParams = new URLSearchParams(parsedUrl.search);
  const personAwayId = convertToInteger(queryParams.get('personAwayId'));
  const personId = convertToInteger(queryParams.get('personId'));

  // See if this viewer has accessRights
  const isEditingSelf = viewerPersonId === personId;
  const canEditPersonAnyone = await personCanSeeOrDo('canEditPersonAnyone', accessRights);
  // See if this person is in a team this viewer has teamAccessRights for.
  const canEditPersonThisTeam = await viewerCanSeeOrDoForThisTeamMember('canEditPersonThisTeam', personId, teamAccessRights, personIdsByTeam);
  const canAddPersonAway = canEditPersonAnyone || canEditPersonThisTeam || isEditingSelf;
  const canEditPersonAway = canEditPersonAnyone || canEditPersonThisTeam || isEditingSelf;
  const personAwayChangeDict = extractVariablesToChangeFromIncomingParams(
    queryParams,
    PERSON_AWAY_FIELDS_ACCEPTED,
  );
  personAwayChangeDict.personId = personId;
  personAwayChangeDict.reportedByPersonId = viewerPersonId;

  // Set up the default JSON response.
  const jsonData = {
    personAwayCreated: false,
    personAwayId: -1,
    personId: -1,
    personAwayUpdated: false,
    reportedByPersonId: -1,
    status: '',
    success: true,
    updateErrors: [],
  };
  try {
    jsonData.personAwayId = personAwayId;
    jsonData.personId = personId;
    jsonData.reportedByPersonId = viewerPersonId;
    jsonData.success = true;
    const keys = Object.keys(personAwayChangeDict);
    const values = Object.values(personAwayChangeDict);
    for (let i = 0; i < keys.length; i++) {
      jsonData[keys[i]] = values[i];
    }
  } catch (err) {
    jsonData.status += err.message;
    jsonData.success = false;
  }

  try {
    if (personAwayId >= 0) {
      jsonData.status += 'PERSON_AWAY_FOUND ';
      shouldUpdatePersonAway = true;
    } else {
      jsonData.status += 'PERSON_AWAY_TO_BE_CREATED ';
      shouldCreatePersonAway = true;
    }

    if (shouldCreatePersonAway) {
      if (canAddPersonAway) {
        const personAway = await createPersonAway(personAwayChangeDict);
        jsonData.personAwayId = personAway.id;
        // console.log('Created new personAway:', personAway);
        jsonData.personAwayCreated = true;
        jsonData.status += 'PERSON_AWAY_CREATED ';
        const modifiedPersonAwayDict = removeProtectedFieldsFromPersonAway(personAway);
        const personAwayKeys = Object.keys(modifiedPersonAwayDict);
        const personAwayValues = Object.values(modifiedPersonAwayDict);
        for (let i = 0; i < personAwayKeys.length; i++) {
          jsonData[personAwayKeys[i]] = personAwayValues[i];
        }
      } else {
        jsonData.displayErrorMessage = true;
        jsonData.personAwayCreated = false;
        jsonData.status += 'canAddPersonAway-PERMISSION_DENIED ';
        jsonData.success = false;
      }
    } else if (shouldUpdatePersonAway) {
      if (canEditPersonAway) {
        personAwayChangeDict.id = personAwayId;
        // console.log('Updating personAway:', personAwayChangeDict);
        const personAway = await savePersonAway(personAwayChangeDict);
        jsonData.personAwayUpdated = true;
        jsonData.personAwayId = personAway.id;
        jsonData.status += 'PERSON_AWAY_UPDATED ';
        const modifiedPersonAwayDict = removeProtectedFieldsFromPersonAway(personAway);
        const personAwayKeys = Object.keys(modifiedPersonAwayDict);
        const personAwayValues = Object.values(modifiedPersonAwayDict);
        for (let i = 0; i < personAwayKeys.length; i++) {
          jsonData[personAwayKeys[i]] = personAwayValues[i];
        }
      } else {
        jsonData.displayErrorMessage = true;
        jsonData.personAwayUpdated = false;
        jsonData.status += 'canEditPersonAnyone-OR-canEditPersonThisTeam-PERMISSION_DENIED ';
        jsonData.success = false;
      }
    }
  } catch (err) {
    console.error('Error while saving personAway:', err);
    jsonData.displayErrorMessage = true;
    jsonData.status += err.message;
    jsonData.success = false;
    jsonData.updateErrors.push('Missing required field: TBD');
  }
  response.json(jsonData);
};


/**
 * GET /api/v1/person-list-retrieve
 * Retrieve a list of people.
 */
exports.personListRetrieve = async (request, response) => {
  const parsedUrl = new URL(request.url, `${process.env.BASE_URL}`);
  const queryParams = new URLSearchParams(parsedUrl.search);
  const searchText = queryParams.get('searchText');

  const jsonData = {
    isSearching: false,
    personList: [],
    status: '',
    success: true,
  };
  try {
    const params = {};
    if (searchText) {
      jsonData.isSearching = true;
      params.OR = [
        { firstName: { contains: searchText, mode: 'insensitive' } },
        { firstNamePreferred: { contains: searchText, mode: 'insensitive' } },
        { lastName: { contains: searchText, mode: 'insensitive' } },
        { emailPersonal: { contains: searchText, mode: 'insensitive' } },
      ];
    }
    const personList = await findPersonListByParams(params);
    // const person = personList.find((per) => per.personId === parseInt(1));
    // console.log('personFromAPI person.firstNamePreferred: ', person.firstNamePreferred);
    jsonData.success = true;
    if (personList) {
      jsonData.personList = personList;
      jsonData.status += 'PERSON_LIST_FOUND ';
    } else {
      jsonData.status += 'PERSON_LIST_NOT_FOUND ';
    }
  } catch (err) {
    jsonData.status += err.message;
    jsonData.success = false;
  }
  response.json(jsonData);
};

/**
 * GET /api/v1/person-retrieve-by-email
 * Retrieve one person by email.
 */
exports.personRetrieveByEmail = async (request, response) => {
  const parsedUrl = new URL(request.url, `${process.env.BASE_URL}`);
  const queryParams = new URLSearchParams(parsedUrl.search);
  const emailPersonal = queryParams.get('emailPersonal');
  let filteredPerson = {};
  try {
    const person = await findOnePerson({ emailPersonal });
    filteredPerson = removeProtectedFieldsFromPerson(person);
    filteredPerson.status = '';
    filteredPerson.success = true;
  } catch (err) {
    filteredPerson.status = err.message;
    filteredPerson.success = false;
  }
  response.json(filteredPerson);
};

/**
 * GET /api/v1/person-retrieve
 * Retrieve one person by id.
 */
exports.personRetrieve = async (request, response) => {
  const parsedUrl = new URL(request.url, `${process.env.BASE_URL}`);
  const queryParams = new URLSearchParams(parsedUrl.search);
  const personIdRaw = queryParams.get('personId');
  const personIdInteger = convertToInteger(queryParams.get('personId'));

  // Compare personIdRaw and personIdInteger as strings
  const personIdRawString = String(personIdRaw);
  const personIdIntegerString = String(personIdInteger);
  const idsMatch = personIdRawString === personIdIntegerString;
  const personId = idsMatch ? personIdInteger : -1;

  // const searchText = queryParams.get('searchText');

  const jsonData = {
    status: '',
    success: true,
    personFound: false,
  };
  try {
    const params = Object.fromEntries(queryParams.entries());
    let person;
    // console.log('personRetrieve personId: ', personId);
    if (personId >= 0) {
      // console.log('personRetrieve findPersonById personId raw: ', personId);
      person = await findPersonById(personId);
    } else if (Object.keys(params).length) {
      if (params.searchText) {
        delete params.searchText;
      }
      // jsonData.isSearching = true;
      // params.OR = [
      //   { firstName: { contains: searchText, mode: 'insensitive' } },
      //   { firstNamePreferred: { contains: searchText, mode: 'insensitive' } },
      //   { lastName: { contains: searchText, mode: 'insensitive' } },
      //   { emailPersonal: { contains: searchText, mode: 'insensitive' } },
      // ];
      // TODO filter out params that are not in PERSON_FIELDS_ACCEPTED - not currently working
      // Please leave for Dale to debug
      // console.log('personRetrieve params BEFORE: ', params);
      // const filteredParams = extractSearchParamsFromIncomingParams(params, PERSON_FIELDS_ACCEPTED);
      // console.log('personRetrieve filteredParams AFTER: ', filteredParams);
      // person = await findOnePerson(filteredParams);
    }
    jsonData.success = true;
    if (person && Object.keys(person).length) {
      jsonData.personFound = true;
      jsonData.personId = person.id;
      const keys = Object.keys(person);
      const values = Object.values(person);
      for (let i = 0; i < keys.length; i++) {
        jsonData[keys[i]] = values[i];
      }
      jsonData.status += 'PERSON_FOUND ';
    } else {
      jsonData.status += 'PERSON_NOT_FOUND ';
    }
  } catch (err) {
    jsonData.status += err.message;
    jsonData.success = false;
  }
  response.json(jsonData);
};

// Replacing checkIsAdmin with /controllers/personController.js getAllAccessRightsForPerson and personCanSeeOrDo
// Still using this for on-server access rights check
exports.checkIsAdmin = async (req) => {
  const isAuthenticated = req.isAuthenticated();
  const personId = await getPersonIdBySessionId(req.sessionID || 0);
  const person = personId ? await findPersonById(personId || 0, true) : undefined;
  if (!person) {
    console.error('Undefined person in checkIsAdmin isAuthenticated: ', isAuthenticated);
    return false;
  }
  // superusers allow access to grant admin rights, in a blank DB, or after a misconfiguration.
  const superUsers = ['dale.mcgrew@wevote.us', 'steve.podell@wevote.us']; // Feel free to revise

  return {
    isAdmin: person.isAdmin || superUsers.includes(person.emailPersonal.trim()),
    person,
  };
};

/**
 * GET /api/v1/person-save
 */
exports.personSave = async (request, response) => {
  let shouldCreatePerson = false;
  let shouldUpdatePerson = false;

  // const userIsAdmin = await checkIsAdmin(request);
  //
  // const searchFragment = request.url.substring(request.url.indexOf('?') + 1);
  // const urlSearchParams = new URLSearchParams(searchFragment);
  // const params = Object.fromEntries(urlSearchParams.entries());
  //
  // let personId = convertToInteger(params?.id || params.personId);
  // const teamName = params?.teamName;
  // const teamIdText = params?.teamId || 0;
  // const teamId = convertToInteger(teamIdText) || 0;
  // const teamMemberFirstName = params?.firstNameToBeSaved;
  // const teamMemberLastName = params?.lastNameToBeSaved;
  // const personChangeDict = extractVariablesToChangeFromIncomingParamsObject(
  //   params,
  //   userIsAdmin ? PERSON_FIELDS_ACCEPTED_ADMIN : PERSON_FIELDS_ACCEPTED,
  // );
  // if (personChangeDict.password) {
  //   personChangeDict.password = await bcrypt.hash(personChangeDict.password, 10);
  // }

  const results = await getAllAccessRightsForPerson(request);
  const { accessRights, personIdsByTeam, teamAccessRights } = results;
  // console.log('personSave accessRights: ', accessRights);
  const parsedUrl = new URL(request.url, `${process.env.BASE_URL}`);
  const queryParams = new URLSearchParams(parsedUrl.search);
  let personId = convertToInteger(queryParams.get('personId'));
  const teamId = convertToInteger(queryParams.get('teamId'));
  const teamName = queryParams.get('teamName');
  const teamMemberFirstName = queryParams.get('firstNameToBeSaved');
  const teamMemberLastName = queryParams.get('lastNameToBeSaved');

  // See if this viewer has accessRights
  const canAddPerson = await personCanSeeOrDo('canAddPerson', accessRights);
  const canAddTeamMemberAnyTeam = await personCanSeeOrDo('canAddTeamMemberAnyTeam', accessRights);
  // const canEditPermissionsAnyone = await personCanSeeOrDo('canEditPermissionsAnyone', accessRights);
  const canEditPersonAnyone = await personCanSeeOrDo('canEditPersonAnyone', accessRights);
  // See if this person is in a team this viewer has teamAccessRights for.
  const canEditPersonThisTeam = await viewerCanSeeOrDoForThisTeamMember('canEditPersonThisTeam', personId, teamAccessRights, personIdsByTeam);
  const canEditPerson = canEditPersonAnyone || canEditPersonThisTeam;
  const personChangeDict = extractVariablesToChangeFromIncomingParams(
    queryParams,
    canEditPerson ? PERSON_FIELDS_ACCEPTED_ADMIN : PERSON_FIELDS_ACCEPTED,
  );
  if (personChangeDict.password) {
    personChangeDict.password = await bcrypt.hash(personChangeDict.password, 10);
  }
  // Set up the default JSON response.
  const jsonData = {
    addPersonToTeamSuccessful: false,
    personCreated: false,
    personId: -1,
    personUpdated: false,
    status: '',
    success: true,
    updateErrors: [],
  };
  try {
    jsonData.personId = personId;
    jsonData.success = true;
    const keys = Object.keys(personChangeDict);
    const values = Object.values(personChangeDict);
    for (let i = 0; i < keys.length; i++) {
      jsonData[keys[i]] = values[i];
    }
  } catch (err) {
    jsonData.status += err.message;
    jsonData.success = false;
  }

  try {
    if (personId >= 0) {
      jsonData.status += 'PERSON_FOUND ';
      shouldUpdatePerson = true;
    } else {
      // TODO make sure a person with exact firstName/lastName or emailPersonal doesn't already exist in the database
      jsonData.status += 'PERSON_TO_BE_CREATED ';
      shouldCreatePerson = true;
    }

    if (shouldCreatePerson) {
      if (canAddPerson) {
        const canInsertEmailOfficial = await manuallyConfirmEmailUniqueness({ emailOfficial: personChangeDict?.emailOfficial });
        const canInsertEmailPreferred = await manuallyConfirmEmailUniqueness({ emailPreferred: personChangeDict?.emailPreferred });
        if (!canInsertEmailOfficial || !canInsertEmailPreferred) {
          jsonData.displayErrorMessage = true;
          jsonData.personCreated = false;
          jsonData.status += 'canAddPerson-NON_UNIQUE_EMAIL ';
          jsonData.success = false;
          jsonData.updateErrors.push('Email is not unique: ', !canInsertEmailOfficial ? 'emailOfficial' : 'emailPreferred');
        } else {
          const tempPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
          personChangeDict.password = await bcrypt.hash(tempPassword, 10);
          const person = await createPerson(personChangeDict);
          personId = person.id;
          // console.log('Created new person:', person);
          jsonData.personCreated = true;
          jsonData.personId = person.id;
          jsonData.status += 'PERSON_CREATED ';
          const modifiedPersonDict = removeProtectedFieldsFromPerson(person);
          const personKeys = Object.keys(modifiedPersonDict);
          const personValues = Object.values(modifiedPersonDict);
          for (let i = 0; i < personKeys.length; i++) {
            jsonData[personKeys[i]] = personValues[i];
          }
        }
      } else {
        jsonData.displayErrorMessage = true;
        jsonData.personCreated = false;
        jsonData.status += 'canAddPerson-PERMISSION_DENIED ';
        jsonData.success = false;
      }
    } else if (shouldUpdatePerson) {
      if (canEditPerson || ('password' in personChangeDict)) {   // Have to let a person change their password
        personChangeDict.id = personId;
        // console.log('Updating person:', personChangeDict);
        const person = await savePerson(personChangeDict);
        jsonData.personUpdated = true;
        jsonData.personId = person.id;
        jsonData.status += 'PERSON_UPDATED ';
        const modifiedPersonDict = removeProtectedFieldsFromPerson(person);
        const personKeys = Object.keys(modifiedPersonDict);
        const personValues = Object.values(modifiedPersonDict);
        for (let i = 0; i < personKeys.length; i++) {
          jsonData[personKeys[i]] = personValues[i];
        }
      } else {
        jsonData.displayErrorMessage = true;
        jsonData.personUpdated = false;
        jsonData.status += 'canEditPersonAnyone-OR-canEditPersonThisTeam-PERMISSION_DENIED ';
        jsonData.success = false;
      }
    }
  } catch (err) {
    console.error('Error while saving person:', err);
    jsonData.displayErrorMessage = true;
    jsonData.status += err.message;
    jsonData.success = false;
    jsonData.updateErrors.push('Missing required field: emailPersonal');
  }
  try {
    if (personId >= 0 && teamId >= 0 && jsonData.personCreated) {
      // Add the person to the team
      if (canAddTeamMemberAnyTeam) {
        const teamMemberChangeDict = {
          teamMemberFirstName,
          teamMemberLastName,
          teamName,
        };
        await updateOrCreateTeamMember(personId, teamId, teamMemberChangeDict);
        jsonData.addPersonToTeamSuccessful = true;
      } else {
        jsonData.displayErrorMessage = true;
        jsonData.addPersonToTeamSuccessful = false;
        jsonData.status += 'canAddTeamMemberAnyTeam-PERMISSION_DENIED ';
        jsonData.success = false;
      }
    }
  } catch (err) {
    console.error('Error while adding person to team:', err);
    jsonData.status += err.message;
    jsonData.success = false;
  }

  response.json(jsonData);
};

/**
 * POST /signup
 * Create a new local account.
 */
// eslint-disable-next-line consistent-return
exports.signup = async (req, res) => {
  const validationErrors = [];
  if (!validator.isEmail(req.body.emailPersonal)) validationErrors.push({ msg: 'Please enter a valid primary email address.' });
  if (!validator.isLength(req.body.password, { min: 8 })) validationErrors.push({ msg: 'Password must be at least 8 characters long' });
  if (validator.escape(req.body.password) !== validator.escape(req.body.confirmPassword)) validationErrors.push({ msg: 'Passwords do not match' });
  if (validationErrors.length) {
    return res.json({
      personCreated: false,
      errors: validationErrors,
      personId: -1,
      person: undefined,
      signedIn: false,
    });
  }
  req.body.email = validator.normalizeEmail(req.body.emailPersonal, { gmail_remove_dots: false });
  try {
    const existingPerson = await findOnePerson({ emailPersonal: req.body.emailPersonal }, true);
    if (existingPerson) {
      validationErrors.push({ msg: 'A person with the same primary email already exists' });
      return res.json({
        personCreated: false,
        errors: validationErrors,
        personId: -1,
        person: undefined,
        signedIn: false,
      });
    }

    const canInsertEmailOfficial = await manuallyConfirmEmailUniqueness({ emailOfficial: req.body.emailPersonal });
    const canInsertEmailPreferred = await manuallyConfirmEmailUniqueness({ emailPreferred: req.body.emailPreferred });
    if (!canInsertEmailOfficial || !canInsertEmailPreferred) {
      const msg = `Email is not unique: ${!canInsertEmailOfficial ? 'emailOfficial' : 'emailPreferred'}`;
      validationErrors.push({ msg });
      return res.json({
        personCreated: false,
        errors: validationErrors,
        personId: -1,
        person: undefined,
        signedIn: false,
      });
    }

    const encryptedPwd = await bcrypt.hash(req.body.password, 10);
    const person = await createPerson({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      location: req.body.location,
      emailPersonal: req.body.emailPersonal,
      emailOfficial: req.body.emailOfficial,
      password: encryptedPwd,
    });
    req.logIn(person, (err) => {
      if (err) {
        validationErrors.push({ msg: err });
        return res.json({
          personCreated: false,
          errors: validationErrors,
          personId: -1,
          person: undefined,
          signedIn: false,
        });
      }
      const filteredPerson = removeProtectedFieldsFromPerson(person);
      return res.json({
        personCreated: true,
        errors: validationErrors.toString(),
        personId: person.id,
        person: filteredPerson,
        signedIn: true,
      });
    });
  } catch (err) {
    validationErrors.push({ msg: err });
    res.json({
      personCreated: false,
      errors: validationErrors,
      personId: -1,
      person: undefined,
      signedIn: false,
    });
  }
};

/**
 * POST /apis/v1/login
 * Sign in using email and password.
 */
exports.login = async (req, res, next) => {
  // console.log('test top in login, isAuthenticated: ', req.isAuthenticated());
  req.body.email = await getUniqueKeyEmail(req.body.email);
  req.body.personalEmail = req.body.email;

  // eslint-disable-next-line consistent-return
  passport.authenticate('local', (err, authenticatedPerson, info) => {
    if (err) { return next(err); }
    if (!authenticatedPerson) {
      // Converting from a pug redirect to an API response ... req.flash('errors', info);
      // Converting from a pug redirect to an API response ... return res.redirect('/login');
      return res.json({
        emailVerified: false,
        error: info,
        personId: -1,
        signedIn: false,
        person: '',
      });
    }
    req.logIn(authenticatedPerson, (err2) => {
      if (err2) {
        const msg = info + err2;
        res.json({
          emailVerified: false,
          error: msg,
          personId: -1,
          signedIn: false,
          person: '',
        });
      }

      console.log('login createSessionRecord req.sessionID', req.sessionID);
      createSessionRecord(authenticatedPerson.id, req.sessionID, req.useragent.source);
      const filteredPerson = removeProtectedFieldsFromPerson(authenticatedPerson);
      res.json({
        emailVerified: filteredPerson.emailVerified,
        errors: [],
        personId: filteredPerson.id,
        signedIn: true,
        person: filteredPerson,
      });
    });
  })(req, res, next);
};

/**
 * POST /apis/v1/send-email-code
 * Send a verification code to the 'person's email
 */
exports.sendEmailCode = async (req, res) => {
  const { personId } = req.body;

  const person = await findPersonById(personId, true);   // For now, just use person.emailPersonal
  const data = sendEmailValidationCode(person);
  return res.json(data);
};

exports.verifyEmailCode = async (req, res) => {
  const { personId, code } = req.body;

  const person = await findPersonById(personId, true);
  if (parseInt(code) === parseInt(person.emailVerificationToken)) {
    console.log('verifyEmailCode token matched code');
    const person2 = await savePerson({ id: personId, emailVerified: true });
    await createSessionRecord(personId, req.sessionID, req.useragent.source);
    console.log('verifyEmailCode token matched person2.personId: ', person2.id, personId);
    return res.json({
      personId: person2.id,
      emailVerified: person2.emailVerified,
    });
  } else {
    console.log('verifyEmailCode token DID NOT MATCH incoming code: ', code, person.emailVerificationToken, person.id);
    return res.json({
      personId,
      emailVerified: false,
    });
  }
};

/**
 * POST /apis/v1/save-password
 * Change the signed in person's password, with checks for security
 */
exports.savePassword = async (req, res) => {
  const { personId, password } = req.body;

  const person = await findPersonById(personId, true);
  // const personIdFromSession = await getPersonIdBySessionId(req.sessionID)  || person.personId;
  const personIdFromSession = personId;  // TODO: can't get the session until they are signed in, so if not signed in...

  if (person.personId !== personIdFromSession || !person.emailVerified) {
    const error = person.personId !== personIdFromSession ?
      'POTENTIAL_MAN_IN_MIDDLE: Can only change the password for the user of their session' :
      'Can only change the password for the user with a verified email';
    console.error(error);
    return res.json({
      personId,
      person: undefined,
      error,
    });
  }

  console.log('Updating person password:', password);
  const personToSave = {};
  personToSave.id = person.id;
  personToSave.password = await bcrypt.hash(password, 10);
  const personFromSave = await savePerson(personToSave);
  const filteredPerson = removeProtectedFieldsFromPerson(personFromSave);

  return res.json({
    personId,
    person: filteredPerson,
    error: '',
  });
};


/**
 * POST /logout
 * Log out.
 */
exports.logout = async (req, res) => {
  await deleteOneSessionRecord(req.sessionID);
  req.logout((err) => {
    if (err) console.log('Error : Failed to logout req.logout: ', err);
  });
  // This might be unnecessary (or harmful in the future) https://stackoverflow.com/a/14277819/1893089
  req.session.destroy((err) => {
    if (err) console.log('Error : Failed to logout req.session.destroy: ', err);
  });
  return res.json({
    authenticated: req.isAuthenticated(),
  });
};

exports.getAuth = async (req, res) => {
  /* Passport JS conveniently provides a “req.isAuthenticated()” function, that
       returns “true” in case an authenticated user is present in “req.session.passport.user”, or
       returns “false” in case no authenticated user is present in “req.session.passport.user”.
   */
  let isAuthenticated = req.isAuthenticated();
  const personId = await getPersonIdBySessionId(req.sessionID || 0);
  if (personId > 0 && !isAuthenticated) {
    isAuthenticated = true;             // 2/23/25 This is a hack, for after reset password, to be investigated
  }
  // console.log('getAuth personId from sessionId', personId, req.sessionID);
  const person = personId > 0 ? await findPersonById(personId) : undefined;
  const emailVerified = person && personId > 0 && person.emailVerified;
  const accessRights = getAccessRightsForPerson(person);
  const teamAccessRights = await getTeamAccessRightsForPerson(person);

  return res.json({
    emailVerified,
    accessRights,
    isAuthenticated,
    person,
    personId,
    teamAccessRights,
  });
};
