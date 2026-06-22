# Land Finance MCP Server

A Model Context Protocol (MCP) server for the land-finance-app, enabling LLMs like ChatGPT, Claude, and others to interact with the application data and perform operations.

## Features

The MCP server provides tools for:

- **Communities**: List, create, update communities
- **Contracts**: List and create contracts with builders
- **Tranches (Take Downs)**: List and create tranches for contracts
- **Payments**: List and create payment records
- **Cash Flow**: Get cash flow summaries
- **What-If Scenarios**: Calculate projected revenue with different parameters

## Installation

```bash
cd mcp-server
npm install
```

## Configuration

Set the following environment variables:

```bash
export LAND_FINANCE_API_ENDPOINT="http://localhost:4000"  # Your backend API URL
export LAND_FINANCE_API_TOKEN="your-jwt-token"            # Optional: JWT token for authentication
```

Or create a `.env` file:

```
LAND_FINANCE_API_ENDPOINT=http://localhost:4000
LAND_FINANCE_API_TOKEN=your-jwt-token
```

## Usage

### Running the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### Connecting with Claude Desktop

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "land-finance": {
      "command": "node",
      "args": ["/path/to/land-finance-app/mcp-server/src/index.js"],
      "env": {
        "LAND_FINANCE_API_ENDPOINT": "http://localhost:4000",
        "LAND_FINANCE_API_TOKEN": "your-jwt-token"
      }
    }
  }
}
```

### Connecting with ChatGPT

For ChatGPT, you'll need to use an MCP-compatible client or adapter. The server uses stdio transport, which is the standard for local MCP integrations.

## Available Tools

### Communities

- `list_communities` - List all communities
- `get_community` - Get details of a specific community
- `create_community` - Create a new community
- `update_community` - Update an existing community

### Contracts

- `list_contracts` - List all contracts for a community
- `create_contract` - Create a new contract

### Tranches (Take Downs)

- `list_tranches` - List all tranches for a contract
- `create_tranche` - Create a new tranche

### Payments

- `list_payments` - List all payments for a community
- `create_payment` - Create a new payment record

### Cash Flow

- `get_cash_flow` - Get cash flow summary for a community

### What-If Scenarios

- `what_if_revenue` - Calculate projected revenue with different parameters

## Authentication

The server supports JWT token authentication. Set the `LAND_FINANCE_API_TOKEN` environment variable with your JWT token from the land-finance-app. The token will be included in the `Authorization` header for all API requests.

## Example Usage with an LLM

Once connected, you can ask the LLM to:

- "List all communities in the land finance app"
- "Create a new community called 'Oak Ridge' in Austin, TX"
- "Show me all contracts for the Oak Ridge community"
- "Calculate what the revenue would be if I have 50 lots at $2500 per FF with 5% annual escalation over 12 months"
- "Create a payment record for lot purchase of $100,000 due on 2026-09-01"

## Development

The server is built with:
- `@modelcontextprotocol/sdk` - Official MCP SDK
- `zod` - Runtime type validation
- `node-fetch` - HTTP requests

## Testing

```bash
npm test
```

## Troubleshooting

1. **Connection issues**: Ensure your backend API is running and accessible at the configured endpoint
2. **Authentication errors**: Verify your JWT token is valid and not expired
3. **Permission errors**: Ensure the token has the necessary permissions for the requested operations
