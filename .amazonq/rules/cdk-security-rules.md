# source: https://www.promptz.dev/rules?tags%5B%5D=CDK

# CDK Security and Compliance Rules

## IAM

- Grant only the permissions required for a specific task
- Avoid using wildcard permissions (`*`) in IAM policies
- Use IAM roles instead of access keys for service-to-service authentication
- Configure service roles with appropriate permissions
- Use managed policies when appropriate, but prefer custom policies for more control
- Use temporary credentials instead of long-term access keys
- Implement credential rotation for any long-term credentials
- Set appropriate expiration times for temporary credentials

## Encryption

- Enable encryption for all storage services with service managed keys
- Enforce HTTPS for all external communications
- Use TLS 1.2 or later for all encrypted connections
- Configure security policies for CloudFront distributions