const { Prisma, PrismaClient } = require('@prisma/client');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const { DateTime } = require('luxon');

/*
While debugging this feature, you can restore the database to where you were before starting the debug run
We dump the db into a text file in the root of the project
     `pg_dump WeConnectDB > ${file}`
Use pgAdmin 4 to drop the database Servers/WeVoteServer/Databases/WeConnectDB  -- right click on it and choose 'Delete (Force)'
Use pgAdmin 4 to reinitialize an empty database -- Servers/WeVoteServer/Databases  -- right click on it and choose Create/Database and enter 'WeConnectDB' and save.
Select a database dump that was before you started debugging, and should have the full data set
     psql -X -f WeConnectDBdumpfile.2025-05-20T20:03:55.sql WeConnectDB
That's it, your data is restored.
*/


// eslint-disable-next-line no-unused-vars
const prisma = new PrismaClient();

const isLocal = async (req) => {
  try {
    const { stdout } = await exec('ver');
    if (stdout.includes('Microsoft Windows')) {
      console.log(`FastLoad local: is running on ${stdout}`);
      return true;
    }
  } catch (error) {
    console.log('FastLoad local: Not running on Microsoft Windows');
  }
  // Linux ip-10-0-182-109.us-west-2.compute.internal 5.10.235-227.919.amzn2.x86_64 #1 SMP Sat Apr 5 16:59:05 UTC 2025 x86_64 GNU/Linux
  try {
    const { stdout } = await exec('uname -a ');
    if (stdout.startsWith('Linux') || stdout.endsWith('x86_64 GNU/Linux') || stdout.includes('.amzn2.')) {
      console.log('FastLoad local: uname: ', stdout);
      console.error('FastLoad local: Attempted to run localReplaceTable on an AWS instance!');
      return false;
    }
    const isOnSourceOfTruthServer = (process.env.SERVER_IS_SOURCE_OF_TRUTH === true) || (process.env.SERVER_IS_SOURCE_OF_TRUTH === 'true');
    const { host } = req;
    // console.log('req.host: ', stdout);
    const isOnWeVoteMasterURL = host.toLowerCase().includes('wevote.org') || host.toLowerCase().includes('wevote.us');
    if (isOnWeVoteMasterURL || isOnSourceOfTruthServer) {
      console.error('FastLoad local: Attempted to run localReplaceTable on host teamapi.wevote.org!');
      return false;
    }
    if (!host.startsWith('wevotedeveloper.com')) {
      console.log('FastLoad local: req.host: ', stdout);
      console.error('FastLoad local: Attempted to run localReplaceTable on a host other than wevotedeveloper.com!');
      return false;
    }
  } catch (error) {
    console.error('FastLoad local: uname error', error);
    return false;
  }
  return true;
};

function getMostRecentDumpFileCreationTime () {
  const files = fs.readdirSync('./');

  if (files.length > 0) {
    const dumpFiles = [];
    files.forEach((file) => {
      if (file.startsWith('WeConnectDBdumpfile')) {
        dumpFiles.push(file);
      }
    });

    if (dumpFiles.length > 0) {
      const sortedFiles = dumpFiles.map((file) => ({
        name: file,
        time: fs.statSync(`./${file}`).mtime.getTime(),
      })).sort((a, b) => b.time - a.time);
      return new DateTime(sortedFiles[0].time);
    }
  }
  const now = DateTime.now();
  return now.minus({ year: 1 });  // pretend year ago date, so we will do a backup
}

const backupTheDatabase = async () => {
  // Since the db files are backed up one-by-one, we want to run the full WeConnectDB backup less often
  const priorFastLoadDate = await getMostRecentDumpFileCreationTime();
  if (priorFastLoadDate.plus({ minutes: 5 }) < DateTime.now()) {
    let date = DateTime.now().toISO();
    date = date.slice(0, -10);
    const file = `WeConnectDBdumpfile.${date}.sql`;  // example: WeConnectDBdumpfile.2025-05-20T16:27:27.sql
    const command = `pg_dump WeConnectDB > ${file}`;
    console.log('FastLoad local: ', command);
    await exec(command);
    return true;
  }
  return false;
};

const emptyTheTable = async (tableName) => {
  const command = `TRUNCATE TABLE "${tableName}"  RESTART IDENTITY CASCADE;`;
  console.log('FastLoad local: ', command);
  try {
    await prisma.$executeRawUnsafe(command);
    return true;
  } catch (error) {
    console.log('FastLoad local: ', error);
    return false;
  }
};

const fillTheTable = async (tableName, tableJSON) => {
  const outTempFile = `/tmp/${tableName}.tsv`;
  let tableTSV = '';
  let error;
  tableJSON.forEach((element) => {
    // console.log(element);
    // const keys = Object.keys(element);
    const values = Object.values(element);
    let line = '';
    values.forEach((val) => {
      if (val === 'null' || val === null) {
        line += '\\N\t';
      } else if (Array.isArray(val)) {
        let arrayLiteralString = JSON.stringify(val);
        arrayLiteralString = arrayLiteralString.replace('[', '{').replace(']', '}');
        line += `${arrayLiteralString}\t`;
      } else {
        line += `${val}\t`;
      }
    });
    // console.log(line);
    line = line.replace('\n', '');
    line = line.slice(0, -1);
    tableTSV += `${line}\n`;
    // console.log(tableTSV);
  });

  try {
    fs.unlinkSync(outTempFile);
  } catch {
    console.log(`FastLoad local: Did not find ${tableName} so an old copy was not removed.`);
    error = `Did not find ${tableName} so an old copy was not removed.`;
  }
  try {
    fs.writeFileSync(outTempFile, tableTSV);
    const set = 'SET session_replication_role = \'replica\';';
    const sql = `COPY "${tableName}" FROM '${outTempFile}';`;
    const unset = 'SET session_replication_role = \'origin\';';
    await prisma.$queryRawUnsafe(set);
    console.log('FastLoad local: fillTheTable queryRawUnsafe: ', set);
    await prisma.$queryRawUnsafe(sql);
    console.log('FastLoad local: fillTheTable queryRawUnsafe: ', sql);
    await prisma.$queryRawUnsafe(unset);
    console.log('FastLoad local: fillTheTable queryRawUnsafe: ', unset);
  } catch (err) {
    console.error(`FastLoad local: Error in writing ${tableName}: ${err}`);
    error += ` -- Error in writing ${tableName}: ${err}`;
  }
  return error;
};

// Some fields have '\n' in the strings, clean them out.  Ideally we would have never saved strings like this.
const cleanNewLinesOutOfJSON = (tableJSON) => {
  tableJSON.forEach((object) => {
    const keys = Object.keys(object);
    keys.forEach((key) => {
      const value = object[key];
      if (typeof value === 'string' || value instanceof String) {
        // eslint-disable-next-line no-param-reassign
        object[key] = value.replace(/\r?\n/g, '');
      }
    });
  });
};


exports.localReplaceTable = async (req, res) => {
  const isOnSourceOfTruthServer = (process.env.SERVER_IS_SOURCE_OF_TRUTH === true) || (process.env.SERVER_IS_SOURCE_OF_TRUTH === 'true');
  const { host }  = req;
  const isOnWeVoteMasterURL = host.toLowerCase().includes('wevote.org') || host.toLowerCase().includes('wevote.us');
  if (isOnWeVoteMasterURL || isOnSourceOfTruthServer) {
    console.log('localReplaceTable: weconnect-server environment variable SERVER_IS_SOURCE_OF_TRUTH is true, returning null');
    return null;
  }

  const { tablePacket: { tableName, tableJSON } } = req.body;
  console.log('FastLoad local: ReplaceTable for table: ', tableName);
  let success = true;
  let didEmpty = false;
  let error;

  // If localReplaceTable was somehow run successfully on the production server
  // it would wipe out the production database, so being very careful here
  const local = await isLocal(req);
  if (local) {
    await backupTheDatabase();

    if (tableJSON?.length) {
      didEmpty = await emptyTheTable(tableName);
      cleanNewLinesOutOfJSON(tableJSON);
      error = await fillTheTable(tableName, tableJSON);
      // console.log(Prisma.dmmf.datamodel.models[0].fields);
      const table = await Prisma.dmmf.datamodel.models.find((m) => m.name === tableName);
      if (table.fields.some((field) => field.name === 'id')) {
        // Coalesce the ids, so auto increment works on the copied table
        const coalesceSQLCmd =
          `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), coalesce(max(id)+1, 1), false) FROM "${tableName}"`;
        const idsCount = await prisma.$queryRawUnsafe(coalesceSQLCmd);
        const count = idsCount && idsCount.length && idsCount[0] && idsCount[0].setval;
        console.log(`FastLoad local: Coalesce ${tableName} after fillTheTable, ids coalesced: ${count}`);
      }
    } else {
      error = 'Empty table';
    }
  } else {
    success = false;
    error = 'Attempted to run localReplaceTable on an AWS instance!';
  }

  return res.json({
    success,
    error,
    didEmpty,
    isLocal: local,
  });
};
