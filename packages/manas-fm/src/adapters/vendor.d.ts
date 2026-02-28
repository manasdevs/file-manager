/**
 * Type stubs for optional peer dependencies.
 * These modules are dynamically imported at runtime only when needed.
 */

declare module "@aws-sdk/client-s3" {
  export class S3Client {
    constructor(config: Record<string, unknown>);
    send(command: unknown): Promise<unknown>;
    destroy(): void;
  }
  export class PutObjectCommand {
    constructor(input: Record<string, unknown>);
  }
  export class GetObjectCommand {
    constructor(input: Record<string, unknown>);
  }
  export class DeleteObjectCommand {
    constructor(input: Record<string, unknown>);
  }
  export class CopyObjectCommand {
    constructor(input: Record<string, unknown>);
  }
  export class HeadObjectCommand {
    constructor(input: Record<string, unknown>);
  }
  export class ListObjectsV2Command {
    constructor(input: Record<string, unknown>);
  }
}

declare module "@aws-sdk/lib-storage" {
  export class Upload {
    constructor(params: Record<string, unknown>);
    done(): Promise<unknown>;
  }
}

declare module "@azure/storage-blob" {
  export class BlobServiceClient {
    static fromConnectionString(connectionString: string): BlobServiceClient;
    getContainerClient(containerName: string): unknown;
  }
  export class StorageSharedKeyCredential {
    constructor(accountName: string, accountKey: string);
  }
}

declare module "firebase-admin/storage" {
  export function getStorage(): {
    bucket(name?: string): unknown;
  };
}
