const tsNode = require('ts-node');

tsNode.register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
});

require('../src/services/transcription.test.ts');
