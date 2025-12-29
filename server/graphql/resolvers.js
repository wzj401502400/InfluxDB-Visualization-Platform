// server/graphql/resolvers.js
// 做成“工厂函数”，把服务依赖注入进来，方便测试/替换
export function makeResolvers({ listBuckets, validateInflux, setSession, clearSession }) {
  return {
    // Query
    hello: () => 'Hello from GraphQL!',
    getBuckets: async (_args, context) => {
      // 从 session 取当前登录的 influx 连接信息
      const sess = context.getSession();
      if (!sess) {
        throw new Error('Unauthorized');
      }
      return await listBuckets(sess); // 返回 [{id,name},...]
    },

    // Mutation
    echo: ({ msg }) => msg,

    login: async ({ url, token }, context) => {
      try {
        const info = await validateInflux({ url, token }); // 探活 + 权限验证
        // 把 url/token 存到会话（只在服务端）
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
