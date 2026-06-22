#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Configuration - these should be set via environment variables
const API_ENDPOINT = process.env.LAND_FINANCE_API_ENDPOINT || 'http://localhost:4000';
const API_TOKEN = process.env.LAND_FINANCE_API_TOKEN;

// Helper function to make authenticated API calls
async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_ENDPOINT}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API error: ${response.status}`);
  }

  return response.json();
}

// Create MCP server
const server = new McpServer({
  name: 'land-finance-app',
  version: '1.0.0',
});

// ── Communities Tools ───────────────────────────────────────

server.tool(
  'list_communities',
  'List all communities in the land finance application',
  {},
  async () => {
    try {
      const communities = await apiCall('/api/projects');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(communities, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

server.tool(
  'get_community',
  'Get details of a specific community by ID',
  {
    community_id: z.string().describe('The UUID of the community'),
  },
  async ({ community_id }) => {
    try {
      const community = await apiCall(`/api/projects/${community_id}`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(community, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

server.tool(
  'create_community',
  'Create a new community',
  {
    name: z.string().describe('Community name'),
    location: z.string().optional().describe('Community location'),
    description: z.string().optional().describe('Community description'),
  },
  async ({ name, location, description }) => {
    try {
      const community = await apiCall('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, location, description }),
      });
      return {
        content: [{
          type: 'text',
          text: `Community created successfully:\n${JSON.stringify(community, null, 2)}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

server.tool(
  'update_community',
  'Update an existing community',
  {
    community_id: z.string().describe('The UUID of the community'),
    name: z.string().optional().describe('Updated community name'),
    location: z.string().optional().describe('Updated community location'),
    description: z.string().optional().describe('Updated community description'),
  },
  async ({ community_id, name, location, description }) => {
    try {
      const community = await apiCall(`/api/projects/${community_id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, location, description }),
      });
      return {
        content: [{
          type: 'text',
          text: `Community updated successfully:\n${JSON.stringify(community, null, 2)}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

// ── Contracts Tools ─────────────────────────────────────────

server.tool(
  'list_contracts',
  'List all contracts for a specific community',
  {
    community_id: z.string().describe('The UUID of the community'),
  },
  async ({ community_id }) => {
    try {
      const contracts = await apiCall(`/api/projects/${community_id}/contracts`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(contracts, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

server.tool(
  'create_contract',
  'Create a new contract for a community',
  {
    community_id: z.string().describe('The UUID of the community'),
    builder_id: z.string().describe('The UUID of the builder'),
    lot_size_label: z.string().describe('Lot size label, e.g., "60s"'),
    ff_width: z.number().describe('Front footage width in feet'),
    ff_price: z.number().describe('Price per front footage'),
    total_qty: z.number().describe('Total quantity of lots'),
    escalator_rate: z.number().optional().describe('Annual escalator rate as decimal (e.g., 0.05 for 5%)'),
    escalator_start: z.string().optional().describe('Escalator start date in YYYY-MM-DD format'),
    em_pct: z.number().optional().describe('Earnest money percentage as decimal (e.g., 0.10 for 10%)'),
    notes: z.string().optional().describe('Additional notes'),
  },
  async ({ community_id, builder_id, lot_size_label, ff_width, ff_price, total_qty, escalator_rate, escalator_start, em_pct, notes }) => {
    try {
      const contract = await apiCall(`/api/projects/${community_id}/contracts`, {
        method: 'POST',
        body: JSON.stringify({
          builder_id,
          lot_size_label,
          ff_width,
          ff_price,
          total_qty,
          escalator_rate: escalator_rate || 0,
          escalator_start: escalator_start || '2027-01-01',
          em_pct: em_pct || 0.10,
          notes: notes || '',
        }),
      });
      return {
        content: [{
          type: 'text',
          text: `Contract created successfully:\n${JSON.stringify(contract, null, 2)}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

// ── Tranches (Take Downs) Tools ──────────────────────────────

server.tool(
  'list_tranches',
  'List all tranches (take downs) for a contract',
  {
    contract_id: z.string().describe('The UUID of the contract'),
  },
  async ({ contract_id }) => {
    try {
      const tranches = await apiCall(`/api/contracts/${contract_id}/tranches`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(tranches, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

server.tool(
  'create_tranche',
  'Create a new tranche (take down) for a contract',
  {
    contract_id: z.string().describe('The UUID of the contract'),
    tranche_number: z.number().describe('Tranche number'),
    scheduled_date: z.string().describe('Scheduled date in YYYY-MM-DD format'),
    lot_count: z.number().describe('Number of lots in this tranche'),
  },
  async ({ contract_id, tranche_number, scheduled_date, lot_count }) => {
    try {
      const tranche = await apiCall(`/api/contracts/${contract_id}/tranches`, {
        method: 'POST',
        body: JSON.stringify({ tranche_number, scheduled_date, lot_count }),
      });
      return {
        content: [{
          type: 'text',
          text: `Tranche created successfully:\n${JSON.stringify(tranche, null, 2)}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

// ── Payments Tools ─────────────────────────────────────────

server.tool(
  'list_payments',
  'List all payments for a community',
  {
    community_id: z.string().describe('The UUID of the community'),
  },
  async ({ community_id }) => {
    try {
      const payments = await apiCall(`/api/projects/${community_id}/payments`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(payments, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

server.tool(
  'create_payment',
  'Create a new payment record',
  {
    community_id: z.string().describe('The UUID of the community'),
    contract_id: z.string().describe('The UUID of the contract'),
    payment_type: z.enum(['earnest_money', 'lot_purchase', 'other']).describe('Type of payment'),
    amount_expected: z.number().describe('Expected amount'),
    due_date: z.string().describe('Due date in YYYY-MM-DD format'),
    amount_received: z.number().optional().describe('Received amount'),
    received_date: z.string().optional().describe('Received date in YYYY-MM-DD format'),
    status: z.enum(['pending', 'partial', 'paid', 'overdue']).optional().describe('Payment status'),
    reference_num: z.string().optional().describe('Reference number'),
    notes: z.string().optional().describe('Additional notes'),
  },
  async ({ community_id, contract_id, payment_type, amount_expected, due_date, amount_received, received_date, status, reference_num, notes }) => {
    try {
      const payment = await apiCall(`/api/projects/${community_id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          contract_id,
          payment_type,
          amount_expected,
          due_date,
          amount_received: amount_received || 0,
          received_date: received_date || null,
          status: status || 'pending',
          reference_num: reference_num || null,
          notes: notes || null,
        }),
      });
      return {
        content: [{
          type: 'text',
          text: `Payment created successfully:\n${JSON.stringify(payment, null, 2)}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

// ── Cash Flow Tools ─────────────────────────────────────────

server.tool(
  'get_cash_flow',
  'Get cash flow summary for a community',
  {
    community_id: z.string().describe('The UUID of the community'),
  },
  async ({ community_id }) => {
    try {
      // This would typically call a cash flow endpoint if available
      // For now, we'll fetch contracts and tranches to calculate
      const contracts = await apiCall(`/api/projects/${community_id}/contracts`);
      
      let totalRevenue = 0;
      let totalLots = 0;
      
      for (const contract of contracts) {
        const tranches = await apiCall(`/api/contracts/${contract.id}/tranches`);
        for (const tranche of tranches) {
          totalRevenue += parseFloat(tranche.projected_revenue || 0);
          totalLots += parseInt(tranche.lot_count || 0);
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            community_id,
            total_contracts: contracts.length,
            total_lots: totalLots,
            total_projected_revenue: totalRevenue,
            contracts: contracts.map(c => ({
              id: c.id,
              builder_id: c.builder_id,
              lot_size_label: c.lot_size_label,
              total_qty: c.total_qty,
            })),
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

// ── What-If Scenario Tools ─────────────────────────────────

server.tool(
  'what_if_revenue',
  'Calculate projected revenue with different parameters',
  {
    ff_width: z.number().describe('Front footage width in feet'),
    ff_price: z.number().describe('Price per front footage'),
    lot_count: z.number().describe('Number of lots'),
    escalator_rate: z.number().optional().describe('Annual escalator rate as decimal (e.g., 0.05 for 5%)'),
    months: z.number().optional().describe('Number of months for escalation calculation'),
  },
  async ({ ff_width, ff_price, lot_count, escalator_rate = 0, months = 0 }) => {
    try {
      const basePrice = ff_width * ff_price;
      const adjPrice = basePrice * (1 + (escalator_rate / 12) * months);
      const revenue = adjPrice * lot_count;
      const escalatorLift = (adjPrice - basePrice) * lot_count;
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            parameters: { ff_width, ff_price, lot_count, escalator_rate, months },
            calculations: {
              base_lot_price: basePrice,
              adj_lot_price: adjPrice,
              months_escalated: months,
              projected_revenue: revenue,
              escalator_lift: escalatorLift,
            },
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`,
        }],
        isError: true,
      };
    }
  }
);

// ── Start Server ───────────────────────────────────────────

async function main() {
  console.error('Starting Land Finance MCP Server...');
  console.error(`API Endpoint: ${API_ENDPOINT}`);
  console.error(`API Token: ${API_TOKEN ? 'Set' : 'Not set'}`);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Land Finance MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
