-- Zero/App tables
CREATE TABLE "user" (
  "id" VARCHAR PRIMARY KEY,
  "name" VARCHAR NOT NULL,
  "partner" BOOLEAN NOT NULL
);

CREATE TABLE "medium" (
  "id" VARCHAR PRIMARY KEY,
  "name" VARCHAR NOT NULL
);

CREATE TABLE "message" (
  "id" VARCHAR PRIMARY KEY,
  "sender_id" VARCHAR REFERENCES "user"(id),
  "medium_id" VARCHAR REFERENCES "medium"(id),
  "body" VARCHAR NOT NULL,
  "labels" VARCHAR[] NOT NULL,
  "timestamp" TIMESTAMP not null
);

-- Better Auth tables (prefixed with auth_)
CREATE TABLE "auth_user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "email_verified" BOOLEAN DEFAULT false NOT NULL,
  "image" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "auth_session" (
  "id" TEXT PRIMARY KEY,
  "expires_at" TIMESTAMP NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL REFERENCES "auth_user"(id) ON DELETE CASCADE
);
CREATE INDEX "auth_session_userId_idx" ON "auth_session"("user_id");

CREATE TABLE "auth_account" (
  "id" TEXT PRIMARY KEY,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "auth_user"(id) ON DELETE CASCADE,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TIMESTAMP,
  "refresh_token_expires_at" TIMESTAMP,
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX "auth_account_userId_idx" ON "auth_account"("user_id");

CREATE TABLE "auth_verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification"("identifier");

-- Seed data for Zero/App
INSERT INTO "user" (id, name, partner) VALUES ('ycD76wW4R2', 'Aaron', true);
INSERT INTO "user" (id, name, partner) VALUES ('IoQSaxeVO5', 'Matt', true);
INSERT INTO "user" (id, name, partner) VALUES ('WndZWmGkO4', 'Cesar', true);
INSERT INTO "user" (id, name, partner) VALUES ('ENzoNm7g4E', 'Erik', true);
INSERT INTO "user" (id, name, partner) VALUES ('dLKecN3ntd', 'Greg', true);
INSERT INTO "user" (id, name, partner) VALUES ('enVvyDlBul', 'Darick', true);
INSERT INTO "user" (id, name, partner) VALUES ('9ogaDuDNFx', 'Alex', true);
INSERT INTO "user" (id, name, partner) VALUES ('6z7dkeVLNm', 'Dax', false);
INSERT INTO "user" (id, name, partner) VALUES ('7VoEoJWEwn', 'Nate', false);

INSERT INTO "medium" (id, name) VALUES ('G14bSFuNDq', 'Discord');
INSERT INTO "medium" (id, name) VALUES ('b7rqt_8w_H', 'Twitter DM');
INSERT INTO "medium" (id, name) VALUES ('0HzSMcee_H', 'Tweet reply to unrelated thread');
INSERT INTO "medium" (id, name) VALUES ('ttx7NCmyac', 'SMS');
