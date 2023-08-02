# Geo Storage
This repository contains the infra as code for the buckets that are used by the geo department of Gemeente Nijmegen.


## Replication architecture
An achitecture reference for documentation purposes can be found below. The geo-storage-operator role is managed by AWS SSO. The backup-replication-role is assumed by S3 to perform eighter batch operations or using the replication rule.
![Architecture](./docs/setup.drawio.png)