declare module 'streamsaver' {
  export interface StreamSaverOptions {
    filename?: string;
  }

  export interface WritableStreamDefaultWriter {
    write(chunk: Uint8Array | Uint8Array[]): Promise<undefined>;
    close(): Promise<undefined>;
    abort(reason?: unknown): Promise<undefined>;
  }

  export interface FileStream {
    getWriter(): WritableStreamDefaultWriter;
  }

  export function createWriteStream(
    filename: string,
    options?: { size?: number }
  ): FileStream;
}
