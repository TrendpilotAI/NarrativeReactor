const { genkit } = require('genkit');
const firebasePlugin = require('@genkit-ai/firebase');

console.log('--- GENKIT INSTANCE ---');
const ai = genkit({ plugins: [] });
console.log(Object.keys(ai));
console.log('--- PROTOTYPE ---');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(ai)));

console.log('--- FIREBASE REQUIRE ---');
console.log(firebasePlugin);
