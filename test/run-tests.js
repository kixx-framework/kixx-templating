import process from 'node:process';
import expectedErrorCases from './expected-error-cases.js';
import helperCases from './helper-cases.js';


function main() {
    for (const testCase of expectedErrorCases) {
        testCase();
    }

    for (const testCase of helperCases) {
        testCase();
    }
}


try {
    main();
    // eslint-disable-next-line no-console
    console.log('All tests passed');
    process.exit(0);
} catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
}
