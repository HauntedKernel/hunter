# FlashStack Database Schema for Share Sessions

This document outlines the database schema required for implementing the FlashStack web link sharing feature in a production environment.

## Core Tables

### 1. `share_sessions` Table

**Purpose**: Stores shareable report sessions with metadata and access controls.

```sql
CREATE TABLE share_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id VARCHAR(50) UNIQUE NOT NULL,
    report_data JSONB NOT NULL,
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('discovery', 'cma', 'rental')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    agent_id UUID REFERENCES agents(id),
    customer_name VARCHAR(255),
    property_address TEXT,
    access_count INTEGER DEFAULT 0,
    max_access INTEGER NULL,
    password_hash VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Indexes
    INDEX idx_share_sessions_share_id (share_id),
    INDEX idx_share_sessions_agent_id (agent_id),
    INDEX idx_share_sessions_created_at (created_at),
    INDEX idx_share_sessions_expires_at (expires_at),
    INDEX idx_share_sessions_active (is_active, expires_at)
);
```

### 2. `share_session_access_logs` Table

**Purpose**: Tracks access attempts and analytics for shared reports.

```sql
CREATE TABLE share_session_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_session_id UUID NOT NULL REFERENCES share_sessions(id) ON DELETE CASCADE,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    access_successful BOOLEAN DEFAULT TRUE,
    failure_reason VARCHAR(100) NULL,
    
    -- Indexes
    INDEX idx_access_logs_session_id (share_session_id),
    INDEX idx_access_logs_accessed_at (accessed_at),
    INDEX idx_access_logs_ip (ip_address)
);
```

### 3. `agents` Table

**Purpose**: Stores agent information for attribution and permissions.

```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    company VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Indexes
    INDEX idx_agents_email (email),
    INDEX idx_agents_active (is_active)
);
```

### 4. `share_session_metadata` Table

**Purpose**: Extended metadata for share sessions that doesn't fit in main table.

```sql
CREATE TABLE share_session_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_session_id UUID NOT NULL REFERENCES share_sessions(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(share_session_id, key),
    
    -- Indexes
    INDEX idx_metadata_session_key (share_session_id, key)
);
```

## Sample Data Structure

### Share Session Record Example

```json
{
  "share_id": "fs_1a2b3c4d_xyz123",
  "report_data": {
    "reportType": "cma",
    "date": "2024-01-15",
    "customerName": "John & Jane Smith",
    "agentName": "Sarah Johnson",
    "agentCompany": "Premier Realty",
    "agentEmail": "sarah@premierrealty.com",
    "agentPhone": "(214) 555-0123",
    "selectedProperties": [
      {
        "address": "123 Main St, Dallas TX",
        "beds": 4,
        "baths": 3,
        "sqft": 2500,
        "price": 495000,
        "pricePerSqFt": 198
      }
    ],
    "priceRecommendation": {
      "low": 465000,
      "recommended": 485000,
      "high": 505000
    },
    "marketStats": {
      "avgDaysOnMarket": 18,
      "saleToListRatio": 98.2,
      "pricePerSqFt": 205
    }
  },
  "report_type": "cma",
  "created_by": "Sarah Johnson",
  "customer_name": "John & Jane Smith",
  "property_address": "456 Oak Avenue, Dallas, TX",
  "expires_at": "2024-02-15T00:00:00Z",
  "max_access": null,
  "password_hash": null
}
```

## API Endpoints

### 1. Create Share Session
```
POST /api/share/sessions
Content-Type: application/json
Authorization: Bearer <agent_token>

{
  "reportData": { ... },
  "expirationDays": 30,
  "maxAccess": null,
  "password": null
}

Response:
{
  "success": true,
  "shareId": "fs_1a2b3c4d_xyz123",
  "shareUrl": "https://app.flashstack.com/share/fs_1a2b3c4d_xyz123",
  "expiresAt": "2024-02-15T00:00:00Z",
  "qrCode": "data:image/png;base64,..."
}
```

### 2. Get Shared Report
```
GET /api/share/sessions/:shareId
Query: ?password=<optional_password>

Response:
{
  "success": true,
  "reportData": { ... },
  "metadata": {
    "propertyAddress": "456 Oak Avenue, Dallas, TX",
    "customerName": "John & Jane Smith",
    "agentInfo": { ... }
  },
  "accessCount": 5
}
```

### 3. List Agent's Share Sessions
```
GET /api/share/sessions
Authorization: Bearer <agent_token>
Query: ?page=1&limit=20&reportType=cma&active=true

Response:
{
  "success": true,
  "sessions": [
    {
      "shareId": "fs_1a2b3c4d_xyz123",
      "reportType": "cma",
      "createdAt": "2024-01-15T10:30:00Z",
      "expiresAt": "2024-02-15T00:00:00Z",
      "accessCount": 5,
      "propertyAddress": "456 Oak Avenue, Dallas, TX",
      "customerName": "John & Jane Smith"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### 4. Delete Share Session
```
DELETE /api/share/sessions/:shareId
Authorization: Bearer <agent_token>

Response:
{
  "success": true,
  "message": "Share session deleted successfully"
}
```

## Security Considerations

### 1. Access Control
- Share IDs should be cryptographically secure and unpredictable
- Optional password protection with bcrypt hashing
- Rate limiting on share access attempts
- Automatic expiration cleanup

### 2. Data Privacy
- GDPR/CCPA compliance for personal data
- Secure deletion of expired sessions
- Audit logging for access attempts
- IP-based access restrictions if needed

### 3. Performance
- Implement caching for frequently accessed reports
- Database connection pooling
- CDN for static report assets
- Pagination for large result sets

## Cleanup Jobs

### 1. Expired Session Cleanup
```sql
-- Run daily to clean up expired sessions
DELETE FROM share_sessions 
WHERE expires_at < NOW() - INTERVAL '7 days';

-- Clean up orphaned access logs
DELETE FROM share_session_access_logs 
WHERE share_session_id NOT IN (SELECT id FROM share_sessions);
```

### 2. Analytics Cleanup
```sql
-- Keep access logs for 90 days for analytics
DELETE FROM share_session_access_logs 
WHERE accessed_at < NOW() - INTERVAL '90 days';
```

## Monitoring & Analytics

### Key Metrics to Track
- Share session creation rate
- Access success/failure rates
- Popular report types
- Average session lifetime
- Geographic access patterns
- Agent usage statistics

### Example Analytics Queries

```sql
-- Most popular report types
SELECT report_type, COUNT(*) as count
FROM share_sessions 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY report_type
ORDER BY count DESC;

-- Agent share activity
SELECT a.name, a.company, COUNT(s.id) as shares_created,
       SUM(s.access_count) as total_accesses
FROM agents a
LEFT JOIN share_sessions s ON a.id = s.agent_id
WHERE s.created_at >= NOW() - INTERVAL '30 days'
GROUP BY a.id, a.name, a.company
ORDER BY shares_created DESC;

-- Access patterns by hour
SELECT EXTRACT(hour FROM accessed_at) as hour,
       COUNT(*) as accesses
FROM share_session_access_logs
WHERE accessed_at >= NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour;
```

## Implementation Checklist

- [ ] Set up PostgreSQL database with proper indexes
- [ ] Implement API endpoints with proper authentication
- [ ] Add rate limiting and security middleware
- [ ] Set up automated cleanup jobs
- [ ] Implement analytics dashboard
- [ ] Add monitoring and alerting
- [ ] Configure CDN for report assets
- [ ] Set up backup and disaster recovery
- [ ] Document API for frontend integration
- [ ] Add comprehensive error handling
- [ ] Implement caching strategy
- [ ] Set up logging and audit trails

## Migration Strategy

When transitioning from localStorage (demo) to production database:

1. Export existing localStorage data
2. Transform data to match new schema
3. Import data into production database
4. Update frontend to use API endpoints
5. Test all functionality thoroughly
6. Deploy with rollback plan
7. Monitor for issues post-deployment

This schema provides a robust foundation for the FlashStack share functionality while maintaining security, performance, and scalability requirements.