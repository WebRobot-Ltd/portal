# Authentication

WebRobot uses API keys for authentication. All API requests must include a valid API key in the request headers.

## API Key Format

API keys are provided in the format: `<key_id>:<secret>`

## Request Headers

Include your API key in one of the following headers:

### Option 1: X-API-Key (Recommended)

```bash
curl -H "X-API-Key: your-key-id:your-secret" \
  https://api.webrobot.eu/api/projects
```

### Option 2: Authorization Header

```bash
curl -H "Authorization: ApiKey your-key-id:your-secret" \
  https://api.webrobot.eu/api/projects
```

## Getting an API Key

1. Contact your organization administrator
2. Request an API key with appropriate scopes
3. Store your API key securely (never commit to version control)

## Scopes

API keys can have different scopes that determine what operations they can perform:

- `read` - Read-only access
- `write` - Write access
- `admin:*` - Full administrative access
- `etl:*` - ETL pipeline operations
- `ai:agent:access` - AI agent operations

## Security Best Practices

- **Never expose API keys** in client-side code
- **Rotate keys regularly** for security
- **Use environment variables** to store keys
- **Revoke compromised keys** immediately

## Example

```javascript
// Using fetch API
const response = await fetch('https://api.webrobot.eu/api/projects', {
  headers: {
    'X-API-Key': 'your-key-id:your-secret',
    'Content-Type': 'application/json'
  }
});

const projects = await response.json();
```

