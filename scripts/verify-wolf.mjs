const verifyUrl = process.env.VERIFY_URL || 'http://localhost:3000/api/verify/wolf';

async function main() {
  const response = await fetch(verifyUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Expected JSON from ${verifyUrl}, received non-JSON response.`);
  }

  if (!response.ok) {
    throw new Error(`Verification endpoint failed (${response.status}): ${payload.error || 'Unknown error'}`);
  }

  console.log('Wolf chart verification report');
  console.log(`- Source image: ${payload.sourceImage}`);
  console.log(`- Grid: ${payload.params.gridWidth} x ${payload.params.gridHeight}`);
  console.log(`- Palette count: ${payload.paletteCount}`);

  for (const check of payload.checks) {
    const status = check.pass ? 'PASS' : 'FAIL';
    console.log(`- [${status}] ${check.id}: ${check.detail}`);
  }

  if (Array.isArray(payload.qualityWarnings) && payload.qualityWarnings.length > 0) {
    console.log('- Quality warnings:');
    for (const warning of payload.qualityWarnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (Array.isArray(payload.qaFlags) && payload.qaFlags.length > 0) {
    console.log('- QA flags:');
    for (const flag of payload.qaFlags) {
      console.log(`  - ${flag}`);
    }
  }

  if (!payload.overallPass) {
    process.exitCode = 1;
    console.error('Verification failed. Do not push until chart requirements pass.');
    return;
  }

  console.log('Verification passed. Chart requirements are present in output.');
}

main().catch((error) => {
  process.exitCode = 1;
  console.error('Verification failed to run:', error instanceof Error ? error.message : error);
});