const developmentOrigins = ['http://localhost:8000', 'http://127.0.0.1:8000'];

/** Only full origins are accepted; paths, credentials and wildcards cannot become CORS rules. */
export function corsOrigins(nodeEnv: string, raw?: string): string[] {
  const values =
    raw === undefined
      ? nodeEnv === 'production'
        ? []
        : developmentOrigins
      : raw
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
  return [
    ...new Set(
      values.map((value) => {
        let url: URL;
        try {
          url = new URL(value);
        } catch {
          throw new Error('CORS_ORIGINS 包含无效来源');
        }
        if (
          !['http:', 'https:'].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.pathname !== '/' ||
          url.search ||
          url.hash ||
          url.origin !== value
        ) {
          throw new Error(
            'CORS_ORIGINS 必须是逗号分隔的完整来源，不含路径或凭据',
          );
        }
        return url.origin;
      }),
    ),
  ];
}
