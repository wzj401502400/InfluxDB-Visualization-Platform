// server/graphql/resolvers.js
// Factory function: inject service dependencies for easy testing/replacement
export function makeResolvers({ listBuckets, validateInflux, setSession, clearSession }) {
  return {
    // Query
    hello: () => 'Hello from GraphQL!',
    getBuckets: async (_args, context) => {
      // Get current InfluxDB connection info from session
      const sess = context.getSession();
      if (!sess) {
        throw new Error('Unauthorized');
      }
      return await listBuckets(sess); // Returns [{id,name},...]
    },

    // Mutation
    echo: ({ msg }) => msg,

    login: async ({ url, token }, context) => {
      try {
        const info = await validateInflux({ url, token }); // Probe + permission check
        // Store url/token in session (server-side only)
        setSession(context.res, { influxUrl: url, token });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message || 'Login failed' };
      }
    },

    logout: (_args, context) => {
      clearSession(context.req, context.res);
      return true;
    }
  };
}
