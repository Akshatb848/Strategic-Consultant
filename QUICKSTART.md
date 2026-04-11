# ASIS v4.0 Quick Start

1. **Backend Setup**
   ```bash
   cd asis/backend
   npm install
   cp .env.example .env
   # Edit .env: set ANTHROPIC_API_KEY and DATABASE_URL
   npx prisma migrate dev --name asis_v4_foundation
   npx prisma generate
   npm run dev
   # Runs on http://localhost:8000
   ```

2. **Frontend Setup**
   ```bash
   cd asis/frontend
   npm install
   npm run dev
   # Runs on http://localhost:3001
   ```

3. **Access the app**
   Open http://localhost:3001 in your browser.

4. **Database**
   - PostgreSQL 15+ required
   - Create database: `CREATE DATABASE asis_v4;`
   - User: `CREATE USER asis_user WITH PASSWORD 'STRONG_PASSWORD';`
   - Grant: `GRANT ALL PRIVILEGES ON DATABASE asis_v4 TO asis_user;`
