-- Additive non-destructive column on MediaAsset to support DB_ENCRYPTED stateless Postgres deployments
ALTER TABLE "MediaAsset" ADD COLUMN "encryptedBlob" BLOB;
