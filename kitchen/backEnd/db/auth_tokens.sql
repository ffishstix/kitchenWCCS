IF OBJECT_ID(N'dbo.auth_tokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.auth_tokens (
        token NVARCHAR(64) NOT NULL PRIMARY KEY,
        expires_at DATETIME2 NOT NULL
    );
    CREATE INDEX IX_auth_tokens_expires_at ON dbo.auth_tokens (expires_at);
END
