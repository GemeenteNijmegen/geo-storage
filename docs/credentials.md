# Credentials aanmaken

Primair maken we gebruik van AWS SSO voor toegang tot de buckets. Dit is geregeld via de Nijmegen AD om toegangsrechten beheer via de servicedesk te laten lopen. 
Voor sommige applicaties (koppeling naar ander partijen of met applicaties) worden alleen AWS secret en access keys ondersteund.

## Aanmaken nieuwe credentials
We kunnen in CDK een nieuwe IAM user aanmaken en hier credentials voor aanmaken.
Zie het voorbeeld hieronder. De access key kan in de IAM console worden gevonden, de secret key wordt in een new secretsmanager secret opgeslagen.

Note: buckets waar toegang toe gegeven moeten worden zijn te vinden in de StorageStack. Hier kan je ook de user en credentials aanmaken.

```js
function setupThirdPartyAccessUser() {
  const user = new iam.User(this, 'third-party-user');
  const key = new iam.AccessKey(this, 'third-part-user-key', {
    user: user,
  });
  new Secret(this, 'third-party-user-secret', {
    secretStringValue: key.secretAccessKey,
  });

  // Allow to view a list buckets in AWS account
  user.addToPolicy(new iam.PolicyStatement({
    sid: 'AllowToListTheBucketsInTheAccount',
    effect: iam.Effect.ALLOW,
    actions: ['s3:ListAllMyBuckets'],
    resources: ['*'],
  }));

  return user;
}
```

Vervolgens kan deze user met de credentials toegang verleend worden tot verschillende buckets.

```js
bucket.grantRead(user);
```