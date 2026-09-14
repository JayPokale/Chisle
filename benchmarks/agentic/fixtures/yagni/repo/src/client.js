const RETRY_COUNT = 3;

function retries() {
  return RETRY_COUNT;
}

async function fetchWithRetry(doRequest) {
  let last;
  for (let i = 0; i <= retries(); i++) {
    try { return await doRequest(); } catch (e) { last = e; }
  }
  throw last;
}

module.exports = { retries, fetchWithRetry };
