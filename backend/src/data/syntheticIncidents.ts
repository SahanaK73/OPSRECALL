// SYNTHETIC TEST DATA - invented for demonstration. Not real production incidents.
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const syntheticScenarios = () => [
  {
    key: 'scenario-1',
    label: 'Scenario 1 - Database connection pool exhaustion (to be resolved)',
    incident: {
      title: 'Intermittent payment failures - DB connection timeouts',
      serviceName: 'payment-service',
      severity: 'Critical',
      environment: 'production',
      errorMessage: 'SequelizeConnectionAcquireTimeoutError: Operation timeout - connection pool exhausted (max: 10, in use: 10, waiting: 47)',
      logDetails: [
        '2026-03-02T09:14:02Z ERROR payment-service db: ConnectionAcquireTimeoutError after 30000ms',
        '2026-03-02T09:14:02Z WARN  payment-service pool: pool exhausted max=10 idle=0 waiting=47',
        '2026-03-02T09:14:05Z ERROR payment-service POST /v1/charge 500 - database connection timeout',
        '2026-03-02T09:15:11Z ERROR payment-service POST /v1/charge 500 - connection pool exhausted',
      ].join('\n'),
      symptoms: 'Intermittent payment failures, p99 latency over 30s on /v1/charge, failures come in bursts during peak traffic',
      recentDeployment: 'No deployment in the last 3 days. Traffic up 40% due to a promotion.',
      occurredAt: ago(72),
      isSynthetic: true,
    },
    resolution: {
      actualRootCause: 'Database connection pool was misconfigured: max connections set to 10 in production (a staging value), so bursts of traffic exhausted the pool and requests timed out waiting for a connection.',
      resolutionApplied: 'Corrected the connection pool configuration (max 10 -> 50, acquire timeout 10s, idle timeout 10s) and redeployed the config.',
      verificationResults: 'Verified database connectivity, pool metrics stayed below 60% utilisation under peak load, and payment success rate recovered to 99.9% over 30 minutes.',
      serviceRecovered: true,
      engineerName: 'Synthetic Engineer',
      engineerConfirmed: true,
    },
  },
  {
    key: 'scenario-2',
    label: 'Scenario 2 - Memory-assisted recurrence (similar DB timeouts after deployment)',
    incident: {
      title: 'Payment request failures spike after v2.14 deployment',
      serviceName: 'payment-service',
      severity: 'High',
      environment: 'production',
      errorMessage: 'Error: connection timeout - timeout acquiring database connection (request failed after 30000ms)',
      logDetails: [
        '2026-03-09T14:02:44Z INFO  deploy: payment-service v2.14.0 rolled out (new retry middleware)',
        '2026-03-09T14:10:19Z ERROR payment-service db: connection timeout while acquiring connection',
        '2026-03-09T14:10:21Z ERROR payment-service POST /v1/charge 500 - database timeout',
        '2026-03-09T14:12:03Z WARN  payment-service slow query: SELECT * FROM transactions WHERE ... 4200ms',
      ].join('\n'),
      symptoms: 'Increased payment request failures starting ~8 minutes after deployment; database timeout errors in logs',
      recentDeployment: 'payment-service v2.14.0 deployed 20 minutes ago (adds automatic retries on failed charges).',
      occurredAt: ago(2),
      isSynthetic: true,
    },
  },
  {
    key: 'scenario-3',
    label: 'Scenario 3 - Different incident (HTTP 502, no database evidence)',
    incident: {
      title: 'HTTP 502 errors from API gateway',
      serviceName: 'api-gateway',
      severity: 'High',
      environment: 'production',
      errorMessage: '502 Bad Gateway: upstream service unavailable (upstream: catalog-service:8080, connect() failed (111: Connection refused))',
      logDetails: [
        '2026-03-10T11:30:01Z ERROR api-gateway nginx: connect() failed (111: Connection refused) while connecting to upstream catalog-service:8080',
        '2026-03-10T11:30:01Z ERROR api-gateway GET /v1/products 502 upstream unavailable',
        '2026-03-10T11:30:09Z WARN  api-gateway health check failed for upstream catalog-service (3 consecutive)',
        '2026-03-10T11:30:30Z INFO  api-gateway no database connections used by this component',
      ].join('\n'),
      symptoms: 'HTTP 502 on /v1/products for ~35% of requests; upstream health checks failing; no database errors anywhere',
      recentDeployment: 'catalog-service pods restarted by autoscaler 10 minutes ago.',
      occurredAt: ago(1),
      isSynthetic: true,
    },
  },
];
