/**
 * N2 Stitch MCP — Server Module (Low-level API)
 * 
 * Uses the raw Server class (not McpServer) to enable:
 *   - Dynamic tool discovery with raw JSON Schema passthrough
 *   - Arbitrary argument forwarding without Zod validation
 *   - generate_screen_from_text routed through GenerationTracker
 *   - Virtual tools: generation_status, list_generations
 * 
 * Architecture:
 *   ┌─────────────┐   STDIO/JSON-RPC   ┌──────────────────┐   HTTP + Auth   ┌────────────────┐
 *   │ Antigravity  │ ◄────────────────  │  N2 Stitch MCP   │ ─────────────► │ Stitch API     │
 *   │  (IDE/CLI)   │ ────────────────► │  (proxy server)  │ ◄──────────── │ googleapis.com │
 *   └─────────────┘                    └──────────────────┘                └────────────────┘
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export class StitchMCPServer {
    /**
     * @param {object} config
     * @param {import('./proxy-client.js').ProxyClient} proxyClient
     * @param {import('./generation-tracker.js').GenerationTracker} genTracker
     * @param {object} logger
     */
    constructor(config, proxyClient, genTracker, logger) {
        this.config = config;
        this.proxy = proxyClient;
        this.genTracker = genTracker;
        this.logger = logger;

        // Low-level Server for full control over tool schemas + args
        this.server = new Server(
            { name: 'n2-stitch-mcp', version: '1.0.0' },
            { capabilities: { tools: {} } }
        );

        // Discovered tools from remote Stitch API (raw JSON Schema)
        this._remoteTools = [];
        // Virtual tools defined by this proxy
        this._virtualTools = [];
    }

    /**
     * Discover tools from Stitch API, register handlers, and set up virtual tools.
     */
    async discoverAndRegisterTools() {
        this.logger.info('Discovering tools from remote Stitch API...');

        const resp = await this.proxy.send('tools/list', {});

        if (resp.error) {
            throw new Error(`Stitch API error for tools/list: ${JSON.stringify(resp.error)}`);
        }

        if (!resp.result) {
            throw new Error('Stitch API returned empty result for tools/list');
        }

        this._remoteTools = resp.result.tools || [];
        this.logger.info(`Discovered ${this._remoteTools.length} tools from Stitch API`);

        for (const t of this._remoteTools) {
            this.logger.info(`  → ${t.name}`);
        }

        // Build virtual tools
        this._virtualTools = this._buildVirtualTools();

        // ── Handler: tools/list ──
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [...this._remoteTools, ...this._virtualTools],
            };
        });

        // ── Handler: tools/call ──
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;
            const args = request.params.arguments || {};

            // Route generate_screen_from_text through GenerationTracker
            if (toolName === 'generate_screen_from_text') {
                return this._handleResilientGeneration(args);
            }

            // Route virtual tools
            if (toolName === 'generation_status') {
                return this._handleGenerationStatus(args);
            }
            if (toolName === 'list_generations') {
                return this._handleListGenerations();
            }

            // Forward all other tools directly to Stitch API
            return this._forwardToolCall(toolName, args);
        });

        this.logger.info('Tool handlers registered');
    }

    /**
     * Returns the underlying Server instance (for transport binding).
     */
    getServer() {
        return this.server;
    }

    // ── Virtual tool definitions ──────────────────────────────

    _buildVirtualTools() {
        return [
            {
                name: 'generation_status',
                description: 'Check the status of a screen generation. Returns the current state, elapsed time, and any errors.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        generation_id: {
                            type: 'string',
                            description: 'The generation ID returned when generate_screen_from_text was called',
                        },
                    },
                    required: ['generation_id'],
                },
            },
            {
                name: 'list_generations',
                description: 'List all in-flight and recent screen generations with their status.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
        ];
    }

    // ── Resilient generation handler ──────────────────────────

    async _handleResilientGeneration(args) {
        const { projectId, prompt, deviceType, modelId } = args;

        if (!projectId) {
            return { content: [{ type: 'text', text: 'Error: projectId is required' }], isError: true };
        }
        if (!prompt) {
            return { content: [{ type: 'text', text: 'Error: prompt is required' }], isError: true };
        }

        this.logger.info(`Resilient generation: project=${projectId} prompt="${(prompt || '').slice(0, 80)}"`);

        try {
            const result = await this.genTracker.generate(projectId, prompt, deviceType, modelId);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        } catch (err) {
            return {
                content: [{ type: 'text', text: `Screen generation failed: ${err.message}` }],
                isError: true,
            };
        }
    }

    // ── Virtual tool handlers ─────────────────────────────────

    _handleGenerationStatus(args) {
        const { generation_id } = args;
        if (!generation_id) {
            return { content: [{ type: 'text', text: 'Error: generation_id is required' }], isError: true };
        }

        const info = this.genTracker.getInfo(generation_id);
        if (!info) {
            return { content: [{ type: 'text', text: `Generation "${generation_id}" not found` }], isError: true };
        }

        return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
    }

    _handleListGenerations() {
        const gens = this.genTracker.listAll();
        if (gens.length === 0) {
            return { content: [{ type: 'text', text: 'No generations tracked.' }] };
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    count: gens.length,
                    generations: gens,
                    timestamp: new Date().toISOString(),
                }, null, 2),
            }],
        };
    }

    // ── Tool call forwarding ──────────────────────────────────

    async _forwardToolCall(toolName, args) {
        const jsonRPCReq = {
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name: toolName, arguments: args },
            id: Date.now(),
        };

        if (this.config.debug) {
            this.logger.debug(`Forwarding tool call: ${toolName}`);
        }

        try {
            const respBody = await this.proxy.sendRaw(jsonRPCReq);

            // JSON-RPC error from Stitch
            if (respBody.error) {
                const code = respBody.error.code || -1;
                const msg = respBody.error.message || JSON.stringify(respBody.error);
                return {
                    content: [{ type: 'text', text: `Stitch API error (code ${code}): ${msg}` }],
                    isError: true,
                };
            }

            if (!respBody.result) {
                return {
                    content: [{ type: 'text', text: 'Stitch API returned no result' }],
                    isError: true,
                };
            }

            const result = respBody.result;

            // If it's already a valid CallToolResult with content array — pass through
            if (result.content && Array.isArray(result.content)) {
                return result;
            }

            // Otherwise wrap in text
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        } catch (err) {
            return {
                content: [{ type: 'text', text: `Stitch API request failed: ${err.message}` }],
                isError: true,
            };
        }
    }
}
