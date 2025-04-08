const { GemeenteNijmegenCdkApp } = require('@gemeentenijmegen/projen-project-type');
const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.187.0',
  defaultReleaseBranch: 'main',
  devDeps: ['@gemeentenijmegen/projen-project-type'],
  name: 'geo-storage',
  deps: [
    '@pepperize/cdk-ssm-parameters-cross-region',
    '@gemeentenijmegen/aws-constructs',
    'cdk-remote-stack',
    '@gemeentenijmegen/dnssec-record',
  ],
  scripts: {
    lint: 'cfn-lint cdk.out/**/*.template.json -i W3005 W2001 W3045', // W3045: zie CloudFront logs bucket
  },
});
project.synth();