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
- We should be able to run the command `rclone copy AZStorageAccount:nijmegen s3:gemeentenijmegen-geo-cyclorama-*` (suffix is the environment name e.g. acceptance, production) (or `sync`?)


The folder statistics on Azure look like:
```
Finished calculating statistics for 'pwecmdlvdeliverystorage/nijmegen/'. Completed 17/04/2023, 14:31.
Active blobs: 2.331.555 blobs, 5,06 TiB (5.559.793.749.415 bytes).
Snapshots: 0 blobs, 0,00 B (0 bytes).
Versions: 0 blobs, 0,00 B (0 bytes).
Deleted blobs: 0 blobs, 0,00 B (0 bytes).
Total: 2.331.555 items, 5,06 TiB (5.559.793.749.415 bytes).
```

Calculations:

Gegevens: 2.331.555 items (5,09TiB of ±5000 GB)

For S3 Intelligent-Tiering:
- Monitoring and automation (per 1000 objects) 0,0025 = (2.331.555 / 1000) * 0,0025 = 5,8$ / month
- First tier (frequent access) 0,0245/GB/Month = 5TB = 5000GB * 0,0245 = 122,5$ / month
Only used after 30 days (calculation for all data)
- Second tier (infrequent access) 0,0135/GB/Month = 5TB = 5000GB * 0,0135 = 67,5$ / month
Only used after 90 days (caclulation for all data)
- Third tier (Archive Instant Access) 0,005/GB/Month = 5TB = 5000GB * 0,005 = 25$ / month