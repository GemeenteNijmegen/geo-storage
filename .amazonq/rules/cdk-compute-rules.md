# source: https://www.promptz.dev/rules?tags%5B%5D=CDK

# CDK Construct Development Rules

## Compute

### AWS Lambda Functions
- Separate business logic from infrastructure code.
- Add the function handler code in a file with a `.lambda.ts` suffix.
- Group function handlers in a `functions` folder.
- Configure appropriate memory and timeout settings.
- Use environment variables for configuration.
- Set up appropriate IAM permissions with least privilege.
- Use the latest NodeJs Runtime supported by AWS