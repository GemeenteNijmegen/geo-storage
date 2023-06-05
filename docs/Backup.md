# Backup options

Requirements;
- Total data: 7 TB (7000GB)



## 1 AWS Backup
- Only supports warm storage (not cold)
- Billed per GB-month
- Pricing is 0,06 per GB-month
- Cross-region OUT transfer is 0,02 GB-month

Storage
7000 GB * 0,06 = 420 per month (Too expensive)
1000 GB * 0,06 = 60 per month (other use cases with less data)

Data transfer (corss-region OUT)
7000 GB * 0,02 = 140 (once + for all new data)
1000 GB * 0,02 = 20 (once + for all new data)

- **One time costs:** Transfer $140
- **Additional montly costs:** Backup storage $420

## 2 S3 replication (cross-region replication CRR)

- Versioning must be enabled on source and destination buckets
  - Versioning means no data is removed! Charged for old + new version combined.
- Role must be available to assume when writing to destionation bucket
- The owner of the destination buckets must grant the owner of the source bucket permissions to replicate objects with a bucket policy. For more information, see [Granting permissions when the source and destination buckets are owned by different AWS accounts](https://docs.aws.amazon.com/AmazonS3/latest/userguide/setting-repl-config-perm-overview.html#setting-repl-config-crossacct).
- Setup replication for new object
- For existing objects start a bach operation to transfer all
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/DeleteMarker.html

**Storage normal**
7000 GB * $0.005 = $35 / month
1000 GB * $0.005 = $5 / month

**Storage replication (S3 deep archive glacier)**
7000 GB * $0.0018 = $12,6 / month
1000 GB * $0.0018 = $1,8 / month

**Data transfer cross region and account (Frankfurt -> Ireland)**
7000 GB * $0.02 = $140 (once + for all new data)
1000 GB * $0.02 = $20 (once + for all new data)

**Batch Operation (one time)**
- Job 0,25 per job
- Objects $1 per 1M
- 5 buckets
- Buckets usually less than 1M objects (except 1 which has over 2)

5 buckets * $0,25 per job = 1,25
4 buckets * $1 per 1M objects = $4
1 bucket * 2M+ objects = $3 
total = $8,25

- **One time costs:** Batch Operation $8,25 + Transfer $140  = ~$150
- **Additional montly costs:** Replication storage $12,5
- **Assumptions:**
  - No considerable amount of new data
  - No creation of multiple versions of objects


## Backup acccount
Some considerations:
- For now use the gn-backup account to deploy the backup buckets
- Backup buckets will be defined in this project
- Backup buckets may be moved to workload or ensia ou specific backup accounts.
- Implementing the buckets in this project enables us to move the pipeline to a workload ou build account and a workload ou backup account. 
- gn-build account can later be used as a platform specific build account

## Conclusion
- AWS backup offers better restoring options (point in time)
- AWS backup is less complex to setup compared to S3 replication
- However S3 replication is way cheaper than backup

We'll be going with replication.


## Steps to implementing replication
- Enable versioning on buckets
- Look into deleting objects (delete markers)