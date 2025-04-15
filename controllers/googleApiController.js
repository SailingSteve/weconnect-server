const path = require('path');
const { google } = require('googleapis');
// const res = require('express/lib/response');

// Key urls for admin, drive, datatransfer, & user apis
// https://admin.google.com/u/6/ac/accountsettings
// https://console.cloud.google.com/welcome?pli=1&invt=AbtsZg&project=weconnectserverapp
// https://admin.google.com/ac/owl/domainwidedelegation
// https://developers.google.com/workspace/explore?filter=&discoveryUrl=https%3A%2F%2Fadmin.googleapis.com%2F%24discovery%2Frest%3Fversion%3Ddirectory_v1&discoveryRef=resources.users.methods.list&operationId=directory.users.list
// https://developers.google.com/oauthplayground/?code=4/0AQSTgQHDpbfkg5jq3NbzIRhHzNcVQTJI3fbYtr38NoJyZhgJl15uWcq-aGKLCbBJPZa4Sw&scope=https://www.googleapis.com/auth/admin.directory.user%20https://www.googleapis.com/auth/cloud-platform
// https://www.npmjs.com/package/googleapis
// https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list?apix_params=%7B%22includeTeamDriveItems%22%3Atrue%2C%22supportsTeamDrives%22%3Atrue%7D
// https://developers.google.com/oauthplayground/   to generate a bearer token for curl tests of apis

const getAuth = async () => {
  let auth;
  // console.log('Getting auth process.env.GOOGLE_SUPER_ADMIN_EMAIL:', process.env.GOOGLE_SUPER_ADMIN_EMAIL);
  // Note on scopes: Need to add new ones to https://admin.google.com/ac/owl/domainwidedelegation
  // and (rarely needed) enable the API at https://console.cloud.google.com/apis/dashboard?invt=Abuqxg&project=weconnectserverapp
  await google.auth.getClient({
    keyFile: path.join(__dirname, '../jwt.keys.json'),
    scopes: [
      'https://www.googleapis.com/auth/admin.directory.group',
      'https://www.googleapis.com/auth/admin.directory.group.member',
      'https://www.googleapis.com/auth/admin.directory.user',
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/admin.datatransfer',
    ],
    clientOptions: {
      subject: process.env.GOOGLE_SUPER_ADMIN_EMAIL,
    },
  }).then(
    (authReturned) => {
      auth = authReturned;
      // console.log('Sign-in successful');
    },
    (err) => { console.error('Error signing in', err); },
  );
  return auth;
};

/**
 * Get info about one user.
 *
 * @param adminClient
 * @param primaryEmail
 */
async function getOneUser (adminClient, primaryEmail) {
  const res = await adminClient.users.list({
    customer: 'my_customer',
    maxResults: 500,   // when we go over 500, will need to page with nextPageToken
    orderBy: 'email',
    query: `email=${primaryEmail}`,
  });

  const { users } = res.data;
  if (!users || users.length === 0) {
    console.log('No users found.');
    return [];
  }
  const user = users[0];
  // console.log(`User: ${user.primaryEmail} (${user.name.fullName})`);
  return user;
}


/**
 * Lists the first 500 users in the domain.
 *
 * @param adminClient
 */
async function listUsers (adminClient) {
  const res = await adminClient.users.list({
    customer: 'my_customer',
    maxResults: 500,   // when we exceed 500 active staff, will need to page with nextPageToken
    orderBy: 'email',
  });

  const { users } = res.data;
  if (!users || users.length === 0) {
    console.log('No users found.');
    return [];
  }

  // console.log('Users:');
  const brief = [];
  users.forEach((user) => {
    brief.push(`${user.primaryEmail} (${user.name.fullName})`);
    // console.log(`${user.primaryEmail} (${user.name.fullName})`);
  });
  return brief;
}

/**
 * Create a user in the domain.
 *
 * @param {admin_directory_v1.Admin} adminClient
 * @param primaryEmail
 * @param firstName
 * @param lastName
 * @param password
 * @param phoneNumber
 */
async function createUser (adminClient, primaryEmail, firstName, lastName, password, phoneNumber) {
  const user = {
    kind: 'admin_directory#user',
    primaryEmail,
    password,
    name: {
      givenName: firstName,
      familyName: lastName,
    },
    phones: [
      {
        value: phoneNumber,
        type: 'work',
      },
      {
        value: phoneNumber,
        type: 'mobile',
      },
    ],
  };
  const ret = {};

  try {
    const res = await adminClient.users.insert({
      resource: user,
    });
    console.log(res.data);
    ret.success = true;
    ret.primaryEmail = primaryEmail;
    ret.error = '';
    ret.errorCode = '';
    ret.errors = '';
  } catch (err) {
    ret.success = false;
    ret.primaryEmail = primaryEmail;
    ret.error = err.message;
    ret.errorCode = err.code;
    ret.errors = JSON.stringify(err.errors);
  }
  return ret;
}

/**
 * Delete a user in the domain.
 *
 * @param adminClient
 * @param primaryEmail
 */
async function deleteUser (adminClient, primaryEmail) {
  const ret = {};

  // Construct request
  const request = {
    userKey: primaryEmail,
  };

  // Run request
  try {
    const res = await adminClient.users.delete(request);
    console.log(res);
    console.log(res.data);
    ret.success = true;
    ret.primaryEmail = primaryEmail;
    ret.error = '';
    ret.errorCode = '';
    ret.errors = '';
  } catch (err) {
    ret.success = false;
    ret.primaryEmail = primaryEmail;
    ret.error = err.message;
    ret.error = err.message;
    ret.errorCode = err.code;
    ret.errors = JSON.stringify(err.errors);
    // console.error(err);
  }
  return ret;
}

/**
 * List all the files shared with a user in Drive for wevoteeducation.org
 * The drive MUST BE SHARED with the user in GOOGLE_SUPER_ADMIN_EMAIL for this API call to return anything
 * @param driveClient
 */
async function listDriveFiles (driveClient) {
  let res;
  let filesToReturn = [];
  try {
    res = await driveClient.files.list({
      includeTeamDriveItems: true,
      supportsTeamDrives: true,
      // queryTerm,
      // pageSize: 10, // Set the desired number of files to retrieve
      // fields: 'files(name, id)', // Specify the fields to include in the response
    });
    const { files } = res.data;
    console.log(files);
    filesToReturn = files;
  } catch (err) {
    console.log('ERROR listDriveFiles:', err);
  }
  return filesToReturn;
}

/**
 * Get the id for a folder in Drive for wevoteeducation.org
 * The drive MUST BE SHARED with the user in GOOGLE_SUPER_ADMIN_EMAIL for this API call to return anything
 * @param driveClient
 * @param directory, for example 'Engineering, WVE'
 */
async function driveIdForDirectory (driveClient, directory) {
  let res;
  let fileId = '';
  const query = ''; //`(mimeType='application/vnd.google-apps.folder' and name='${directory.trim()}')`;
  // const query = `name='${directory.trim()}'`;

  try {
    res = await driveClient.files.list({
      includeTeamDriveItems: true,
      supportsTeamDrives: true,
      q: query,
    });
    const { files } = res.data;
    if (files.length > 0) {
      console.log(files);
      fileId = files[0].id;
    }
  } catch (err) {
    console.log('ERROR driveIdForDirectory:', err);
  }
  return fileId;
}

/**
 * Reset a user's password
 *
 * @param adminClient
 * @param primaryEmail
 * @param newPassword
 */
async function resetUserPassword (adminClient, primaryEmail, newPassword) {
  const ret = {};

  // Construct request
  const requestBody = {
    userKey: primaryEmail,
    requestBody: {
      password: newPassword,
      passwordResetType: 'ADMIN_INITIATED',
      // forcePasswordChange: true, // Optional: Force the user to change the password on next login
    },
  };

  // Run request
  try {
    const res = await adminClient.users.update({
      userKey: primaryEmail,
      resource: requestBody,
    });
    console.log('User password updated:', res.data);
    console.log(res);
    ret.primaryEmail = primaryEmail;
    ret.success = true;
    ret.error = '';
    ret.errorCode = '';
    ret.errors = '';
  } catch (err) {
    ret.success = false;
    ret.primaryEmail = primaryEmail;
    ret.error = err.message;
    ret.error = err.message;
    ret.errorCode = err.code;
    ret.errors = JSON.stringify(err.errors);
    console.error(err);
  }
  return ret;
}

async function getDataTransferApplicationResourceId (transferClient) {
  try {
    const serverResponse = await transferClient.applications.list();
    const app = serverResponse.data.applications.find((appElement) => appElement.name === 'Drive and Docs');
    return app.id;
  } catch (e) {
    console.log('ERROR transferClient.applications.list:', e);
    return '';
  }
}

/**
 * Transfer a user's ownership of files and folders to a new user
 * https://developers.google.com/workspace/admin/data-transfer/v1/transfer-data
 *
 * @param adminClient
 * @param oldOwnerUserId
 * @param newOwnerEmail
 */
async function transferDriveFilesAndFoldersOwnership (adminClient, transferClient, oldOwnersEmail, newOwnersEmail) {
  let serverResponse = {};

  const oldOwner = await getOneUser(adminClient, oldOwnersEmail);
  const oldOwnerUserId = oldOwner.id;
  const newOwner = await getOneUser(adminClient, newOwnersEmail);
  const newOwnerUserId = newOwner.id;

  console.log('transferDriveFilesAndFoldersOwnership: ', oldOwner, oldOwnerUserId, newOwner, newOwnerUserId);

  // TODO error checking

  // 4/11/25 posted: https://stackoverflow.com/questions/79569838/ownership-transfer-of-google-drive-files-using-the-node-api-fails-with-missing
  // https://www.google.com/search?q=Google+Docs+and+Google+Drive+Application+ID
  // https://developers.google.com/workspace/explore?filter=&discoveryUrl=https%3A%2F%2Fadmin.googleapis.com%2F%24discovery%2Frest%3Fversion%3Ddatatransfer_v1&discoveryRef=resources.transfers.methods.insert&operationId=datatransfer.transfers.insert

  const applicationId = await getDataTransferApplicationResourceId(transferClient);

  const requestBody = {
    kind: 'admin#datatransfer#DataTransfer',
    oldOwnerUserId,
    newOwnerUserId,
    applicationDataTransfers: [{
      applicationId,
      // In some dart code from github, /// [customerId] - Immutable ID of the Google Workspace account. (is passed into the insert request)
      // applicationId: '103626277937150531336', // Service account, Unique ID:  jwt.keys.json ... '"You'll be provided with a Client ID and Client Secret. The Client ID is the application ID you need."
      // applicationId: '0B4Sb2OJjaaGOfk53TmxCV3F6bnpQaGVhNGdFdEZ5MU1FZ2o2bl9obEpIUlhMN2Y3cjlGTEk', // from the url
      // applicationId: '435070579839',  // https://developers.google.com/workspace/admin/data-transfer/v1/transfer-data
      // applicationId: '55656082996',  // Google Docs and Google Drive (Application ID: 55656082996), same for all api users The https://developers.google.com/workspace/admin/data-transfer/v1/parameters
      // applicationId: 1008827788717,  // The Client ID from https://console.cloud.google.com/welcome?pli=1&invt=AbugjA&project=weconnectserverapp
      // applicationId: 103626277937150531336,  // The Client ID from https://admin.google.com/ac/owl/domainwidedelegation
      applicationTransferParams: [
        {
          key: 'RELEASE_RESOURCES',
          value: [
            'TRUE',
          ],
        },
        {
          key: 'PRIVACY_LEVEL',
          value: [
            'PRIVATE',
            'SHARED',
          ],
        },
      ],
    }],
  };

  try {
    serverResponse = await transferClient.transfers.insert(requestBody);
  } catch (e) {
    console.log('ERROR driveDriveFilesAndFoldersOwnership:', e);
  }
  console.log('transferDriveFilesAndFoldersOwnership:', serverResponse);

  return serverResponse;
}

/**
 * GET /api/v1/google-get-user-list
 * Use the Google Admin SDK Directory API to add a new user to the WeVote Google organization
 */
exports.googleGetUserInfo = async (request, response) => {
  const { primaryEmail } = request.body;
  const auth = await getAuth();
  const adminClient = google.admin({ version: 'directory_v1', auth });
  const user = await getOneUser(adminClient, primaryEmail);
  let ret;
  if (user.length === 0) {
    ret = {
      success: false,
      error: 'User not found',
    };
  } else {
    ret = {
      success: true,
      firstName: user.name.givenName,
      lastName: user.name.familyName,
      fullName: user.name.fullName,
      phoneNumber: user.phones[0].value,
      primaryEmail: user.emails[0].address,
      lastLoginTime: user.lastLoginTime,
      isMailboxSetup: user.isMailboxSetup,
      thumbnailPhotoUrl: user.thumbnailPhotoUrl,
      // Less important
      creationTime: user.creationTime,
      changePasswordAtNextLogin: user.changePasswordAtNextLogin,
      agreedToTerms: user.agreedToTerms,
      archived: user.archived,
      googleUserId: user.id,
      isAdmin: user.isAdmin,
      isDelegatedAdmin: user.isDelegatedAdmin,
      isSuspended: user.suspended,
    };
  }
  return response.json(ret);
};

/**
 * GET /api/v1/google-get-user-list
 * Use the Google Admin SDK Directory API to add a new user to the WeVote Google organization
 */
exports.googleGetUserList = async (request, response) => {
  const auth = await getAuth();
  const adminClient = google.admin({ version: 'directory_v1', auth });
  const users = await listUsers(adminClient);

  return response.json(users);
};

/**
 * GET /apis/v1/google-create-user
 * Use the Google Admin SDK Directory API to add a new user to the WeVote Google organization
 */
exports.googleCreateUserAccount = async (request, response) => {
  const { primaryEmail, firstName, lastName, password, phoneNumber } = request.body;
  const auth = await getAuth();
  const adminClient = google.admin({ version: 'directory_v1', auth });
  const ret = await createUser(adminClient, primaryEmail, firstName, lastName, password, phoneNumber);

  return response.json(ret);
};

/**
 * GET /api/v1/google-delete-user
 * Use the Google Admin SDK Directory API to delete a user from the WeVote Google organization
 */
exports.googleDeleteUserAccount = async (request, response) => {
  const { primaryEmail } = request.body;
  const auth = await getAuth();
  const adminClient = google.admin({ version: 'directory_v1', auth });
  const ret = await deleteUser(adminClient, primaryEmail);

  return response.json(ret);
};

/**
 * POST /apis/v1/google-reset-user-password
 * Use the Google Admin SDK Directory API to reset a user's Google password
 */
exports.googleResetUserPassword = async (request, response) => {
  const { primaryEmail, newPassword } = request.body;
  const auth = await getAuth();
  const adminClient = google.admin({ version: 'directory_v1', auth });
  const ret = await resetUserPassword(adminClient, primaryEmail, newPassword);

  return response.json(ret);
};

/**
 * POST /apis/v1/google-drive-list-files
 * Use the Google Drive SDK Directory API to list the files in the drive
 */
exports.googleDriveListFiles = async (request, response) => {
  const auth = await getAuth();
  const driveClient = google.drive({ version: 'v3', auth });
  const filesToReturn = await listDriveFiles(driveClient);
  return response.json(filesToReturn);
};

/**
 * POST /apis/v1/google-share-drive-access
 * Use the Google Drive SDK Directory API to grant access (share) directories in the drive
 */
exports.googleShareDriveAccess = async (request, response) => {
  const { primaryEmail, driveFolder, role } = request.body;
  let success = false;
  let error = '';
  const auth = await getAuth();
  const driveClient = google.drive({ version: 'v3', auth });
  const driveFolderId = await driveIdForDirectory(driveClient, driveFolder);
  if (driveFolderId.length === 0) {
    success = false;
    error = 'Unable to find drive folder';
  } else {
    try {
      const res = await driveClient.permissions.create({
        fileId: driveFolderId,
        requestBody: {
          type: 'user',         // Or 'group'
          role,                 // 'reader', 'commenter', 'writer', or 'owner'
          emailAddress: primaryEmail,
        },
        fields: 'id',
      });
      console.log(`File shared with ${primaryEmail} (Permission ID: ${res.data.id})`);
      success = true;
    } catch (err) {
      error = `Error sharing file: ${err}`;
      console.error(error);
    }
  }
  return response.json({
    success,
    driveFolder,
    driveFolderId,
    error,
  });
};

/**
 * POST /apis/v1/google-revoke-drive-access
 * Use the Google Drive SDK Directory API to grant access (share) directories in the drive
 * https://stackoverflow.com/questions/65227750/how-to-execute-data-transfer-api
 * Always transfer ownership when revoking
 */
exports.googleRevokeDriveAccess = async (request, response) => {
  const { oldOwnersEmail, newOwnersEmail } = request.body;
  let success = false;
  let error = '';
  const primaryEmail = oldOwnersEmail;
  const auth = await getAuth();
  // Waiting for response https://stackoverflow.com/questions/79569838/ownership-transfer-of-google-drive-files-using-the-node-api-fails-with-missing
  const adminClient = google.admin({ version: 'directory_v1', auth });
  const transferClient = google.admin({ version: 'datatransfer_v1', auth });
  const ret = await transferDriveFilesAndFoldersOwnership(adminClient, transferClient, oldOwnersEmail, newOwnersEmail);
  console.log(ret);

  const driveClient = google.drive({ version: 'v3', auth });
  const driveFolderId = await driveIdForDirectory(driveClient, 'We Vote Education');  // This matches the 72 char id, in the url when I browse the Drive
  if (driveFolderId.length === 0) {
    success = false;
    error = 'Unable to find drive folder';
  } else {
    try {
      const pList = await driveClient.permissions.list({
        fileId: driveFolderId,  // <---this is ID of a shared drive, not a file
      });
      console.log(pList);
      const { data: { permissions } } = pList;
      permissions.forEach(async (permission) => {
        // const res = await driveClient.permissions.delete({
        //   fileId: driveFolderId,
        //   permissionId: permission.id,
        // });
        console.log('permission deleted: ', permission);
        // console.log('permission deleted: ', res);
      });


      // console.log(`File sharing removed for ${primaryEmail} (Permission ID: ${res.data.id})`);
      success = true;
    } catch (err) {
      error = `Error sharing file: ${err}`;
      console.error(error);
    }
  }

  return response.json({
    success,
    res: '',
    // driveFolderId,
    error,
  });
};

