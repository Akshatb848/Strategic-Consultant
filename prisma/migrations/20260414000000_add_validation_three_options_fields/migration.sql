-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'enterprise',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#6366f1',
    "maxUsers" INTEGER NOT NULL DEFAULT 50,
    "maxAnalyses" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "organisation" TEXT NOT NULL DEFAULT '',
    "organisationId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Analyst',
    "avatarInitials" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "googleId" TEXT,
    "githubId" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'email',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "analysisCount" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organisationId" TEXT,
    "problemStatement" TEXT NOT NULL,
    "organisationContext" TEXT NOT NULL DEFAULT '',
    "industryContext" TEXT NOT NULL DEFAULT '',
    "geographyContext" TEXT NOT NULL DEFAULT '',
    "decisionType" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pipelineVersion" TEXT NOT NULL DEFAULT '4.0.0',
    "currentAgent" TEXT,
    "agentsCompleted" INTEGER NOT NULL DEFAULT 0,
    "agentsTotal" INTEGER NOT NULL DEFAULT 8,
    "durationSeconds" REAL,
    "overallConfidence" REAL,
    "decisionRecommendation" TEXT,
    "boardNarrative" TEXT,
    "executiveSummary" TEXT,
    "topStrategicRisk" TEXT,
    "recommendedInvestment" TEXT,
    "validationWarnings" TEXT,
    "hasBlockingWarnings" BOOLEAN NOT NULL DEFAULT false,
    "userAcknowledgedWarnings" BOOLEAN NOT NULL DEFAULT false,
    "strategistData" TEXT,
    "quantData" TEXT,
    "marketIntelData" TEXT,
    "riskData" TEXT,
    "redTeamData" TEXT,
    "ethicistData" TEXT,
    "synthesisData" TEXT,
    "coveVerificationData" TEXT,
    "logicConsistencyPassed" BOOLEAN,
    "redTeamChallengeCount" INTEGER NOT NULL DEFAULT 0,
    "fatalInvalidationCount" INTEGER NOT NULL DEFAULT 0,
    "majorInvalidationCount" INTEGER NOT NULL DEFAULT 0,
    "recommendationDowngraded" BOOLEAN NOT NULL DEFAULT false,
    "originalRecommendation" TEXT,
    "selfCorrectionCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceBreakdown" TEXT,
    "threeOptionsData" TEXT,
    "buildVsBuyVerdict" TEXT,
    "recommendedOption" TEXT,
    "pdfUrl" TEXT,
    "reportVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Analysis_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "durationMs" INTEGER,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "confidenceScore" REAL,
    "selfCorrected" BOOLEAN NOT NULL DEFAULT false,
    "correctionReason" TEXT,
    "rawPrompt" TEXT,
    "rawOutput" TEXT,
    "parsedOutput" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentLog_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_name_key" ON "Organisation"("name");

-- CreateIndex
CREATE INDEX "Organisation_domain_idx" ON "Organisation"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_githubId_idx" ON "User"("githubId");

-- CreateIndex
CREATE INDEX "User_organisationId_idx" ON "User"("organisationId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Analysis_userId_idx" ON "Analysis"("userId");

-- CreateIndex
CREATE INDEX "Analysis_organisationId_idx" ON "Analysis"("organisationId");

-- CreateIndex
CREATE INDEX "Analysis_status_idx" ON "Analysis"("status");

-- CreateIndex
CREATE INDEX "Analysis_createdAt_idx" ON "Analysis"("createdAt");

-- CreateIndex
CREATE INDEX "AgentLog_analysisId_idx" ON "AgentLog"("analysisId");

-- CreateIndex
CREATE INDEX "AgentLog_agentId_idx" ON "AgentLog"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

