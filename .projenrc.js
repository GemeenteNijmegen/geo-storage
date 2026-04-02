const { GemeenteNijmegenCdkApp } = require('@gemeentenijmegen/projen-project-type');
const { GithubCredentials } = require('projen/lib/github');
const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.195.0',
  defaultReleaseBranch: 'main',
  devDeps: [],
  name: 'geo-storage',
  deps: [
    '@gemeentenijmegen/projen-project-type',
    '@gemeentenijmegen/aws-constructs',
    '@gemeentenijmegen/cross-region-parameters',
    '@gemeentenijmegen/dnssec-record',
    '@aws-sdk/client-kms',
    '@aws-sdk/client-s3',
  ],
  scripts: {
    lint: 'cfn-lint cdk.out/**/*.template.json -i W3005 W2001 W3045', // W3045: zie CloudFront logs bucket
  },
  githubOptions: {
    projenCredentials: GithubCredentials.fromApp({
      appIdSecret: 'PROJEN_APP_ID',
      privateKeySecret: 'PROJEN_APP_PRIVATE_KEY',
    }),
  },
});
project.synth();