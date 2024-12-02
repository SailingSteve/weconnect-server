const { PrismaClient } = require('@prisma/client');
const bcrypt = require('@node-rs/bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function findUserById (id) {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });
  return user;
}

async function findOneUser (prms) {   // Find one with array
  const user = await prisma.user.findUnique({
    where: prms,
  });
  return user;
}

async function deleteOne (id) {
  await prisma.user.delete({
    where: {
      id,
    },
  });
}

async function saveUser (user) {
  const data = user;
  const updateUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data,
  });
  console.log(updateUser);
}

function isoFutureDate () {
  const today = new Date();
  const oneYearFromNow = new Date(today);
  oneYearFromNow.setFullYear(today.getFullYear() + 1);
  return oneYearFromNow;
}

const userObjTemplate = {
  name: '',
  gender: '',
  location: '',
  email: '',
  website: '',
  picture: '',
  password: '',
  passwordResetToken: '',
  passwordResetExpires: isoFutureDate(),
  emailVerificationToken: '',
  emailVerified: false,

  snapchat: '',
  facebook: '',
  twitter: '',
  google: '',
  github: '',
  linkedin: '',
  steam: '',
  twitch: '',
  quickbooks: '',
  tokens: {},
};

async function createUser (prms) {
  // eslint-disable-next-line prefer-object-spread
  const mergedUser = Object.assign({}, userObjTemplate, prms);
  const user = await prisma.user.create({ data: mergedUser });
  return user;
}

async function comparePassword (user, candidatePassword, cb) {
  try {
    const verified = await bcrypt.verify(candidatePassword, user.password);
    cb(null, verified, user.password);
  } catch (err) {
    cb(err);
  }
}

function gravatar (user, size) {
  if (!size) {
    // eslint-disable-next-line no-param-reassign
    size = 200;
  }
  if (!user.email) {
    return `https://gravatar.com/avatar/00000000000000000000000000000000?s=${size}&d=retro`;
  }
  const md5 = crypto.createHash('md5').update(user.email).digest('hex');
  return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
}


module.exports = {
  comparePassword,
  createUser,
  deleteOne,
  findUserById,
  findOneUser,
  saveUser,
  gravatar,
}; // Export the functions
