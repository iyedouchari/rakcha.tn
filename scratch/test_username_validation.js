// Scratch test for validateUsername.js
import {
  sanitizeUsernameBody,
  formatFullUsername,
  validateUsernameFormat,
  USERNAME_REGEX,
  USERNAME_BODY_REGEX
} from '../src/utils/validateUsername.js';

console.log('--- Running Username Validation Tests ---');

const testCases = [
  // [input, expectedSanitizedBody, expectedValid, expectedFull]
  ['', '', false, ''],
  ['@', '', false, ''],
  ['@@john', 'john', false, '@john'],
  ['John Doe', 'johndoe', false, '@johndoe'],
  ['john__doe', 'john_doe', true, '@john_doe'],
  ['john___doe__smith', 'john_doesmith', true, '@john_doesmith'],
  ['alex_vance', 'alex_vance', true, '@alex_vance'],
  ['@alex_vance', 'alex_vance', true, '@alex_vance'],
  ['alex_', 'alex_', false, '@alex_'],
  ['_vance', '_vance', false, '@_vance'],
  ['john_doe123', 'john_doe123', true, '@john_doe123'],
  ['123_456', '123_456', true, '@123_456'],
  ['user!@#$%^&*()_+name', 'user_name', true, '@user_name'],
  ['a_b', 'a_b', true, '@a_b'],
  ['iyed_ouchari', 'iyed_ouchari', true, '@iyed_ouchari'],
];

let allPassed = true;

for (const [input, expSanitized, expValid, expFull] of testCases) {
  const sanitized = sanitizeUsernameBody(input);
  const formatted = formatFullUsername(input);
  const validation = validateUsernameFormat(input);

  const passSanitized = sanitized === expSanitized;
  const passValid = validation.isValid === expValid;
  const passFull = formatted === expFull;

  if (!passSanitized || !passValid || !passFull) {
    allPassed = false;
    console.error(`FAIL for input "${input}":`);
    console.error(`  Sanitized: got "${sanitized}", expected "${expSanitized}"`);
    console.error(`  Valid: got ${validation.isValid} (${validation.message}), expected ${expValid}`);
    console.error(`  Full: got "${formatted}", expected "${expFull}"`);
  } else {
    console.log(`PASS: "${input}" -> body: "${sanitized}", full: "${formatted}", valid: ${validation.isValid}, msg: "${validation.message}"`);
  }
}

if (allPassed) {
  console.log('\n>>> ALL TEST CASES PASSED SUCCESSFULLY! <<<');
} else {
  console.error('\n>>> SOME TESTS FAILED! <<<');
  process.exit(1);
}
