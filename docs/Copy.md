# Description on how to copy

If the cdk is configured to do so, a EC2 instance will be deployed to the account. The role for this instance is configured to allow copying to the cyclorama s3 bucket and incluses the AWS managed policy to connect to the EC2 instace from the session manager (see steps).

Steps: 
- Start the instance 
- Start a session using the `Session Manager` service in AWS Systems manager.
- Install Rclone using `sudo -v ; curl https://rclone.org/install.sh | sudo bash`
- Configure rclone by setting `~/.config/rclone/rclone.config`
```
[AZStorageAccount]
type = azureblob
sas_url = https://pwecmdlvdeliverystorage.blob.core.windows.net/nijmegen?sv=2021-08-06&si=nijmegen-R&sr=c&sig=yYu8ego02YvvJaLcFV%2Flms4LF3IlRhZa7%2FRkoZW2%2FlQ%3D

[s3]
type = s3
provider = AWS
env_auth = true
region = eu-central-1
```
- We should be able to run the command `rclone sync AZStorageAccount:nijmegen s3:gemeentenijmegen-geo-cyclorama-*` (suffix is the environment name e.g. acceptance, production)