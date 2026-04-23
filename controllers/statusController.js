const util = require('util');
const fs = require('node:fs');
const exec = util.promisify(require('child_process').exec);
const { DateTime } = require('luxon');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

exports.getStatus = async (req, res) => {
  const stats = {};
  let hash = '';
  const apiHeaders = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'weconnect-client-build',
  };

  try {
    console.log('Working Directory: ', __dirname);
    hash = fs.readFileSync('./git_commit_hash', 'utf8');
    hash = hash.trim();
    console.log('Hash: ', hash);

    // Use the GitHub REST API instead of scraping HTML — works for all commit types
    const commitResponse = await fetch(`https://api.github.com/repos/wevote/weconnect-server/commits/${hash}`, { headers: apiHeaders });
    if (!commitResponse.ok) {
      throw new Error(`GitHub API returned ${commitResponse.status} for commit ${hash}`);
    }

    const commitData = await commitResponse.json();
    const { sha, html_url: htmlURL, commit: { author: { name, date } } } = commitData;
    console.log('committedDate: ', date, name);
    const committedDate = new Date(date);
    stats.Git_committed_date = committedDate.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
    // Always shows the person who merged as the committer, so skip it, stats.Git_commit_author = name;
    stats.Git_sha = `<a href="${htmlURL}">${sha}</a>`;
  } catch (error) {
    stats.Git_committed_date = 'Not Found';
    // stats.Git_commit_author = 'Not Found';
    stats.Git_sha = 'Not Found';
  }
  // Get associated pull request number
  try {
    const prsResponse = await fetch(`https://api.github.com/repos/wevote/weconnect-server/commits/${hash}/pulls`, { headers: apiHeaders });
    if (prsResponse.ok) {
      const prs = await prsResponse.json();
      if (prs.length > 0) {
        stats.Git_pull_request = `#${prs[0].number}`;
        console.log('Pull_request: ', stats.Git_pull_request);
      } else {
        stats.Pull_request = 'Not Found';
      }
    }
  } catch (err) {
    stats.Pull_request = 'Not Found';
  }

  try {
    stats.node_version = execSync('node --version').toString().trim();
    stats.npm_version = execSync('npm --version').toString().trim();
  } catch (error) {
    console.log('ERROR in getGitValues node/npm: ', error);
    stats.node = 'node not found';
  }

  try {
    const prisma = new PrismaClient();
    const version = await prisma.$queryRaw`SELECT version();`;
    stats.Postgres_version = version[0].version;
  } catch (error) {
    stats.pgVersion = `SELECT version() error: ${error}`;
  }

  stats.host = req.host;

  try {
    const { stdout: uname } = await exec('uname -a ');
    stats.uname = uname.trim();
  } catch (error) {
    try {
      const { stdout } = await exec('ver');
      if (stdout.includes('Microsoft Windows')('Microsoft Windows')) {
        stats.uname = stdout.trim();
        return true;
      }
    } catch (error2) {
      console.log('FastLoad local: uname/ver error');
    }
  }

  return res.json(stats);
};
