# Observability and Monitoring Guide

**Version:** 1.0  
**Last Updated:** 2026-02-17  
**Owner:** Platform Engineering

## Table of Contents

1. [Overview](#overview)
2. [Metrics and Monitoring](#metrics-and-monitoring)
3. [Logging](#logging)
4. [Alerting](#alerting)
5. [Health Checks](#health-checks)
6. [Dashboards](#dashboards)
7. [Incident Response](#incident-response)

---

## Overview

This guide documents the observability infrastructure for the Spring Rate Calculator backend. It covers metrics, logging, alerting, and monitoring practices.

### Observability Stack

**Current:**
- Cloudflare Workers Analytics (built-in)
- Cloudflare Logs (invocation logs)
- Health check endpoint

**Future Enhancements:**
- Custom metrics via Cloudflare Workers Analytics Engine
- Distributed tracing
- User behavior analytics
- Performance monitoring (RUM)

---

## Metrics and Monitoring

### Cloudflare Workers Metrics

**Automatic Metrics** (available in Cloudflare Dashboard):

1. **Request Volume**
   - Requests per second
   - Total requests per time period
   - Requests by status code

2. **Performance**
   - CPU time (P50, P95, P99)
   - Duration (P50, P95, P99)
   - Wall time

3. **Errors**
   - Error rate (%)
   - Error count by type
   - 5xx vs 4xx errors

4. **Success Rate**
   - 2xx status codes
   - Health check success rate

### Custom Metrics (Future)

When backend API is implemented, track:

```typescript
// Example: Custom metrics with Analytics Engine
interface CalculationMetrics {
  operation: 'create' | 'read' | 'update' | 'delete';
  duration: number;
  success: boolean;
  userId?: string;
}

// Log metric
await env.ANALYTICS.writeDataPoint({
  indexes: [operation],
  doubles: [duration],
  blobs: [userId || 'anonymous'],
});
```

**Planned Metrics:**
- CRUD operation latency (per operation type)
- Sync operation success rate
- Conflict resolution frequency
- Database query performance
- Cache hit/miss ratio
- Auth success/failure rate

---

## Logging

### Current Configuration

**wrangler.jsonc:**
```json
{
  "observability": {
    "logs": {
      "enabled": true,
      "invocation_logs": true
    }
  }
}
```

### Log Levels

Use structured logging for better observability:

```typescript
// Good: Structured log with context
console.log(JSON.stringify({
  level: 'info',
  message: 'Calculation created',
  calculationId: id,
  timestamp: new Date().toISOString(),
  duration: 45,
}));

// Avoid: Unstructured string logs
console.log('calculation created');
```

### Log Categories

1. **INFO:** Normal operations
   - Health checks
   - Successful requests
   - Deployment events

2. **WARN:** Potentially problematic
   - Slow queries (>500ms)
   - Retry attempts
   - Deprecated API usage
   - Rate limit approaching

3. **ERROR:** Failures requiring attention
   - Request failures
   - Database errors
   - Unhandled exceptions
   - Auth failures

4. **DEBUG:** Development/troubleshooting
   - Request details
   - Query parameters
   - State changes

### Log Retention

**Cloudflare Workers Logs:**
- Tail logs: Real-time via `wrangler tail`
- Logpush: Historical logs to external service (future)
- Retention: 3 days (built-in)

### Accessing Logs

**Real-time tail:**
```bash
# All requests
wrangler tail

# Filter by status
wrangler tail --status=error

# Filter by method
wrangler tail --method=POST

# Production environment
wrangler tail --env=production
```

**Historical logs:**
```bash
# Via Cloudflare dashboard
# Navigate to: Workers > [your-worker] > Logs

# Future: Export to external log aggregator
# - Cloudflare Logpush → S3/GCS
# - Send to Datadog/New Relic/Grafana
```

---

## Alerting

### Alert Configuration

**Critical Alerts** (page on-call):

| Alert | Condition | Threshold | Action |
|-------|-----------|-----------|--------|
| High Error Rate | Error rate > 1% for 5 minutes | Critical | Page on-call + rollback |
| Health Check Failure | 3 consecutive failures | Critical | Page on-call + investigate |
| Response Time Spike | P95 > 2000ms for 5 minutes | Critical | Page on-call + investigate |
| Service Down | 10+ 5xx errors in 1 minute | Critical | Page on-call + rollback |

**Warning Alerts** (notify team):

| Alert | Condition | Threshold | Action |
|-------|-----------|-----------|--------|
| Elevated Error Rate | Error rate > 0.5% for 10 minutes | Warning | Investigate during business hours |
| Slow Response Time | P95 > 1000ms for 10 minutes | Warning | Monitor and investigate |
| High Traffic | Requests > 1000/min | Info | Monitor for scaling needs |
| Health Check Degraded | 2 consecutive failures | Warning | Investigate |

### Alert Channels

**Delivery Methods:**

1. **PagerDuty** (Critical only)
   - 24/7 on-call rotation
   - Escalation policy
   - Incident tracking

2. **Slack #eng-alerts** (Warning + Critical)
   - Real-time notifications
   - Team visibility
   - Quick response

3. **Email** (Daily digest)
   - Summary of warnings
   - Trend analysis
   - Weekly reports

### Alert Runbooks

Each alert should link to a runbook:

**High Error Rate Runbook:**
1. Check Cloudflare Workers dashboard for error details
2. Tail logs: `wrangler tail --status=error`
3. Identify error pattern (specific endpoint? all requests?)
4. Check recent deployments (within last 4 hours?)
5. If deployment-related: Rollback immediately
6. If external issue: Engage on-call + investigate
7. Update incident channel with findings

**Health Check Failure Runbook:**
1. Verify health check endpoint: `curl https://[domain]/health`
2. Check worker status in Cloudflare dashboard
3. Review recent deployments
4. Check for infrastructure issues (Cloudflare status page)
5. If worker issue: Rollback
6. If infrastructure issue: Monitor and escalate
7. Document in incident log

---

## Health Checks

### Endpoint Specification

**URL:** `GET /health` or `GET /api/health`

**Response (Healthy):**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-17T02:00:00.000Z",
  "version": "0.1.11",
  "checks": {
    "assets": true,
    "database": true
  }
}
```

**Status Codes:**
- `200 OK` - All checks passing
- `503 Service Unavailable` - One or more checks failing

**Response Time SLO:** < 100ms

### Health Check Types

1. **Liveness Check**
   - Is the worker running?
   - Can it respond to requests?
   - Basic functionality works?

2. **Readiness Check** (Future)
   - Is the service ready to handle traffic?
   - Are dependencies available?
   - Is database accessible?

3. **Dependency Checks** (Future)
   ```json
   {
     "status": "healthy",
     "checks": {
       "assets": true,
       "database": true,
       "d1": true,          // Future: D1 database
       "auth": true,        // Future: Auth service
       "cache": true        // Future: KV/Durable Objects
     }
   }
   ```

### Monitoring Health Checks

**Internal Monitoring:**
```bash
# Kubernetes liveness probe (example for future)
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
```

**External Monitoring:**
- Uptime monitoring service (Pingdom, UptimeRobot, etc.)
- Frequency: Every 1 minute
- Locations: Multiple geographic regions
- Alert on: 2+ consecutive failures

---

## Dashboards

### Cloudflare Workers Dashboard

**Built-in Metrics:**
- Navigate to: Workers & Pages > [worker-name] > Metrics
- Time ranges: Last hour, 24 hours, 7 days, 30 days

**Key Graphs:**
1. Requests (per second, total)
2. Success rate (%)
3. Errors (count, rate)
4. Duration (P50, P95, P99)
5. CPU time

### Custom Dashboard (Future)

When backend API is implemented:

**Operations Dashboard:**
- CRUD operation success rate
- Operation latency (by type)
- Active connections
- Queue depth (if applicable)

**User Activity Dashboard:**
- Daily/Monthly active users
- Calculations created per day
- Sync operations per user
- Feature usage

**Performance Dashboard:**
- P50/P95/P99 latencies (per endpoint)
- Error rate by endpoint
- Database query performance
- Cache hit rate

**Business Metrics Dashboard:**
- User growth
- Retention rate
- Feature adoption
- Cost per user

---

## Incident Response

### Incident Workflow

1. **Detection**
   - Alert fires
   - User report
   - Monitoring anomaly

2. **Triage**
   - Assess severity (P0-P3)
   - Assign incident commander
   - Create incident channel
   - Initial investigation

3. **Mitigation**
   - Implement fix or rollback
   - Verify mitigation successful
   - Monitor for stability

4. **Resolution**
   - Confirm issue resolved
   - Update status page
   - Close incident

5. **Post-Mortem**
   - Write incident report
   - Identify root cause
   - Document lessons learned
   - Implement preventive measures

### Monitoring During Incidents

**Focus on these metrics:**
```bash
# Real-time error monitoring
wrangler tail --status=error

# Check error rate
# (via Cloudflare dashboard)

# Health check status
watch -n 5 'curl -s https://[domain]/health | jq'

# Recent deployments
wrangler deployments list
```

**Communication:**
- Update incident channel every 15 minutes
- Post to #engineering channel
- Update status page (if user-facing)
- Notify stakeholders

---

## Future Enhancements

### Planned Additions

1. **Distributed Tracing**
   - OpenTelemetry integration
   - Trace requests across services
   - Identify performance bottlenecks

2. **Real User Monitoring (RUM)**
   - Client-side performance metrics
   - User experience tracking
   - Error tracking in browser

3. **Synthetic Monitoring**
   - Automated user journey tests
   - Multi-region health checks
   - SLA validation

4. **Cost Monitoring**
   - Workers CPU time usage
   - D1 database operations
   - KV read/write operations
   - Alert on unusual cost spikes

5. **Security Monitoring**
   - Failed auth attempts
   - Rate limit violations
   - Suspicious patterns
   - DDoS detection

---

## Configuration Checklist

### Initial Setup

- [x] Observability enabled in wrangler.jsonc
- [x] Health check endpoint implemented
- [ ] Alert channels configured (PagerDuty, Slack)
- [ ] Alert thresholds defined
- [ ] Dashboard bookmarks saved
- [ ] On-call rotation established

### Ongoing Maintenance

- [ ] Review alerts weekly
- [ ] Tune alert thresholds monthly
- [ ] Review dashboards quarterly
- [ ] Update runbooks after incidents
- [ ] Test alerting system quarterly

---

## Resources

### Documentation

- [Cloudflare Workers Analytics](https://developers.cloudflare.com/workers/observability/analytics/)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/)
- [Tail Workers](https://developers.cloudflare.com/workers/observability/tail-workers/)

### Tools

- `wrangler tail` - Real-time log streaming
- Cloudflare Dashboard - Metrics and logs
- PagerDuty - Incident management
- Slack - Team communication

### Support

- **On-call:** PagerDuty escalation
- **Team:** #engineering Slack channel
- **Documentation:** This guide + Cloudflare docs

---

## Document History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-02-17 | 1.0 | Initial version | Platform Engineering |

**Next Review:** 2026-05-17
