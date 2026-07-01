#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Configuration - these should be set via environment variables
const API_ENDPOINT = process.env.LAND_FINANCE_API_ENDPOINT || 'http://localhost:4000';
const API_TOKEN = process.env.LAND_FINANCE_API_TOKEN;

// Date helpers (no external deps)
function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day || 1);
}

function monthsBetween(startStr, endStr) {
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
}

function formatMonth(dateStr) {
  return dateStr.split('T')[0].slice(0, 7);
}

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
  'get_community_dashboard',
  'Get a full summary of a community including all contracts and their tranches in a single call. Use this instead of calling get_community + list_contracts + list_tranches separately.',
  {
    community_id: z.string().describe('The UUID of the community'),
  },
  async ({ community_id }) => {
    try {
      const [community, contracts] = await Promise.all([
        apiCall(`/api/projects/${community_id}`),
        apiCall(`/api/projects/${community_id}/contracts`),
      ]);

      const trancheResults = await Promise.all(
        contracts.map(c =>
          apiCall(`/api/contracts/${c.id}/tranches`).then(ts => ({ contract_id: c.id, tranches: ts }))
        )
      );

      const tranchesByContract = Object.fromEntries(trancheResults.map(r => [r.contract_id, r.tranches]));

      const result = {
        ...community,
        contracts: contracts.map(c => ({
          ...c,
          tranches: tranchesByContract[c.id] || [],
        })),
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
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
  'Update/rename a community',
  {
    community_id: z.string().describe('The UUID of the community'),
    name: z.string().describe('New community name'),
    description: z.string().optional().describe('New community description'),
  },
  async ({ community_id, name, description }) => {
    try {
      const community = await apiCall(`/api/projects/${community_id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description }),
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

// ── Builders Tools ─────────────────────────────────────────

server.tool(
  'create_builder',
  'Create a new builder for a community',
  {
    community_id: z.string().describe('The UUID of the community'),
    name: z.string().describe('Builder name'),
    contact_name: z.string().optional().describe('Contact person name'),
    contact_email: z.string().optional().describe('Contact email'),
    contact_phone: z.string().optional().describe('Contact phone'),
    notes: z.string().optional().describe('Additional notes'),
  },
  async ({ community_id, name, contact_name, contact_email, contact_phone, notes }) => {
    try {
      const builder = await apiCall(`/api/projects/${community_id}/builders`, {
        method: 'POST',
        body: JSON.stringify({ name, contact_name, contact_email, contact_phone, notes }),
      });
      return {
        content: [{
          type: 'text',
          text: `Builder created successfully:\n${JSON.stringify(builder, null, 2)}`,
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
    lot_size_label: z.string().describe('Lot size label (e.g., "50ft", "60ft")'),
    ff_width: z.number().describe('Front footage width in feet'),
    ff_price: z.number().describe('Price per front footage'),
    total_qty: z.number().describe('Total quantity of lots'),
    escalator_rate: z.number().optional().describe('Annual escalator rate as decimal (e.g., 0.05 for 5%)'),
    escalator_start: z.string().optional().describe('Escalator start date (YYYY-MM-DD)'),
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

// ── Tranches (Take Downs) Tools ─────────────────────────────

server.tool(
  'list_tranches',
  'List all tranches (take downs) for a specific contract',
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
  'Create a new take down (tranche) for a contract',
  {
    contract_id: z.string().describe('The UUID of the contract'),
    scheduled_date: z.string().describe('Scheduled date for the take down (YYYY-MM-DD)'),
    lot_count: z.number().describe('Number of lots in this take down'),
    additional_escalator_rate: z.number().optional().describe('Additional annual escalator rate as decimal (e.g., 0.03 for 3%), added to the contract escalator'),
    notes: z.string().optional().describe('Additional notes'),
  },
  async ({ contract_id, scheduled_date, lot_count, additional_escalator_rate, notes }) => {
    try {
      const tranche = await apiCall(`/api/contracts/${contract_id}/tranches`, {
        method: 'POST',
        body: JSON.stringify({ scheduled_date, lot_count, additional_escalator_rate, notes }),
      });
      return {
        content: [{
          type: 'text',
          text: `Take down (tranche) created successfully:\n${JSON.stringify(tranche, null, 2)}`,
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
  'update_tranche',
  'Update/rename a tranche (take down)',
  {
    tranche_id: z.string().describe('The UUID of the tranche'),
    scheduled_date: z.string().optional().describe('New scheduled date (YYYY-MM-DD)'),
    lot_count: z.number().optional().describe('New lot count'),
    additional_escalator_rate: z.number().optional().describe('Additional annual escalator rate as decimal (e.g., 0.03 for 3%), added to the contract escalator'),
    notes: z.string().optional().describe('New notes'),
  },
  async ({ tranche_id, scheduled_date, lot_count, additional_escalator_rate, notes }) => {
    try {
      const tranche = await apiCall(`/api/tranches/${tranche_id}`, {
        method: 'PUT',
        body: JSON.stringify({ scheduled_date, lot_count, additional_escalator_rate, notes }),
      });
      return {
        content: [{
          type: 'text',
          text: `Tranche updated successfully:\n${JSON.stringify(tranche, null, 2)}`,
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

// ── Earnest Money & Revenue Chart Tools ─────────────────────

server.tool(
  'list_earnest_money',
  'List all earnest money entries for a contract',
  {
    contract_id: z.string().describe('The UUID of the contract'),
  },
  async ({ contract_id }) => {
    try {
      const entries = await apiCall(`/api/contracts/${contract_id}/earnest-money`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(entries, null, 2),
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
  'create_earnest_money',
  'Record a new earnest money payment for a contract',
  {
    contract_id: z.string().describe('The UUID of the contract'),
    amount: z.number().describe('Earnest money amount'),
    received_date: z.string().describe('Date received (YYYY-MM-DD)'),
    notes: z.string().optional().describe('Optional notes, e.g., payment method or check number'),
  },
  async ({ contract_id, amount, received_date, notes }) => {
    try {
      const entry = await apiCall(`/api/contracts/${contract_id}/earnest-money`, {
        method: 'POST',
        body: JSON.stringify({ amount, received_date, notes: notes || '' }),
      });
      return {
        content: [{
          type: 'text',
          text: `Earnest money recorded successfully:\n${JSON.stringify(entry, null, 2)}`,
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
  'list_tranche_earnest_credits',
  'List earnest money credits applied to a tranche',
  {
    tranche_id: z.string().describe('The UUID of the tranche'),
  },
  async ({ tranche_id }) => {
    try {
      const credits = await apiCall(`/api/tranches/${tranche_id}/earnest-credits`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(credits, null, 2),
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
  'create_tranche_earnest_credit',
  'Apply an earnest money credit to a tranche (take down)',
  {
    tranche_id: z.string().describe('The UUID of the tranche'),
    amount: z.number().describe('Credit amount'),
  },
  async ({ tranche_id, amount }) => {
    try {
      const credit = await apiCall(`/api/tranches/${tranche_id}/earnest-credits`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
      return {
        content: [{
          type: 'text',
          text: `Earnest money credit applied successfully:\n${JSON.stringify(credit, null, 2)}`,
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
  'get_revenue_chart',
  'Get monthly revenue and earnest money for a community using actual tranche and EM data, not contract percentage',
  {
    community_id: z.string().describe('The UUID of the community'),
  },
  async ({ community_id }) => {
    try {
      const contracts = await apiCall(`/api/projects/${community_id}/contracts`);
      const result = {
        community_id,
        months: {},
        contracts: [],
        totals: { revenue: 0, em: 0, lots: 0 },
      };

      for (const contract of contracts) {
        const [tranches, emEntries] = await Promise.all([
          apiCall(`/api/contracts/${contract.id}/tranches`).then(ts => ts.map(t => ({ ...t, contract_id: contract.id }))),
          apiCall(`/api/contracts/${contract.id}/earnest-money`).then(em => em.map(e => ({ ...e, contract_id: contract.id }))),
        ]);

        const creditPromises = tranches.map(t =>
          apiCall(`/api/tranches/${t.id}/earnest-credits`).then(credits => ({ trancheId: t.id, credits }))
        );
        const creditResults = await Promise.all(creditPromises);
        const creditsByTranche = Object.fromEntries(creditResults.map(r => [r.trancheId, r.credits]));

        const byMonth = {};

        for (const tranche of tranches) {
          const basePrice = parseFloat(contract.ff_width) * parseFloat(contract.ff_price);
          const months = monthsBetween(contract.escalator_start, tranche.scheduled_date);
          const adjPrice = basePrice * (1 + (parseFloat(contract.escalator_rate) / 12) * months);
          const revenue = adjPrice * parseInt(tranche.lot_count, 10);
          const credits = creditsByTranche[tranche.id] || [];
          const totalCredit = credits.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
          const netRevenue = revenue - totalCredit;
          const mo = formatMonth(tranche.scheduled_date);

          if (!byMonth[mo]) byMonth[mo] = { revenue: 0, em: 0, lots: 0 };
          byMonth[mo].revenue += netRevenue;
          byMonth[mo].lots += parseInt(tranche.lot_count, 10);

          if (!result.months[mo]) result.months[mo] = { revenue: 0, em: 0, lots: 0 };
          result.months[mo].revenue += netRevenue;
          result.months[mo].lots += parseInt(tranche.lot_count, 10);
          result.totals.revenue += netRevenue;
          result.totals.lots += parseInt(tranche.lot_count, 10);
        }

        for (const em of emEntries) {
          if (!em.received_date) continue;
          const mo = formatMonth(em.received_date);
          const amount = parseFloat(em.amount || 0);

          if (!byMonth[mo]) byMonth[mo] = { revenue: 0, em: 0, lots: 0 };
          byMonth[mo].em += amount;
          byMonth[mo].revenue += amount;

          if (!result.months[mo]) result.months[mo] = { revenue: 0, em: 0, lots: 0 };
          result.months[mo].em += amount;
          result.months[mo].revenue += amount;
          result.totals.em += amount;
          result.totals.revenue += amount;
        }

        result.contracts.push({
          contract_id: contract.id,
          builder_name: contract.builder_name || contract.builder_id,
          lot_size_label: contract.lot_size_label,
          by_month: byMonth,
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
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
