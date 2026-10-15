import {sqliteTable,text,primaryKey,index,integer} from 'drizzle-orm/sqlite-core';
export const commentState=sqliteTable('comment_state',{tenant:text('tenant').notNull(),commentId:text('comment_id').notNull(),status:text('status').notNull(),response:text('response').notNull()},t=>[primaryKey({columns:[t.tenant,t.commentId]})]);
export const audit=sqliteTable('audit',{id:text('id').primaryKey(),tenant:text('tenant').notNull(),commentId:text('comment_id').notNull(),action:text('action').notNull(),response:text('response').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_audit_tenant_date').on(t.tenant,t.createdAt)]);
export const manuals=sqliteTable('manuals',{tenant:text('tenant').primaryKey(),content:text('content').notNull()});
export const workspaceOwner=sqliteTable('workspace_owner',{key:text('key').primaryKey(),userId:text('user_id').notNull()});
export const clientSettings=sqliteTable('client_settings',{tenant:text('tenant').primaryKey(),deletedAt:text('deleted_at')});
export const clientGrants=sqliteTable('client_grants',{id:text('id').primaryKey(),tenant:text('tenant').notNull(),label:text('label').notNull(),tokenHash:text('token_hash').notNull(),userId:text('user_id'),createdAt:text('created_at').notNull(),expiresAt:text('expires_at').notNull(),revokedAt:text('revoked_at')},t=>[index('idx_grants_tenant').on(t.tenant),index('idx_grants_hash').on(t.tokenHash)]);
export const metaOauthAttempts=sqliteTable('meta_oauth_attempts',{stateHash:text('state_hash').primaryKey(),browserHash:text('browser_hash').notNull(),expiresAt:integer('expires_at').notNull()});
export const metaConnections=sqliteTable('meta_connections',{id:text('id').primaryKey(),metaUserId:text('meta_user_id').notNull(),displayName:text('display_name').notNull(),tokenCiphertext:text('token_ciphertext').notNull(),expiresAt:integer('expires_at'),connectedAt:integer('connected_at').notNull()});

export const metaAppConfig=sqliteTable('meta_app_config',{id:text('id').primaryKey(),secretCiphertext:text('secret_ciphertext').notNull(),graphVersion:text('graph_version').notNull(),updatedAt:integer('updated_at').notNull()});

export const metaClientData=sqliteTable('meta_client_data',{tenant:text('tenant').primaryKey(),pageId:text('page_id').notNull(),pageName:text('page_name').notNull(),instagramId:text('instagram_id'),instagramUsername:text('instagram_username'),snapshot:text('snapshot'),syncedAt:integer('synced_at')});
