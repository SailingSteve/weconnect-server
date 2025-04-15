// Calls script that populates the WeConnectDB from a spreadsheet that has been exported as csv
// This is a non-destructive update, it will not overwrite existing teams or persons

/* To find duplicate emailOfficial values (which are very much NOT allowed):
SELECT "emailOfficial", COUNT(*) AS Freq
FROM public."Person"
GROUP BY "emailOfficial"
ORDER BY Freq DESC
*/


const fs = require('fs');
const execSync = require('child_process').execSync;
const validator = require('validator');

exports.updateDbFromCsv = async (request, response) => {
  const csvText = request.body.csv;
  let success = false;
  let error = '';
  let outputString = '';

  const isValidLength = validator.isLength(csvText, {
    min: 800,
    max: 1000000,
  }); // one line to ~1000 lines

  if (isValidLength) {
    const fileName = `${process.env.PATH_FOR_TEMP_FILES}/csv-${Date.now()}.csv`;
    // Asynchronous file creation and writing
    try {
      fs.writeFileSync(fileName, csvText);
    } catch (err) {
      console.error('An error occurred in creating a temp csv file:', err);
      error = err;
    }
    outputString = execSync(`node ./node_scripts/populateSqlFromCsv.js ${fileName}`).toString();
    // console.log(outputString);
    success = true;
    console.log('afterWriteFileSync');
  } else {
    error = 'incoming csv not within size limits';
  }
  return response.json({
    success,
    error,
    outputString,
  });
};
