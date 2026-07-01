// Lambda handler for Land Finance API Server
// This is a Lambda-compatible version of the mcp-server

// Configuration - these will be set via Lambda environment variables
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

// Helper function to create Lambda response
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(body),
  };
}

// Route handler
async function handleRequest(event) {
  const { path, httpMethod, body } = event;
  
  // Parse body if present
  let parsedBody = null;
  if (body) {
    try {
      parsedBody = JSON.parse(body);
    } catch (e) {
      return createResponse(400, { error: 'Invalid JSON body' });
    }
  }

  // Health check
  if (path === '/health' && httpMethod === 'GET') {
    return createResponse(200, { status: 'healthy', server: 'land-finance-api' });
  }

  // OPTIONS for CORS
  if (httpMethod === 'OPTIONS') {
    return createResponse(200, {});
  }

  try {
    // Communities endpoints
    if (path === '/api/communities' && httpMethod === 'GET') {
      const communities = await apiCall('/api/projects');
      return createResponse(200, communities);
    }

    if (path.match(/^\/api\/communities\/[^/]+$/) && httpMethod === 'GET') {
      const id = path.split('/').pop();
      const community = await apiCall(`/api/projects/${id}`);
      return createResponse(200, community);
    }

    if (path === '/api/communities' && httpMethod === 'POST') {
      const { name, location, description } = parsedBody;
      const community = await apiCall('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, location, description }),
      });
      return createResponse(201, community);
    }

    if (path.match(/^\/api\/communities\/[^/]+$/) && httpMethod === 'PUT') {
      const id = path.split('/').pop();
      const { name, location, description } = parsedBody;
      const community = await apiCall(`/api/projects/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, location, description }),
      });
      return createResponse(200, community);
    }

    // Contracts endpoints
    if (path.match(/^\/api\/communities\/[^/]+\/contracts$/) && httpMethod === 'GET') {
      const communityId = path.split('/')[3];
      const contracts = await apiCall(`/api/projects/${communityId}/contracts`);
      return createResponse(200, contracts);
    }

    if (path.match(/^\/api\/communities\/[^/]+\/contracts$/) && httpMethod === 'POST') {
      const communityId = path.split('/')[3];
      const { builder_id, lot_size_label, ff_width, ff_price, total_qty, escalator_rate, escalator_start, em_pct, notes } = parsedBody;
      const contract = await apiCall(`/api/projects/${communityId}/contracts`, {
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
      return createResponse(201, contract);
    }

    // Tranches endpoints
    if (path.match(/^\/api\/contracts\/[^/]+\/tranches$/) && httpMethod === 'GET') {
      const contractId = path.split('/')[3];
      const tranches = await apiCall(`/api/contracts/${contractId}/tranches`);
      return createResponse(200, tranches);
    }

    if (path.match(/^\/api\/contracts\/[^/]+\/tranches$/) && httpMethod === 'POST') {
      const contractId = path.split('/')[3];
      const { tranche_number, scheduled_date, lot_count, additional_escalator_rate } = parsedBody;
      const tranche = await apiCall(`/api/contracts/${contractId}/tranches`, {
        method: 'POST',
        body: JSON.stringify({ tranche_number, scheduled_date, lot_count, additional_escalator_rate }),
      });
      return createResponse(201, tranche);
    }

    // Payments endpoints
    if (path.match(/^\/api\/communities\/[^/]+\/payments$/) && httpMethod === 'GET') {
      const communityId = path.split('/')[3];
      const payments = await apiCall(`/api/projects/${communityId}/payments`);
      return createResponse(200, payments);
    }

    if (path.match(/^\/api\/communities\/[^/]+\/payments$/) && httpMethod === 'POST') {
      const communityId = path.split('/')[3];
      const { contract_id, payment_type, amount_expected, due_date, amount_received, received_date, status, reference_num, notes } = parsedBody;
      const payment = await apiCall(`/api/projects/${communityId}/payments`, {
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
      return createResponse(201, payment);
    }

    // Cash Flow endpoint
    if (path.match(/^\/api\/communities\/[^/]+\/cash-flow$/) && httpMethod === 'GET') {
      const communityId = path.split('/')[3];
      const contracts = await apiCall(`/api/projects/${communityId}/contracts`);
      
      let totalRevenue = 0;
      let totalLots = 0;
      
      for (const contract of contracts) {
        const tranches = await apiCall(`/api/contracts/${contract.id}/tranches`);
        for (const tranche of tranches) {
          totalRevenue += parseFloat(tranche.projected_revenue || 0);
          totalLots += parseInt(tranche.lot_count || 0);
        }
      }
      
      return createResponse(200, {
        community_id: communityId,
        total_contracts: contracts.length,
        total_lots: totalLots,
        total_projected_revenue: totalRevenue,
        contracts: contracts.map(c => ({
          id: c.id,
          builder_id: c.builder_id,
          lot_size_label: c.lot_size_label,
          total_qty: c.total_qty,
        })),
      });
    }

    // What-If Scenario endpoint
    if (path === '/api/what-if/revenue' && httpMethod === 'POST') {
      const { ff_width, ff_price, lot_count, escalator_rate = 0, months = 0 } = parsedBody;
      const basePrice = ff_width * ff_price;
      const adjPrice = basePrice * (1 + (escalator_rate / 12) * months);
      const revenue = adjPrice * lot_count;
      const escalatorLift = (adjPrice - basePrice) * lot_count;
      
      return createResponse(200, {
        parameters: { ff_width, ff_price, lot_count, escalator_rate, months },
        calculations: {
          base_lot_price: basePrice,
          adj_lot_price: adjPrice,
          months_escalated: months,
          projected_revenue: revenue,
          escalator_lift: escalatorLift,
        },
      });
    }

    // Route not found
    return createResponse(404, { error: 'Not found' });

  } catch (error) {
    console.error('Error:', error);
    return createResponse(500, { error: error.message });
  }
}

// Lambda handler
export const handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const response = await handleRequest(event);
  
  console.log('Response:', JSON.stringify(response, null, 2));
  return response;
};
