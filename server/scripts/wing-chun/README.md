# Wing Chun DynamoDB Module

Seed, query, and manage the **Shaolin Wing Chun** belt-program data in
Amazon DynamoDB using a **single-table design**.

---

## Architecture

| Concept | Implementation |
|---------|---------------|
| **AWS SDK** | v3 (modular `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) |
| **Table Design** | Single-table with composite PK/SK + one GSI (`GSI1`) |
| **Module System** | ESM (`"type": "module"`) |
| **Validation** | Zod schemas (`validate.js`) |
| **Infrastructure** | Terraform (HCL) |
| **Logging** | Structured JSON to stdout |

### Key Design

| Entity | PK | SK | GSI1PK | GSI1SK |
|-------------|------|------|--------|--------|
| Program | `ORG#<orgId>` | `PROG#<progId>` | `PROG#<progId>` | `META` |
| Belt | `PROG#<progId>` | `BELT#<level 0-padded>` | `PROG#<progId>` | `BELT#<level>` |
| Requirement | `PROG#<progId>#BELT#<level>` | `REQ#<ageCategory>` | `PROG#<progId>` | `REQ#<level>#<age>` |
| Curriculum | `PROG#<progId>` | `CURR#<category>#<id>` | `PROG#<progId>` | `CURR#<category>#<id>` |

---

## Quick Start

### 1. Provision the Table (Terraform)

```bash
cd terraform
terraform init
terraform plan -var="environment=dev"
terraform apply -var="environment=dev"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env — set AWS_REGION, credentials, and optional DynamoDB Local endpoint
```

### 4. Validate Data

```bash
npm run validate
```

### 5. Seed the Table

```bash
npm run seed
```

### 6. Query

```bash
# List all belts
npm run query -- belts

# Get requirements for Level 5, Adult
npm run query -- requirements 5 Adult

# Fastest path to Black Belt for a teen
npm run query -- time-to-black Teen

# See all commands
npm run query
```

### 7. Teardown (dev only)

```bash
npm run teardown
```

---

## Using DynamoDB Local

Set `AWS_ENDPOINT_URL` in your `.env`:

```env
AWS_ENDPOINT_URL=http://localhost:8000
```

Start DynamoDB Local via Docker:

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
```

Then create the table with Terraform (using a local provider override) or
via the AWS CLI:

```bash
aws dynamodb create-table \
  --table-name flowapp-wing-chun \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI1PK,AttributeType=S \
    AttributeName=GSI1SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    '[{"IndexName":"GSI1","KeySchema":[{"AttributeName":"GSI1PK","KeyType":"HASH"},{"AttributeName":"GSI1SK","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

---

## Project Structure

```
wing-chun/
├── .env.example          # Environment template
├── package.json          # ESM project, SDK v3 deps
├── README.md
├── src/
│   ├── config.js         # Zod-validated env config
│   ├── data.js           # Pure data (belts, reqs, curriculum)
│   ├── database.js       # SDK v3 DocumentClient singleton
│   ├── logger.js         # Structured JSON logger
│   ├── models.js         # Single-table key factories
│   ├── query.js          # High-level query helpers + CLI
│   ├── schemas.js        # Zod validation schemas
│   ├── seed.js           # BatchWriteItem seeder
│   ├── teardown.js       # Scan-and-delete cleanup
│   └── validate.js       # Data integrity checks
└── terraform/
    ├── main.tf           # DynamoDB table + GSI1
    ├── outputs.tf        # Table ARN, name, stream ARN
    └── variables.tf      # Region, env, table name, etc.
```

---

## Belt Levels

| Level | Belt | Color | Min Months |
|-------|------|-------|-----------|
| LV1 | White | `#FFFFFF` | 2 |
| LV2 | White/Yellow | `#F5F5DC` | 2 |
| LV3 | Yellow | `#FFD700` | 3 |
| LV4 | Orange/White | `#FFA500` | 4 |
| LV5 | Orange | `#FF8C00` | 5 |
| LV6 | Blue | `#4169E1` | 6 |
| LV7 | Purple | `#9370DB` | 8 |
| LV8 | Green | `#228B22` | 10 |
| LV9 | Brown | `#8B4513` | 12 |
| LV10 | Black (1st Dan) | `#000000` | 18 |

---

## License

Internal — FlowApp © 2025
